import { test } from "node:test";
import assert from "node:assert/strict";
import { buildNode0HardwareProfile } from "../packages/core/src/node0-hardware-profile.js";
import { gatherNode0HardwareObservations } from "../apps/cli/src/commands/hardware-profile-gatherer.js";

test("hardware gatherer feeds kernel with injected deps (no real nvidia-smi)", async () => {
  const obs = await gatherNode0HardwareObservations({
    execFileImpl: async () => {
      throw new Error("nvidia-smi unavailable");
    },
    statfsImpl: async () => ({
      bavail: 500n * 1024n * 1024n,
      bsize: 4096n,
      blocks: 250n * 1024n * 1024n,
    }),
  });

  assert.ok(obs.cpu_cores_logical >= 1);
  assert.ok(obs.memory_total_gb > 0);
  assert.equal(obs.gpus.length, 0);

  const profile = buildNode0HardwareProfile(obs);
  assert.equal(profile.valid, true);
  assert.equal(profile.observations.cpu_cores_logical, obs.cpu_cores_logical);
});
