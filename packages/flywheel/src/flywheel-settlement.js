// FLYWHEEL-1B · local impact settlement bridge.
//
// Minimal §19 step-10 bridge:
//   verified FLYWHEEL-1A receipt
//     -> scoped KEYCONSENT proof
//     -> one local-only IMPACT ledger entry
//     -> immediate permissionless ledger-entry verification
//
// This is intentionally not a public economy, not XP, not House of Wisdom, and
// not the full flywheel. It composes existing kernels and stops at the smallest
// replayable reward primitive.

import { replayOneTaskFlywheel } from "./flywheel-one-task.js";
import { verifyConsentProof } from "../../receipts/src/consent-proof.js";
import {
  buildLedgerEntry,
  verifyLedgerEntry,
  REQUIRED_CONSENT_ACTION_TYPE,
} from "../../econ/src/dual-token-ledger.js";

export const FLYWHEEL_SETTLEMENT_SCHEMA =
  "bizra.dema.flywheel_settlement_bridge.v0.1";

export const IMPACT_AMOUNT_RULE_ID =
  "proof_quality_score_to_impact_points.v0.1";

const ZERO_HASH = "0".repeat(64);

const SUCCESS_BOUNDARY = Object.freeze({
  local_only: true,
  file_write_performed: false,
  network_used: false,
  federation_used: false,
  public_economic_claim_made: false,
  exchange_value_claimed: false,
  public_transfer_performed: false,
  private_key_loaded_for_local_signature: true,
});

function failureBoundary({ privateKeyLoadAttempted = false } = {}) {
  return Object.freeze({
    local_only: true,
    file_write_performed: false,
    network_used: false,
    federation_used: false,
    public_economic_claim_made: false,
    exchange_value_claimed: false,
    public_transfer_performed: false,
    private_key_loaded_for_local_signature: privateKeyLoadAttempted,
  });
}

function fail(stage, error, extra = {}) {
  const { privateKeyLoadAttempted = false, ...fields } = extra;
  return Object.freeze({
    schema: FLYWHEEL_SETTLEMENT_SCHEMA,
    settled: false,
    truth_label: "LOCAL_FLYWHEEL_SETTLEMENT_BRIDGE_FAILED",
    stage,
    error,
    ...fields,
    boundary: failureBoundary({ privateKeyLoadAttempted }),
  });
}

function isSha256Hex(s) {
  return typeof s === "string" && /^[a-f0-9]{64}$/.test(s);
}

function isValidPrevLedgerHash(s) {
  return s === null || isSha256Hex(s);
}

function amountFromScore(score) {
  if (typeof score !== "number" || !Number.isFinite(score)) return null;
  if (score < 0 || score > 1) return null;
  return Math.round(score * 100);
}

export function impactAmountFromFlywheelScore(score) {
  const amount = amountFromScore(score);
  return amount === null ? 0 : amount;
}

/**
 * Build one local-only IMPACT settlement entry from a verified FLYWHEEL-1A
 * receipt. Consent is key-bound and scoped to flywheelReceipt.receipt_id.
 *
 * Returns a frozen success/failure envelope. Does not write files.
 */
export async function settleOneTaskFlywheelImpact({
  flywheelReceipt,
  actionReceiptId,
  consentProof,
  operatorPubkeyPem,
  demaHome,
  now,
  createdAtIso,
  prevLedgerHash = ZERO_HASH,
} = {}) {
  const createdIso =
    typeof createdAtIso === "string" && createdAtIso.length > 0
      ? createdAtIso
      : typeof now === "string" && now.length > 0
        ? now
        : null;

  if (!createdIso) {
    return fail("input", "created_at_iso_required");
  }
  if (!isValidPrevLedgerHash(prevLedgerHash)) {
    return fail("input", "prev_ledger_hash_invalid");
  }

  const flywheelReplay = replayOneTaskFlywheel({
    flywheelReceipt,
    actionReceiptId,
  });
  if (!flywheelReplay.replayed) {
    return fail("flywheel_replay", flywheelReplay.reason, {
      flywheel_replay: flywheelReplay,
    });
  }

  const flywheelReceiptId = flywheelReceipt.receipt_id;
  if (!isSha256Hex(flywheelReceiptId)) {
    return fail("flywheel_replay", "flywheel_receipt_id_invalid", {
      flywheel_replay: flywheelReplay,
    });
  }

  const expectedActionScope = Object.freeze({
    action_type: REQUIRED_CONSENT_ACTION_TYPE,
    target_hash: flywheelReceiptId,
  });
  const consentVerification = verifyConsentProof({
    consentProof,
    pubkeyPem: operatorPubkeyPem,
    expectedActionScope,
    now: typeof now === "string" && now.length > 0 ? now : createdIso,
  });
  if (!consentVerification.verified) {
    return fail("consent", consentVerification.reason, {
      flywheel_replay: flywheelReplay,
      consent_verification: consentVerification,
    });
  }

  const amount = amountFromScore(flywheelReplay.score);
  if (amount === null) {
    return fail("settlement", "score_invalid", {
      flywheel_replay: flywheelReplay,
      consent_verification: consentVerification,
    });
  }

  const ledgerEntry = await buildLedgerEntry({
    entry_type: "IMPACT_CREDIT",
    token_class: "IMPACT",
    amount,
    evidence_receipt_hashes: [flywheelReceiptId],
    prev_hash: prevLedgerHash,
    consentProof,
    demaHome,
    createdAtIso: createdIso,
  });
  if (ledgerEntry.error) {
    return fail("ledger_entry", ledgerEntry.error, {
      privateKeyLoadAttempted: true,
      flywheel_replay: flywheelReplay,
      consent_verification: consentVerification,
    });
  }

  const ledgerVerification = verifyLedgerEntry({
    entry: ledgerEntry,
    pubkeyPem: operatorPubkeyPem,
  });
  if (!ledgerVerification.verified) {
    return fail("ledger_verify", ledgerVerification.reason, {
      privateKeyLoadAttempted: true,
      flywheel_replay: flywheelReplay,
      consent_verification: consentVerification,
      ledger_entry: ledgerEntry,
      ledger_verification: ledgerVerification,
    });
  }

  return Object.freeze({
    schema: FLYWHEEL_SETTLEMENT_SCHEMA,
    settled: true,
    truth_label: "LOCAL_FLYWHEEL_SETTLEMENT_BRIDGE_VERIFIED",
    amount_rule_id: IMPACT_AMOUNT_RULE_ID,
    settlement: Object.freeze({
      flywheel_receipt_id: flywheelReceiptId,
      action_receipt_id: actionReceiptId,
      score: flywheelReplay.score,
      amount,
      token_class: "IMPACT",
      entry_type: "IMPACT_CREDIT",
    }),
    flywheel_replay: flywheelReplay,
    consent_verification: consentVerification,
    ledger_entry: ledgerEntry,
    ledger_verification: ledgerVerification,
    boundary: SUCCESS_BOUNDARY,
  });
}
