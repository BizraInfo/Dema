import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

import {
  planNode0FirstRealLocalMissionPulsePreview,
  buildNode0FirstRealLocalMissionPulsePreviewPayload,
  verifyNode0FirstRealLocalMissionPulsePreview,
  runNode0FirstRealLocalMissionPulsePreview,
  evaluatePulse,
  exampleMissionInput,
  PULSE_STAGES,
  NODE0_FIRST_REAL_LOCAL_MISSION_PULSE_PREVIEW_SCHEMA,
  NODE0_FIRST_REAL_LOCAL_MISSION_PULSE_PREVIEW_TRUTH_LABEL,
  NODE0_FIRST_REAL_LOCAL_MISSION_PULSE_PREVIEW_GO_PHRASE,
} from "../packages/core/src/node0-first-real-local-mission-pulse-preview.js";
import {
  runNode0FirstRealLocalMissionPulsePreviewCheck,
  buildExampleCompositionRef,
} from "../scripts/review/node0-first-real-local-mission-pulse-preview-check.mjs";

const GO = NODE0_FIRST_REAL_LOCAL_MISSION_PULSE_PREVIEW_GO_PHRASE;

// Local mirror of the kernel's content-address so the launder test can forge + recompute.
function sha256(v) {
  return createHash("sha256").update(v, "utf8").digest("hex");
}
function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

// One composition ref reused across tests (fresh ephemeral genesis anchor per call is fine).
function compositionRef() {
  return buildExampleCompositionRef();
}
function validInput(overrides = {}) {
  return { ...exampleMissionInput(compositionRef()), ...overrides };
}

// --- scaffold contract ---------------------------------------------------------------------------

test("plan is fail-closed without the exact consent phrase", () => {
  const plan = planNode0FirstRealLocalMissionPulsePreview({ consent: "wrong", input: validInput() });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("consent_phrase_mismatch"));
});

test("plan is eligible with exact consent and well-formed input", () => {
  const plan = planNode0FirstRealLocalMissionPulsePreview({ consent: GO, input: validInput() });
  assert.equal(plan.eligible, true, plan.blocked_by.join(", "));
});

test("payload is content-addressed and carries an all-false boundary", () => {
  const payload = buildNode0FirstRealLocalMissionPulsePreviewPayload(validInput());
  assert.equal(payload.schema, NODE0_FIRST_REAL_LOCAL_MISSION_PULSE_PREVIEW_SCHEMA);
  assert.match(payload.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(payload.boundary.execution_allowed, false);
  assert.equal(payload.boundary.live_execution_performed, false);
});

test("verify accepts a freshly built payload", () => {
  const payload = buildNode0FirstRealLocalMissionPulsePreviewPayload(validInput());
  const v = verifyNode0FirstRealLocalMissionPulsePreview(payload);
  assert.equal(v.ok, true, v.blocked_by.join(", "));
});

test("verify rejects a tampered content_hash", () => {
  const payload = buildNode0FirstRealLocalMissionPulsePreviewPayload(validInput());
  assert.equal(verifyNode0FirstRealLocalMissionPulsePreview({ ...payload, content_hash: `sha256:${"0".repeat(64)}` }).ok, false);
});

test("verify rejects a field change that did not update the content_hash", () => {
  const payload = buildNode0FirstRealLocalMissionPulsePreviewPayload(validInput());
  assert.equal(verifyNode0FirstRealLocalMissionPulsePreview({ ...payload, truth_label: "FORGED" }).ok, false);
});

test("review gate closes the loop: build -> verify -> tamper-reject", () => {
  const result = runNode0FirstRealLocalMissionPulsePreviewCheck();
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.schema, NODE0_FIRST_REAL_LOCAL_MISSION_PULSE_PREVIEW_SCHEMA);
  assert.equal(result.truth_label, NODE0_FIRST_REAL_LOCAL_MISSION_PULSE_PREVIEW_TRUTH_LABEL);
});

test("orchestrator boundary stays all-false (no execution authority)", () => {
  const result = runNode0FirstRealLocalMissionPulsePreview({ consent: GO, input: validInput() });
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.boundary.execution_allowed, false);
  assert.equal(result.boundary.live_execution_performed, false);
});

// --- pulse contract ------------------------------------------------------------------------------

test("happy path: the eight-stage pulse succeeds and produces receipt + world-state + DEMA previews", () => {
  const r = runNode0FirstRealLocalMissionPulsePreview({ consent: GO, input: validInput() });
  assert.equal(r.ok, true, r.blocked_by?.join(", "));
  assert.equal(r.status, "verified_preview_pulse");
  assert.equal(r.pulse_ready, true);
  assert.equal(r.stage_count, 8);
  assert.deepEqual(PULSE_STAGES, ["PERCEIVE", "CONSENT", "RESOURCE_SELECT", "ACTION_PREVIEW", "VERIFY", "RECEIPT", "WORLD_STATE_UPDATE_PREVIEW", "DEMA_REPORT"]);
  assert.equal(r.receipt_preview.committed_live, false);
  assert.equal(r.world_state_delta_preview.committed_live, false);
  assert.equal(r.world_state_delta_preview.adds.claims.length, 1);
  assert.equal(r.dema_report.status, "verified_preview_pulse");
  assert.equal(r.mint_allowed, false);
});

function rejects(overrides, code) {
  const r = runNode0FirstRealLocalMissionPulsePreview({ consent: GO, input: validInput(overrides) });
  assert.equal(r.ok, false, `expected reject for ${code}`);
  assert.ok(r.blocked_by.some((c) => c === code || c.startsWith(code)), `${code} not in [${r.blocked_by.join(", ")}]`);
}

test("1. missing mission rejects", () => rejects({ mission: undefined }, "missing_mission"));
test("2. missing consent rejects", () => rejects({ consent: undefined }, "missing_consent"));
test("3. consent allowing live mutation rejects", () => rejects({ consent: { operator_is_sole_authority: true, allows_live_mutation: true } }, "consent_allows_live_mutation"));
test("4. missing input content_hash rejects", () => rejects({ input_packet: { source_label: "x", sensitivity: "local_private", raw_content_leaves_node0: false } }, "missing_input_content_hash"));
test("5. missing composition_ref rejects", () => rejects({ composition_ref: undefined }, "missing_composition_ref"));

test("6. composition_ref that fails verification rejects", () => {
  const ref = { ...compositionRef(), content_hash: `sha256:${"0".repeat(64)}` };
  rejects({ composition_ref: ref }, "composition_ref_invalid");
});

test("7. candidate missing claim rejects", () => rejects({ candidate_extraction: { task: "t", boundary: "b" } }, "candidate_missing_claim"));
test("8. candidate missing task rejects", () => rejects({ candidate_extraction: { claim: "c", boundary: "b" } }, "candidate_missing_task"));
test("9. candidate missing boundary rejects", () => rejects({ candidate_extraction: { claim: "c", task: "t" } }, "candidate_missing_boundary"));
test("10. candidate overclaiming live URP rejects", () => rejects({ candidate_extraction: { claim: "live URP is now activated", task: "t", boundary: "b" } }, "overclaim:"));
test("11. candidate overclaiming mint rejects", () => rejects({ candidate_extraction: { claim: "c", task: "reward minted to founder", boundary: "b" } }, "overclaim:"));
test("12. authority_delta > 0 rejects", () => rejects({ authority_delta: 1 }, "authority_delta_nonzero"));
test("13. declared mint_allowed true rejects", () => rejects({ declared_flags: { mint_allowed: true } }, "declared_mint_allowed"));
test("14. declared network_used true rejects", () => rejects({ declared_flags: { network_used: true } }, "declared_network_used"));
test("15. declared model_invocation_performed true rejects", () => rejects({ declared_flags: { model_invocation_performed: true } }, "declared_model_invocation_performed"));
test("16. declared file_mutation_performed true rejects", () => rejects({ declared_flags: { file_mutation_performed: true } }, "declared_file_mutation_performed"));
test("18. request_live_commit true rejects", () => rejects({ request_live_commit: true }, "request_live_commit"));

test("17. verify rejects a payload with a missing receipt_preview", () => {
  const payload = buildNode0FirstRealLocalMissionPulsePreviewPayload(validInput());
  const forged = { ...payload };
  delete forged.receipt_preview;
  assert.equal(verifyNode0FirstRealLocalMissionPulsePreview(forged).ok, false);
});

test("18b. verify rejects a world-state delta marked committed_live", () => {
  const payload = buildNode0FirstRealLocalMissionPulsePreviewPayload(validInput());
  const forged = { ...payload, world_state_delta_preview: { ...payload.world_state_delta_preview, committed_live: true } };
  const v = verifyNode0FirstRealLocalMissionPulsePreview(forged);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("world_state_committed_live") || v.blocked_by.includes("content_hash_mismatch"));
});

test("19. verify rejects a content-hash mismatch", () => {
  const payload = buildNode0FirstRealLocalMissionPulsePreviewPayload(validInput());
  assert.equal(verifyNode0FirstRealLocalMissionPulsePreview({ ...payload, pulse_ready: !payload.pulse_ready }).ok, false);
});

test("20. forge-and-recompute on the composition/genesis anchor is still detected (signature)", () => {
  const payload = buildNode0FirstRealLocalMissionPulsePreviewPayload(validInput());
  const ref = payload.composition_ref;
  const g = ref.genesis_root;
  const forgedGenesis = {
    ...g,
    signed_receipt_anchor: {
      ...g.signed_receipt_anchor,
      payload: { ...g.signed_receipt_anchor.payload, head_hash: `sha256:${"e".repeat(64)}` },
    },
  };
  const forgedRef = { ...ref, genesis_root: forgedGenesis };
  const forgedBody = { ...payload, composition_ref: forgedRef };
  delete forgedBody.content_hash;
  const forged = { ...forgedBody, content_hash: `sha256:${sha256(stableStringify(forgedBody))}` };
  const v = verifyNode0FirstRealLocalMissionPulsePreview(forged);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("composition_anchor_invalid"), v.blocked_by.join(", "));
});

// --- reality gate + purity -----------------------------------------------------------------------

test("reality gate: every must-be-true condition holds for the example pulse", () => {
  const evalr = evaluatePulse(exampleMissionInput(compositionRef()));
  assert.equal(evalr.pulse_ready, true, evalr.blocked_by.join(", "));
  assert.equal(evalr.blocked_by.length, 0);
  assert.ok(evalr.stage_results.every((s) => s.ok === true), JSON.stringify(evalr.stage_results));
  assert.equal(evalr.stage_results.length, 8);
});

test("kernel remains pure: no fs / network / process / clock / random", () => {
  const src = readFileSync(
    fileURLToPath(new URL("../packages/core/src/node0-first-real-local-mission-pulse-preview.js", import.meta.url)),
    "utf8",
  );
  assert.doesNotMatch(src, /node:fs|node:net|node:child_process|node:http|node:dns/);
  assert.doesNotMatch(src, /Math\.random|Date\.now|new Date\(/);
  assert.doesNotMatch(src, /process\.(env|argv|exit)/);
});
