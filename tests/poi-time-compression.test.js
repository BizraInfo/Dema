import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  planPoiTimeCompression,
  buildPoiTimeCompressionPayload,
  verifyPoiTimeCompression,
  runPoiTimeCompression,
  POI_TIME_COMPRESSION_SCHEMA,
  POI_TIME_COMPRESSION_TRUTH_LABEL,
  POI_TIME_COMPRESSION_GO_PHRASE,
} from "../packages/core/src/poi-time-compression.js";
import { runPoiTimeCompressionCheck } from "../scripts/review/poi-time-compression-check.mjs";

// POI-TIME-COMPRESSION-1A proof contract. The canonical fixture is the
// 6-week-estimate-to-5-hour-proof-loop case: 240 declared baseline hours over
// 5 declared actual hours = 48x CANDIDATE compression, valid only because every
// required quality gate passed. Baselines are declared reference-class
// assumptions, never measured facts; observation-time is a separate clock.

function fixtureInput(overrides = {}) {
  return {
    task_id: "fixture-scoped-slice",
    task_name: "Scoped feature slice under agentic proof loop",
    baseline: {
      duration_hours: 240,
      source: "model_estimate",
      reference_class: "human_only_team",
    },
    actual: {
      duration_hours: 5,
      operating_mode: "ai_agent_proof_loop",
    },
    quality_gates: {
      required: ["npm_test", "npm_run_check", "llm_guidance"],
      passed: ["npm_test", "npm_run_check", "llm_guidance"],
    },
    observation_required: true,
    ...overrides,
  };
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

function recomputeHash(body) {
  return `sha256:${createHash("sha256").update(stableStringify(body), "utf8").digest("hex")}`;
}

test("plan is fail-closed without the exact consent phrase", () => {
  const plan = planPoiTimeCompression({ consent: "wrong", input: fixtureInput() });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("consent_phrase_mismatch"));
});

test("plan is eligible with exact consent and well-formed input", () => {
  const plan = planPoiTimeCompression({ consent: POI_TIME_COMPRESSION_GO_PHRASE, input: fixtureInput() });
  assert.equal(plan.eligible, true, plan.blocked_by.join(", "));
});

test("plan rejects non-positive actual hours", () => {
  const plan = planPoiTimeCompression({
    consent: POI_TIME_COMPRESSION_GO_PHRASE,
    input: fixtureInput({ actual: { duration_hours: 0, operating_mode: "ai_agent_proof_loop" } }),
  });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("actual_hours_not_positive"));
});

test("plan rejects a missing baseline source and reference class", () => {
  const plan = planPoiTimeCompression({
    consent: POI_TIME_COMPRESSION_GO_PHRASE,
    input: fixtureInput({ baseline: { duration_hours: 240 } }),
  });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("baseline_source_invalid"));
  assert.ok(plan.blocked_by.includes("baseline_reference_class_missing"));
});

test("a failed required quality gate refuses the compression receipt entirely", () => {
  const plan = planPoiTimeCompression({
    consent: POI_TIME_COMPRESSION_GO_PHRASE,
    input: fixtureInput({
      quality_gates: {
        required: ["npm_test", "npm_run_check"],
        passed: ["npm_run_check"],
      },
    }),
  });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("quality_gate_failed:npm_test"));
});

test("240 baseline hours over 5 actual hours computes a 48x candidate ratio", () => {
  const payload = buildPoiTimeCompressionPayload(fixtureInput());
  assert.equal(payload.compression.ratio, 48);
  assert.equal(payload.compression.claim_status, "CANDIDATE_NOT_INDEPENDENTLY_REVIEWED");
  assert.equal(payload.baseline.status, "DECLARED_REFERENCE_CLASS_ASSUMPTION_NOT_MEASURED");
});

test("observation_required separates build proof from life proof", () => {
  const lifePending = buildPoiTimeCompressionPayload(fixtureInput({ observation_required: true }));
  assert.equal(lifePending.clocks.life_proof_status, "PENDING_REAL_OBSERVATION");
  const buildOnly = buildPoiTimeCompressionPayload(fixtureInput({ observation_required: false }));
  assert.equal(buildOnly.clocks.life_proof_status, "NOT_REQUIRED_FOR_THIS_TASK");
  assert.equal(buildOnly.clocks.proof_time_hours, 5);
});

test("payload is content-addressed and carries an all-false boundary", () => {
  const payload = buildPoiTimeCompressionPayload(fixtureInput());
  assert.equal(payload.schema, POI_TIME_COMPRESSION_SCHEMA);
  assert.equal(payload.truth_label, POI_TIME_COMPRESSION_TRUTH_LABEL);
  assert.match(payload.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(payload.boundary.execution_allowed, false);
  assert.equal(payload.boundary.live_execution_performed, false);
  assert.equal(payload.no_mint, true);
});

test("verify accepts a freshly built payload", () => {
  const payload = buildPoiTimeCompressionPayload(fixtureInput());
  assert.equal(verifyPoiTimeCompression(payload).ok, true);
});

test("verify rejects a tampered content_hash", () => {
  const payload = buildPoiTimeCompressionPayload(fixtureInput());
  const tampered = { ...payload, content_hash: `sha256:${"0".repeat(64)}` };
  assert.equal(verifyPoiTimeCompression(tampered).ok, false);
});

test("verify rejects a field change that did not update the content_hash", () => {
  const payload = buildPoiTimeCompressionPayload(fixtureInput());
  const forged = { ...payload, truth_label: "FORGED" };
  assert.equal(verifyPoiTimeCompression(forged).ok, false);
});

test("verify rejects a forged ratio even when the hash is recomputed to match", () => {
  // Launder probe: self-consistent body (field forged AND hash recomputed) must
  // still fail because verify re-derives the ratio from the declared hours.
  const payload = buildPoiTimeCompressionPayload(fixtureInput());
  const { content_hash: _stale, ...body } = {
    ...payload,
    compression: { ...payload.compression, ratio: 480 },
  };
  const laundered = { ...body, content_hash: recomputeHash(body) };
  const verdict = verifyPoiTimeCompression(laundered);
  assert.equal(verdict.ok, false);
  assert.ok(verdict.blocked_by.includes("compression_ratio_mismatch"));
});

test("verify rejects no_mint=false even when the hash is recomputed to match", () => {
  const payload = buildPoiTimeCompressionPayload(fixtureInput());
  const { content_hash: _stale, ...body } = { ...payload, no_mint: false };
  const laundered = { ...body, content_hash: recomputeHash(body) };
  const verdict = verifyPoiTimeCompression(laundered);
  assert.equal(verdict.ok, false);
  assert.ok(verdict.blocked_by.includes("no_mint_not_true"));
});

test("verify rejects forged gate survival even when the hash is recomputed", () => {
  const payload = buildPoiTimeCompressionPayload(
    fixtureInput({
      quality_gates: { required: ["npm_test"], passed: [] },
    }),
  );
  // Forge survival to true and recompute: the derived required-vs-passed check
  // must still refuse the receipt.
  const { content_hash: _stale, ...body } = {
    ...payload,
    quality_gates: { ...payload.quality_gates, all_required_passed: true },
  };
  const laundered = { ...body, content_hash: recomputeHash(body) };
  const verdict = verifyPoiTimeCompression(laundered);
  assert.equal(verdict.ok, false);
  assert.ok(verdict.blocked_by.includes("quality_gate_survival_forged"));
});

test("verify rejects a self-attested independent review", () => {
  const payload = buildPoiTimeCompressionPayload(fixtureInput());
  const { content_hash: _stale, ...body } = { ...payload, independently_reviewed: true };
  const laundered = { ...body, content_hash: recomputeHash(body) };
  const verdict = verifyPoiTimeCompression(laundered);
  assert.equal(verdict.ok, false);
  assert.ok(verdict.blocked_by.includes("independently_reviewed_must_be_false"));
});

test("review gate closes the loop: build -> verify -> tamper-reject", () => {
  const result = runPoiTimeCompressionCheck();
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.schema, POI_TIME_COMPRESSION_SCHEMA);
  assert.equal(result.truth_label, POI_TIME_COMPRESSION_TRUTH_LABEL);
});

test("orchestrator boundary stays all-false (no execution authority)", () => {
  const result = runPoiTimeCompression({ consent: POI_TIME_COMPRESSION_GO_PHRASE, input: fixtureInput() });
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.boundary.execution_allowed, false);
  assert.equal(result.boundary.live_execution_performed, false);
  assert.equal(result.compression_ratio, 48);
});

// Edge branches: malformed payloads and degenerate inputs must fail closed.

test("plan with no arguments at all fails closed on consent and input", () => {
  const plan = planPoiTimeCompression();
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("consent_phrase_mismatch"));
  assert.ok(plan.blocked_by.includes("input_not_object"));
});

test("plan rejects array-shaped sections", () => {
  const plan = planPoiTimeCompression({
    consent: POI_TIME_COMPRESSION_GO_PHRASE,
    input: { task_id: "x", baseline: [], actual: [], quality_gates: [], observation_required: "yes" },
  });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("baseline_not_object"));
  assert.ok(plan.blocked_by.includes("actual_not_object"));
  assert.ok(plan.blocked_by.includes("quality_gates_not_object"));
  assert.ok(plan.blocked_by.includes("observation_required_not_boolean"));
});

test("plan rejects a non-list passed-gates field", () => {
  const plan = planPoiTimeCompression({
    consent: POI_TIME_COMPRESSION_GO_PHRASE,
    input: fixtureInput({ quality_gates: { required: ["npm_test"], passed: "npm_test" } }),
  });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("quality_gates_passed_not_list"));
});

test("buildPayload with no input degrades to nulls, never throws", () => {
  const payload = buildPoiTimeCompressionPayload();
  assert.equal(payload.compression.ratio, null);
  assert.equal(payload.task.id, null);
  assert.equal(payload.clocks.life_proof_status, "NOT_REQUIRED_FOR_THIS_TASK");
  assert.equal(payload.no_mint, true);
});

test("verify rejects a non-object payload", () => {
  assert.equal(verifyPoiTimeCompression(null).ok, false);
  assert.equal(verifyPoiTimeCompression([]).ok, false);
  assert.ok(verifyPoiTimeCompression(undefined).blocked_by.includes("payload_not_object"));
});

test("verify rejects laundered boundary, clocks, and gate removals", () => {
  const payload = buildPoiTimeCompressionPayload(fixtureInput());

  const { content_hash: _a, ...noBoundary } = { ...payload, boundary: null };
  const b1 = verifyPoiTimeCompression({ ...noBoundary, content_hash: recomputeHash(noBoundary) });
  assert.ok(b1.blocked_by.includes("boundary_missing"));

  const { content_hash: _b, ...flipped } = {
    ...payload,
    boundary: { ...payload.boundary, token_minted: true },
  };
  const b2 = verifyPoiTimeCompression({ ...flipped, content_hash: recomputeHash(flipped) });
  assert.ok(b2.blocked_by.includes("boundary_not_false:token_minted"));

  const { content_hash: _c, ...noClocks } = { ...payload, clocks: null };
  const b3 = verifyPoiTimeCompression({ ...noClocks, content_hash: recomputeHash(noClocks) });
  assert.ok(b3.blocked_by.includes("clocks_missing"));

  const { content_hash: _d, ...noGates } = { ...payload, quality_gates: null };
  const b4 = verifyPoiTimeCompression({ ...noGates, content_hash: recomputeHash(noGates) });
  assert.ok(b4.blocked_by.includes("quality_gates_malformed"));
});

test("verify rejects forged clocks even when the hash is recomputed", () => {
  const payload = buildPoiTimeCompressionPayload(fixtureInput());

  const { content_hash: _a, ...forgedLife } = {
    ...payload,
    clocks: { ...payload.clocks, life_proof_status: "NOT_REQUIRED_FOR_THIS_TASK" },
  };
  const v1 = verifyPoiTimeCompression({ ...forgedLife, content_hash: recomputeHash(forgedLife) });
  assert.ok(v1.blocked_by.includes("life_proof_status_inconsistent"));

  const { content_hash: _b, ...forgedProofTime } = {
    ...payload,
    clocks: { ...payload.clocks, proof_time_hours: 1 },
  };
  const v2 = verifyPoiTimeCompression({ ...forgedProofTime, content_hash: recomputeHash(forgedProofTime) });
  assert.ok(v2.blocked_by.includes("proof_time_hours_mismatch"));

  const { content_hash: _c, ...badFlag } = {
    ...payload,
    clocks: { ...payload.clocks, observation_required: "yes" },
  };
  const v3 = verifyPoiTimeCompression({ ...badFlag, content_hash: recomputeHash(badFlag) });
  assert.ok(v3.blocked_by.includes("observation_required_not_boolean"));
});

test("run with no arguments fails closed without throwing", () => {
  const result = runPoiTimeCompression();
  assert.equal(result.ok, false);
  assert.ok(result.blocked_by.length > 0);
  assert.equal(result.boundary.execution_allowed, false);
});
