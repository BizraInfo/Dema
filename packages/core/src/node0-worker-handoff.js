// NODE0-WORKER-HANDOFF-1A — one typed observation of a worker handoff.
//
// `worker_is_replaceable` asks: "If a worker exits, can another resume from the
// checkpoint?" Every other closure instrument in this tree answers a question
// about a MOMENT. This one is about a TRANSITION between two processes, which is
// why a health probe cannot answer it however healthy the answer is, and why the
// read-only review gate cannot settle it from source at all.
//
// This kernel is the contract that separates "a second worker is running" from
// "the first worker's work survived its death". It is PURE: no fs, no net, no
// clock, no spawn, no randomness. Every fact is injected, so the classification
// replays byte-for-byte from the recorded observation and anyone can re-derive
// it without trusting the process that produced it.
//
// Nothing here grants authority. `authority_delta` is 0 on every path, and a
// proven handoff is still not permission to do anything.

export const NODE0_WORKER_HANDOFF_SCHEMA =
  "bizra.dema.node0_worker_handoff_observation.v0.1";

/// The scope the closure registry requires for `worker_is_replaceable`. Exported
/// so an adapter IMPORTS the term rather than retyping it — the first adapter in
/// this tree retyped its own, which is why NCG-09 had to be written.
export const NODE0_WORKER_HANDOFF_SCOPE = "node0_runtime_worker_handoff";

export const WORKER_HANDOFF_VERDICTS = Object.freeze([
  "NOT_ATTEMPTED",            // nothing was supplied; no handoff was tried
  "NOT_OBSERVED",             // facts present, but not from a genuine observation
  "OPERATOR_ASSERTED_HANDOFF",// a human or script asserted it; useful, not proof
  "PREDECESSOR_STILL_LIVE",   // two workers, not a succession
  "NO_CHECKPOINT",            // it died, but left nothing to resume
  "FENCE_NOT_TRANSFERRED",    // the successor never barred the predecessor
  "RESUMED_FROM_FRESH_STATE", // it started again rather than continuing
  "CHAIN_BROKEN",             // it resumed something, but not that checkpoint
  "HANDOFF_PROVEN",
]);

/// Exactly one verdict may support a closure CLEAN. A second would be the door
/// through which "nearly" becomes "proven" without anyone deciding to open it.
export const CLEAN_ELIGIBLE_HANDOFF_VERDICTS = Object.freeze(["HANDOFF_PROVEN"]);

export const WORKER_HANDOFF_EVIDENCE_CLASSES = Object.freeze([
  "OBSERVED",          // a real kill and a real resume were watched happening
  "OPERATOR_ASSERTED", // someone reported it on the runtime's behalf
  "TEST_INJECTION",    // composition testing only; never evidence
  "NONE",
]);

/// The fence state that proves the predecessor was barred, not merely absent.
/// Mirrors `STALE_OWNER_FENCED` in packages/receipts/src/mission-closure-ownership.js.
const FENCED = "STALE_OWNER_FENCED";
const TAKEOVER = "DEAD_OWNER_TAKEOVER";

const isPositiveInt = (v) => Number.isInteger(v) && v >= 0;
const isNonEmptyString = (v) => typeof v === "string" && v.length > 0;

/**
 * Build one deep-frozen, replayable handoff observation.
 *
 * `hash` is injected so this kernel never imports crypto and the digest can be
 * re-derived independently. It covers the OBSERVED FACTS only — never
 * `observed_at`, which is metadata: two identical handoffs recorded years apart
 * must bind to the same witness.
 */
export function buildWorkerHandoffObservation({
  predecessor = null,
  successor = null,
  evidenceClass = "NONE",
  observedAt = null,
  runnerCommit = null,
  executedCodeHash = null,
  hash,
} = {}) {
  if (typeof hash !== "function") {
    throw new TypeError("buildWorkerHandoffObservation requires an injected `hash`");
  }

  const blocked = [];
  const pre = predecessor && typeof predecessor === "object" ? predecessor : null;
  const suc = successor && typeof successor === "object" ? successor : null;

  // "No handoff was attempted" and "a handoff was attempted and failed" are
  // different facts. Collapsing them would let an unrun proof read as a refuted
  // one, which is how an untested claim becomes a settled negative.
  const attempted = pre !== null || suc !== null;

  let verdict;
  if (!attempted) {
    verdict = "NOT_ATTEMPTED";
    blocked.push("no_handoff_supplied");
  } else if (evidenceClass === "OPERATOR_ASSERTED") {
    verdict = "OPERATOR_ASSERTED_HANDOFF";
    blocked.push("operator_asserted_handoff_is_not_an_observation");
  } else if (evidenceClass !== "OBSERVED") {
    // TEST_INJECTION and NONE both land here. A fixture that could promote
    // itself into evidence is the entire attack this refuses.
    verdict = "NOT_OBSERVED";
    blocked.push(
      evidenceClass === "TEST_INJECTION"
        ? "test_injection_is_not_observation"
        : "no_observation_produced",
    );
  } else if (!pre || pre.exited !== true) {
    // THE CENTRAL REFUSAL. Two live workers sharing a checkpoint is concurrency.
    // The artefact can look identical to a real handoff — same takeover, same
    // resume, same chain — and it proves nothing about replaceability.
    verdict = "PREDECESSOR_STILL_LIVE";
    blocked.push("predecessor_did_not_exit");
  } else if (!isPositiveInt(pre.checkpoint_sequence) || !isNonEmptyString(pre.checkpoint_head_hash)) {
    verdict = "NO_CHECKPOINT";
    blocked.push("predecessor_left_no_checkpoint");
  } else if (
    !suc ||
    suc.claim_kind !== TAKEOVER ||
    suc.predecessor_fence_status !== FENCED ||
    !isNonEmptyString(suc.fencing_token) ||
    !isNonEmptyString(suc.predecessor_fencing_token) ||
    !isNonEmptyString(pre.fencing_token) ||
    suc.fencing_token === suc.predecessor_fencing_token ||
    // The successor must name the EXACT claim it displaced. A takeover that
    // fenced some other claim fenced the wrong worker, and one that names
    // nothing cannot be shown to have fenced anyone.
    suc.predecessor_fencing_token !== pre.fencing_token
  ) {
    // Outliving the predecessor is not fencing it. Without a superseding claim
    // the predecessor could still write, so the state the successor resumed is
    // not exclusively its own.
    //
    // A fencing token here is the canonical hash of the claim body, not a
    // counter — see packages/receipts/src/mission-closure-ownership.js, where
    // two processes must derive the identical token from the identical claim or
    // the fence cannot arbitrate between them.
    verdict = "FENCE_NOT_TRANSFERRED";
    blocked.push("predecessor_not_fenced_by_a_claim_naming_it");
  } else if (suc.season_id !== pre.season_id || !isNonEmptyString(suc.resumed_from_head_hash)) {
    // The most flattering near-miss: the successor comes up healthy and works.
    // It began again. Nothing crossed the exit.
    verdict = "RESUMED_FROM_FRESH_STATE";
    blocked.push("successor_started_a_new_season");
  } else if (
    suc.resumed_from_head_hash !== pre.checkpoint_head_hash ||
    !isPositiveInt(suc.resumed_sequence) ||
    suc.resumed_sequence <= pre.checkpoint_sequence
  ) {
    // Right season, wrong parent — or a sequence that does not advance past the
    // checkpoint, which is a rewind wearing a resume's clothes.
    verdict = "CHAIN_BROKEN";
    blocked.push("resumed_state_does_not_chain_to_the_checkpoint");
  } else {
    verdict = "HANDOFF_PROVEN";
  }

  const facts = {
    schema: NODE0_WORKER_HANDOFF_SCHEMA,
    scope: NODE0_WORKER_HANDOFF_SCOPE,
    verdict,
    evidence_class: WORKER_HANDOFF_EVIDENCE_CLASSES.includes(evidenceClass)
      ? evidenceClass
      : "NONE",
    predecessor_worker_id: pre?.worker_id ?? null,
    predecessor_pid: Number.isInteger(pre?.pid) ? pre.pid : null,
    predecessor_boot_identity_hash: pre?.boot_identity_hash ?? null,
    predecessor_exited: pre?.exited === true,
    checkpoint_sequence: isPositiveInt(pre?.checkpoint_sequence) ? pre.checkpoint_sequence : null,
    checkpoint_head_hash: pre?.checkpoint_head_hash ?? null,
    successor_worker_id: suc?.worker_id ?? null,
    successor_pid: Number.isInteger(suc?.pid) ? suc.pid : null,
    successor_boot_identity_hash: suc?.boot_identity_hash ?? null,
    claim_kind: suc?.claim_kind ?? null,
    predecessor_fence_status: suc?.predecessor_fence_status ?? null,
    predecessor_fencing_token_held: pre?.fencing_token ?? null,
    fencing_token: suc?.fencing_token ?? null,
    fenced_predecessor_token: suc?.predecessor_fencing_token ?? null,
    resumed_sequence: isPositiveInt(suc?.resumed_sequence) ? suc.resumed_sequence : null,
    resumed_from_head_hash: suc?.resumed_from_head_hash ?? null,
    season_id: pre?.season_id ?? suc?.season_id ?? null,
    // Binds the classification to the bytes that produced it, so a later reader
    // knows which runner observed this and can re-derive it.
    runner_commit: runnerCommit,
    executed_code_hash: executedCodeHash,
    // Capability disclosure travels WITH the observation. A producer that spawned
    // and killed processes cannot later be described as read-only.
    live_execution_performed: evidenceClass === "OBSERVED",
    file_mutation_performed: evidenceClass === "OBSERVED",
    public_network_used: false,
    activation_performed: false,
    authority_delta: 0,
    blocked_by: Object.freeze([...blocked]),
  };

  const observation_hash = hash(facts);
  return Object.freeze({ ...facts, observed_at: observedAt, observation_hash });
}

/** Re-derive the hash from the observation's own fields — never trust the carried one. */
export function verifyWorkerHandoffHash(observation, hash) {
  if (typeof hash !== "function") {
    throw new TypeError("verifyWorkerHandoffHash requires an injected `hash`");
  }
  if (!observation || typeof observation !== "object") return false;
  const { observed_at, observation_hash, ...facts } = observation;
  return hash(facts) === observation_hash;
}

/** Only a genuinely observed, fully proven handoff may support a closure CLEAN. */
export function isCleanEligibleHandoff(observation) {
  return (
    !!observation &&
    CLEAN_ELIGIBLE_HANDOFF_VERDICTS.includes(observation.verdict) &&
    observation.evidence_class === "OBSERVED" &&
    observation.authority_delta === 0 &&
    observation.activation_performed === false
  );
}
