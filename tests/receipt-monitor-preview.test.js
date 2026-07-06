import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  planReceiptMonitorPreview,
  buildReceiptMonitorPreviewPayload,
  verifyReceiptMonitorPreview,
  runReceiptMonitorPreview,
  summarizeReceiptMonitorFindings,
  RECEIPT_MONITOR_PREVIEW_SCHEMA,
  RECEIPT_MONITOR_PREVIEW_TRUTH_LABEL,
  RECEIPT_MONITOR_PREVIEW_GO_PHRASE,
} from "../packages/core/src/receipt-monitor-preview.js";
import { runReceiptMonitorPreviewCheck } from "../scripts/review/receipt-monitor-preview-check.mjs";

// RED-FIRST: each test encodes part of the RECEIPT-MONITOR-PREVIEW-1A proof contract. They fail until
// the kernel bodies are implemented. Build to green — do not soften the asserts.

// Clean proof spine: everything measured, gated, documented, evidenced.
const FIXTURE_INPUT = {
  repo_state: { head_sha: "c4913ca", tree_clean: true, stale_proof: false, ci_available: true },
  registry_counts: { declared: 28, required_ids: 28 },
  capability_rows: [
    {
      capability_id: "RECEIPT_MONITOR_PREVIEW_1A",
      measured: true,
      has_tests: true,
      review_gate_in_check: true,
      in_current_limits: true,
      in_testing: true,
    },
  ],
  receipts: [{ id: "stand-2026-07-06-396a4939", verified_claim: true, evidence_refs: 3 }],
  claim_markers: [],
};

// Drifted spine: every monitored failure class seeded at least once.
const DRIFTED_INPUT = {
  repo_state: { head_sha: "deadbee", tree_clean: false, stale_proof: true, ci_available: false },
  registry_counts: { declared: 28, required_ids: 27 },
  capability_rows: [
    {
      capability_id: "PHANTOM_CAPABILITY_1A",
      measured: true,
      has_tests: false,
      review_gate_in_check: false,
      in_current_limits: false,
      in_testing: false,
    },
  ],
  receipts: [{ id: "receipt-noevidence", verified_claim: true, evidence_refs: 0 }],
  claim_markers: [
    { surface: "docs/README.md", marker: "urp_live_claim" },
    { surface: "adapter-report", marker: "live_invocation_claim" },
  ],
};

test("plan is fail-closed without the exact consent phrase", () => {
  const plan = planReceiptMonitorPreview({ consent: "wrong", input: {} });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("consent_phrase_mismatch"));
});

test("plan is eligible with exact consent and well-formed input", () => {
  const plan = planReceiptMonitorPreview({ consent: RECEIPT_MONITOR_PREVIEW_GO_PHRASE, input: FIXTURE_INPUT });
  assert.equal(plan.eligible, true, plan.blocked_by.join(", "));
});

test("payload is content-addressed and carries an all-false boundary", () => {
  const payload = buildReceiptMonitorPreviewPayload(FIXTURE_INPUT);
  assert.equal(payload.schema, RECEIPT_MONITOR_PREVIEW_SCHEMA);
  assert.equal(payload.truth_label, RECEIPT_MONITOR_PREVIEW_TRUTH_LABEL);
  assert.match(payload.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(payload.boundary.execution_allowed, false);
  assert.equal(payload.boundary.live_execution_performed, false);
});

test("verify accepts a freshly built payload", () => {
  const payload = buildReceiptMonitorPreviewPayload(FIXTURE_INPUT);
  assert.equal(verifyReceiptMonitorPreview(payload).ok, true);
});

test("verify rejects a tampered content_hash", () => {
  const payload = buildReceiptMonitorPreviewPayload(FIXTURE_INPUT);
  const tampered = { ...payload, content_hash: `sha256:${"0".repeat(64)}` };
  assert.equal(verifyReceiptMonitorPreview(tampered).ok, false);
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
  const payload = buildReceiptMonitorPreviewPayload(FIXTURE_INPUT);
  const forged = { ...payload, truth_label: "FORGED" };
  assert.equal(verifyReceiptMonitorPreview(forged).ok, false);
});

test("review gate closes the loop: build -> verify -> tamper-reject", () => {
  const result = runReceiptMonitorPreviewCheck();
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.schema, RECEIPT_MONITOR_PREVIEW_SCHEMA);
  assert.equal(result.truth_label, RECEIPT_MONITOR_PREVIEW_TRUTH_LABEL);
});

test("orchestrator boundary stays all-false (no execution authority)", () => {
  const result = runReceiptMonitorPreview({ consent: RECEIPT_MONITOR_PREVIEW_GO_PHRASE, input: FIXTURE_INPUT });
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.boundary.execution_allowed, false);
  assert.equal(result.boundary.live_execution_performed, false);
});

test("clean spine yields all_clear, proceed_allowed, zero findings", () => {
  const payload = buildReceiptMonitorPreviewPayload(FIXTURE_INPUT);
  assert.equal(payload.findings.length, 0);
  assert.deepEqual(payload.summary, {
    critical_count: 0,
    warning_count: 0,
    info_count: 0,
    all_clear: true,
    proceed_allowed: true,
    authority_delta: 0,
    mint_allowed: false,
  });
  assert.equal(payload.autofix_performed, false);
  assert.equal(payload.receipt_written, false);
});

test("drifted spine detects every seeded failure class and fails closed", () => {
  const result = runReceiptMonitorPreview({ consent: RECEIPT_MONITOR_PREVIEW_GO_PHRASE, input: DRIFTED_INPUT });
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.summary.critical_count, 6);
  assert.equal(result.summary.warning_count, 4);
  assert.equal(result.summary.info_count, 1);
  assert.equal(result.proceed_allowed, false);
  const codes = result.findings.map((f) => f.finding);
  for (const expected of [
    "stale_proof_detected",
    "tree_not_clean",
    "ci_unavailable_outward_not_code",
    "registry_count_drift",
    "current_limits_row_missing",
    "testing_row_missing",
    "review_gate_missing",
    "capability_row_lacks_tests",
    "verified_claim_without_evidence",
    "forbidden_claim_marker",
  ]) {
    assert.ok(codes.includes(expected), `missing finding: ${expected}`);
  }
  assert.ok(result.findings.every((f) => f.evidence_ref.length > 0));
});

test("output is deterministic: same input, same content hash", () => {
  const a = buildReceiptMonitorPreviewPayload(DRIFTED_INPUT);
  const b = buildReceiptMonitorPreviewPayload(DRIFTED_INPUT);
  assert.equal(a.content_hash, b.content_hash);
});

test("verify rejects a forged clean verdict: findings stripped AND hash recomputed", () => {
  const payload = buildReceiptMonitorPreviewPayload(DRIFTED_INPUT);
  const { content_hash: _drop, ...body } = {
    ...payload,
    findings: [],
    summary: summarizeReceiptMonitorFindings([]),
  };
  const laundered = verifyReceiptMonitorPreview({ ...body, content_hash: rehash(body) });
  assert.equal(laundered.ok, false);
  assert.ok(laundered.blocked_by.includes("findings_not_rederivable"));
});

test("verify rejects an authority increase even when self-consistent", () => {
  const payload = buildReceiptMonitorPreviewPayload(FIXTURE_INPUT);
  const { content_hash: _drop, ...body } = {
    ...payload,
    summary: { ...payload.summary, authority_delta: 1 },
  };
  const laundered = verifyReceiptMonitorPreview({ ...body, content_hash: rehash(body) });
  assert.equal(laundered.ok, false);
  assert.ok(laundered.blocked_by.includes("authority_delta_nonzero"));
});

test("plan refuses unknown claim markers and malformed rows", () => {
  const badMarker = { ...FIXTURE_INPUT, claim_markers: [{ surface: "x", marker: "sounds_bad_claim" }] };
  const plan = planReceiptMonitorPreview({ consent: RECEIPT_MONITOR_PREVIEW_GO_PHRASE, input: badMarker });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("claim_marker_invalid:0"));

  const badRow = { ...FIXTURE_INPUT, capability_rows: [{ capability_id: "X", measured: true }] };
  const plan2 = planReceiptMonitorPreview({ consent: RECEIPT_MONITOR_PREVIEW_GO_PHRASE, input: badRow });
  assert.equal(plan2.eligible, false);
  assert.ok(plan2.blocked_by.includes("capability_row_invalid:0"));
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
