import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runMissionCompact } from "../apps/cli/src/commands/mission.js";
import { buildExampleHarnessReceipt } from "../scripts/review/node0-mission-harness-return-review-preview-check.mjs";

async function scratchHome(receipts = []) {
  const home = await mkdtemp(join(process.env.TMPDIR || tmpdir(), "compact-"));
  const dir = join(home, "mission", "receipts");
  await mkdir(dir, { recursive: true });
  for (let i = 0; i < receipts.length; i += 1) {
    await writeFile(join(dir, `receipt-${i}.json`), JSON.stringify(receipts[i], null, 2), "utf8");
  }
  return home;
}

test("reads receipts, builds the shelf, and compacts it", async () => {
  const home = await scratchHome([buildExampleHarnessReceipt(), buildExampleHarnessReceipt()]);
  const out = await runMissionCompact({ demaHome: home });
  assert.equal(out.ok, true, JSON.stringify(out.result?.blocked_by));
  assert.equal(out.result.source_receipt_count, 2);
  assert.equal(out.result.valid_receipt_count, 2);
  assert.ok(out.result.dropped_content.includes("raw file content"));
  assert.ok(out.result.what_can_no_longer_be_claimed.length >= 1);
  assert.equal(out.result.committed_live, false);
});

test("an empty home compacts to a 0-receipt state and recommends running a mission", async () => {
  const home = await mkdtemp(join(process.env.TMPDIR || tmpdir(), "compact-empty-"));
  const out = await runMissionCompact({ demaHome: home });
  assert.equal(out.ok, true);
  assert.equal(out.result.source_receipt_count, 0);
  assert.match(out.result.one_next_safe_action, /run `dema mission pulse`/);
});

test("a committed_live receipt on disk makes the next action a quarantine", async () => {
  const home = await scratchHome([{ ...buildExampleHarnessReceipt(), committed_live: true }]);
  const out = await runMissionCompact({ demaHome: home });
  assert.equal(out.result.live_leak_count, 1);
  assert.match(out.result.one_next_safe_action, /quarantine|do NOT act/i);
});
