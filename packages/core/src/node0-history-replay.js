// NODE0-HISTORY-REPLAY-1A — the instrument for `full_history_replayable`.
//
// The invariant asks: "Can the past be reconstructed exactly from the chain?"
// It is the last of the six that describe a RUNNING LOOP; the other five were
// settled by producers that ran a loop and disclosed a recorded artefact. This
// one is settled the same way, and the substrate already exists: the minimum
// season store writes a hash-chained, content-addressed history — `seq/NNNNNN`
// entries pointing at `states/sha256-*` and `receipts/sha256-*`, with `HEAD`
// naming the tail.
//
// This kernel is PURE. It reads nothing, executes nothing, and spawns nothing.
// It is handed a history that some producer already gathered and re-walks it
// with the SHIPPED season verifiers — a second implementation of the hashing or
// the link rule would be a second source of truth about what the chain means.
//
// Reconstruction is EXACT or it is nothing. Three verdicts, and the difference
// between two of them is the whole point:
//   RECONSTRUCTED_EXACT — every link verified and the tail equals HEAD
//   DIVERGED            — the history is present and it does not reconstruct
//   INCOMPLETE          — the history is not all here to judge
// An absent or empty history is INCOMPLETE, never RECONSTRUCTED_EXACT. Zero
// evidence must not promote into proof: a chain of nothing reconstructs nothing.

import {
  verifySeasonState,
  verifySeasonReceipt,
  verifySeasonHead,
  verifySeasonChainLink,
} from "./node0-minimum-season-save-resume.js";

export const NODE0_HISTORY_REPLAY_OBSERVATION_SCHEMA =
  "bizra.dema.node0_history_replay_observation.v0.1";

/** Must match the invariant's `required_scope` exactly or the row stays UNKNOWN. */
export const NODE0_HISTORY_REPLAY_SCOPE = "node0_history_replay";

export const NODE0_HISTORY_REPLAY_TRANSACTION_ID = "node0-history-replay-proof";

export const HISTORY_REPLAY_EVIDENCE_CLASSES = Object.freeze(["NONE", "OBSERVED"]);

export const HISTORY_REPLAY_VERDICTS = Object.freeze([
  "RECONSTRUCTED_EXACT",
  "DIVERGED",
  "INCOMPLETE",
]);

const EXACT = "RECONSTRUCTED_EXACT";
const isStr = (v) => typeof v === "string" && v.length > 0;
const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);

/**
 * Refusals that mean "I cannot judge this", not "this is wrong".
 *
 * A record written under a schema this verifier has never heard of is not a
 * refuted record — it may be perfectly valid under the verifier that wrote it.
 * Calling that DIVERGED would let a version skew masquerade as a broken chain,
 * and would score a row VIOLATED on the strength of the reader's ignorance.
 * Absence of judgement is not rejection: these map to INCOMPLETE.
 */
// Narrow deliberately. `unknown_schema` is the only refusal that means "valid,
// but written under a contract this verifier does not carry". A malformed head
// or a non-object body is not a version skew — it is a record that genuinely
// fails to reconstruct, and calling it INCOMPLETE would hide a real defect
// behind the same excuse.
export const UNJUDGEABLE_REASONS = Object.freeze(["unknown_schema"]);

const verdictFor = (reason) =>
  UNJUDGEABLE_REASONS.includes(reason) ? "INCOMPLETE" : "DIVERGED";

const out = (verdict, reason, steps = 0, finalHash = null) =>
  Object.freeze({
    verdict,
    reason,
    steps_replayed: steps,
    final_state_hash: finalHash,
  });

/**
 * Re-walk a gathered season history from genesis.
 *
 * @param seq       ordered `{state_sequence, state_hash, receipt_hash}` entries
 * @param states    map of state_hash -> state body
 * @param receipts  map of receipt_hash -> receipt body
 * @param head      the HEAD record naming the tail
 */
export function replaySeasonHistory({ seq, states, receipts, head } = {}) {
  if (!Array.isArray(seq) || seq.length === 0) {
    return out("INCOMPLETE", "no_sequence");
  }
  if (!isObj(states) || !isObj(receipts)) {
    return out("INCOMPLETE", "no_bodies");
  }
  if (!isObj(head)) {
    return out("INCOMPLETE", "no_head");
  }

  const ordered = [...seq].sort(
    (a, b) => (a?.state_sequence ?? 0) - (b?.state_sequence ?? 0),
  );

  // "Full history" means from genesis. A tail that verifies perfectly but
  // begins at sequence 4 has not reconstructed the past, it has reconstructed
  // some of it — which is INCOMPLETE, not EXACT.
  if (ordered[0]?.state_sequence !== 1) {
    return out("INCOMPLETE", "not_from_genesis");
  }

  let prev = null;
  let steps = 0;

  for (let i = 0; i < ordered.length; i += 1) {
    const entry = ordered[i];
    if (!isObj(entry) || !isStr(entry.state_hash) || !isStr(entry.receipt_hash)) {
      return out("INCOMPLETE", "sequence_entry_malformed", steps);
    }
    if (entry.state_sequence !== i + 1) {
      return out("INCOMPLETE", "sequence_gap", steps);
    }

    const state = states[entry.state_hash];
    if (!isObj(state)) {
      return out("INCOMPLETE", "state_body_missing", steps);
    }
    // Content addressing is what makes this non-vacuous: the body must re-hash
    // to the name it was filed under, so an edited state cannot pass.
    if (state.state_hash !== entry.state_hash) {
      return out("DIVERGED", "state_hash_mismatch", steps);
    }
    const sOk = verifySeasonState(state);
    if (!sOk?.ok) {
      const r = sOk?.reason ?? "state_unverified";
      return out(verdictFor(r), r, steps);
    }
    if (state.state_sequence !== entry.state_sequence) {
      return out("DIVERGED", "state_sequence_mismatch", steps);
    }

    const link = verifySeasonChainLink(state, prev);
    if (!link?.ok) {
      const r = link?.reason ?? "chain_link_broken";
      return out(verdictFor(r), r, steps);
    }

    const receipt = receipts[entry.receipt_hash];
    if (!isObj(receipt)) {
      return out("INCOMPLETE", "receipt_body_missing", steps);
    }
    const rOk = verifySeasonReceipt(receipt, state);
    if (!rOk?.ok) {
      const r = rOk?.reason ?? "receipt_unverified";
      return out(verdictFor(r), r, steps);
    }

    prev = state;
    steps += 1;
  }

  const hOk = verifySeasonHead(head);
  if (!hOk?.ok) {
    const r = hOk?.reason ?? "head_unverified";
    return out(verdictFor(r), r, steps);
  }

  const tail = ordered[ordered.length - 1];
  if (
    head.state_hash !== prev.state_hash ||
    head.receipt_hash !== tail.receipt_hash ||
    head.state_sequence !== prev.state_sequence
  ) {
    return out("DIVERGED", "head_disagrees_with_replayed_tail", steps, prev.state_hash);
  }

  return out(EXACT, null, steps, prev.state_hash);
}

/**
 * Aggregate one verdict for the NODE, not for a store.
 *
 * "Can the past be reconstructed exactly from the chain?" is asked of the node's
 * history. Replaying one arbitrarily chosen season and reporting EXACT would be
 * the same overclaim as answering a deployment question with a source scan: a
 * narrow instrument routed to a broad question. So every season present must
 * reconstruct, and one that does not is the answer for all of them.
 *
 * A divergence outranks an incompleteness: a history that is present and wrong
 * is a stronger finding than one that is merely not all here.
 */
export function aggregateReplayVerdicts(results) {
  if (!Array.isArray(results) || results.length === 0) {
    return Object.freeze({ verdict: "INCOMPLETE", reason: "no_seasons", seasons: Object.freeze([]) });
  }
  const seasons = Object.freeze(
    results.map((r) =>
      Object.freeze({
        season_id: r?.season_id ?? null,
        verdict: r?.verdict ?? "INCOMPLETE",
        reason: r?.reason ?? null,
        steps_replayed: r?.steps_replayed ?? 0,
      }),
    ),
  );
  const diverged = seasons.find((s) => s.verdict === "DIVERGED");
  if (diverged) {
    return Object.freeze({
      verdict: "DIVERGED",
      reason: `${diverged.season_id}: ${diverged.reason ?? "diverged"}`,
      seasons,
    });
  }
  const incomplete = seasons.find((s) => s.verdict !== EXACT);
  if (incomplete) {
    return Object.freeze({
      verdict: "INCOMPLETE",
      reason: `${incomplete.season_id}: ${incomplete.reason ?? "incomplete"}`,
      seasons,
    });
  }
  return Object.freeze({ verdict: EXACT, reason: null, seasons });
}

/**
 * Shape the recorded artefact. `observed_at` and `observation_hash` are excluded
 * from the hashed body so a re-read at a different clock still verifies.
 */
export function buildHistoryReplayObservation({
  facts = null,
  evidenceClass = "NONE",
  observedAt = null,
  executedCodeHash = null,
  hash,
} = {}) {
  if (typeof hash !== "function") throw new TypeError("hash function required");
  if (!HISTORY_REPLAY_EVIDENCE_CLASSES.includes(evidenceClass)) {
    throw new TypeError(`unknown evidence class: ${evidenceClass}`);
  }
  const body = {
    schema: NODE0_HISTORY_REPLAY_OBSERVATION_SCHEMA,
    scope: NODE0_HISTORY_REPLAY_SCOPE,
    transaction_id: NODE0_HISTORY_REPLAY_TRANSACTION_ID,
    evidence_class: evidenceClass,
    replay_verdict: facts?.verdict ?? null,
    replay_reason: facts?.reason ?? null,
    // Every season present on the machine, each with its own verdict. A reader
    // can see exactly which history answered and which refused.
    seasons: Object.freeze([...(facts?.seasons ?? [])]),
    seasons_replayed: (facts?.seasons ?? []).length,
    executed_code_hash: executedCodeHash,
    // The producer executed; this record says so plainly so a read-only reader
    // of it can keep declaring that IT executed nothing.
    live_execution_performed: evidenceClass === "OBSERVED",
    what_this_proves:
      "A recorded season history was re-walked from genesis with the shipped season verifiers and its tail matched HEAD exactly.",
    what_this_does_not_prove:
      "It does NOT prove every historical artefact the node ever wrote is replayable, that a chain absent from disk once existed, or that Node0 is closed. It speaks for the one season store named here.",
  };
  return Object.freeze({
    ...body,
    observed_at: observedAt,
    observation_hash: hash(body),
  });
}

export function verifyHistoryReplayHash(observation, hash) {
  if (!observation || typeof hash !== "function") return false;
  const { observed_at: _o, observation_hash: carried, ...body } = observation;
  return isStr(carried) && hash(body) === carried;
}

/** Only an OBSERVED, exactly-reconstructed history may settle the row. */
export function isCleanEligibleHistoryReplay(o) {
  return o?.evidence_class === "OBSERVED" && o?.replay_verdict === EXACT;
}
