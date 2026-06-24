import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256, stableStringify } from "../packages/consent/src/consent-common.js";

import {
  buildDiffusionRefinement,
  scoreDraftNoise,
  verifyDiffusionRefinement,
  DIFFUSION_REASONER_SCHEMA,
  DIFFUSION_NOISE_MARKERS,
} from "../packages/core/src/diffusion-reasoner.js";

const SHA256_HEX = /^[a-f0-9]{64}$/;

// A denoising trajectory: each draft is a progressive refinement of the prior.
const NOISY = "This will probably maybe work, it seems obviously the best ever revolutionary fix.";
const MID = "This seems to address the gate failure in the covenant CLI.";
const CLEAN = "The covenant CLI ESM fail-open is fixed by an ESM readFileSync import.";

test("1 · builds a deterministic frozen diffusion-refinement report", () => {
  const a = buildDiffusionRefinement({ drafts: [NOISY, MID, CLEAN], evidence: ["packages/perf/src/perf-improvement.js"] });
  const b = buildDiffusionRefinement({ drafts: [NOISY, MID, CLEAN], evidence: ["packages/perf/src/perf-improvement.js"] });
  assert.equal(a.schema, DIFFUSION_REASONER_SCHEMA);
  assert.equal(a.schema, "bizra.dema.diffusion_reasoner.v0.1");
  assert.match(a.convergence_hash, SHA256_HEX);
  assert.equal(a.convergence_hash, b.convergence_hash);
  assert.equal(Object.isFrozen(a), true);
  assert.equal(verifyDiffusionRefinement(a).valid, true);
});

test("2 · scoreDraftNoise counts speculation/overclaim markers deterministically", () => {
  assert.ok(scoreDraftNoise(NOISY) > scoreDraftNoise(CLEAN));
  assert.equal(scoreDraftNoise(CLEAN), 0);
  assert.ok(Array.isArray(DIFFUSION_NOISE_MARKERS) && DIFFUSION_NOISE_MARKERS.length > 0);
});

test("3 · a monotonically denoising trajectory ending clean + evidenced → CONVERGED", () => {
  const r = buildDiffusionRefinement({ drafts: [NOISY, MID, CLEAN], evidence: ["a.js"] });
  assert.equal(r.convergence_status, "CONVERGED");
  assert.equal(r.final_noise_score, 0);
  assert.equal(r.steps[r.steps.length - 1].noise_score, 0);
});

test("4 · a clean-ending trajectory with NO evidence is DENOISED_UNEVIDENCED, not CONVERGED", () => {
  const r = buildDiffusionRefinement({ drafts: [NOISY, CLEAN], evidence: [] });
  assert.equal(r.convergence_status, "DENOISED_UNEVIDENCED");
  assert.notEqual(r.convergence_status, "CONVERGED");
});

test("5 · a still-noisy non-increasing trajectory → REFINING", () => {
  const r = buildDiffusionRefinement({ drafts: [NOISY, MID], evidence: ["a.js"] });
  assert.equal(r.convergence_status, "REFINING");
  assert.ok(r.final_noise_score > 0);
});

test("6 · a trajectory where noise INCREASES at a step → DIVERGED", () => {
  const r = buildDiffusionRefinement({ drafts: [CLEAN, MID, NOISY], evidence: ["a.js"] });
  assert.equal(r.convergence_status, "DIVERGED");
  assert.ok(r.diverged_at_step >= 1);
});

test("7 · fail-closed on empty / non-array / malformed drafts", () => {
  assert.equal(buildDiffusionRefinement({ drafts: [] }).reason_code, "drafts_empty");
  assert.equal(buildDiffusionRefinement({ drafts: "bad" }).reason_code, "drafts_must_be_array");
  assert.equal(buildDiffusionRefinement({ drafts: [NOISY, 42] }).reason_code, "draft_malformed");
});

test("8 · does NOT claim neural diffusion / learned sampling; verify fails closed on overclaim", () => {
  const r = buildDiffusionRefinement({ drafts: [NOISY, CLEAN], evidence: ["a.js"] });
  assert.equal(r.learned_sampling, false);
  assert.equal(r.neural_diffusion, false);
  assert.ok(r.what_this_does_not_prove.some((line) => /not.*(neural|learned|stochastic|generative)/i.test(line)));
  const tampered = JSON.parse(JSON.stringify(r));
  tampered.neural_diffusion = true;
  assert.ok(verifyDiffusionRefinement(tampered).blocked_by.some((b) => b.includes("neural_diffusion_overclaim")));
});

test("9 · verify re-derives convergence_status (laundering DIVERGED→CONVERGED with recomputed hash is rejected)", () => {
  const r = buildDiffusionRefinement({ drafts: [CLEAN, NOISY], evidence: ["a.js"] }); // DIVERGED
  assert.equal(r.convergence_status, "DIVERGED");
  const forged = JSON.parse(JSON.stringify(r));
  forged.convergence_status = "CONVERGED";
  const { convergence_hash: _d, ...body } = forged;
  forged.convergence_hash = sha256(stableStringify(body)); // recompute so the hash backstop passes
  const v = verifyDiffusionRefinement(forged);
  assert.equal(v.valid, false);
  assert.ok(v.blocked_by.includes("convergence_status_mismatch"));
  assert.ok(!v.blocked_by.includes("convergence_hash_mismatch"));
});

test("10 · verify catches step/noise/boundary tampering", () => {
  const r = buildDiffusionRefinement({ drafts: [NOISY, CLEAN], evidence: ["a.js"] });
  const noiseTamper = JSON.parse(JSON.stringify(r));
  noiseTamper.steps[0].noise_score = 0;
  const { convergence_hash: _d, ...body } = noiseTamper;
  noiseTamper.convergence_hash = sha256(stableStringify(body));
  assert.ok(verifyDiffusionRefinement(noiseTamper).blocked_by.some((b) => b.includes("noise_score_mismatch")));

  const boundaryTamper = JSON.parse(JSON.stringify(r));
  boundaryTamper.boundary.model_invocation_performed = true;
  assert.ok(verifyDiffusionRefinement(boundaryTamper).blocked_by.some((b) => b.includes("boundary_not_false")));
});

test("13 · converged_claim (the verdict payload) is re-derived: substituting it with a recomputed hash is rejected", () => {
  const r = buildDiffusionRefinement({ drafts: [NOISY, MID, CLEAN], evidence: ["a.js"] });
  assert.equal(r.convergence_status, "CONVERGED");
  const forged = JSON.parse(JSON.stringify(r));
  forged.converged_claim = "An attacker-substituted conclusion the trajectory never reached.";
  const { convergence_hash: _d, ...body } = forged;
  forged.convergence_hash = sha256(stableStringify(body)); // recompute so the hash backstop passes
  const v = verifyDiffusionRefinement(forged);
  assert.equal(v.valid, false);
  assert.ok(v.blocked_by.includes("converged_claim_mismatch"), JSON.stringify(v.blocked_by));
  assert.ok(!v.blocked_by.includes("convergence_hash_mismatch"));
});

test("14 · noise_schedule and per-step markers are re-derived (not trusted)", () => {
  const r = buildDiffusionRefinement({ drafts: [NOISY, CLEAN], evidence: ["a.js"] });
  const forged = JSON.parse(JSON.stringify(r));
  forged.noise_schedule = [0, 0];
  forged.steps[0].noise_markers_found = [];
  const { convergence_hash: _d, ...body } = forged;
  forged.convergence_hash = sha256(stableStringify(body));
  const v = verifyDiffusionRefinement(forged);
  assert.equal(v.valid, false);
  assert.ok(v.blocked_by.includes("noise_schedule_mismatch"));
  assert.ok(v.blocked_by.some((b) => b.includes("noise_markers_mismatch")));
});

test("11 · source has no fs/network/process/clock/random surfaces", async () => {
  const src = await readFile(new URL("../packages/core/src/diffusion-reasoner.js", import.meta.url), "utf8");
  assert.doesNotMatch(src, /node:(fs|net|http|https|child_process|os|worker_threads)\b/);
  assert.doesNotMatch(src, /\bDate\.now\b|\bnew Date\b|\bMath\.random\b/);
  assert.doesNotMatch(src, /\bfetch\s*\(|\bimport\s*\(/);
});

test("12 · boundary is entirely false and hash changes when a draft changes", () => {
  const r = buildDiffusionRefinement({ drafts: [NOISY, CLEAN], evidence: ["a.js"] });
  for (const [k, v] of Object.entries(r.boundary)) assert.equal(v, false, `boundary.${k} must be false`);
  const r2 = buildDiffusionRefinement({ drafts: [NOISY, MID], evidence: ["a.js"] });
  assert.notEqual(r.convergence_hash, r2.convergence_hash);
});
