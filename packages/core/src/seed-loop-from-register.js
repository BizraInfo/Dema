// Seed-loop from the claim register — the LIVE-signal composition.
//
// Maps each claim in the (already-loaded) claim register to the two sub-kernels'
// input shapes, runs them, and composes the seed-loop posture — so `dema seed
// --live` reports the REAL epistemic posture of the repo's claims, not a fixture.
//
// Pure: takes a pre-loaded register object (the CLI does the impure read), no
// I/O, deep-frozen, canonical all-false boundary (reading one versioned repo doc
// writes nothing, scans no private data). Honesty crux: the mapping never rates a
// claim above its register label, and always yields a VALID V/D/A/U envelope (so
// the loop is never auto-REFUSED by a malformed mapping). DERIVED maps to A — the
// register carries no derivation chain, so claiming D would be unsupported.

import { buildSeedLoopPreview } from "./seed-loop-preview.js";
import { buildProofConvergencePreview } from "./proof-convergence-preview.js";
import { buildAssumptionStatePreview } from "./assumption-state-preview.js";

const SEED_LOOP_FROM_REGISTER_SOURCE = "claim-register";

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value))
    return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

// register evidence_class → the 4 convergence rail evidence tokens (no rail above label).
export function mapRegisterClaimToConvergence(claim) {
  const ec = claim?.evidence_class;
  let rails;
  if (ec === "VERIFIED" || ec === "MEASURED") {
    rails = { formal: "spec_plus_test", empirical: "passing_tests" };
  } else if (ec === "DERIVED") {
    rails = { formal: "declared_spec", empirical: "structural_tests" };
  } else if (ec === "SCENARIO" || ec === "DESIGNED_NOT_LIVE") {
    rails = {
      formal: "designed",
      empirical: "none",
      economic:
        claim?.scope === "economy" ? "designed_not_live" : "not_applicable",
    };
  } else {
    rails = { formal: "none", empirical: "none" };
  }
  return {
    id: claim?.id ?? null,
    statement: claim?.text ?? "",
    rails: {
      formal: rails.formal,
      empirical: rails.empirical,
      cryptographic: "not_applicable",
      economic: rails.economic ?? "not_applicable",
    },
  };
}

function assumedFrom(claim) {
  const blocked =
    Array.isArray(claim?.blocked_wording) && claim.blocked_wording.length
      ? claim.blocked_wording.join(", ")
      : "design-phase";
  return {
    id: claim?.id ?? null,
    claim_state: "A",
    assumption: nonEmpty(claim?.text) ? claim.text : "design-phase claim",
    ground: nonEmpty(claim?.status) ? claim.status : "claim-register",
    boundary: blocked,
    rejectable: true,
  };
}

// register evidence_class → a VALID V/D/A/U envelope (fail-closed, never above label).
export function mapRegisterClaimToAssumption(claim) {
  const ec = claim?.evidence_class;
  if (ec === "VERIFIED" || ec === "MEASURED") {
    const evidence_refs = [claim?.source, claim?.verification_path].filter(
      nonEmpty,
    );
    if (evidence_refs.length > 0) {
      return { id: claim?.id ?? null, claim_state: "V", evidence_refs };
    }
    return assumedFrom(claim); // labeled verified but no pointer → demote, honestly
  }
  if (ec === "DERIVED") {
    // register has no derivation chain → A (claiming D would be unsupported)
    return {
      id: claim?.id ?? null,
      claim_state: "A",
      assumption: nonEmpty(claim?.text) ? claim.text : "derived claim",
      ground: nonEmpty(claim?.source)
        ? claim.source
        : (claim?.status ?? "claim-register"),
      boundary: "derived; chain not enumerated in register",
      rejectable: true,
    };
  }
  if (ec === "SCENARIO" || ec === "DESIGNED_NOT_LIVE") {
    return assumedFrom(claim);
  }
  return { id: claim?.id ?? null, claim_state: "U" };
}

export function buildSeedLoopFromRegister({ register = {}, seed } = {}) {
  const claims = Array.isArray(register?.claims) ? register.claims : [];
  const convergence = buildProofConvergencePreview({
    claims: claims.map(mapRegisterClaimToConvergence),
  });
  const assumption_state = buildAssumptionStatePreview({
    claims: claims.map(mapRegisterClaimToAssumption),
  });
  const loop = buildSeedLoopPreview({
    seed: seed ?? { intent: "the repository's current claim posture" },
    assumption_state,
    convergence,
  });
  return deepFreeze({
    ...loop,
    source: SEED_LOOP_FROM_REGISTER_SOURCE,
    claims_graded: claims.length,
  });
}
