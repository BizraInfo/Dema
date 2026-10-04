// DIFFUSION-REASONER-KERNEL-1A
//
// A deterministic "diffusion reasoning" kernel — diffusion ONLY as a denoising
// metaphor. It takes an ordered refinement trajectory (drafts, each a revision of
// the prior) and verifies it CONVERGES: each step's deterministic noise score
// (count of speculation/overclaim markers) must be non-increasing, ending in an
// evidence-bound, zero-noise claim. It is NOT a neural diffusion model, NOT learned
// sampling, NOT stochastic, and generates NO text — it scores and verifies a
// caller-supplied trajectory. neural_diffusion / learned_sampling are false and
// verifyDiffusionRefinement fails closed if either is flipped.

import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import { buildAllFalseBoundaryFromKeys } from "./boundary-schema.js";

export const DIFFUSION_REASONER_SCHEMA = "bizra.dema.diffusion_reasoner.v0.1";

// Deterministic noise lexicon: speculation hedges + overclaim/bombast markers. The
// "noise" a converging reasoning trajectory must denoise away.
export const DIFFUSION_NOISE_MARKERS = Object.freeze([
  "maybe", "probably", "might", "possibly", "i think", "seems", "appears to",
  "guaranteed", "obviously", "definitely", "clearly", "of course", "trust me",
  "should work", "i guess", "sort of", "kind of", "peak", "ultimate",
  "revolutionary", "best ever", "world-class", "cutting-edge", "perfect",
  // Autonomy-overclaim phrasing is noise, not signal: a draft asserting a live
  // self-directed loop is speculation in this PREVIEW_ONLY repo by definition.
  "autonomous loop", "autonomous self-improvement", "self-improvement loop",
  "self-improving", "evolves itself", "recursive self-improvement",
  "without review", "without oversight",
  // Past-tense live-claim + currency-overclaim families (2026-07-04 probe gap:
  // these scored 0 through the lexicon above). A draft asserting something RAN
  // live, IS already running, or IS the currency needs receipts, not prose —
  // in a draft these phrases are unproven-assertion noise by definition.
  "autopoietic loop", "ran live", "tested live", "already running",
  "is the currency", "measured — live",
]);

export const DIFFUSION_REASONER_BOUNDARY_KEYS = Object.freeze([
  "runtime_execution_performed",
  "text_generation_performed",
  "model_invocation_performed",
  "network_call_performed",
  "file_write_performed",
  "self_modification_performed",
  "autonomous_loop_started",
  "signing_performed",
  "key_generation_performed",
  "mint_performed",
  "poi_activation_performed",
  "federation_started",
  "mcp_runtime_started",
  "a2a_runtime_started",
]);

const CANONICAL_BOUNDARY = buildAllFalseBoundaryFromKeys(
  DIFFUSION_REASONER_BOUNDARY_KEYS,
);

const WHAT_THIS_PROVES = Object.freeze([
  "A caller-supplied refinement trajectory can be deterministically scored for residual noise per step.",
  "Convergence (non-increasing noise ending in an evidence-bound, zero-noise claim) is verifiable and content-addressed.",
  "Divergence (noise that increases) and denoised-but-unevidenced endings are surfaced, not hidden.",
]);

const WHAT_THIS_DOES_NOT_PROVE = Object.freeze([
  "This is NOT a neural diffusion model, NOT learned sampling, NOT stochastic, and NOT generative — it scores caller-supplied text by a fixed lexicon.",
  "A zero-noise claim is not necessarily true; convergence binds to caller-supplied evidence anchors, not to ground truth.",
  "It performs no runtime, model call, network, text generation, signing, mint, or federation.",
]);

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function text(value) {
  return typeof value === "string" ? value : "";
}

function normalizeEvidence(evidence) {
  if (!Array.isArray(evidence)) return Object.freeze([]);
  return Object.freeze([...new Set(evidence.map((e) => text(e).trim()).filter(Boolean))].sort());
}

function reject(reason_code, details = {}) {
  return deepFreeze({ valid: false, rejected: true, reason_code, ...details });
}

// Markers match on word boundaries, never as bare substrings. Plain `includes`
// scored any word merely CONTAINING a marker — "speak"/"peaked" hit `peak`,
// "mighty" hit `might`, "perfectly" hit `perfect`.
//
// The boundary is `\w` ONLY — the hyphen is a separator, not an identifier char.
// An earlier form used (?<![\w-]) / (?![\w-]), borrowing the identifier-safety
// idiom from scripts/review/no-overclaim.mjs. That gate scans source, where "-"
// really does bind identifiers; this kernel scores PROSE, where it does not. The
// borrowed rule silently zeroed ordinary compounds that carry a real marker —
// "might-be", "perfect-world", "semi-perfect" — a false NEGATIVE on the predicate
// behind CONVERGED / ACCEPT_CONVERGED, strictly worse than the false positive it
// replaced. Underscore identifiers ("peak_phase") stay exempt for free because
// "_" is a word character. Lexicon entries that themselves contain a hyphen still
// match as whole markers, since the pattern is built from the entry verbatim.
// Cost: a hyphenated command name like `peak-self-loop` scores 1 — accepted
// deliberately, since 0 of 241 hyphenated tokens in `dema --help` contain a marker
// segment, so an identifier allowlist would exist for no documented command while
// prose stayed broken.
// Markers are lowercase and the haystack is lowercased, so no `i` flag is needed.
const escapeForRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const MARKER_PATTERNS = Object.freeze(
  DIFFUSION_NOISE_MARKERS.map(
    (m) => new RegExp(`(?<!\\w)${escapeForRegex(m)}(?!\\w)`, "u"),
  ),
);

export function scoreDraftNoise(draft) {
  const haystack = text(draft).toLowerCase();
  let score = 0;
  for (const pattern of MARKER_PATTERNS) {
    if (pattern.test(haystack)) score += 1;
  }
  return score;
}

function markersFound(draft) {
  const haystack = text(draft).toLowerCase();
  return Object.freeze(
    DIFFUSION_NOISE_MARKERS.filter((_m, i) => MARKER_PATTERNS[i].test(haystack)),
  );
}

function deriveStatus(noiseScores, divergedAtStep, evidenceCount) {
  if (divergedAtStep !== null) return "DIVERGED";
  const final = noiseScores[noiseScores.length - 1];
  if (final === 0) return evidenceCount > 0 ? "CONVERGED" : "DENOISED_UNEVIDENCED";
  return "REFINING";
}

const RECOMMENDATION_BY_STATUS = Object.freeze({
  CONVERGED: "ACCEPT_CONVERGED",
  DENOISED_UNEVIDENCED: "NEEDS_EVIDENCE",
  REFINING: "CONTINUE_REFINEMENT",
  DIVERGED: "REJECT_DIVERGENT",
});

function computeDivergedAtStep(noiseScores) {
  for (let i = 1; i < noiseScores.length; i += 1) {
    if (noiseScores[i] > noiseScores[i - 1]) return i;
  }
  return null;
}

export function buildDiffusionRefinement({ drafts = [], evidence = [], claim_id = "diffusion-1a" } = {}) {
  if (!Array.isArray(drafts)) return reject("drafts_must_be_array");
  if (drafts.length === 0) return reject("drafts_empty");
  for (let i = 0; i < drafts.length; i += 1) {
    if (typeof drafts[i] !== "string" || drafts[i].trim().length === 0) return reject("draft_malformed", { index: i });
  }

  const evidenceAnchors = normalizeEvidence(evidence);
  const steps = drafts.map((draft, i) => {
    const noise_score = scoreDraftNoise(draft);
    const stepBody = { step: i, draft, noise_score, noise_markers_found: markersFound(draft) };
    return { ...stepBody, draft_hash: sha256(stableStringify({ step: i, draft })) };
  });
  const noiseScores = steps.map((s) => s.noise_score);
  const divergedAtStep = computeDivergedAtStep(noiseScores);
  const convergence_status = deriveStatus(noiseScores, divergedAtStep, evidenceAnchors.length);

  const body = {
    schema: DIFFUSION_REASONER_SCHEMA,
    truth_label: "DIFFUSION_REASONER_BOUNDED_KERNEL",
    mode: "DETERMINISTIC_DENOISING_CONVERGENCE_ONLY",
    neural_diffusion: false,
    learned_sampling: false,
    claim_id: text(claim_id).trim() || "diffusion-1a",
    step_count: steps.length,
    steps,
    noise_schedule: Object.freeze(noiseScores),
    final_noise_score: noiseScores[noiseScores.length - 1],
    diverged_at_step: divergedAtStep,
    evidence_anchors: evidenceAnchors,
    convergence_status,
    recommendation: RECOMMENDATION_BY_STATUS[convergence_status],
    converged_claim: convergence_status === "CONVERGED" ? drafts[drafts.length - 1] : null,
    boundary: { ...CANONICAL_BOUNDARY },
    what_this_proves: WHAT_THIS_PROVES,
    what_this_does_not_prove: WHAT_THIS_DOES_NOT_PROVE,
  };
  return deepFreeze({ ...body, convergence_hash: sha256(stableStringify(body)) });
}

export function verifyDiffusionRefinement(report) {
  if (!report || typeof report !== "object" || Array.isArray(report)) return reject("report_malformed");
  const blocked_by = [];
  if (report.schema !== DIFFUSION_REASONER_SCHEMA) blocked_by.push("schema_mismatch");
  if (report.truth_label !== "DIFFUSION_REASONER_BOUNDED_KERNEL") blocked_by.push("truth_label_mismatch");
  if (report.neural_diffusion !== false) blocked_by.push("neural_diffusion_overclaim");
  if (report.learned_sampling !== false) blocked_by.push("learned_sampling_overclaim");
  if (stableStringify(report.what_this_does_not_prove) !== stableStringify(WHAT_THIS_DOES_NOT_PROVE)) blocked_by.push("what_this_does_not_prove_mismatch");

  if (!report.boundary || typeof report.boundary !== "object") blocked_by.push("boundary_missing");
  else {
    for (const [k, v] of Object.entries(report.boundary)) {
      if (v !== false) blocked_by.push(`boundary_not_false:${k}`);
    }
  }

  const steps = Array.isArray(report.steps) ? report.steps : null;
  if (!steps) blocked_by.push("steps_missing");
  else {
    const noiseScores = [];
    for (let i = 0; i < steps.length; i += 1) {
      const s = steps[i];
      if (!s || typeof s !== "object") {
        blocked_by.push("step_malformed");
        noiseScores.push(NaN);
        continue;
      }
      const expectedNoise = scoreDraftNoise(s.draft);
      if (s.noise_score !== expectedNoise) blocked_by.push(`noise_score_mismatch:${i}`);
      noiseScores.push(expectedNoise);
      const expectedHash = sha256(stableStringify({ step: i, draft: s.draft }));
      if (s.draft_hash !== expectedHash) blocked_by.push(`draft_hash_mismatch:${i}`);
      if (s.step !== i) blocked_by.push(`step_index_mismatch:${i}`);
      if (stableStringify(s.noise_markers_found) !== stableStringify(markersFound(s.draft))) blocked_by.push(`noise_markers_mismatch:${i}`);
    }
    // re-derive convergence — verify must not trust a stored status.
    const expectedDiverged = computeDivergedAtStep(noiseScores);
    if ((report.diverged_at_step ?? null) !== expectedDiverged) blocked_by.push("diverged_at_step_mismatch");
    const evidenceCount = Array.isArray(report.evidence_anchors) ? report.evidence_anchors.length : 0;
    const expectedStatus = deriveStatus(noiseScores, expectedDiverged, evidenceCount);
    if (report.convergence_status !== expectedStatus) blocked_by.push("convergence_status_mismatch");
    if (report.recommendation !== RECOMMENDATION_BY_STATUS[expectedStatus]) blocked_by.push("recommendation_mismatch");
    if (report.final_noise_score !== noiseScores[noiseScores.length - 1]) blocked_by.push("final_noise_score_mismatch");
    if (report.step_count !== steps.length) blocked_by.push("step_count_mismatch");
    if (stableStringify(report.noise_schedule) !== stableStringify(noiseScores)) blocked_by.push("noise_schedule_mismatch");
    // converged_claim is the verdict's payload — re-derive it, never trust the stored value.
    const expectedClaim = expectedStatus === "CONVERGED" ? (steps[steps.length - 1]?.draft ?? null) : null;
    if (report.converged_claim !== expectedClaim) blocked_by.push("converged_claim_mismatch");
  }

  const { convergence_hash, ...body } = report;
  if (!convergence_hash || sha256(stableStringify(body)) !== convergence_hash) blocked_by.push("convergence_hash_mismatch");
  if (blocked_by.length > 0) return deepFreeze({ valid: false, rejected: true, reason_code: "diffusion_refinement_invalid", blocked_by });
  return deepFreeze({ valid: true, rejected: false, reason_code: "diffusion_refinement_valid", convergence_status: report.convergence_status, convergence_hash: report.convergence_hash });
}
