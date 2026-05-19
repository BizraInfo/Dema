import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  buildSapeScorecardPreview,
  DEFAULT_MELAE_FLOOR,
  evaluateMelaeGatePreview,
  SAPE_PROBES
} from "../packages/verifier/src/melae-preview.js";

const fixedNow = new Date("2026-05-15T00:00:00.000Z");

function passingProbeScores(score = 0.97) {
  return SAPE_PROBES.map((probe) => ({
    probe_id: probe.id,
    score,
    notes: [`${probe.id} passed in preview`]
  }));
}

test("SAPE probe registry is complete and normalized", () => {
  assert.deepEqual(
    SAPE_PROBES.map((probe) => probe.id),
    [
      "counterfactual",
      "boundary",
      "analogical",
      "formalization",
      "program_sketch",
      "compression",
      "expansion",
      "adversarial",
      "ethical_overlay"
    ]
  );
  assert.equal(
    SAPE_PROBES.reduce((total, probe) => total + probe.weight, 0).toFixed(2),
    "1.00"
  );
});

test("buildSapeScorecardPreview emits deterministic preview scorecard", () => {
  const scorecard = buildSapeScorecardPreview({
    probeScores: passingProbeScores(),
    now: fixedNow
  });

  assert.equal(scorecard.schema, "bizra.dema.sape_scorecard_preview.v0.1");
  assert.equal(scorecard.mode, "PREVIEW_ONLY");
  assert.equal(scorecard.certifies, false);
  assert.equal(scorecard.verdict, "PARTIAL_PLACEHOLDER");
  assert.equal(scorecard.weighted_score.toFixed(4), "0.9700");
  assert.match(scorecard.scorecard_digest, /^[0-9a-f]{64}$/);
  assert.equal(scorecard.boundary.runtime_gate_executed, false);
  assert.equal(scorecard.boundary.receipt_minted, false);

  const second = buildSapeScorecardPreview({
    probeScores: passingProbeScores(),
    now: fixedNow
  });
  assert.equal(second.scorecard_digest, scorecard.scorecard_digest);
});

test("buildSapeScorecardPreview fails closed for missing or malformed probes", () => {
  const missing = buildSapeScorecardPreview({
    probeScores: passingProbeScores().slice(1),
    now: fixedNow
  });
  assert.equal(missing.verdict, "PREVIEW_REJECT");
  assert.deepEqual(missing.missing_probe_ids, ["counterfactual"]);

  const malformed = buildSapeScorecardPreview({
    probeScores: [
      ...passingProbeScores().slice(0, -1),
      { probe_id: "ethical_overlay", score: Number.NaN }
    ],
    now: fixedNow
  });
  assert.equal(malformed.verdict, "PREVIEW_REJECT");
  assert.equal(malformed.probes.at(-1).score, null);
});

test("evaluateMelaeGatePreview requires SAPE, SNR, and Ihsan floors", () => {
  const accepted = evaluateMelaeGatePreview({
    probeScores: passingProbeScores(),
    snr: 0.98,
    ihsan: 0.96,
    now: fixedNow
  });
  assert.equal(accepted.schema, "bizra.dema.melae_gate_preview.v0.1");
  assert.equal(accepted.floor, DEFAULT_MELAE_FLOOR);
  assert.equal(accepted.verdict, "PARTIAL_PLACEHOLDER");
  assert.ok(accepted.checks.every((check) => check.pass));

  const rejected = evaluateMelaeGatePreview({
    probeScores: passingProbeScores(),
    snr: 0.94,
    ihsan: 0.96,
    now: fixedNow
  });
  assert.equal(rejected.verdict, "PREVIEW_REJECT");
  assert.equal(rejected.checks.find((check) => check.check === "snr_floor_met").pass, false);
});

test("MELAE preview source has no runtime, network, or filesystem side effects", async () => {
  const source = await readFile(
    new URL("../packages/verifier/src/melae-preview.js", import.meta.url),
    "utf8"
  );

  assert.doesNotMatch(source, /\b(writeFile|appendFile|mkdir|rename|unlink|createWriteStream)\b/);
  assert.doesNotMatch(source, /\b(fetch|WebSocket|exec|execFile|spawn|spawnSync)\b/);
});
