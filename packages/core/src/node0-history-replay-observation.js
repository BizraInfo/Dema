// NODE0-HISTORY-REPLAY-1A — can the past be reconstructed exactly from the chain?
//
// The closure row this settles is `full_history_replayable`, and the trap it has
// to avoid is the one every replay claim falls into: a process that still holds
// the history in memory can "replay" it perfectly and prove nothing. Replay is
// only meaningful when the thing that PRODUCED the history is gone.
//
// So the producer spends its own process. Phase 1 establishes a genesis root,
// writes real receipts, rotates the authorship key, and exits. Phase 2 is a
// fresh interpreter that has never seen any of it and must reconstruct the
// lineage from durable bytes alone.
//
// WHY EVERY NEGATIVE CONTROL IS A STORED FIELD. A replayer that accepts
// everything reconstructs a tampered history just as happily as a true one, and
// reports success either way. "It replayed" is therefore not evidence; "it
// replayed AND refused four specific corruptions" is. Each control below records
// whether the corrupted history was actually REJECTED, and a control that failed
// to reject flips the verdict to REFUTED rather than merely withholding it —
// because a replayer proven to accept a forgery is worse than one that never ran.
//
// MODEL-BLIND BY CONSTRUCTION. Nothing here reads a model, a prompt, a worker's
// memory, or any in-process state. The admissible inputs are the canonical
// ledger, the genesis root record, and the key generation store — all durable,
// all on disk, all independently re-readable.
//
// Pure: no fs, no network, no clock, no random, no crypto. Facts in, verdict out.

export const NODE0_HISTORY_REPLAY_OBSERVATION_SCHEMA =
  "bizra.dema.node0_history_replay_observation.v0.1";

export const NODE0_HISTORY_REPLAY_SCOPE = "node0_history_replay";

export const HISTORY_REPLAY_EVIDENCE_CLASSES = Object.freeze([
  "OBSERVED",
  "OPERATOR_ASSERTED",
  "TEST_INJECTION",
  "NONE",
]);

export const HISTORY_REPLAY_VERDICTS = Object.freeze([
  "NOT_OBSERVED",
  "OPERATOR_ASSERTED_ONLY",
  "NO_REPLAY_EVIDENCE",
  "REPLAY_INCOMPLETE",
  "REPLAY_REFUTED",
  "HISTORY_REPLAY_PROVEN",
]);

/**
 * The positive facts a successful replay must report. Each is a claim about what
 * the FRESH process reconstructed, not about what the producer remembered.
 */
export const REPLAY_POSITIVE_FACTS = Object.freeze([
  "producer_process_exited",      // the history's author is gone
  "replayed_in_fresh_process",    // a different interpreter did the reading
  "genesis_root_recovered",       // K0 came from the durable root record
  "chain_verified_from_root",     // the whole lineage walks from K0
  "authority_succession_replayed",// K0 -> K1 crossed during the walk
  "final_authority_matches_store",// the walk lands on today's active key
  "worker_state_absent",          // no transient producer state was consulted
]);

/**
 * The corruptions a trustworthy replayer must REFUSE. Each field records the
 * result of actually feeding that corruption to the replayer: `true` means it
 * was rejected. A `false` here is a refutation, not a gap.
 */
export const REPLAY_NEGATIVE_CONTROLS = Object.freeze([
  "tampered_receipt_rejected",    // one byte changed in a receipt body
  "reordered_chain_rejected",     // prev_hash linkage broken
  "missing_root_rejected",        // no genesis root -> fail closed
  "foreign_root_rejected",        // an unrelated key offered as genesis
]);

const isBool = (v) => typeof v === "boolean";
const isStr = (v) => typeof v === "string" && v.length > 0;
const isInt = (v) => Number.isInteger(v) && v >= 0;

/**
 * Verdict from supplied facts.
 *
 * Order matters. A refuted control outranks an incomplete fact set: if the
 * replayer demonstrably accepted a forgery, that is the finding, and a missing
 * unrelated field must not downgrade it to "we did not look".
 */
function classify(facts, cls) {
  if (cls === "OPERATOR_ASSERTED") return "OPERATOR_ASSERTED_ONLY";
  if (cls !== "OBSERVED") return "NOT_OBSERVED";
  if (!facts || typeof facts !== "object" || Array.isArray(facts)) return "NO_REPLAY_EVIDENCE";

  // A control that RAN and failed to reject is a refutation.
  for (const k of REPLAY_NEGATIVE_CONTROLS) {
    if (facts[k] === false) return "REPLAY_REFUTED";
  }
  for (const k of REPLAY_NEGATIVE_CONTROLS) {
    if (!isBool(facts[k])) return "REPLAY_INCOMPLETE";
  }
  for (const k of REPLAY_POSITIVE_FACTS) {
    if (!isBool(facts[k])) return "REPLAY_INCOMPLETE";
    if (facts[k] === false) return "REPLAY_REFUTED";
  }
  // Identity of the lineage must be carried, or "it replayed" names nothing.
  if (!isStr(facts.genesis_root_fingerprint)) return "REPLAY_INCOMPLETE";
  if (!isStr(facts.final_authority_fingerprint)) return "REPLAY_INCOMPLETE";
  if (!isInt(facts.ledger_entries) || facts.ledger_entries === 0) return "REPLAY_INCOMPLETE";
  if (!isInt(facts.successions_replayed) || facts.successions_replayed === 0) {
    return "REPLAY_INCOMPLETE";
  }
  // Root and current authority must be DIFFERENT, or the replay never crossed a
  // rotation and the hard half of the claim was never exercised.
  if (facts.genesis_root_fingerprint === facts.final_authority_fingerprint) {
    return "REPLAY_INCOMPLETE";
  }
  return "HISTORY_REPLAY_PROVEN";
}

/// Only a proven or refuted replay contributes a value. Everything else is null,
/// which the evaluator scores UNKNOWN — the honest answer when nobody looked.
function observedFor(verdict) {
  if (verdict === "HISTORY_REPLAY_PROVEN") return true;
  if (verdict === "REPLAY_REFUTED") return false;
  return null;
}

export function buildHistoryReplayObservation({
  facts = null,
  evidenceClass = "NONE",
  observedAt = null,
  executedCodeHash = null,
  hash,
} = {}) {
  if (typeof hash !== "function") {
    throw new TypeError("buildHistoryReplayObservation requires an injected `hash`");
  }
  const cls = HISTORY_REPLAY_EVIDENCE_CLASSES.includes(evidenceClass) ? evidenceClass : "NONE";
  const replay_verdict = classify(facts, cls);

  const body = {
    schema: NODE0_HISTORY_REPLAY_OBSERVATION_SCHEMA,
    evidence_class: cls,
    scope: NODE0_HISTORY_REPLAY_SCOPE,
    replay_verdict,
    observed: observedFor(replay_verdict),
    genesis_root_fingerprint: facts?.genesis_root_fingerprint ?? null,
    final_authority_fingerprint: facts?.final_authority_fingerprint ?? null,
    ledger_entries: isInt(facts?.ledger_entries) ? facts.ledger_entries : null,
    successions_replayed: isInt(facts?.successions_replayed) ? facts.successions_replayed : null,
    positive_facts: Object.freeze(
      Object.fromEntries(REPLAY_POSITIVE_FACTS.map((k) => [k, facts?.[k] ?? null])),
    ),
    negative_controls: Object.freeze(
      Object.fromEntries(REPLAY_NEGATIVE_CONTROLS.map((k) => [k, facts?.[k] ?? null])),
    ),
    executed_code_hash: executedCodeHash,
    authority_delta: 0,
    observed_at: observedAt,
  };
  return Object.freeze({ ...body, observation_hash: hash(body) });
}

export function verifyHistoryReplayHash(observation, hash) {
  if (!observation || typeof observation !== "object") return false;
  const { observation_hash, ...body } = observation;
  try {
    return hash(body) === observation_hash;
  } catch {
    return false;
  }
}

/// The adapter may only source the row from a replay that PROVED itself.
export function isProvenHistoryReplay(o) {
  return Boolean(o) && o.replay_verdict === "HISTORY_REPLAY_PROVEN" && o.observed === true;
}
