// NODE0-CLOSE-MEASUREMENT-RECEIPT-1A
//
// Measurement overlay on the ten-invariant closure ledger. Closure DNA already
// lives in node0-closure-invariants.js (sole emitter of the node-scope closed
// flag). This module READS that ledger and refuses to admit NODE0_CLOSED on a
// measurement receipt until BOTH:
//
//   1. remote_write is SATISFIED on the ledger (no external write path), and
//   2. an endurance soak observation is SATISFIED at scope node0_endurance_soak.
//
// Silence / missing soak ⇒ NODE0_CLOSED stays false. A forged ledger that claims
// CLOSED while soak or remote_write is open is refused (ok:false), never laundered
// into a green admission.
//
// Pure · deterministic · no fs/network/daemon/mint. Does not widen authority.

import {
  evaluateNode0ClosureInvariants,
  verifyClosureVerdict,
  INVARIANT_STATUS,
  NODE0_CLOSURE_INVARIANTS_SCHEMA,
  REMOTE_WRITE_OBSERVATION_SCOPE,
} from "./node0-closure-invariants.js";
import { buildPreviewBoundary } from "./preview-boundary.js";

export const NODE0_CLOSE_MEASUREMENT_RECEIPT_SCHEMA =
  "bizra.dema.node0_close_measurement_receipt.v0.1";
export const NODE0_CLOSE_MEASUREMENT_RECEIPT_TRUTH_LABEL =
  "NODE0_CLOSE_MEASUREMENT_RECEIPT_LOCAL";
export const SOAK_OBSERVATION_SCOPE = "node0_endurance_soak";
export const DEFAULT_SOAK_MIN_DURATION_SECONDS = 72 * 60 * 60;

const WHAT_THIS_PROVES =
  "Whether a measured receipt may admit NODE0_CLOSED given the closure ledger plus soak and remote_write admission predicates.";
const WHAT_THIS_DOES_NOT_PROVE =
  "Does not prove live soak occurred, that remote_write was measured honestly, activation, federation, mint, or that Node0 is closed in production.";

function textVal(v) {
  return typeof v === "string" ? v : "";
}

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/**
 * Evaluate soak evidence. Fail-closed: missing/malformed ⇒ UNKNOWN.
 * Required observed value is true (healthy soak completed).
 */
export function evaluateSoakAdmission(soak, {
  minDurationSeconds = DEFAULT_SOAK_MIN_DURATION_SECONDS,
} = {}) {
  if (soak === undefined || soak === null) {
    return Object.freeze({
      status: INVARIANT_STATUS.UNKNOWN,
      reason: "no_evidence",
      observed: null,
      source: null,
      scope: null,
      required_scope: SOAK_OBSERVATION_SCOPE,
      min_duration_seconds: minDurationSeconds,
    });
  }
  if (!isPlainObject(soak) || Array.isArray(soak)) {
    return Object.freeze({
      status: INVARIANT_STATUS.UNKNOWN,
      reason: "unsourced_assertion",
      observed: null,
      source: null,
      scope: null,
      required_scope: SOAK_OBSERVATION_SCOPE,
      min_duration_seconds: minDurationSeconds,
    });
  }
  if (!("observed" in soak)) {
    return Object.freeze({
      status: INVARIANT_STATUS.UNKNOWN,
      reason: "no_observed_value",
      observed: null,
      source: null,
      scope: null,
      required_scope: SOAK_OBSERVATION_SCOPE,
      min_duration_seconds: minDurationSeconds,
    });
  }
  if (typeof soak.source !== "string" || soak.source.trim() === "") {
    return Object.freeze({
      status: INVARIANT_STATUS.UNKNOWN,
      reason: "no_source",
      observed: null,
      source: null,
      scope: null,
      required_scope: SOAK_OBSERVATION_SCOPE,
      min_duration_seconds: minDurationSeconds,
    });
  }
  if (soak.scope !== SOAK_OBSERVATION_SCOPE) {
    return Object.freeze({
      status: INVARIANT_STATUS.UNKNOWN,
      reason: "observation_scope_mismatch",
      observed: null,
      source: null,
      scope: soak.scope ?? null,
      required_scope: SOAK_OBSERVATION_SCOPE,
      min_duration_seconds: minDurationSeconds,
    });
  }

  const duration = Number(soak.observed_duration_seconds);
  if (!Number.isFinite(duration) || duration < minDurationSeconds) {
    return Object.freeze({
      status: INVARIANT_STATUS.VIOLATED,
      reason: "soak_duration_below_minimum",
      observed: soak.observed,
      source: soak.source,
      scope: soak.scope,
      required_scope: SOAK_OBSERVATION_SCOPE,
      min_duration_seconds: minDurationSeconds,
      observed_duration_seconds: Number.isFinite(duration) ? duration : null,
    });
  }

  const satisfied = soak.observed === true;
  return Object.freeze({
    status: satisfied ? INVARIANT_STATUS.SATISFIED : INVARIANT_STATUS.VIOLATED,
    reason: satisfied ? null : "soak_not_healthy",
    observed: soak.observed,
    source: soak.source,
    scope: soak.scope,
    required_scope: SOAK_OBSERVATION_SCOPE,
    min_duration_seconds: minDurationSeconds,
    observed_duration_seconds: duration,
  });
}

function remoteWriteRow(ledger) {
  const rows = Array.isArray(ledger?.invariants) ? ledger.invariants : [];
  return rows.find((r) => r && r.id === "remote_write") || null;
}

/**
 * Build a Node0-close measurement receipt.
 *
 * @param {{
 *   evidence?: object,
 *   closure_ledger?: object,
 *   soak?: object|null,
 *   min_soak_duration_seconds?: number,
 *   head_sha?: string,
 *   measured_at?: string,
 * }} input
 */
export function buildNode0CloseMeasurementReceipt(input = {}) {
  const blocked_by = [];
  const minSoak =
    Number.isFinite(input.min_soak_duration_seconds) &&
    input.min_soak_duration_seconds > 0
      ? input.min_soak_duration_seconds
      : DEFAULT_SOAK_MIN_DURATION_SECONDS;

  let ledger = input.closure_ledger;
  if (ledger === undefined || ledger === null) {
    ledger = evaluateNode0ClosureInvariants(input.evidence || {});
  }

  const verification = verifyClosureVerdict(ledger);
  if (!verification.ok) {
    blocked_by.push(
      Object.freeze({
        id: "closure_ledger",
        status: "REFUSED",
        reason: verification.reason || "verdict_unverified",
      }),
    );
  }

  if (ledger?.schema !== NODE0_CLOSURE_INVARIANTS_SCHEMA) {
    blocked_by.push(
      Object.freeze({
        id: "closure_ledger_schema",
        status: "REFUSED",
        reason: "schema_mismatch",
      }),
    );
  }

  const soakAdmission = evaluateSoakAdmission(input.soak, {
    minDurationSeconds: minSoak,
  });
  if (soakAdmission.status !== INVARIANT_STATUS.SATISFIED) {
    blocked_by.push(
      Object.freeze({
        id: "soak",
        status: soakAdmission.status,
        reason: soakAdmission.reason,
      }),
    );
  }

  const rw = remoteWriteRow(ledger);
  const remoteWriteOk =
    rw !== null && rw.status === INVARIANT_STATUS.SATISFIED;
  if (!remoteWriteOk) {
    blocked_by.push(
      Object.freeze({
        id: "remote_write",
        status: rw?.status || INVARIANT_STATUS.UNKNOWN,
        reason: rw?.reason || "remote_write_not_satisfied",
      }),
    );
  }

  // Ledger may report closed only when all ten are SATISFIED. Admission still
  // requires soak. Never promote a forged CLOSED ledger past verification.
  const ledgerClaimsClosed = ledger && ledger.verdict === "CLOSED";
  const ledgerFlag = ledger ? Boolean(ledger["node0_closed"]) : false;

  if (ledgerClaimsClosed !== ledgerFlag) {
    blocked_by.push(
      Object.freeze({
        id: "closure_ledger_flag",
        status: "REFUSED",
        reason: "verdict_flag_mismatch",
      }),
    );
  }

  const admitClosed =
    verification.ok === true &&
    ledgerFlag === true &&
    soakAdmission.status === INVARIANT_STATUS.SATISFIED &&
    remoteWriteOk === true &&
    blocked_by.every(
      (b) => b.id !== "closure_ledger" && b.id !== "closure_ledger_schema" && b.id !== "closure_ledger_flag",
    );

  // Force-false when any admission predicate fails — even if a caller forged
  // a CLOSED ledger that somehow passed shape checks without soak.
  const NODE0_CLOSED = admitClosed === true;

  // ok = measurement usable. OPEN with honest blockers is still ok:true.
  // ok:false only when the supplied ledger cannot be verified.
  const ok = verification.ok === true;

  return Object.freeze({
    schema: NODE0_CLOSE_MEASUREMENT_RECEIPT_SCHEMA,
    truth_label: NODE0_CLOSE_MEASUREMENT_RECEIPT_TRUTH_LABEL,
    ok,
    NODE0_CLOSED,
    verdict: NODE0_CLOSED ? "CLOSED" : "OPEN",
    head_sha: textVal(input.head_sha).trim() || null,
    measured_at: textVal(input.measured_at).trim() || null,
    closure_ledger: ledger,
    soak: soakAdmission,
    remote_write: Object.freeze({
      required_scope: REMOTE_WRITE_OBSERVATION_SCOPE,
      status: rw?.status || INVARIANT_STATUS.UNKNOWN,
      reason: rw?.reason || "remote_write_not_satisfied",
      observed: rw?.observed ?? null,
      source: rw?.source ?? null,
      scope: rw?.scope ?? null,
    }),
    admission: Object.freeze({
      soak_required: true,
      remote_write_required: true,
      soak_satisfied: soakAdmission.status === INVARIANT_STATUS.SATISFIED,
      remote_write_satisfied: remoteWriteOk,
      ledger_claims_closed: ledgerFlag,
      ledger_verified: verification.ok === true,
    }),
    blocked_by: Object.freeze(blocked_by),
    boundary: buildPreviewBoundary(),
    authority_delta: 0,
    what_this_proves: WHAT_THIS_PROVES,
    what_this_does_not_prove: WHAT_THIS_DOES_NOT_PROVE,
  });
}
