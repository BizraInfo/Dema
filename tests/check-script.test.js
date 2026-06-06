import test from "node:test";
import assert from "node:assert/strict";

import { commands } from "../scripts/check.mjs";

function commandKey(entry) {
  const [bin, args] = entry;
  return `${bin} ${args.join(" ")}`;
}

test("check gate includes hermetic provenance scans before perf bench", () => {
  const keys = commands.map(commandKey);
  const crossRepoIndex = keys.indexOf(
    "node scripts/review/cross-repo-genesis-provenance.mjs --no-block0",
  );
  const poolIndex = keys.indexOf(
    "node scripts/review/node0-local-resource-pool.mjs",
  );
  const perfIndex = keys.indexOf("node scripts/perf-bench.mjs");

  assert.notEqual(crossRepoIndex, -1);
  assert.notEqual(poolIndex, -1);
  assert.notEqual(perfIndex, -1);
  assert.ok(crossRepoIndex < poolIndex);
  assert.ok(poolIndex < perfIndex);
  assert.deepEqual(commands[crossRepoIndex][2], { CROSS_REPO_SKIP_GH: "1" });
  assert.deepEqual(commands[poolIndex][2], { NODE0_POOL_SKIP_SCAN: "1" });
});

test("check gate includes transition assurance before proof-room composition", () => {
  const keys = commands.map(commandKey);
  const transitionIndex = keys.indexOf(
    "node scripts/review/transition-assurance-check.mjs",
  );
  const proofRoomIndex = keys.indexOf(
    "node scripts/proof-room-bundle.mjs --json",
  );

  assert.notEqual(transitionIndex, -1);
  assert.notEqual(proofRoomIndex, -1);
  assert.ok(transitionIndex < proofRoomIndex);
});
