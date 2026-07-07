import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runMissionReturnReview } from "../apps/cli/src/commands/mission.js";
import { buildExampleHarnessReceipt } from "../scripts/review/node0-mission-harness-return-review-preview-check.mjs";

async function scratchReceipt(overrides = {}) {
  const base = await mkdtemp(join(process.env.TMPDIR || tmpdir(), "mission-review-"));
  const receipt = { ...buildExampleHarnessReceipt(), ...overrides };
  const path = join(base, "receipt.json");
  await writeFile(path, JSON.stringify(receipt, null, 2), "utf8");
  return { base, path, receipt };
}

test("reads a real receipt file and reviews it ok", async () => {
  const { path } = await scratchReceipt();
  const out = await runMissionReturnReview({ receiptPath: path });
  assert.equal(out.ok, true, JSON.stringify(out.result?.blocked_by));
  assert.equal(out.result.receipt_ok, true);
  assert.ok(out.result.what_was_not_proven.length >= 1);
  assert.match(out.result.one_next_safe_action, /index this receipt/i);
});

test("a committed_live receipt reviews as NOT ok (review still completes)", async () => {
  const { path } = await scratchReceipt({ committed_live: true });
  const out = await runMissionReturnReview({ receiptPath: path });
  assert.equal(out.ok, true); // the review's job is to report the bad receipt
  assert.equal(out.result.receipt_ok, false);
  assert.match(out.result.one_next_safe_action, /repair/i);
});

test("refuses a missing receipt path", async () => {
  const out = await runMissionReturnReview({ receiptPath: undefined });
  assert.equal(out.ok, false);
  assert.equal(out.error, "missing_receipt_path");
});

test("refuses a nonexistent file", async () => {
  const out = await runMissionReturnReview({ receiptPath: "/no/such/receipt.json" });
  assert.equal(out.ok, false);
  assert.equal(out.error, "receipt_file_not_found_or_unreadable");
});

test("refuses non-JSON content", async () => {
  const base = await mkdtemp(join(process.env.TMPDIR || tmpdir(), "mission-review-bad-"));
  const path = join(base, "bad.json");
  await writeFile(path, "this is not json {", "utf8");
  const out = await runMissionReturnReview({ receiptPath: path });
  assert.equal(out.ok, false);
  assert.equal(out.error, "receipt_not_valid_json");
});
