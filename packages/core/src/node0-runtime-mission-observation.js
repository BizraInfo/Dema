// NODE0-RUNTIME-MISSION-OBSERVATION-1A — the classification contract for two
// closure rows that no read-only gate can settle:
//
//   mission_is_primary_state  <- node0_runtime_state_ownership
//   contract_is_immutable     <- node0_contract_artifact_immutability
//
// NOT ML. NOT runtime. NOT a supervisor. This kernel judges facts it is handed.
// It never spawns, never reads a file, never kills anything. The producer that
// does those things lives in scripts/proof/ and is the only thing that can
// honestly set `evidenceClass: "OBSERVED"`.
//
// WHY THE NEAR-MISSES EACH GET THEIR OWN REFUSAL. Every one of them is
// separately plausible to mistake for success, and a generic failure would let
// the wrong one be dismissed as the right one:
//   PREDECESSOR_STILL_LIVE            two live workers is concurrency, not succession
//   NOT_KILLED                        a clean exit proves an orderly shutdown, a different claim
//   SAME_PROCESS                      one process cannot demonstrate replacement
//   STATE_NOT_RECONSTRUCTED_FROM_HOME state carried in argv proves the harness, not the home
//   MISSION_IDENTITY_CHANGED          a different mission is not a resume
//   RESUMED_FROM_FRESH_STATE          the flattering near-miss: healthy, working, and started over
//   HUMAN_INTERVENED                  "without human hands" is the actual question
//
// AND THE CONTROLS ARE PART OF THE VERDICT. A harness whose negative control also
// "recovered", or whose operator control produced no new hash, has not
// discriminated — it has produced a green that would appear whatever happened.
// Those are CONTROL_NOT_RUN and CONTROL_DID_NOT_DISCRIMINATE rather than silent
// passes, because an unrun control is exactly what a vacuous proof looks like.
//
// Pure: no fs, no network, no process, no clock, no random, no model call.
// `hash` is injected so the digest can be re-derived by someone who does not
// trust this file.

export const NODE0_RUNTIME_MISSION_SCHEMA =
  "bizra.dema.node0_runtime_mission_observation.v0.1";

/// Exported so an adapter IMPORTS the term rather than retyping it.
export const NODE0_RUNTIME_STATE_OWNERSHIP_SCOPE = "node0_runtime_state_ownership";
export const NODE0_CONTRACT_IMMUTABILITY_SCOPE = "node0_contract_artifact_immutability";

export const RUNTIME_MISSION_EVIDENCE_CLASSES = Object.freeze([
  "OBSERVED",
  "OPERATOR_ASSERTED",
  "TEST_INJECTION",
  "NONE",
]);

export const STATE_OWNERSHIP_VERDICTS = Object.freeze([
  "NOT_ATTEMPTED",
  "NOT_OBSERVED",
  "OPERATOR_ASSERTED_ONLY",
  "CONTROL_NOT_RUN",
  "CONTROL_DID_NOT_DISCRIMINATE",
  "PREDECESSOR_STILL_LIVE",
  "NOT_KILLED",
  "SAME_PROCESS",
  "STATE_NOT_RECONSTRUCTED_FROM_HOME",
  "MISSION_IDENTITY_CHANGED",
  "RESUMED_FROM_FRESH_STATE",
  "HUMAN_INTERVENED",
  "MISSION_STATE_PRIMARY_PROVEN",
]);

export const CONTRACT_IMMUTABILITY_VERDICTS = Object.freeze([
  "NOT_ATTEMPTED",
  "NOT_OBSERVED",
  "OPERATOR_ASSERTED_ONLY",
  "CONTROL_NOT_RUN",
  "CONTROL_DID_NOT_DISCRIMINATE",
  "AMENDMENT_NOT_REFUSED",
  "CONTRACT_HASH_CHANGED",
  "REFUSAL_NOT_RECEIPTED",
  "CONTRACT_IMMUTABLE_PROVEN",
]);

export const NODE0_VERIFIER_INDEPENDENCE_SCOPE = "node0_verifier_independence";
export const NODE0_CYCLE_AUTHORITY_DELTA_SCOPE = "node0_cycle_authority_delta";

export const VERIFIER_INDEPENDENCE_VERDICTS = Object.freeze([
  "NOT_ATTEMPTED",
  "NOT_OBSERVED",
  "OPERATOR_ASSERTED_ONLY",
  "CONTROL_NOT_RUN",
  "CONTROL_DID_NOT_DISCRIMINATE",
  "SAME_PROCESS_VERIFIED",
  "LAW_NOT_INDEPENDENTLY_OBTAINED",
  "VERIFIER_USED_EXECUTOR_CLAIM",
  "NO_EXACT_COMPARISON",
  "VERIFICATION_EXTERNAL_PROVEN",
]);

export const AUTHORITY_DELTA_VERDICTS = Object.freeze([
  "NOT_ATTEMPTED",
  "NOT_OBSERVED",
  "OPERATOR_ASSERTED_ONLY",
  "CONTROL_NOT_RUN",
  "WIDENING_ACCEPTED",
  "AUTHORITY_WIDENED",
  "CARRIED_CLAIM_CONTRADICTS_MEASUREMENT",
  "AUTHORITY_DELTA_ZERO_PROVEN",
]);

/// Every widening vector the cycle must have TRIED. An untried vector is
/// CONTROL_NOT_RUN, never a silent pass: "nobody attempted to widen authority"
/// and "widening was refused" are different facts.
const WIDENING_VECTORS = Object.freeze([
  "worker_a_widen_refused",
  "worker_b_widen_refused",
  "restart_widen_refused",
  "self_grant_refused",
  "stale_grant_refused",
]);

const CLEAN_VERIF = "VERIFICATION_EXTERNAL_PROVEN";
const CLEAN_AUTH = "AUTHORITY_DELTA_ZERO_PROVEN";

const CLEAN_STATE = "MISSION_STATE_PRIMARY_PROVEN";
const CLEAN_IMMUT = "CONTRACT_IMMUTABLE_PROVEN";
const isStr = (v) => typeof v === "string" && v.length > 0;
const isInt = (v) => Number.isInteger(v) && v >= 0;

function classifyStateOwnership(pre, suc, control, evidenceClass) {
  if (!pre && !suc) return "NOT_ATTEMPTED";
  if (evidenceClass === "OPERATOR_ASSERTED") return "OPERATOR_ASSERTED_ONLY";
  if (evidenceClass !== "OBSERVED") return "NOT_OBSERVED";
  if (!control || control.attempted !== true) return "CONTROL_NOT_RUN";
  // If a worker-local-only mission ALSO recovers, recovery is not evidence that
  // state lives outside the worker.
  if (control.recovered !== false) return "CONTROL_DID_NOT_DISCRIMINATE";
  if (!pre || pre.exited !== true) return "PREDECESSOR_STILL_LIVE";
  if (pre.killed_with !== "SIGKILL") return "NOT_KILLED";
  if (!suc || !isInt(suc.pid) || suc.pid === pre.pid) return "SAME_PROCESS";
  if (suc.reconstructed_from !== "dema_home_only") return "STATE_NOT_RECONSTRUCTED_FROM_HOME";
  if (suc.mission_id !== pre.mission_id || suc.contract_hash !== pre.contract_hash) return "MISSION_IDENTITY_CHANGED";
  if (!isStr(suc.resumed_state_hash) || suc.resumed_state_hash !== pre.checkpoint_state_hash) return "RESUMED_FROM_FRESH_STATE";
  if (!isInt(suc.state_seq) || suc.state_seq <= pre.state_seq) return "RESUMED_FROM_FRESH_STATE";
  if (suc.human_steps_between !== 0) return "HUMAN_INTERVENED";
  return CLEAN_STATE;
}

function classifyContractImmutability(im, evidenceClass) {
  if (!im) return "NOT_ATTEMPTED";
  if (evidenceClass === "OPERATOR_ASSERTED") return "OPERATOR_ASSERTED_ONLY";
  if (evidenceClass !== "OBSERVED") return "NOT_OBSERVED";
  // A contract that refuses EVERY amendment is broken, not immutable. The
  // operator control proves the refusal discriminates by channel.
  if (im.operator_control_attempted !== true) return "CONTROL_NOT_RUN";
  if (!isStr(im.operator_control_new_hash) || im.operator_control_new_hash === im.contract_hash_before) {
    return "CONTROL_DID_NOT_DISCRIMINATE";
  }
  if (!isStr(im.amendment_refusal)) return "AMENDMENT_NOT_REFUSED";
  if (!isStr(im.contract_hash_before) || im.contract_hash_before !== im.contract_hash_after) return "CONTRACT_HASH_CHANGED";
  if (im.refusal_receipted !== true) return "REFUSAL_NOT_RECEIPTED";
  return CLEAN_IMMUT;
}

function classifyVerifierIndependence(v, evidenceClass) {
  if (!v) return "NOT_ATTEMPTED";
  if (evidenceClass === "OPERATOR_ASSERTED") return "OPERATOR_ASSERTED_ONLY";
  if (evidenceClass !== "OBSERVED") return "NOT_OBSERVED";
  // A verifier that only ever REJECTS discriminates nothing, so the episode must
  // also contain one independently re-derived ACCEPT.
  if (!isStr(v.positive_control_verdict)) return "CONTROL_NOT_RUN";
  if (v.positive_control_verdict !== "ACCEPT") return "CONTROL_DID_NOT_DISCRIMINATE";
  // THE SELF-CERTIFICATION CONTROL. The executor must have claimed success on
  // something the independent verifier then REJECTED. If the two agreed, the
  // episode shows they coincided, not that self-certification fails.
  if (v.executor_self_claimed_success === true && v.independently_rederived_verdict !== "REJECT") {
    return "CONTROL_DID_NOT_DISCRIMINATE";
  }
  if (!isInt(v.executor_pid) || !isInt(v.verifier_pid) || v.executor_pid === v.verifier_pid) {
    return "SAME_PROCESS_VERIFIED";
  }
  // Being HANDED the law by the party under judgement is not independence.
  if (v.law_source !== "rederived_from_persisted_contract_fields") return "LAW_NOT_INDEPENDENTLY_OBTAINED";
  if (v.authoritative_verdict_source !== "independent_verifier") return "VERIFIER_USED_EXECUTOR_CLAIM";
  if (v.exact_comparison_performed !== true) return "NO_EXACT_COMPARISON";
  return CLEAN_VERIF;
}

/// The delta is MEASURED here from the before/after hashes. A carried
/// `authority_delta: 0` is treated as a claim to be checked, never as the answer.
function measureAuthorityDelta(a) {
  if (!a || !isStr(a.authority_before_hash) || !isStr(a.authority_after_hash)) return null;
  return a.authority_before_hash === a.authority_after_hash ? 0 : 1;
}

function classifyAuthorityDelta(a, evidenceClass, measured) {
  if (!a) return "NOT_ATTEMPTED";
  if (evidenceClass === "OPERATOR_ASSERTED") return "OPERATOR_ASSERTED_ONLY";
  if (evidenceClass !== "OBSERVED") return "NOT_OBSERVED";
  if (measured === null) return "CONTROL_NOT_RUN";
  for (const k of WIDENING_VECTORS) {
    if (typeof a[k] !== "boolean") return "CONTROL_NOT_RUN";
  }
  if (WIDENING_VECTORS.some((k) => a[k] === false)) return "WIDENING_ACCEPTED";
  if (measured !== 0) return "AUTHORITY_WIDENED";
  if (a.carried_authority_delta_claim !== measured) return "CARRIED_CLAIM_CONTRADICTS_MEASUREMENT";
  return CLEAN_AUTH;
}

/**
 * Build one deep-frozen, re-derivable runtime observation.
 *
 * The digest covers the FACTS and the derived verdicts, and deliberately excludes
 * `observed_at`: two identical observations recorded years apart must bind to the
 * same witness.
 */
export function buildRuntimeMissionObservation({
  predecessor = null,
  successor = null,
  workerLocalControl = null,
  immutability = null,
  verification = null,
  authority = null,
  evidenceClass = "NONE",
  observedAt = null,
  executedCodeHash = null,
  hash,
} = {}) {
  if (typeof hash !== "function") {
    throw new TypeError("buildRuntimeMissionObservation requires an injected `hash`");
  }
  const cls = RUNTIME_MISSION_EVIDENCE_CLASSES.includes(evidenceClass) ? evidenceClass : "NONE";
  const pre = predecessor && typeof predecessor === "object" ? predecessor : null;
  const suc = successor && typeof successor === "object" ? successor : null;
  const ctl = workerLocalControl && typeof workerLocalControl === "object" ? workerLocalControl : null;
  const im = immutability && typeof immutability === "object" ? immutability : null;
  const vf = verification && typeof verification === "object" ? verification : null;
  const au = authority && typeof authority === "object" ? authority : null;
  const measured_authority_delta = measureAuthorityDelta(au);

  const body = {
    schema: NODE0_RUNTIME_MISSION_SCHEMA,
    evidence_class: cls,
    state_ownership_scope: NODE0_RUNTIME_STATE_OWNERSHIP_SCOPE,
    contract_immutability_scope: NODE0_CONTRACT_IMMUTABILITY_SCOPE,
    state_ownership_verdict: classifyStateOwnership(pre, suc, ctl, cls),
    contract_immutability_verdict: classifyContractImmutability(im, cls),
    verifier_independence_scope: NODE0_VERIFIER_INDEPENDENCE_SCOPE,
    cycle_authority_delta_scope: NODE0_CYCLE_AUTHORITY_DELTA_SCOPE,
    verifier_independence_verdict: classifyVerifierIndependence(vf, cls),
    authority_delta_verdict: classifyAuthorityDelta(au, cls, measured_authority_delta),
    measured_authority_delta,
    predecessor_pid: pre?.pid ?? null,
    predecessor_exited: pre?.exited ?? null,
    predecessor_killed_with: pre?.killed_with ?? null,
    predecessor_state_seq: pre?.state_seq ?? null,
    predecessor_checkpoint_state_hash: pre?.checkpoint_state_hash ?? null,
    successor_pid: suc?.pid ?? null,
    successor_reconstructed_from: suc?.reconstructed_from ?? null,
    successor_state_seq: suc?.state_seq ?? null,
    successor_resumed_state_hash: suc?.resumed_state_hash ?? null,
    human_steps_between: suc?.human_steps_between ?? null,
    mission_id: pre?.mission_id ?? suc?.mission_id ?? null,
    contract_hash: pre?.contract_hash ?? suc?.contract_hash ?? null,
    worker_local_control_attempted: ctl?.attempted ?? null,
    worker_local_control_recovered: ctl?.recovered ?? null,
    amendment_channel: im?.amendment_channel ?? null,
    amendment_refusal: im?.amendment_refusal ?? null,
    contract_hash_before: im?.contract_hash_before ?? null,
    contract_hash_after: im?.contract_hash_after ?? null,
    refusal_receipted: im?.refusal_receipted ?? null,
    operator_control_attempted: im?.operator_control_attempted ?? null,
    operator_control_new_hash: im?.operator_control_new_hash ?? null,
    executor_pid: vf?.executor_pid ?? null,
    verifier_pid: vf?.verifier_pid ?? null,
    law_source: vf?.law_source ?? null,
    executor_self_claimed_success: vf?.executor_self_claimed_success ?? null,
    independently_rederived_verdict: vf?.independently_rederived_verdict ?? null,
    positive_control_verdict: vf?.positive_control_verdict ?? null,
    authoritative_verdict_source: vf?.authoritative_verdict_source ?? null,
    exact_comparison_performed: vf?.exact_comparison_performed ?? null,
    authority_before_hash: au?.authority_before_hash ?? null,
    authority_after_hash: au?.authority_after_hash ?? null,
    carried_authority_delta_claim: au?.carried_authority_delta_claim ?? null,
    widening_vectors_refused: au ? Object.fromEntries(WIDENING_VECTORS.map((k) => [k, au[k] ?? null])) : null,
    executed_code_hash: executedCodeHash,
    authority_delta: 0,
  };

  return Object.freeze({
    ...body,
    observed_at: observedAt,
    observation_hash: hash(body),
  });
}

/// Re-derive rather than trust. `observed_at` and the carried hash are excluded
/// from the recomputation exactly as they were from the original.
export function verifyRuntimeMissionHash(observation, hash) {
  if (!observation || typeof hash !== "function") return false;
  const { observed_at: _o, observation_hash: carried, ...body } = observation;
  return isStr(carried) && hash(body) === carried;
}

export function isCleanEligibleStateOwnership(o) {
  return o?.evidence_class === "OBSERVED" && o?.state_ownership_verdict === CLEAN_STATE;
}

export function isCleanEligibleContractImmutability(o) {
  return o?.evidence_class === "OBSERVED" && o?.contract_immutability_verdict === CLEAN_IMMUT;
}

export function isCleanEligibleVerifierIndependence(o) {
  return o?.evidence_class === "OBSERVED" && o?.verifier_independence_verdict === CLEAN_VERIF;
}

export function isCleanEligibleAuthorityDelta(o) {
  return o?.evidence_class === "OBSERVED" && o?.authority_delta_verdict === CLEAN_AUTH;
}
