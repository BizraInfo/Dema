import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  planNode0MissionHarnessReturnReviewPreview,
  buildNode0MissionHarnessReturnReviewPreviewPayload,
  verifyNode0MissionHarnessReturnReviewPreview,
  runNode0MissionHarnessReturnReviewPreview,
  evaluateReceipt,
  exampleHarnessReceipt,
  NODE0_MISSION_HARNESS_RETURN_REVIEW_PREVIEW_SCHEMA,
  NODE0_MISSION_HARNESS_RETURN_REVIEW_PREVIEW_TRUTH_LABEL,
  NODE0_MISSION_HARNESS_RETURN_REVIEW_PREVIEW_GO_PHRASE,
} from "../packages/core/src/node0-mission-harness-return-review-preview.js";
import {
  runNode0MissionHarnessReturnReviewPreviewCheck,
  buildExampleHarnessReceipt,
} from "../scripts/review/node0-mission-harness-return-review-preview-check.mjs";

const GO = NODE0_MISSION_HARNESS_RETURN_REVIEW_PREVIEW_GO_PHRASE;

function validInput(overrides = {}) {
  return { receipt: exampleHarnessReceipt(), ...overrides };
}

// --- scaffold contract ---------------------------------------------------------------------------

test("plan is fail-closed without the exact consent phrase", () => {
  const plan = planNode0MissionHarnessReturnReviewPreview({ consent: "wrong", input: validInput() });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("consent_phrase_mismatch"));
});

test("plan is eligible with exact consent and a receipt", () => {
  const plan = planNode0MissionHarnessReturnReviewPreview({ consent: GO, input: validInput() });
  assert.equal(plan.eligible, true, plan.blocked_by.join(", "));
});

test("payload is content-addressed and carries an all-false boundary", () => {
  const payload = buildNode0MissionHarnessReturnReviewPreviewPayload(validInput());
  assert.equal(payload.schema, NODE0_MISSION_HARNESS_RETURN_REVIEW_PREVIEW_SCHEMA);
  assert.match(payload.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(payload.boundary.model_invocation_performed, false);
});

test("verify accepts a freshly built payload", () => {
  const payload = buildNode0MissionHarnessReturnReviewPreviewPayload(validInput());
  const v = verifyNode0MissionHarnessReturnReviewPreview(payload);
  assert.equal(v.ok, true, v.blocked_by.join(", "));
});

test("verify rejects a tampered content_hash", () => {
  const payload = buildNode0MissionHarnessReturnReviewPreviewPayload(validInput());
  assert.equal(verifyNode0MissionHarnessReturnReviewPreview({ ...payload, content_hash: `sha256:${"0".repeat(64)}` }).ok, false);
});

test("verify rejects a field change that did not update the content_hash", () => {
  const payload = buildNode0MissionHarnessReturnReviewPreviewPayload(validInput());
  assert.equal(verifyNode0MissionHarnessReturnReviewPreview({ ...payload, truth_label: "FORGED" }).ok, false);
});

test("review gate closes the loop over a real harness receipt", () => {
  const result = runNode0MissionHarnessReturnReviewPreviewCheck();
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.schema, NODE0_MISSION_HARNESS_RETURN_REVIEW_PREVIEW_SCHEMA);
  assert.equal(result.truth_label, NODE0_MISSION_HARNESS_RETURN_REVIEW_PREVIEW_TRUTH_LABEL);
});

test("orchestrator boundary stays all-false", () => {
  const result = runNode0MissionHarnessReturnReviewPreview({ consent: GO, input: validInput() });
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.boundary.execution_allowed, false);
});

// --- return-review contract ----------------------------------------------------------------------

test("happy path: reviews a valid receipt, proven + not-proven + one next action", () => {
  const r = runNode0MissionHarnessReturnReviewPreview({ consent: GO, input: validInput() });
  assert.equal(r.ok, true, r.blocked_by?.join(", "));
  assert.equal(r.status, "return_review_complete");
  assert.equal(r.receipt_ok, true);
  assert.ok(r.what_was_proven.length >= 1);
  assert.ok(r.what_was_not_proven.length >= 1);
  assert.match(r.one_next_safe_action, /index this receipt/i);
  assert.equal(r.mint_allowed, false);
});

test("it reviews a REAL harness receipt (end-to-end) as ok", () => {
  const r = runNode0MissionHarnessReturnReviewPreview({ consent: GO, input: { receipt: buildExampleHarnessReceipt() } });
  assert.equal(r.ok, true, r.blocked_by?.join(", "));
  assert.equal(r.receipt_ok, true);
});

test("a receipt marked committed_live is reviewed as NOT ok (and the review itself still completes)", () => {
  const r = runNode0MissionHarnessReturnReviewPreview({ consent: GO, input: { receipt: { ...exampleHarnessReceipt(), committed_live: true } } });
  // The review's JOB is to report a bad receipt — so run.ok stays true, but receipt_ok is false.
  assert.equal(r.ok, true, r.blocked_by?.join(", "));
  assert.equal(r.receipt_ok, false);
  assert.equal(r.what_was_proven.length, 0);
  assert.match(r.one_next_safe_action, /repair/i);
});

test("a receipt with a bad pulse content hash is reviewed as NOT ok", () => {
  const r = runNode0MissionHarnessReturnReviewPreview({ consent: GO, input: { receipt: { ...exampleHarnessReceipt(), pulse_content_hash: "not-a-hash" } } });
  assert.equal(r.receipt_ok, false);
});

test("a receipt with the wrong schema is reviewed as NOT ok", () => {
  const r = runNode0MissionHarnessReturnReviewPreview({ consent: GO, input: { receipt: { ...exampleHarnessReceipt(), schema: "bizra.dema.NOT_HARNESS.v0.1" } } });
  assert.equal(r.receipt_ok, false);
});

test("missing receipt fails the plan (nothing to review)", () => {
  const r = runNode0MissionHarnessReturnReviewPreview({ consent: GO, input: {} });
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("missing_receipt"));
});

test("evaluateReceipt flags a null receipt and an ok receipt correctly", () => {
  assert.equal(evaluateReceipt(null).receipt_ok, false);
  assert.equal(evaluateReceipt(exampleHarnessReceipt()).receipt_ok, true);
});

test("verify rejects a forged verdict claiming ok with no proven items", () => {
  const payload = buildNode0MissionHarnessReturnReviewPreviewPayload(validInput());
  const forged = { ...payload, what_was_proven: [] };
  assert.equal(verifyNode0MissionHarnessReturnReviewPreview(forged).ok, false);
});

test("verify rejects a verdict missing its not-proven list", () => {
  const payload = buildNode0MissionHarnessReturnReviewPreviewPayload(validInput());
  const forged = { ...payload, what_was_not_proven: [] };
  assert.equal(verifyNode0MissionHarnessReturnReviewPreview(forged).ok, false);
});

// --- purity --------------------------------------------------------------------------------------

test("kernel remains pure: no fs / network / process / clock / random", () => {
  const src = readFileSync(
    fileURLToPath(new URL("../packages/core/src/node0-mission-harness-return-review-preview.js", import.meta.url)),
    "utf8",
  );
  assert.doesNotMatch(src, /node:fs|node:net|node:child_process|node:http|node:dns/);
  assert.doesNotMatch(src, /Math\.random|Date\.now|new Date\(/);
  assert.doesNotMatch(src, /process\.(env|argv|exit)/);
});
