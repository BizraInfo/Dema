// NODE0-ENDURANCE-CHAIN-1A — tamper-evidence for the endurance record.
//
// ── WHY A HASH CHAIN ALONE IS NOT TAMPER-EVIDENCE ──
// A chain detects that a record was CHANGED. It cannot detect that records were
// REMOVED FROM THE END, because a truncated prefix of a valid chain is itself a
// valid chain — it verifies perfectly and reports nothing wrong. Deleting the
// file entirely is worse still: an empty chain is trivially valid.
//
// This estate has already measured that exact failure: an erased chain verified
// `valid: true`. A witness kept inside the thing it testifies about dies with it.
//
// So integrity here is TWO artefacts that must agree:
//   1. the chained records  — detect modification, reordering, insertion, and
//                             deletion from the MIDDLE
//   2. an out-of-band ANCHOR — a separate file naming the head (seq + hash), so
//                             deletion from the END and wholesale erasure become
//                             a disagreement instead of a silence
//
// ── WHAT THIS IS NOT ──
// This is tamper-EVIDENT, not tamper-PROOF. Nothing here is signed: an actor
// with write access to BOTH artefacts can rewrite them consistently and this
// module will report SEALED. Signing requires an identity key, which is a halt
// gate in this program. The honest claim is: silent loss and single-artefact
// edits are detected. A coordinated forger is not.
//
// PURE: no fs, clock, network, process or randomness. Records, the anchor and
// the runner binding are all injected by the caller.

import { sha256CanonicalJsonV1 } from "../../canon/src/sha256-canonical-json-v1.js";

export const NODE0_ENDURANCE_CHAIN_SCHEMA = "bizra.dema.node0_endurance_chain.v0.1";
export const NODE0_ENDURANCE_ANCHOR_SCHEMA = "bizra.dema.node0_endurance_anchor.v0.1";

export const ENDURANCE_HEADER_KIND = "ENDURANCE_RUN_HEADER";
export const ENDURANCE_SAMPLE_KIND = "ENDURANCE_SAMPLE";

/**
 * How the record came to exist.
 *
 * `ELAPSED` is the only class that can support an endurance TARGET claim: it
 * means a runner loop actually sat there for that wall-clock time. `CUSTOM_TEST`
 * records are synthesised — they are legitimate evidence that the JUDGMENT works,
 * and are never evidence that a node endured anything.
 */
export const ENDURANCE_EVIDENCE_CLASSES = Object.freeze({
  ELAPSED: "ELAPSED",
  CUSTOM_TEST: "CUSTOM_TEST",
});

export const CHAIN_STATES = Object.freeze([
  "ABSENT",    // no chain fields — a legacy record, not witnessed and not accused
  "SEALED",    // records and anchor agree exactly
  "TORN_TAIL", // records lead the anchor by one append: a crash, not an edit
  "TRUNCATED", // the anchor names a head the records no longer reach: removal
  "BROKEN",    // the chain does not verify
]);

/** Hash a record over everything EXCEPT its own `hash` field. */
export function enduranceRecordHash(record) {
  const { hash: _self, ...payload } = record ?? {};
  return sha256CanonicalJsonV1(payload);
}

/** Link one record onto the chain. `prev` is null only for the header. */
export function chainEnduranceRecord({ record, prev = null }) {
  const body = {
    ...record,
    seq: prev ? prev.seq + 1 : 0,
    prev_hash: prev ? prev.hash : null,
  };
  return Object.freeze({ ...body, hash: enduranceRecordHash(body) });
}

/** The out-of-band witness. Written to a DIFFERENT file than the records. */
export function buildEnduranceAnchor({ head, runId }) {
  return Object.freeze({
    schema: NODE0_ENDURANCE_ANCHOR_SCHEMA,
    run_id: runId,
    head_seq: head.seq,
    head_hash: head.hash,
    authority_delta: 0,
  });
}

const isNonEmptyString = (v) => typeof v === "string" && v.length > 0;

/**
 * Verify an endurance record against its anchor.
 *
 * `runId` is the run the CALLER believes it is reading. Supplying it turns the
 * run-id traversal law on: records belonging to another run are a REFUSAL, never
 * a filter. Filtering them out would silently shrink the evidence while leaving
 * the observed span intact — which is how two short runs get presented as one
 * long one.
 */
export function verifyEnduranceChain({ records, anchor = null, runId = null } = {}) {
  const shell = {
    schema: NODE0_ENDURANCE_CHAIN_SCHEMA,
    run_id: runId ?? null,
    record_count: Array.isArray(records) ? records.length : 0,
    head_seq: null,
    head_hash: null,
    evidence_class: null,
    elapsed_evidence: false,
    runner_code_hash: null,
    authority_delta: 0,
  };
  const refuse = (chain_state, reason, over = {}) => Object.freeze({
    ...shell, ok: false, tamper_evident: false, chain_state, reason, ...over,
  });

  if (!Array.isArray(records)) return refuse("BROKEN", "records_not_array");

  // An anchor only ever exists because a run appended something. That makes its
  // survival the ESTABLISHED PRECONDITION which separates erasure from absence.
  // PROMOTION-CORRECTION-1C. `Number.isInteger(-1)` is true, so a negative
  // head_seq used to name a head. A sequence counts appends; it cannot be
  // negative. Admitting one let malformed evidence read as a real head here,
  // and reach the torn-tail arithmetic below as a valid value.
  //
  // Anchor PRESENCE and anchor VALIDITY are two different facts and must stay
  // separate. Collapsing them is what let the first version of this guard move
  // the bug instead of fixing it: rejecting a negative head_seq stopped it being
  // read as TRUNCATED, and it fell through to ABSENT — "a run that never
  // started" — which is the same conflation from the other side.
  const anchorPresent = !!anchor && typeof anchor === "object" && !Array.isArray(anchor);
  const anchorNamesAHead = anchorPresent
    && Number.isInteger(anchor.head_seq) && anchor.head_seq >= 0
    && isNonEmptyString(anchor.head_hash);

  if (records.length === 0) {
    // Reporting a wiped run as "no records" would make it indistinguishable from
    // a run that never started — the precise conflation this module exists to
    // prevent. The anchor still names a head; say so.
    if (anchorNamesAHead) {
      return refuse("TRUNCATED", `records_erased:anchor_head_seq_${anchor.head_seq}_but_no_records_remain`);
    }
    // An anchor object exists but does not name a usable head. Something was
    // written and is now corrupt. That is BROKEN evidence, and it is emphatically
    // not the absence of a run.
    if (anchorPresent) return refuse("BROKEN", "anchor_malformed");
    return refuse("ABSENT", "no_records");
  }

  const chainedCount = records.filter(
    (r) => r && typeof r === "object" && isNonEmptyString(r.hash),
  ).length;
  // A record written before this slice existed is unwitnessed, not tampered.
  // Reporting it ABSENT (rather than BROKEN) keeps the accusation honest while
  // still refusing to let anyone call it tamper-evident. But an anchor proves the
  // run WAS chain-aware, so unchained records in its presence are a replacement.
  if (chainedCount === 0) {
    if (anchorNamesAHead) return refuse("BROKEN", "anchor_present_but_records_are_unchained");
    return refuse("ABSENT", "chain_absent_unwitnessed_record");
  }
  if (chainedCount !== records.length) {
    return refuse("BROKEN", `partially_chained:${records.length - chainedCount}_unchained_record(s)`);
  }

  const header = records[0];
  if (header.kind !== ENDURANCE_HEADER_KIND) return refuse("BROKEN", "first_record_is_not_a_header");
  if (header.seq !== 0 || (header.prev_hash ?? null) !== null) {
    return refuse("BROKEN", "header_is_not_the_chain_root");
  }
  if (!isNonEmptyString(header.run_id)) return refuse("BROKEN", "header_run_id_missing");
  // The header is seq 0, so every later record chains transitively to the code
  // that produced it. Without this binding the record says what happened but not
  // what was running when it happened. The binding is a hash of the executed
  // bytes rather than a git revision, because a dirty tree at a clean commit
  // reports the clean commit — naming code that did not run.
  if (!isNonEmptyString(header.runner_code_hash)) {
    return refuse("BROKEN", "header_runner_binding_missing");
  }
  if (!Object.values(ENDURANCE_EVIDENCE_CLASSES).includes(header.evidence_class)) {
    return refuse("BROKEN", `header_evidence_class_invalid:${String(header.evidence_class)}`);
  }
  const chainRunId = header.run_id;
  if (runId !== null && runId !== chainRunId) {
    return refuse("BROKEN", `run_id_mismatch:asked_${runId}_record_is_${chainRunId}`);
  }

  const bound = {
    ...shell,
    run_id: chainRunId,
    evidence_class: header.evidence_class,
    elapsed_evidence: header.evidence_class === ENDURANCE_EVIDENCE_CLASSES.ELAPSED,
    runner_code_hash: header.runner_code_hash,
  };

  let prevHash = null;
  for (let i = 0; i < records.length; i += 1) {
    const r = records[i];
    if (r.seq !== i) return refuse("BROKEN", `seq_out_of_order_at_index_${i}:expected_${i}_got_${String(r.seq)}`, bound);
    if (r.run_id !== chainRunId) return refuse("BROKEN", `foreign_run_id_at_seq_${i}:${String(r.run_id)}`, bound);
    if ((r.prev_hash ?? null) !== prevHash) return refuse("BROKEN", `prev_hash_mismatch_at_seq_${i}`, bound);
    // RE-DERIVE from the record's own payload. Comparing the stored hash to
    // itself is the binding failure this estate has already shipped once.
    if (enduranceRecordHash(r) !== r.hash) return refuse("BROKEN", `record_hash_mismatch_at_seq_${i}`, bound);
    prevHash = r.hash;
  }

  const last = records[records.length - 1];
  const withHead = { ...bound, head_seq: last.seq, head_hash: last.hash };

  if (!anchor || typeof anchor !== "object" || Array.isArray(anchor)) {
    // The chain verified — against itself. That is precisely the condition this
    // module refuses to call integrity.
    return refuse("BROKEN", "anchor_missing_a_chain_cannot_witness_itself", withHead);
  }
  if (anchor.run_id !== chainRunId) {
    return refuse("BROKEN", `anchor_run_id_mismatch:${String(anchor.run_id)}`, withHead);
  }
  // PROMOTION-CORRECTION-1C. A negative head_seq passed Number.isInteger and
  // fell through to the torn-tail branches below, where `last.seq - anchor.head_seq`
  // produced a nonsense lag instead of a refusal. Malformed evidence is BROKEN,
  // never a head and never an absence.
  if (!Number.isInteger(anchor.head_seq) || anchor.head_seq < 0
    || !isNonEmptyString(anchor.head_hash)) {
    return refuse("BROKEN", "anchor_malformed", withHead);
  }
  if (anchor.head_seq > last.seq) {
    return refuse("TRUNCATED",
      `records_truncated:anchor_head_seq_${anchor.head_seq}_but_records_end_at_${last.seq}`, withHead);
  }
  if (anchor.head_seq === last.seq) {
    if (anchor.head_hash !== last.hash) return refuse("BROKEN", "anchor_head_hash_mismatch", withHead);
    return Object.freeze({
      ...withHead, ok: true, tamper_evident: true,
      chain_state: "SEALED", reason: "records_and_anchor_agree",
    });
  }
  if (anchor.head_seq === last.seq - 1) {
    // The append is fsynced BEFORE the anchor is rewritten, so a kill in that
    // window leaves the records exactly one ahead. Treating this as tampering
    // would make every crash cry wolf — and surviving crashes is the other half
    // of what this record exists to prove.
    if (anchor.head_hash !== records[last.seq - 1].hash) {
      return refuse("BROKEN", "anchor_head_hash_mismatch_at_torn_tail", withHead);
    }
    return Object.freeze({
      ...withHead, ok: true, tamper_evident: true,
      chain_state: "TORN_TAIL", reason: "anchor_lags_records_by_one_append",
    });
  }
  return refuse("BROKEN", `anchor_lags_records_by_${last.seq - anchor.head_seq}_appends`, withHead);
}
