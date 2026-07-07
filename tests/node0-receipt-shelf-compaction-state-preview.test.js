import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  planNode0ReceiptShelfCompactionStatePreview,
  buildNode0ReceiptShelfCompactionStatePreviewPayload,
  verifyNode0ReceiptShelfCompactionStatePreview,
  runNode0ReceiptShelfCompactionStatePreview,
  RETAINED_SIGNALS,
  DROPPED_CONTENT,
  NODE0_RECEIPT_SHELF_COMPACTION_STATE_PREVIEW_SCHEMA,
  NODE0_RECEIPT_SHELF_COMPACTION_STATE_PREVIEW_TRUTH_LABEL,
  NODE0_RECEIPT_SHELF_COMPACTION_STATE_PREVIEW_GO_PHRASE,
} from "../packages/core/src/node0-receipt-shelf-compaction-state-preview.js";
import {
  runNode0ReceiptShelfCompactionStatePreviewCheck,
  buildExampleShelfPayload,
} from "../scripts/review/node0-receipt-shelf-compaction-state-preview-check.mjs";
import {
  buildNode0LocalUrpShelfIndexPreviewPayload,
} from "../packages/core/src/node0-local-urp-shelf-index-preview.js";
import { buildExampleHarnessReceipt } from "../scripts/review/node0-mission-harness-return-review-preview-check.mjs";

const GO = NODE0_RECEIPT_SHELF_COMPACTION_STATE_PREVIEW_GO_PHRASE;

function shelfOf(receipts) {
  return buildNode0LocalUrpShelfIndexPreviewPayload({ receipts });
}
function validInput(overrides = {}) {
  return { shelf: buildExampleShelfPayload(), ...overrides };
}

// --- scaffold contract ---------------------------------------------------------------------------

test("plan is fail-closed without the exact consent phrase", () => {
  const plan = planNode0ReceiptShelfCompactionStatePreview({ consent: "wrong", input: validInput() });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("consent_phrase_mismatch"));
});

test("plan is eligible with exact consent and a shelf", () => {
  const plan = planNode0ReceiptShelfCompactionStatePreview({ consent: GO, input: validInput() });
  assert.equal(plan.eligible, true, plan.blocked_by.join(", "));
});

test("plan rejects a missing shelf", () => {
  const plan = planNode0ReceiptShelfCompactionStatePreview({ consent: GO, input: {} });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("missing_shelf"));
});

test("payload is content-addressed and carries an all-false boundary", () => {
  const payload = buildNode0ReceiptShelfCompactionStatePreviewPayload(validInput());
  assert.equal(payload.schema, NODE0_RECEIPT_SHELF_COMPACTION_STATE_PREVIEW_SCHEMA);
  assert.match(payload.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(payload.boundary.model_invocation_performed, false);
  assert.equal(payload.committed_live, false);
});

test("verify accepts a freshly built payload", () => {
  const payload = buildNode0ReceiptShelfCompactionStatePreviewPayload(validInput());
  const v = verifyNode0ReceiptShelfCompactionStatePreview(payload);
  assert.equal(v.ok, true, v.blocked_by.join(", "));
});

test("verify rejects a tampered content_hash", () => {
  const payload = buildNode0ReceiptShelfCompactionStatePreviewPayload(validInput());
  assert.equal(verifyNode0ReceiptShelfCompactionStatePreview({ ...payload, content_hash: `sha256:${"0".repeat(64)}` }).ok, false);
});

test("verify rejects a field change that did not update the content_hash", () => {
  const payload = buildNode0ReceiptShelfCompactionStatePreviewPayload(validInput());
  assert.equal(verifyNode0ReceiptShelfCompactionStatePreview({ ...payload, truth_label: "FORGED" }).ok, false);
});

test("review gate closes the loop over a real shelf", () => {
  const result = runNode0ReceiptShelfCompactionStatePreviewCheck();
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.schema, NODE0_RECEIPT_SHELF_COMPACTION_STATE_PREVIEW_SCHEMA);
});

test("orchestrator boundary stays all-false", () => {
  const result = runNode0ReceiptShelfCompactionStatePreview({ consent: GO, input: validInput() });
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.boundary.execution_allowed, false);
});

// --- compaction contract -------------------------------------------------------------------------

test("happy path: compacts a shelf, keeps signals, declares dropped + no-longer-claimable + one action", () => {
  const r = runNode0ReceiptShelfCompactionStatePreview({ consent: GO, input: validInput() });
  assert.equal(r.ok, true, r.blocked_by?.join(", "));
  assert.equal(r.status, "compaction_state_complete");
  assert.equal(r.shelf_ok, true);
  assert.equal(r.source_receipt_count, 2);
  assert.equal(r.valid_receipt_count, 2);
  assert.ok(r.retained_signals.length >= 1);
  assert.ok(r.dropped_content.includes("raw file content"));
  assert.ok(r.what_can_no_longer_be_claimed.length >= 1);
  assert.match(r.one_next_safe_action, /Compacted preview memory/);
  assert.equal(r.committed_live, false);
});

test("the Ihsān gate always answers keep / drop / no-longer-claim / next-action", () => {
  const payload = buildNode0ReceiptShelfCompactionStatePreviewPayload(validInput());
  assert.deepEqual(payload.retained_signals, RETAINED_SIGNALS);
  assert.deepEqual(payload.dropped_content, DROPPED_CONTENT);
  assert.ok(payload.what_can_no_longer_be_claimed.length >= 1);
  assert.ok(payload.one_next_safe_action.length > 0);
});

test("an empty shelf compacts (0 receipts) and recommends running a mission", () => {
  const r = runNode0ReceiptShelfCompactionStatePreview({ consent: GO, input: { shelf: shelfOf([]) } });
  assert.equal(r.ok, true, r.blocked_by?.join(", "));
  assert.equal(r.source_receipt_count, 0);
  assert.match(r.one_next_safe_action, /run `dema mission pulse`/);
});

test("a shelf with a live_leak makes the next action a QUARANTINE, not an act", () => {
  const leaked = { ...buildExampleHarnessReceipt(), committed_live: true };
  const shelf = shelfOf([leaked]);
  const r = runNode0ReceiptShelfCompactionStatePreview({ consent: GO, input: { shelf } });
  assert.equal(r.live_leak_count, 1);
  assert.match(r.one_next_safe_action, /quarantine|do NOT act/i);
});

test("a forged shelf (bad content hash) is reported shelf_ok false and the run still completes", () => {
  const shelf = shelfOf([buildExampleHarnessReceipt()]);
  const badShelf = { ...shelf, content_hash: `sha256:${"0".repeat(64)}` };
  const r = runNode0ReceiptShelfCompactionStatePreview({ consent: GO, input: { shelf: badShelf } });
  assert.equal(r.shelf_ok, false);
  assert.match(r.one_next_safe_action, /did not verify|rebuild/i);
});

test("verify re-derives counts from the embedded shelf — a forged compacted count is rejected", () => {
  const payload = buildNode0ReceiptShelfCompactionStatePreviewPayload(validInput());
  assert.equal(verifyNode0ReceiptShelfCompactionStatePreview({ ...payload, valid_receipt_count: 99 }).ok, false);
});

test("verify rejects a compaction that dropped its dropped-list (Ihsān violation)", () => {
  const payload = buildNode0ReceiptShelfCompactionStatePreviewPayload(validInput());
  assert.equal(verifyNode0ReceiptShelfCompactionStatePreview({ ...payload, dropped_content: [] }).ok, false);
});

test("verify rejects a committed_live-true compaction", () => {
  const payload = buildNode0ReceiptShelfCompactionStatePreviewPayload(validInput());
  assert.equal(verifyNode0ReceiptShelfCompactionStatePreview({ ...payload, committed_live: true }).ok, false);
});

// --- purity --------------------------------------------------------------------------------------

test("kernel remains pure: no fs / network / process / clock / random", () => {
  const src = readFileSync(
    fileURLToPath(new URL("../packages/core/src/node0-receipt-shelf-compaction-state-preview.js", import.meta.url)),
    "utf8",
  );
  assert.doesNotMatch(src, /node:fs|node:net|node:child_process|node:http|node:dns/);
  assert.doesNotMatch(src, /Math\.random|Date\.now|new Date\(/);
  assert.doesNotMatch(src, /process\.(env|argv|exit)/);
});
