// Proof-of-Truth Convergence preview v0.1.
//
// A pure classifier that grades claims across the four proof rails
// (Formal · Cryptographic · Empirical · Economic) and reports, per claim, a
// level (0-5) + gap per rail, a convergence floor, and a consolidated verdict.
//
// No-overclaim invariant (Ihsān · Law of Assumption): a rail's level is DERIVED
// strictly from a fixed evidence→level map. The caller supplies an evidence
// token, never a level. An unrecognized token fails CLOSED to 0 — no claim
// sits above its evidence. The floor (weakest applicable rail) bounds the
// convergence label, so a single weak rail cannot be hidden behind strong ones.
//
// Pure: no I/O, no clock, deep-frozen output, canonical all-false boundary.
// A later slice may feed it real signals (claim register, harness verdict,
// test/coverage gates); this kernel only classifies caller-supplied evidence.

import { buildPreviewBoundary } from "./preview-boundary.js";

export const PROOF_CONVERGENCE_PREVIEW_SCHEMA =
  "bizra.dema.proof_convergence_preview.v0.1";

const MAX_LEVEL = 5;

// Evidence vocabularies map to levels on the repo's truth taxonomy. Tokens not
// listed here fail closed to level 0.
const RAIL_EVIDENCE = Object.freeze({
  formal: Object.freeze({
    none: 0,
    designed: 1,
    declared_spec: 2,
    spec_plus_test: 4,
    machine_checked: 5,
  }),
  cryptographic: Object.freeze({
    none: 0,
    schema_only: 1,
    hash_bound: 3,
    local_signed: 4,
    grounded_rederivable: 5,
  }),
  empirical: Object.freeze({
    none: 0,
    declared: 1,
    structural_tests: 3,
    passing_tests: 4,
    measured_remote_ci: 5,
  }),
  economic: Object.freeze({
    none: 0,
    designed_not_live: 1,
    local_only: 2,
    settled_local: 4,
    live_impact: 5,
  }),
});

const RAILS = Object.freeze([
  "formal",
  "cryptographic",
  "empirical",
  "economic",
]);

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value))
    return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function railResult(rail, evidence) {
  if (
    evidence === undefined ||
    evidence === null ||
    evidence === "not_applicable"
  ) {
    return {
      evidence: "not_applicable",
      applicable: false,
      level: null,
      gap: null,
    };
  }
  // no-overclaim: strictly map evidence → level; unknown token fails closed to 0.
  const map = RAIL_EVIDENCE[rail];
  const level = Object.hasOwn(map, evidence) ? map[evidence] : 0;
  return { evidence, applicable: true, level, gap: MAX_LEVEL - level };
}

function classifyClaim(claim) {
  const railsIn = (claim && claim.rails) || {};
  const rails = {};
  const applicableLevels = [];
  for (const rail of RAILS) {
    const result = railResult(rail, railsIn[rail]);
    rails[rail] = result;
    if (result.applicable) applicableLevels.push(result.level);
  }
  const floor_level = applicableLevels.length
    ? Math.min(...applicableLevels)
    : 0;
  const convergence =
    floor_level >= 4 ? "CONVERGED" : floor_level >= 1 ? "PARTIAL" : "DECLARED";
  return {
    id: claim && claim.id != null ? claim.id : null,
    statement: claim && claim.statement ? claim.statement : "",
    rails,
    floor_level,
    convergence,
  };
}

export function buildProofConvergencePreview({ claims = [] } = {}) {
  const list = Array.isArray(claims) ? claims : [];
  const classified = list.map(classifyClaim);

  let converged = 0;
  let partial = 0;
  let declared = 0;
  let weakest_claim = null;
  let weakestFloor = Infinity;
  for (const claim of classified) {
    if (claim.convergence === "CONVERGED") converged += 1;
    else if (claim.convergence === "PARTIAL") partial += 1;
    else declared += 1;
    if (claim.floor_level < weakestFloor) {
      weakestFloor = claim.floor_level;
      weakest_claim = claim.id;
    }
  }

  return deepFreeze({
    schema: PROOF_CONVERGENCE_PREVIEW_SCHEMA,
    mode: "preview_only",
    truth_label: "DECLARED",
    claims: classified,
    summary: {
      total: classified.length,
      converged,
      partial,
      declared,
      weakest_claim: classified.length ? weakest_claim : null,
    },
    boundary: buildPreviewBoundary(),
  });
}
