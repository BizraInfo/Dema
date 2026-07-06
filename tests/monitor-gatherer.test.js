import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  planReceiptMonitorPreview,
  runReceiptMonitorPreview,
  RECEIPT_MONITOR_PREVIEW_GO_PHRASE,
} from "../packages/core/src/receipt-monitor-preview.js";

import {
  planMonitorGatherer,
  buildMonitorGathererPayload,
  deriveMonitorInputFacts,
  verifyMonitorGatherer,
  runMonitorGatherer,
  MONITOR_GATHERER_SCHEMA,
  MONITOR_GATHERER_TRUTH_LABEL,
  MONITOR_GATHERER_GO_PHRASE,
} from "../packages/core/src/monitor-gatherer.js";
import { runMonitorGathererCheck } from "../scripts/review/monitor-gatherer-check.mjs";

// RED-FIRST: each test encodes part of the MONITOR-GATHERER-1A proof contract. They fail until
// the kernel bodies are implemented. Build to green — do not soften the asserts.

// Clean raw artifacts: fresh gates, clean tree, both rows fully wired.
const FIXTURE_INPUT = {
  git: { head_sha: "32743df", dirty_count: 0 },
  gate_logs: { test_age_hours: 0.5, check_age_hours: 0.4, stale_threshold_hours: 24 },
  ci_available_declared: true,
  registry: {
    required_ids: ["RECEIPT_MONITOR_PREVIEW_1A", "MONITOR_GATHERER_1A"],
    rows: [
      {
        capability_id: "RECEIPT_MONITOR_PREVIEW_1A",
        test_paths: ["tests/receipt-monitor-preview.test.js"],
        review_gate_paths: ["scripts/review/receipt-monitor-preview-check.mjs"],
      },
      {
        capability_id: "MONITOR_GATHERER_1A",
        test_paths: ["tests/monitor-gatherer.test.js"],
        review_gate_paths: ["scripts/review/monitor-gatherer-check.mjs"],
      },
    ],
  },
  artifacts: {
    check_source:
      "node scripts/review/receipt-monitor-preview-check.mjs\nnode scripts/review/monitor-gatherer-check.mjs",
    current_limits_text: "| RECEIPT-MONITOR-PREVIEW-1A | MONITOR-GATHERER-1A |",
    testing_text: "receipt-monitor-preview.test.js monitor-gatherer.test.js",
    test_paths_present: {
      "tests/receipt-monitor-preview.test.js": true,
      "tests/monitor-gatherer.test.js": true,
    },
  },
  receipts_raw: [{ id: "stand-2026-07-06-396a4939", evidence_refs: 2 }],
};

// Drifted raw artifacts: dirty tree, missing test log, unwired phantom row.
const DRIFTED_INPUT = {
  ...FIXTURE_INPUT,
  git: { head_sha: "deadbee", dirty_count: 3 },
  gate_logs: { test_age_hours: null, check_age_hours: 30, stale_threshold_hours: 24 },
  registry: {
    required_ids: ["PHANTOM_CAPABILITY_1A", "GHOST_2A"],
    rows: [
      {
        capability_id: "PHANTOM_CAPABILITY_1A",
        test_paths: ["tests/phantom.test.js"],
        review_gate_paths: ["scripts/review/phantom-check.mjs"],
      },
    ],
  },
  artifacts: {
    check_source: "node scripts/review/other-check.mjs",
    current_limits_text: "| SOME-OTHER-ROW |",
    testing_text: "other.test.js",
    test_paths_present: { "tests/phantom.test.js": false },
  },
};

test("plan is fail-closed without the exact consent phrase", () => {
  const plan = planMonitorGatherer({ consent: "wrong", input: {} });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("consent_phrase_mismatch"));
});

test("plan is eligible with exact consent and well-formed input", () => {
  const plan = planMonitorGatherer({ consent: MONITOR_GATHERER_GO_PHRASE, input: FIXTURE_INPUT });
  assert.equal(plan.eligible, true, plan.blocked_by.join(", "));
});

test("payload is content-addressed and carries an all-false boundary", () => {
  const payload = buildMonitorGathererPayload(FIXTURE_INPUT);
  assert.equal(payload.schema, MONITOR_GATHERER_SCHEMA);
  assert.equal(payload.truth_label, MONITOR_GATHERER_TRUTH_LABEL);
  assert.match(payload.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(payload.boundary.execution_allowed, false);
  assert.equal(payload.boundary.live_execution_performed, false);
});

test("verify accepts a freshly built payload", () => {
  const payload = buildMonitorGathererPayload(FIXTURE_INPUT);
  assert.equal(verifyMonitorGatherer(payload).ok, true);
});

test("verify rejects a tampered content_hash", () => {
  const payload = buildMonitorGathererPayload(FIXTURE_INPUT);
  const tampered = { ...payload, content_hash: `sha256:${"0".repeat(64)}` };
  assert.equal(verifyMonitorGatherer(tampered).ok, false);
});

test("verify rejects a field change that did not update the content_hash", () => {
  // Internal-consistency check: a field changed but the stored hash did not, so
  // recompute-over-body must differ from content_hash.
  //
  // NOTE the harder launder this scaffold does NOT yet defend against: changing a
  // field AND recomputing the hash so the body is self-consistent. Internal
  // consistency alone cannot catch that — you need an INDEPENDENT anchor
  // (a signature over the payload, or an externally measured state hash). When
  // this slice gains one, add a test that forges + recomputes and still expects
  // rejection. Until then, do not claim launder-resistance.
  const payload = buildMonitorGathererPayload(FIXTURE_INPUT);
  const forged = { ...payload, truth_label: "FORGED" };
  assert.equal(verifyMonitorGatherer(forged).ok, false);
});

test("review gate closes the loop: build -> verify -> tamper-reject", () => {
  const result = runMonitorGathererCheck();
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.schema, MONITOR_GATHERER_SCHEMA);
  assert.equal(result.truth_label, MONITOR_GATHERER_TRUTH_LABEL);
});

test("orchestrator boundary stays all-false (no execution authority)", () => {
  const result = runMonitorGatherer({ consent: MONITOR_GATHERER_GO_PHRASE, input: FIXTURE_INPUT });
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.boundary.execution_allowed, false);
  assert.equal(result.boundary.live_execution_performed, false);
});

test("clean artifacts derive clean facts: fresh, clean, fully wired rows", () => {
  const facts = deriveMonitorInputFacts(FIXTURE_INPUT);
  assert.deepEqual(facts.repo_state, {
    head_sha: "32743df",
    tree_clean: true,
    stale_proof: false,
    ci_available: true,
  });
  assert.deepEqual(facts.registry_counts, { declared: 2, required_ids: 2 });
  for (const row of facts.capability_rows) {
    assert.equal(row.measured, true);
    assert.equal(row.has_tests, true, row.capability_id);
    assert.equal(row.review_gate_in_check, true, row.capability_id);
    assert.equal(row.in_current_limits, true, row.capability_id);
    assert.equal(row.in_testing, true, row.capability_id);
  }
  assert.deepEqual(facts.claim_markers, []);
  assert.equal(facts.receipts[0].verified_claim, false);
});

test("drifted artifacts derive drift: stale, dirty, count mismatch, unwired row", () => {
  const facts = deriveMonitorInputFacts(DRIFTED_INPUT);
  assert.equal(facts.repo_state.tree_clean, false);
  assert.equal(facts.repo_state.stale_proof, true);
  assert.deepEqual(facts.registry_counts, { declared: 1, required_ids: 2 });
  const row = facts.capability_rows[0];
  assert.equal(row.has_tests, false);
  assert.equal(row.review_gate_in_check, false);
  assert.equal(row.in_current_limits, false);
  assert.equal(row.in_testing, false);
});

test("gatherer output pipes into the receipt monitor: eligible and coherent", () => {
  const cleanFacts = deriveMonitorInputFacts(FIXTURE_INPUT);
  const plan = planReceiptMonitorPreview({ consent: RECEIPT_MONITOR_PREVIEW_GO_PHRASE, input: cleanFacts });
  assert.equal(plan.eligible, true, plan.blocked_by.join(", "));
  const monitor = runReceiptMonitorPreview({ consent: RECEIPT_MONITOR_PREVIEW_GO_PHRASE, input: cleanFacts });
  assert.equal(monitor.ok, true, monitor.blocked_by?.join(", "));
  assert.equal(monitor.summary.all_clear, true);

  const driftedFacts = deriveMonitorInputFacts(DRIFTED_INPUT);
  const drifted = runReceiptMonitorPreview({ consent: RECEIPT_MONITOR_PREVIEW_GO_PHRASE, input: driftedFacts });
  assert.equal(drifted.ok, true, drifted.blocked_by?.join(", "));
  assert.ok(drifted.summary.critical_count > 0);
  assert.equal(drifted.proceed_allowed, false);
});

test("verify rejects a laundered clean repo_state even with a recomputed hash", () => {
  const payload = buildMonitorGathererPayload(DRIFTED_INPUT);
  const { content_hash: _drop, ...body } = {
    ...payload,
    monitor_input: {
      ...payload.monitor_input,
      repo_state: { ...payload.monitor_input.repo_state, tree_clean: true, stale_proof: false },
    },
  };
  const laundered = verifyMonitorGatherer({ ...body, content_hash: rehash(body) });
  assert.equal(laundered.ok, false);
  assert.ok(laundered.blocked_by.includes("monitor_input_not_rederivable"));
});

test("plan refuses malformed raw artifacts", () => {
  const badAge = { ...FIXTURE_INPUT, gate_logs: { test_age_hours: -1, check_age_hours: 0, stale_threshold_hours: 24 } };
  const plan = planMonitorGatherer({ consent: MONITOR_GATHERER_GO_PHRASE, input: badAge });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("gate_logs_invalid"));

  const badRow = {
    ...FIXTURE_INPUT,
    registry: { required_ids: ["X_1A"], rows: [{ capability_id: "X_1A", test_paths: "nope", review_gate_paths: [] }] },
  };
  const plan2 = planMonitorGatherer({ consent: MONITOR_GATHERER_GO_PHRASE, input: badRow });
  assert.equal(plan2.eligible, false);
  assert.ok(plan2.blocked_by.includes("registry_row_invalid:0"));
});

test("derivation is deterministic: same artifacts, same content hash", () => {
  const a = buildMonitorGathererPayload(DRIFTED_INPUT);
  const b = buildMonitorGathererPayload(DRIFTED_INPUT);
  assert.equal(a.content_hash, b.content_hash);
});

// Recompute a content hash the same way the kernel does, for launder fixtures.
function rehash(body) {
  const stable = (v) => {
    if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
    if (v && typeof v === "object") {
      return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(",")}}`;
    }
    return JSON.stringify(v);
  };
  return `sha256:${createHash("sha256").update(stable(body), "utf8").digest("hex")}`;
}
