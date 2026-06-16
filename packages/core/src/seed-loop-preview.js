// Seed-loop preview v0.1 — the gate that closes the epistemic loop.
//
// The session built three pure kernels (bootstrap-state, assumption-state,
// proof-convergence). This one ties two of them into a single loop-state over
// the canonical stages: Seed → Assumption → Meaning → Consent → Receipt → Growth.
// Given a seed intent and the already-built assumption-state + convergence
// verdicts, it decides whether the seed may advance — fail-closed:
//
//   REFUSED  — assumptions are not admissible (a naked assumption blocks the
//              loop, regardless of evidence). Law of Assumption: ambiguity is refusal.
//   HOLD     — assumptions admissible but no claim has converged; stay in Meaning
//              and gather evidence before any consented act.
//   ADVANCE  — admissible AND ≥1 converged claim → may proceed to micro-consent.
//
// Pure: composes the two kernels' OUTPUTS (no I/O, no clock, no write), deep-frozen,
// canonical all-false boundary. It declares the loop; it does not run it at runtime.

import { buildPreviewBoundary } from "./preview-boundary.js";

export const SEED_LOOP_PREVIEW_SCHEMA = "bizra.dema.seed_loop_preview.v0.1";

export const SEED_LOOP_STAGES = Object.freeze([
  "seed",
  "assumption",
  "meaning",
  "consent",
  "receipt",
  "growth",
]);

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value))
    return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export function buildSeedLoopPreview({
  seed = {},
  assumption_state = null,
  convergence = null,
} = {}) {
  const admissible = assumption_state?.summary?.admissible === true;
  const assumptionPosture = assumption_state?.summary?.posture ?? "REFUSED";

  const conv = convergence?.summary ?? {};
  const converged = conv.converged ?? 0;
  const partial = conv.partial ?? 0;
  const declared = conv.declared ?? 0;
  const weakest_claim = conv.weakest_claim ?? null;

  let posture;
  let next_safe_step;
  if (!admissible) {
    posture = "REFUSED";
    next_safe_step =
      "Resolve naked assumptions — the assumption-state is not admissible (ambiguity is refusal).";
  } else if (converged < 1) {
    posture = "HOLD";
    next_safe_step =
      "Strengthen evidence — no claim has converged yet; stay in Meaning and gather proof.";
  } else {
    posture = "ADVANCE";
    next_safe_step = "Proceed to micro-consent for the next bounded action.";
  }

  return deepFreeze({
    schema: SEED_LOOP_PREVIEW_SCHEMA,
    mode: "preview_only",
    truth_label: "DECLARED",
    seed: { intent: typeof seed?.intent === "string" ? seed.intent : "" },
    stages: [...SEED_LOOP_STAGES],
    assumption: { posture: assumptionPosture, admissible },
    convergence: { converged, partial, declared, weakest_claim },
    posture,
    next_safe_step,
    boundary: buildPreviewBoundary(),
  });
}
