// Assumption-State preview v0.1 — the BASA epistemic-state aggregate.
//
// Composes the existing per-claim validator
// (packages/receipts/src/assumption-boundary-validator.js, the canon V/D/A/U
// Law-of-Assumption gate) into an aggregate assumption-state over a set of
// claims: counts per state, the uncertainty surface (A + U), and a fail-closed
// admissibility posture.
//
// Fail-closed (Law of Assumption): a single naked/invalid claim (unsupported
// certainty, missing derivation, an A without its Ihsān shape, a U that would
// mutate or go public) makes the WHOLE set REFUSED — the aggregate is never
// admitted above what every individual claim's boundary allows. Declared
// uncertainty (a well-formed A or a labeled U) is admissible-but-bounded, not
// refused: "assume with Ihsān, declare the boundary."
//
// Pure: no I/O, no clock, deep-frozen, canonical all-false boundary. It does
// NOT restate the Law (docs/canon/LAW_OF_ASSUMPTION.md) or reimplement the
// validator — it only aggregates.

import { buildPreviewBoundary } from "./preview-boundary.js";
import { validateAssumptionBoundary } from "../../receipts/src/assumption-boundary-validator.js";

export const ASSUMPTION_STATE_PREVIEW_SCHEMA =
  "bizra.dema.assumption_state_preview.v0.1";

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value))
    return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export function buildAssumptionStatePreview({ claims = [] } = {}) {
  const list = Array.isArray(claims) ? claims : [];
  const by_state = { V: 0, D: 0, A: 0, U: 0 };
  let valid = 0;
  let invalid = 0;

  const evaluated = list.map((claim) => {
    const result = validateAssumptionBoundary(claim);
    const id = claim && claim.id != null ? claim.id : null;
    if (result.valid) {
      valid += 1;
      by_state[result.claim_state] += 1;
      return { id, valid: true, claim_state: result.claim_state, error: null };
    }
    invalid += 1;
    return { id, valid: false, claim_state: null, error: result.error };
  });

  const uncertainty_surface = by_state.A + by_state.U;
  const admissible = invalid === 0;
  const posture = !admissible
    ? "REFUSED"
    : uncertainty_surface === 0
      ? "GROUNDED"
      : "BOUNDED_UNCERTAINTY";

  return deepFreeze({
    schema: ASSUMPTION_STATE_PREVIEW_SCHEMA,
    mode: "preview_only",
    truth_label: "DECLARED",
    claims: evaluated,
    summary: {
      total: list.length,
      valid,
      invalid,
      by_state,
      uncertainty_surface,
      admissible,
      posture,
    },
    boundary: buildPreviewBoundary(),
  });
}
