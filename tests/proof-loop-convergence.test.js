import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runMissionProbe } from "../packages/mission/src/mission-probe.js";
import { runThinkProbe } from "../packages/think/src/think-probe.js";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("proof-loop convergence", () => {
  it("both mission and think probes produce CLEAN verdicts", async () => {
    const mission = await runMissionProbe(REPO_ROOT);
    const think = await runThinkProbe(REPO_ROOT);

    assert.equal(mission.schema, "bizra.dema.mission_probe.v0.1");
    assert.equal(think.schema, "bizra.dema.think_probe.v0.1");
    assert.equal(
      mission.verdict,
      "CLEAN",
      `mission: ${mission.probes_failing} probes failing`,
    );
    assert.equal(
      think.verdict,
      "CLEAN",
      `think: ${think.probes_failing} probes failing`,
    );
  });

  it("both loops have 5 behavioral invariants each", async () => {
    const mission = await runMissionProbe(REPO_ROOT);
    const think = await runThinkProbe(REPO_ROOT);

    assert.equal(mission.probes_total, 5);
    assert.equal(think.probes_total, 5);
    assert.equal(mission.probes_passing, 5);
    assert.equal(think.probes_passing, 5);
  });

  it("both loops share the same invariant structure", async () => {
    const mission = await runMissionProbe(REPO_ROOT);
    const think = await runThinkProbe(REPO_ROOT);

    const mNames = mission.probes.map((p) => p.name).sort();
    const tNames = think.probes.map((p) => p.name).sort();

    for (const required of [
      "determinism",
      "consent_gate",
      "receipt_integrity",
      "tamper_detection",
    ]) {
      assert.ok(mNames.includes(required), `mission missing ${required}`);
      assert.ok(tNames.includes(required), `think missing ${required}`);
    }
  });
});
