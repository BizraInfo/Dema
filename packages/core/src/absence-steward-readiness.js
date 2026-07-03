// ABSENCE-STEWARD-PREVIEW-CHECK-1A — deterministic read-only readiness gate
// (docs/02-architecture/ABSENCE_STEWARD_PREVIEW_v0_1.md §4/§13 · ADR-043).
//
// Readiness is a REPORT, never a grant. This kernel derives which preview
// state a contract/validation/receipt trio sits in — NOT_CONFIGURED,
// CONTRACT_VERIFIED, PREVIEW_READY, EXPIRED, or REFUSED — by re-deriving the
// whole Away Contract verification and re-binding the receipt (self-excluding
// hash recompute, consent-phrase match, boundary all-false). PREVIEW_READY
// authorizes nothing: no steward runs, no transition executes work, and
// `dema away start` does not exist.
//
// Pure kernel: no fs / network / process / clock / random. Act-time is
// injected via input.now_iso and refused when absent.

import { createHash } from "node:crypto";

import { verifyAwayContract } from "./away-contract-verify.js";
import {
  AWAY_CONTRACT_RECEIPT_SCHEMA,
  AWAY_CONTRACT_RECEIPT_TRUTH_LABEL,
  expectedAwayContractReceiptConsent,
} from "./away-contract-receipt.js";

export const ABSENCE_STEWARD_READINESS_SCHEMA =
  "bizra.dema.absence_steward.readiness_preview.v0.1";
export const ABSENCE_STEWARD_READINESS_TRUTH_LABEL =
  "ABSENCE_STEWARD_READINESS_PREVIEW_ONLY";

export const ABSENCE_STEWARD_PREVIEW_STATES = Object.freeze([
  "NOT_CONFIGURED",
  "CONTRACT_VERIFIED",
  "PREVIEW_READY",
  "EXPIRED",
  "REFUSED",
]);

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// Readiness reports and grants nothing — steward_started leads the boundary.
function readinessBoundary() {
  return Object.freeze({
    steward_started: false,
    execution_attempted: false,
    contract_started: false,
    receipt_written: false,
    model_invocation: false,
    network: false,
    token_mint: false,
    activation: false,
    daemon_started: false,
  });
}

export function deriveAbsenceStewardReadiness(input = {}) {
  const blocked_by = [];
  const { contract, validation_result, receipt } = input;

  const nowMs = isNonEmptyString(input.now_iso) ? Date.parse(input.now_iso) : NaN;
  if (Number.isNaN(nowMs)) {
    blocked_by.push("now_iso_required");
    return buildReport({ state: "REFUSED", blocked_by, contract });
  }

  if (!isPlainObject(contract)) {
    return buildReport({ state: "NOT_CONFIGURED", blocked_by, contract: null });
  }

  // Binding is judged AS OF ACT-TIME, expiry as of now (wall-clock-at-verify
  // is a time bomb): with a receipt, act-time is the receipt's hash-protected
  // created_at — so the recompute check MUST pass before created_at is
  // trusted. Without a receipt, act-time is the injected now.
  let bindTimeIso = input.now_iso;
  if (isPlainObject(receipt)) {
    if (isNonEmptyString(receipt.receipt_hash)) {
      const { receipt_hash, ...body } = receipt;
      const recomputed = `sha256:${sha256(stableStringify(body))}`;
      if (recomputed !== receipt_hash) blocked_by.push("receipt_hash_mismatch");
    } else {
      blocked_by.push("receipt_hash_missing");
    }
    if (blocked_by.length > 0) {
      return buildReport({ state: "REFUSED", blocked_by, contract });
    }
    if (Number.isNaN(Date.parse(receipt.created_at ?? ""))) {
      blocked_by.push("receipt_created_at_invalid");
      return buildReport({ state: "REFUSED", blocked_by, contract });
    }
    bindTimeIso = receipt.created_at;
  }

  // Re-derive the whole body-bound verification — disk truth first.
  const verify = verifyAwayContract(
    { contract, validation_result },
    { now_iso: bindTimeIso },
  );
  if (!verify.valid) {
    for (const code of verify.blocked_by) blocked_by.push(`verify:${code}`);
    return buildReport({ state: "REFUSED", blocked_by, contract });
  }

  if (!isPlainObject(receipt)) {
    return buildReport({
      state: "CONTRACT_VERIFIED",
      blocked_by,
      contract,
      verify,
    });
  }

  // Re-bind the receipt to THIS verified contract.
  if (receipt.schema !== AWAY_CONTRACT_RECEIPT_SCHEMA) {
    blocked_by.push("receipt_schema_mismatch");
  }
  if (receipt.truth_label !== AWAY_CONTRACT_RECEIPT_TRUTH_LABEL) {
    blocked_by.push("receipt_truth_label_mismatch");
  }
  if (
    receipt.contract_id !== verify.contract_id ||
    receipt.contract_hash !== verify.contract_hash
  ) {
    blocked_by.push("receipt_contract_mismatch");
  }
  if (receipt.consent_verified !== true) {
    blocked_by.push("receipt_consent_not_verified");
  }
  if (receipt.consent_phrase !== expectedAwayContractReceiptConsent(verify)) {
    blocked_by.push("receipt_consent_phrase_mismatch");
  }
  const boundaryClean =
    isPlainObject(receipt.boundary) &&
    Object.values(receipt.boundary).every((flag) => flag === false);
  if (!boundaryClean) blocked_by.push("receipt_boundary_not_all_false");

  if (blocked_by.length > 0) {
    return buildReport({ state: "REFUSED", blocked_by, contract, verify });
  }

  const expiresMs = Date.parse(verify.verified_contract.expires_at);
  if (!Number.isNaN(expiresMs) && expiresMs <= nowMs) {
    return buildReport({ state: "EXPIRED", blocked_by, contract, verify });
  }

  return buildReport({ state: "PREVIEW_READY", blocked_by, contract, verify });
}

function buildReport({ state, blocked_by, contract, verify = null }) {
  return Object.freeze({
    schema: ABSENCE_STEWARD_READINESS_SCHEMA,
    truth_label: ABSENCE_STEWARD_READINESS_TRUTH_LABEL,
    state,
    ready: state === "PREVIEW_READY",
    contract_id: isNonEmptyString(contract?.contract_id) ? contract.contract_id : null,
    contract_hash: verify?.contract_hash ?? null,
    blocked_by: Object.freeze([...blocked_by]),
    boundary: readinessBoundary(),
  });
}
