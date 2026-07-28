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

test("16 · past-tense live-loop and currency overclaims score as noise (2026-07-04 probe gap)", () => {
  // Live probe 2026-07-04 (log: roadmap-v02-diffusion-2026-07-04.json): these
  // families scored noise 0 through the b805166 lexicon. Red-first closure.
  const PROBES = [
    ["The autopoietic loop with verified reward ran live in May 2026.", ["autopoietic loop", "ran live"]],
    ["In BIZRA, the receipt is the currency — MEASURED — live at the membrane.", ["is the currency", "measured — live"]],
    ["The evaluation system is already running tonight.", ["already running"]],
    ["The grading kernel was tested live on Node0 yesterday.", ["tested live"]],
  ];
  for (const [draft, expected] of PROBES) {
    for (const marker of expected) {
      assert.ok(
        DIFFUSION_NOISE_MARKERS.includes(marker),
        `lexicon must carry marker: ${marker}`,
      );
    }
    assert.ok(
      scoreDraftNoise(draft) >= expected.length,
      `must score >= ${expected.length}: ${draft}`,
    );
  }
});

test("15 · autonomy-overclaim phrasing scores as noise, not clean signal", () => {
  const OVERCLAIM =
    "Activate the autonomous self-improvement loop so the system evolves itself continuously without review";
  assert.ok(
    scoreDraftNoise(OVERCLAIM) >= 2,
    "autonomy-overclaim draft must register lexicon noise",
  );
  const r = buildDiffusionRefinement({ drafts: [NOISY, OVERCLAIM], evidence: ["a.js"] });
  const last = r.steps[r.steps.length - 1];
  assert.ok(last.noise_score >= 2);
  assert.ok(
    last.noise_markers_found.some(
      (m) => m.includes("self-improvement") || m.includes("autonomous") || m.includes("without review"),
    ),
  );
});

// DIFFUSION-NOISE-MARKER-WORD-BOUNDARY-1A — the lexicon matched by bare substring,
// so any word merely CONTAINING a marker scored as noise: "speak"/"peaked" hit
// `peak`, "mighty" hit `might`, "perfectly" hit `perfect`. Worst case, the repo's
// own `dema peak-self-loop` command name could not appear in a converging draft.
// Boundary idiom reused from scripts/review/no-overclaim.mjs: (?<![\w-])..(?![\w-]).
test("17 · noise markers match on word boundaries, not bare substrings", () => {
  // Innocent words that merely CONTAIN a marker must score zero.
  for (const clean of [
    "We speak to the operator before every mutation.",
    "The peaked roof shades the courtyard.",
    "A mighty fine gate guards the sandbox.",
    "The undo path is perfectly reversible and receipted.",
  ]) {
    assert.equal(scoreDraftNoise(clean), 0, `false positive on: ${clean}`);
  }

  // Identifier safety: UNDERSCORE-bound tokens are names, not bombast. "_" is a word
  // character, so this holds under a \w-only boundary with no allowlist.
  assert.equal(scoreDraftNoise("The peak_phase field is preview-only."), 0);

  // DELIBERATELY CHANGED by DIFFUSION-HYPHENATED-PROSE-BOUNDARY-1A (see test 18).
  // This line previously asserted 0 — treating "-" as an identifier character so a
  // hyphenated command name would not score. That assertion encoded the defect: the
  // same rule zeroed "might-be" / "perfect-world" / "semi-perfect", a false negative
  // on the predicate behind CONVERGED. Prose correctness outranks one command name,
  // and 0 of 241 hyphenated tokens in `dema --help` contain a marker segment, so the
  // allowlist that would rescue this case has no other member. Now asserts 1, so the
  // trade is pinned and visible rather than silently reversed.
  assert.equal(scoreDraftNoise("Wire dema peak-self-loop into the help output."), 1);

  // Standalone markers must STILL score — the fix must not disarm the lexicon.
  assert.equal(scoreDraftNoise("This is peak performance."), 1);
  assert.equal(scoreDraftNoise("It might work."), 1);
  assert.equal(scoreDraftNoise("The result is perfect."), 1);
  // Multi-word and hyphenated markers keep matching.
  assert.equal(scoreDraftNoise("It should work, trust me."), 2);
  assert.equal(scoreDraftNoise("A world-class cutting-edge platform."), 2);

  // Every marker in the lexicon must match itself standalone (no marker disarmed).
  for (const m of DIFFUSION_NOISE_MARKERS) {
    assert.ok(scoreDraftNoise(m) >= 1, `marker no longer matches itself: ${m}`);
  }
});

// DIFFUSION-HYPHENATED-PROSE-BOUNDARY-1A — regression on test 17's fix. That fix used
// (?<![\w-]) / (?![\w-]), putting the hyphen INSIDE the boundary class, which made "-"
// behave like an identifier character on both sides. Ordinary prose compounds carrying a
// real marker were then silently scored 0: "might-be", "perfect-world", "semi-perfect".
// That is a FALSE NEGATIVE on the predicate that drives CONVERGED / ACCEPT_CONVERGED —
// strictly worse than the substring false positive it replaced. Boundary is now \w only.
test("18 · hyphenated prose compounds still score their marker", () => {
  // The regression cases: a real marker joined by a hyphen must still count.
  for (const noisy of [
    "might-be", "semi-might", "perfect-world", "semi-perfect", "peak-performance",
    "This might-be a problem.", "a perfect-world scenario", "the semi-perfect answer",
  ]) {
    assert.ok(scoreDraftNoise(noisy) >= 1, `false negative on: ${noisy}`);
  }

  // Test 17's guarantees must survive: substrings and underscore identifiers stay clean.
  for (const clean of ["speak", "peaked", "perfectly", "mighty", "peak_phase", "might_be"]) {
    assert.equal(scoreDraftNoise(clean), 0, `false positive on: ${clean}`);
  }

  // Hyphenated LEXICON entries must keep matching as whole markers.
  assert.equal(scoreDraftNoise("A world-class cutting-edge platform."), 2);

  // No marker may be disarmed by the boundary change.
  for (const m of DIFFUSION_NOISE_MARKERS) {
    assert.ok(scoreDraftNoise(m) >= 1, `marker no longer matches itself: ${m}`);
  }
});
