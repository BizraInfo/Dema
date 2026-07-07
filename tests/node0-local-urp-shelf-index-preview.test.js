import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  planNode0LocalUrpShelfIndexPreview,
  buildNode0LocalUrpShelfIndexPreviewPayload,
  verifyNode0LocalUrpShelfIndexPreview,
  runNode0LocalUrpShelfIndexPreview,
  composeShelfEntries,
  exampleShelfReceipts,
  NODE0_LOCAL_URP_SHELF_INDEX_PREVIEW_SCHEMA,
  NODE0_LOCAL_URP_SHELF_INDEX_PREVIEW_TRUTH_LABEL,
  NODE0_LOCAL_URP_SHELF_INDEX_PREVIEW_GO_PHRASE,
} from "../packages/core/src/node0-local-urp-shelf-index-preview.js";
import {
  runNode0LocalUrpShelfIndexPreviewCheck,
} from "../scripts/review/node0-local-urp-shelf-index-preview-check.mjs";
import { buildExampleHarnessReceipt } from "../scripts/review/node0-mission-harness-return-review-preview-check.mjs";

const GO = NODE0_LOCAL_URP_SHELF_INDEX_PREVIEW_GO_PHRASE;

function validInput(overrides = {}) {
  return { receipts: exampleShelfReceipts(), ...overrides };
}

// --- scaffold contract ---------------------------------------------------------------------------

test("plan is fail-closed without the exact consent phrase", () => {
  const plan = planNode0LocalUrpShelfIndexPreview({ consent: "wrong", input: validInput() });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("consent_phrase_mismatch"));
});

test("plan is eligible with exact consent and a receipts array", () => {
  const plan = planNode0LocalUrpShelfIndexPreview({ consent: GO, input: validInput() });
  assert.equal(plan.eligible, true, plan.blocked_by.join(", "));
});

test("plan rejects a non-array receipts input", () => {
  const plan = planNode0LocalUrpShelfIndexPreview({ consent: GO, input: { receipts: "nope" } });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("receipts_not_array"));
});

test("payload is content-addressed and carries an all-false boundary", () => {
  const payload = buildNode0LocalUrpShelfIndexPreviewPayload(validInput());
  assert.equal(payload.schema, NODE0_LOCAL_URP_SHELF_INDEX_PREVIEW_SCHEMA);
  assert.match(payload.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(payload.boundary.network_used, false);
});

test("verify accepts a freshly built payload", () => {
  const payload = buildNode0LocalUrpShelfIndexPreviewPayload(validInput());
  const v = verifyNode0LocalUrpShelfIndexPreview(payload);
  assert.equal(v.ok, true, v.blocked_by.join(", "));
});

test("verify rejects a tampered content_hash", () => {
  const payload = buildNode0LocalUrpShelfIndexPreviewPayload(validInput());
  assert.equal(verifyNode0LocalUrpShelfIndexPreview({ ...payload, content_hash: `sha256:${"0".repeat(64)}` }).ok, false);
});

test("verify rejects a field change that did not update the content_hash", () => {
  const payload = buildNode0LocalUrpShelfIndexPreviewPayload(validInput());
  assert.equal(verifyNode0LocalUrpShelfIndexPreview({ ...payload, truth_label: "FORGED" }).ok, false);
});

test("review gate closes the loop over real harness receipts", () => {
  const result = runNode0LocalUrpShelfIndexPreviewCheck();
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.schema, NODE0_LOCAL_URP_SHELF_INDEX_PREVIEW_SCHEMA);
});

test("orchestrator boundary stays all-false", () => {
  const result = runNode0LocalUrpShelfIndexPreview({ consent: GO, input: validInput() });
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.boundary.execution_allowed, false);
});

// --- shelf contract ------------------------------------------------------------------------------

test("happy path: indexes 2 valid receipts with accurate counts", () => {
  const r = runNode0LocalUrpShelfIndexPreview({ consent: GO, input: validInput() });
  assert.equal(r.ok, true, r.blocked_by?.join(", "));
  assert.equal(r.status, "shelf_index_complete");
  assert.equal(r.entry_count, 2);
  assert.equal(r.valid_count, 2);
  assert.equal(r.invalid_count, 0);
  assert.equal(r.live_leak_count, 0);
  assert.equal(r.all_preview, true);
});

test("indexes REAL harness receipts (end-to-end)", () => {
  const r = runNode0LocalUrpShelfIndexPreview({ consent: GO, input: { receipts: [buildExampleHarnessReceipt(), buildExampleHarnessReceipt()] } });
  assert.equal(r.ok, true, r.blocked_by?.join(", "));
  assert.equal(r.entry_count, 2);
  assert.equal(r.valid_count, 2);
});

test("an empty shelf is valid (zero entries, all_preview true)", () => {
  const r = runNode0LocalUrpShelfIndexPreview({ consent: GO, input: { receipts: [] } });
  assert.equal(r.ok, true);
  assert.equal(r.entry_count, 0);
  assert.equal(r.all_preview, true);
});

test("a bad receipt is catalogued (shelf shows what is held) and counted invalid", () => {
  const bad = { ...exampleShelfReceipts()[0], pulse_content_hash: "not-a-hash" };
  const r = runNode0LocalUrpShelfIndexPreview({ consent: GO, input: { receipts: [bad] } });
  assert.equal(r.ok, true); // the shelf still builds
  assert.equal(r.entry_count, 1);
  assert.equal(r.valid_count, 0);
  assert.equal(r.invalid_count, 1);
});

test("a committed_live receipt is surfaced as a live_leak (shelf itself commits nothing)", () => {
  const leaked = { ...exampleShelfReceipts()[0], committed_live: true };
  const r = runNode0LocalUrpShelfIndexPreview({ consent: GO, input: { receipts: [leaked] } });
  assert.equal(r.live_leak_count, 1);
  assert.equal(r.all_preview, false);
});

test("entries are deterministically ordered (stable content hash across input order)", () => {
  const [a, b] = exampleShelfReceipts();
  const p1 = buildNode0LocalUrpShelfIndexPreviewPayload({ receipts: [a, b] });
  const p2 = buildNode0LocalUrpShelfIndexPreviewPayload({ receipts: [b, a] });
  assert.equal(p1.content_hash, p2.content_hash);
});

test("verify rejects a forged entry_count", () => {
  const payload = buildNode0LocalUrpShelfIndexPreviewPayload(validInput());
  assert.equal(verifyNode0LocalUrpShelfIndexPreview({ ...payload, entry_count: 99 }).ok, false);
});

test("verify rejects a forged valid_count", () => {
  const payload = buildNode0LocalUrpShelfIndexPreviewPayload(validInput());
  assert.equal(verifyNode0LocalUrpShelfIndexPreview({ ...payload, valid_count: 0 }).ok, false);
});

test("composeShelfEntries reuses the return-review validator", () => {
  const entries = composeShelfEntries(exampleShelfReceipts());
  assert.equal(entries.length, 2);
  assert.ok(entries.every((e) => e.receipt_ok === true));
});

// --- purity --------------------------------------------------------------------------------------

test("kernel remains pure: no fs / network / process / clock / random", () => {
  const src = readFileSync(
    fileURLToPath(new URL("../packages/core/src/node0-local-urp-shelf-index-preview.js", import.meta.url)),
    "utf8",
  );
  assert.doesNotMatch(src, /node:fs|node:net|node:child_process|node:http|node:dns/);
  assert.doesNotMatch(src, /Math\.random|Date\.now|new Date\(/);
  assert.doesNotMatch(src, /process\.(env|argv|exit)/);
});
