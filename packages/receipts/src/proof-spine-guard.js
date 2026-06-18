// PROOF-SPINE-GUARD-1A · read-only combined spine health validator
//
// Substrate parity for the four fail-closed rails identified in the peak
// integration audit: empty genesis, empty signature, quarantined settlement,
// and unsigned fresh-state receipts. Pure — no disk, no network, no signing.

export const PROOF_SPINE_GUARD_SCHEMA = "bizra.dema.proof_spine_guard.v0.1";

export const PROOF_SPINE_REASON_CODES = Object.freeze({
  GENESIS_RECEIPT_EMPTY: "GENESIS_RECEIPT_EMPTY",
  LEDGER_SIGNATURE_EMPTY: "LEDGER_SIGNATURE_EMPTY",
  PULSE_QUARANTINED_NO_SETTLEMENT: "PULSE_QUARANTINED_NO_SETTLEMENT",
  FRESH_STATE_RECEIPT_UNSIGNED: "FRESH_STATE_RECEIPT_UNSIGNED",
});

const QUARANTINED_DECISIONS = new Set(["QUARANTINED", "REJECTED", "REVIEW"]);
const UNSIGNED_MARKERS = new Set(["UNSIGNED_DEV_ONLY", "UNSIGNED_FALLBACK"]);

function isEmptyObject(value) {
  return (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length === 0
  );
}

function isEmptySignature(value) {
  return typeof value !== "string" || value.trim().length === 0;
}

function isMissingFreshStateKey(value) {
  return value === null || value === undefined || isEmptySignature(value);
}

/**
 * Evaluate combined proof-spine health for a single receipt/ledger snapshot.
 * Read-only: returns substrate-parity reason codes without mutating state.
 */
export function validateProofSpineGuard(input = {}) {
  const reason_codes = [];

  if (isEmptyObject(input.genesis_receipt)) {
    reason_codes.push(PROOF_SPINE_REASON_CODES.GENESIS_RECEIPT_EMPTY);
  }
  if (isEmptySignature(input.signature)) {
    reason_codes.push(PROOF_SPINE_REASON_CODES.LEDGER_SIGNATURE_EMPTY);
  }
  if (QUARANTINED_DECISIONS.has(input.decision)) {
    reason_codes.push(PROOF_SPINE_REASON_CODES.PULSE_QUARANTINED_NO_SETTLEMENT);
  }
  if (
    isMissingFreshStateKey(input.fresh_state_ed25519) &&
    !UNSIGNED_MARKERS.has(input.signature_status)
  ) {
    reason_codes.push(PROOF_SPINE_REASON_CODES.FRESH_STATE_RECEIPT_UNSIGNED);
  }

  const refusalReceipt =
    input.receipt_kind === "refusal" || input.receipt_type === "refusal";
  const blocked = reason_codes.length > 0;

  return Object.freeze({
    schema: PROOF_SPINE_GUARD_SCHEMA,
    allowed_to_advance: !blocked,
    allowed_to_settle: !blocked,
    refusal_receipt_allowed: refusalReceipt || blocked,
    reason_codes: Object.freeze([...reason_codes]),
  });
}
