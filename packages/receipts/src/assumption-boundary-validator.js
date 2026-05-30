// ASSUMPTION-GATE-1A · Law of Assumption boundary validator
//
// Makes docs/canon/LAW_OF_ASSUMPTION.md executable as a structural gate.
// The canon states: every claim/act/proposal must carry exactly one of the
// four claim-states V/D/A/U, and an A (Assumed-with-Iḥsān) claim must declare
// the non-negotiable shape — assumption (X) · ground (Y) · boundary (Z) ·
// rejectable. "A claim without a V/D/A/U label is a doctrine violation."
//
// This gate is STRUCTURAL, not semantic. It checks that an envelope *declares*
// its epistemic ground — not whether that ground is factually true. That
// distinction is the whole point: a structural presence check is a pure,
// deterministic function of the recorded envelope, so a stranger holding only
// {envelope + this rule} re-derives the same pass/fail with zero trust. The
// Ihsān excellence floor cannot be grounded this way because "is this
// excellent?" bottoms out in model judgment; "did this envelope declare its
// boundary?" does not.
//
// Canon reference: docs/canon/LAW_OF_ASSUMPTION.md
//   §"V/D/A/U · the four claim-states"
//   §"The shape of assumption-with-Iḥsān (non-negotiable)"
//
// SCOPE (this slice): pure deterministic validator only. No CLI, no I/O, no
// Date.now, no Math.random, no model call, no network, no key material, no
// token / PoI / economy / federation. Fail-closed: any missing required
// declaration rejects.

export const ASSUMPTION_VALIDATOR_SCHEMA =
  "bizra.dema.assumption_boundary_validator.v0.1";

// Canon V/D/A/U: Verified · Derived · Assumed-with-Iḥsān · Unknown.
export const CLAIM_STATES = Object.freeze(["V", "D", "A", "U"]);

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasNonEmptyStringEntry(value) {
  return Array.isArray(value) && value.some(isNonEmptyString);
}

function reject(error) {
  return Object.freeze({ valid: false, error });
}

/**
 * Validate that an action/claim envelope declares its epistemic boundary
 * per the Law of Assumption. Pure: same envelope → same verdict.
 *
 * @param {object} envelope
 *   - claim_state: "V" | "D" | "A" | "U"   (required; canon V/D/A/U)
 *   - V requires evidence_refs: string[]   (named evidence pointers)
 *   - D requires derived_from: string[]    (the derivation chain)
 *   - A requires assumption, ground, boundary: string + rejectable === true
 *   - U carries no extra shape (the label itself is the deliverable)
 *   - mutation?: boolean · risk?: "high" | ... · operator_acknowledged?: boolean
 *   - audience?: "public" | "canonical" | "local"
 * @returns {{valid: true, claim_state: string} | {valid: false, error: string}}
 */
export function validateAssumptionBoundary(envelope) {
  if (!isPlainObject(envelope)) {
    return reject("envelope_invalid");
  }

  const claimState = envelope.claim_state;
  if (claimState === undefined || claimState === null) {
    return reject("claim_state_missing");
  }
  if (!CLAIM_STATES.includes(claimState)) {
    return reject("claim_state_invalid");
  }

  // Per-state declaration shape (canon §V/D/A/U + §assumption shape).
  if (claimState === "V") {
    // A "Verified" claim asserts certainty; certainty without a named
    // evidence pointer is unsupported certainty (ZANN).
    if (!hasNonEmptyStringEntry(envelope.evidence_refs)) {
      return reject("unsupported_certainty");
    }
  } else if (claimState === "D") {
    if (!hasNonEmptyStringEntry(envelope.derived_from)) {
      return reject("derivation_chain_missing");
    }
  } else if (claimState === "A") {
    // The non-negotiable assumption-with-Iḥsān shape.
    if (!isNonEmptyString(envelope.assumption)) {
      return reject("assumption_statement_missing");
    }
    if (!isNonEmptyString(envelope.ground)) {
      return reject("assumption_ground_missing");
    }
    if (!isNonEmptyString(envelope.boundary)) {
      return reject("assumption_boundary_missing");
    }
    if (envelope.rejectable !== true) {
      return reject("assumption_not_rejectable");
    }
  }
  // U: the label is the deliverable — no extra declaration required here.

  // Uncertainty is present when the claim is not grounded in fact.
  const uncertaintyPresent = claimState === "A" || claimState === "U";

  // Mutation gates (canon: an act under U "does not happen · surfaces as a
  // refusal"; high-risk mutation under uncertainty needs operator ack).
  if (envelope.mutation === true) {
    if (claimState === "U") {
      return reject("unknown_claim_cannot_mutate");
    }
    if (
      envelope.risk === "high" &&
      uncertaintyPresent &&
      envelope.operator_acknowledged !== true
    ) {
      return reject("high_risk_uncertainty_not_acknowledged");
    }
  }

  // Public/canonical claims cannot rest on an Unknown label.
  if (
    (envelope.audience === "public" || envelope.audience === "canonical") &&
    claimState === "U"
  ) {
    return reject("public_claim_unverified");
  }

  return Object.freeze({ valid: true, claim_state: claimState });
}
