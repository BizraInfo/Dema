// AWAY-CONTRACT-VERIFY-1A — body-bound verifier for Away Contracts
// (child of ADR-043 · docs/02-architecture/AWAY_CONTRACT_SPEC_v0_1.md · sibling
// of away-contract-schema.js).
//
// Schema says: this contract shape is safe enough to consider.
// Verify says: this exact body still matches the validated body.
// Neither says: start working.
//
// The verifier re-derives the whole validation from the raw contract and diffs
// the ENTIRE normalized body + hash against the provided validation_result —
// never a field subset. Laundering (a forged verdict, a mutated body, or an
// externally recomputed hash over a modified body) is detected because the
// attacker's validation_result can no longer match the internally re-derived
// one while the raw contract stays fixed.
//
// Verification proves body-binding only. It does not prove operator consent,
// does not start Away Mode, does not authorize execution, does not sign
// receipts, and does not escalate to mobile.
//
// Pure kernel: no fs / network / process / clock / random. Act-time is
// injected via options.now_iso (passed through to the schema validator).

import { createHash } from "node:crypto";

import {
  AWAY_CONTRACT_VALIDATION_RESULT_SCHEMA,
  AWAY_CONTRACT_TRUTH_LABEL,
  validateAwayContract,
} from "./away-contract-schema.js";

export const AWAY_CONTRACT_VERIFY_RESULT_SCHEMA =
  "bizra.dema.away_contract.verify_result.v0.1";
export const AWAY_CONTRACT_VERIFY_TRUTH_LABEL = "AWAY_CONTRACT_VERIFY_ONLY";

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

// All-false boundary invariant: verification attempts nothing, starts nothing,
// and never invokes the (future) compiler.
export function awayContractVerifyBoundary() {
  return Object.freeze({
    execution_attempted: false,
    model_invocation: false,
    network: false,
    token_mint: false,
    activation: false,
    daemon_started: false,
    contract_started: false,
    compiler_invoked: false,
  });
}

export function verifyAwayContract(input, options = {}) {
  const blocked_by = [];
  const warnings = [];
  const verification = {
    schema_validation_valid: false,
    contract_hash_matches: false,
    normalized_body_matches: false,
    launder_attempt_detected: false,
    receipt_required: false,
    review_required_on_return: false,
  };

  if (!isPlainObject(input)) {
    blocked_by.push("input_not_object");
    return buildResult({ contract: null, blocked_by, warnings, verification, internal: null });
  }

  const { contract, validation_result } = input;
  if (!isPlainObject(contract)) blocked_by.push("contract_missing");
  if (!isPlainObject(validation_result)) blocked_by.push("validation_result_missing");
  if (blocked_by.length > 0) {
    return buildResult({ contract: null, blocked_by, warnings, verification, internal: null });
  }

  // Provided verdict must at least claim validity with the right provenance.
  const claimsValid =
    validation_result.valid === true && validation_result.rejected !== true;
  if (!claimsValid) blocked_by.push("validation_result_not_valid");
  if (validation_result.schema !== AWAY_CONTRACT_VALIDATION_RESULT_SCHEMA) {
    blocked_by.push("validation_result_schema_mismatch");
  }
  if (validation_result.truth_label !== AWAY_CONTRACT_TRUTH_LABEL) {
    blocked_by.push("validation_result_truth_label_mismatch");
  }
  if (!isNonEmptyString(validation_result.contract_hash)) {
    blocked_by.push("contract_hash_missing");
  }
  if (!isPlainObject(validation_result.normalized_contract)) {
    blocked_by.push("normalized_contract_missing");
  }
  const boundary = validation_result.boundary;
  const boundaryClean =
    isPlainObject(boundary) &&
    Object.values(boundary).every((flag) => flag === false);
  if (!boundaryClean) blocked_by.push("validation_result_boundary_not_all_false");

  // Re-derive the whole validation from the raw contract — the disk truth.
  const internal = validateAwayContract(contract, { now_iso: options?.now_iso });
  verification.schema_validation_valid = internal.valid === true;
  if (!internal.valid) {
    blocked_by.push("schema_validation_failed");
    for (const code of internal.blocked_by) blocked_by.push(`validation:${code}`);
    // A verdict that says valid over a contract that re-validates invalid is a
    // forged verdict — laundering by definition.
    if (claimsValid) verification.launder_attempt_detected = true;
    return buildResult({ contract, blocked_by, warnings, verification, internal: null });
  }

  verification.receipt_required =
    internal.normalized_contract.receipt_required === true;
  verification.review_required_on_return =
    internal.normalized_contract.review_required_on_return === true;

  if (isNonEmptyString(validation_result.contract_hash)) {
    verification.contract_hash_matches =
      validation_result.contract_hash === internal.contract_hash;
    if (!verification.contract_hash_matches) {
      blocked_by.push("contract_hash_mismatch");
    }
  }

  if (isPlainObject(validation_result.normalized_contract)) {
    // Whole-body diff, never a subset: canonical bytes of the provided
    // normalized body must equal canonical bytes of the re-derived one.
    const providedBody = stableStringify(validation_result.normalized_contract);
    const derivedBody = stableStringify(internal.normalized_contract);
    verification.normalized_body_matches = providedBody === derivedBody;
    if (!verification.normalized_body_matches) {
      blocked_by.push("normalized_body_mismatch");
    }
    // Forged-and-recomputed probe: a self-consistent hash over a modified body
    // is still laundering — the recomputed hash matches the attacker's body,
    // not the raw contract's derived body.
    const recomputedProvided = `sha256:${sha256(providedBody)}`;
    if (
      !verification.normalized_body_matches &&
      validation_result.contract_hash === recomputedProvided
    ) {
      warnings.push("hash_recomputed_over_modified_body");
    }
  }

  if (
    claimsValid &&
    (!verification.contract_hash_matches || !verification.normalized_body_matches)
  ) {
    verification.launder_attempt_detected = true;
  }

  return buildResult({ contract, blocked_by, warnings, verification, internal });
}

function buildResult({ contract, blocked_by, warnings, verification, internal }) {
  const valid = blocked_by.length === 0;
  return Object.freeze({
    valid,
    rejected: !valid,
    schema: AWAY_CONTRACT_VERIFY_RESULT_SCHEMA,
    truth_label: AWAY_CONTRACT_VERIFY_TRUTH_LABEL,
    contract_id: isNonEmptyString(contract?.contract_id) ? contract.contract_id : null,
    contract_hash: valid && internal ? internal.contract_hash : null,
    blocked_by: Object.freeze([...blocked_by]),
    warnings: Object.freeze([...warnings]),
    verified_contract: valid && internal ? internal.normalized_contract : null,
    verification: Object.freeze({ ...verification }),
    boundary: awayContractVerifyBoundary(),
  });
}
