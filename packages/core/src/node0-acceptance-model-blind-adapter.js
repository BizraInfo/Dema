// ACCEPTANCE-MODEL-BLIND-ADAPTER-1A — the first closure evidence adapter.
//
// It converts ONE model-swap attestation into ONE scoped closure observation
// for `acceptance_is_model_blind`, or into nothing at all.
//
// WHY THIS ONE FIRST. Six of the ten closure invariants describe a running loop
// observed across a worker exit; no analysis of this repository can settle them.
// `acceptance_is_model_blind` is different: it is a property of the acceptance
// FUNCTION, and NODE0-MODEL-SWAP-INVARIANCE-1A already measures exactly that
// property at exactly that scope.
//
// THE LESSON IT INHERITS. TASK-060 measured a scan that could only see source
// declarations, and it was one adapter away from settling a deployment question.
// The rule that came out of it: an instrument may only settle what it actually
// observed. So this adapter emits ONLY when the model-swap verifier
// INDEPENDENTLY RE-RAN the acceptance decision — `established` is
// `verdict_reproduced`, meaning the envelope carried the contract and every
// output, the verifier re-derived each verdict AND its diagnosis, and they
// matched. Any weaker tier means the receiver confirmed the rows were
// self-consistent and nothing more, which is not model-blindness.
//
// EVIDENCE OMITTED IS EVIDENCE ABSENT. A builder must never reach a satisfied
// invariant by carrying LESS in the envelope. That is why the weaker tiers
// return null rather than a lower-confidence "true".
//
// Pure: no fs, no network, no process, no clock, no random, no model call. It
// judges an attestation it is handed; it never produces one.

import {
  verifyNode0ModelSwapInvariance,
  NODE0_MODEL_SWAP_INVARIANCE_SCHEMA,
} from "./node0-model-swap-invariance.js";

/// The ONE invariant this adapter may address, and the ONE scope it may claim.
/// Both are constants, not parameters: an adapter that could choose its own
/// target would reintroduce the routing failure TASK-060 closed.
export const ACCEPTANCE_MODEL_BLIND_INVARIANT_ID = "acceptance_is_model_blind";
export const ACCEPTANCE_MODEL_BLIND_SCOPE =
  "node0_acceptance_function_model_blindness";

/// The only tier that establishes the property. Named, not inlined, because the
/// whole adapter is this one decision.
const REQUIRED_TIER = "verdict_reproduced";

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * @param {unknown} attestation a NODE0-MODEL-SWAP-INVARIANCE-1A payload
 * @returns {Readonly<{observed: true, source: string, scope: string}> | null}
 *   an observation, or `null` when the attestation does not establish the
 *   property. `null` is the normal, expected answer — the closure kernel scores
 *   absent evidence as UNKNOWN, which blocks closure exactly as a violation does.
 */
export function acceptanceModelBlindObservation(attestation) {
  if (!isPlainObject(attestation)) return null;
  if (attestation.schema !== NODE0_MODEL_SWAP_INVARIANCE_SCHEMA) return null;

  const verified = verifyNode0ModelSwapInvariance(attestation);

  // `ok` already folds in hash, schema, label, all-false boundary, the three
  // invariance flags, the row re-derivation, and — critically — `swap_present`,
  // which refuses a one-model candidate set whose invariance holds vacuously.
  if (verified.ok !== true) return null;

  // Read the tier the receiver ESTABLISHED. Never assume the strongest from a
  // passing `ok`: `ok` is true at every tier, and the envelope chooses the tier.
  if (verified.established !== REQUIRED_TIER) return null;

  // A vacuous contract accepts every output, so the verdict is uniform and
  // model-independence holds without anything having been judged. The verifier
  // refuses to reproduce verdicts over an inadmissible contract, so reaching
  // this line already implies a non-vacuous one — asserted here anyway, because
  // the alternative is trusting a distant invariant to stay true.
  const contract = attestation.acceptance_contract;
  if (!isPlainObject(contract)) return null;

  const observed = attestation.invariants?.all_hold === true;
  if (observed !== true) return null;

  return Object.freeze({
    observed: true,
    // Binds to the exact attestation, not merely to the kernel that made it.
    // A source that named only the kernel would be satisfied by any run.
    source: `NODE0-MODEL-SWAP-INVARIANCE-1A ${REQUIRED_TIER} ${attestation.content_hash}`,
    scope: ACCEPTANCE_MODEL_BLIND_SCOPE,
  });
}
