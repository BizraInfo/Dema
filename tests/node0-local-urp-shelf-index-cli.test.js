import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runMissionShelf } from "../apps/cli/src/commands/mission.js";
import { buildExampleHarnessReceipt } from "../scripts/review/node0-mission-harness-return-review-preview-check.mjs";

async function scratchHome(receipts = []) {
  const home = await mkdtemp(join(process.env.TMPDIR || tmpdir(), "urp-shelf-"));
  const dir = join(home, "mission", "receipts");
  await mkdir(dir, { recursive: true });
  for (let i = 0; i < receipts.length; i += 1) {
    await writeFile(join(dir, `receipt-${i}.json`), JSON.stringify(receipts[i], null, 2), "utf8");
  }
  return home;
}

test("reads the receipts dir and indexes valid receipts", async () => {
  const home = await scratchHome([buildExampleHarnessReceipt(), buildExampleHarnessReceipt()]);
  const out = await runMissionShelf({ demaHome: home });
  assert.equal(out.ok, true, JSON.stringify(out.result?.blocked_by));
  assert.equal(out.result.entry_count, 2);
  assert.equal(out.result.valid_count, 2);
  assert.equal(out.files_seen, 2);
  assert.equal(out.result.all_preview, true);
});

test("an absent receipts dir is an EMPTY shelf, not an error", async () => {
  const home = await mkdtemp(join(process.env.TMPDIR || tmpdir(), "urp-shelf-empty-"));
  const out = await runMissionShelf({ demaHome: home });
  assert.equal(out.ok, true);
  assert.equal(out.result.entry_count, 0);
  assert.equal(out.result.all_preview, true);
});

test("a corrupt receipt file is skipped from the shelf", async () => {
  const home = await scratchHome([buildExampleHarnessReceipt()]);
  await writeFile(join(home, "mission", "receipts", "corrupt.json"), "not json {", "utf8");
  const out = await runMissionShelf({ demaHome: home });
  assert.equal(out.ok, true);
  assert.equal(out.files_seen, 2); // both .json files are counted as seen
  assert.equal(out.result.entry_count, 1); // only the parseable one is on the shelf
});

test("a committed_live receipt on disk is surfaced as a live_leak", async () => {
  const home = await scratchHome([{ ...buildExampleHarnessReceipt(), committed_live: true }]);
  const out = await runMissionShelf({ demaHome: home });
  assert.equal(out.result.live_leak_count, 1);
  assert.equal(out.result.all_preview, false);
});
