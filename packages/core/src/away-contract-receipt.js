// AWAY-CONTRACT-RECEIPT-1A — consent-gated Away Contract receipt writer
// (child of ADR-043 · docs/02-architecture/AWAY_CONTRACT_SPEC_v0_1.md · third
// rung of the ladder: schema validates shape, verify proves body-binding,
// receipt records operator-approved intent).
//
// The receipt proves ONLY that a verified Away Contract body was receipted
// under exact operator consent. It does not start Away Mode, authorize
// execution, compile policy, sign external payloads, invoke models, or send
// mobile notifications.
//
// Persistence I/O by design (all writes under the injected dema_home):
// atomic write+rename of one receipt JSON per contract_id, no overwrite.
// dema_home and now_iso are both injected and required — the writer never
// falls back to ambient env or the wall clock (fail closed, hermetic tests).
// Every reject happens BEFORE any directory or file is created.

import { mkdir, writeFile, rename, stat } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";

import { verifyAwayContract } from "./away-contract-verify.js";

export const AWAY_CONTRACT_RECEIPT_SCHEMA = "bizra.dema.away_contract.receipt.v0.1";
export const AWAY_CONTRACT_RECEIPT_WRITE_RESULT_SCHEMA =
  "bizra.dema.away_contract.receipt_write_result.v0.1";
export const AWAY_CONTRACT_RECEIPT_TRUTH_LABEL = "AWAY_CONTRACT_RECEIPT_WRITE_ONLY";

// One receipt file per contract_id; filename-safe ids only.
const SAFE_CONTRACT_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

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

function receiptBoundary() {
  return Object.freeze({
    execution_attempted: false,
    contract_started: false,
    model_invocation: false,
    network: false,
    token_mint: false,
    activation: false,
    daemon_started: false,
    compiler_invoked: false,
  });
}

// Consent phrase is bound to contract_id + the first 12 hex chars of the
// contract hash. The hash transitively binds operator_id and mission_scope —
// they are inside the hashed normalized body, so retyping the phrase over a
// different scope or operator is impossible without a different hash.
export function expectedAwayContractReceiptConsent(verify_result) {
  if (
    !isPlainObject(verify_result) ||
    verify_result.valid !== true ||
    !isNonEmptyString(verify_result.contract_id) ||
    !isNonEmptyString(verify_result.contract_hash) ||
    !/^sha256:[a-f0-9]{64}$/.test(verify_result.contract_hash)
  ) {
    throw new Error(
      "expectedAwayContractReceiptConsent requires a valid verify_result with contract_id and contract_hash.",
    );
  }
  const shortHash = verify_result.contract_hash.slice("sha256:".length, "sha256:".length + 12);
  return `GO: write away-contract receipt ${verify_result.contract_id} ${shortHash}`;
}

export async function writeAwayContractReceipt(input, options = {}) {
  const blocked_by = [];
  const warnings = [];

  const dema_home = options?.dema_home;
  if (!isNonEmptyString(dema_home)) blocked_by.push("dema_home_missing");
  const now_iso = options?.now_iso;
  if (!isNonEmptyString(now_iso)) blocked_by.push("now_iso_missing");

  if (!isPlainObject(input)) {
    blocked_by.push("input_not_object");
    return buildResult({ blocked_by, warnings });
  }

  const { contract, validation_result, verify_result, typed_go } = input;
  if (!isPlainObject(contract)) blocked_by.push("contract_missing");
  if (!isPlainObject(validation_result)) blocked_by.push("validation_result_missing");
  if (!isPlainObject(verify_result)) blocked_by.push("verify_result_missing");
  if (blocked_by.length > 0) {
    return buildResult({ blocked_by, warnings, contract });
  }

  // Re-derive the whole verification from the raw inputs — disk truth first.
  const internal = verifyAwayContract({ contract, validation_result }, { now_iso });
  if (!internal.valid) {
    blocked_by.push("internal_verify_failed");
    for (const code of internal.blocked_by) blocked_by.push(`verify:${code}`);
    return buildResult({ blocked_by, warnings, contract });
  }

  // The provided verify_result must byte-match the re-derived one.
  if (verify_result.valid !== true || verify_result.rejected === true) {
    blocked_by.push("verify_result_not_valid");
  }
  if (verify_result.contract_hash !== internal.contract_hash) {
    blocked_by.push("verify_result_hash_mismatch");
  }
  if (
    !isPlainObject(verify_result.verified_contract) ||
    stableStringify(verify_result.verified_contract) !==
      stableStringify(internal.verified_contract)
  ) {
    blocked_by.push("verify_result_body_mismatch");
  }
  if (blocked_by.length > 0) {
    return buildResult({ blocked_by, warnings, contract });
  }

  const expected_consent = expectedAwayContractReceiptConsent(internal);
  if (!isNonEmptyString(typed_go)) {
    blocked_by.push("consent_missing");
  } else if (typed_go !== expected_consent) {
    blocked_by.push("consent_mismatch");
  }

  const contract_id = internal.contract_id;
  if (!SAFE_CONTRACT_ID.test(contract_id)) {
    blocked_by.push("unsafe_contract_id");
  }
  if (blocked_by.length > 0) {
    return buildResult({ blocked_by, warnings, contract, expected_consent });
  }

  const receiptsDir = join(dema_home, "away-contracts", "receipts");
  const receipt_path = join(receiptsDir, `${contract_id}.json`);

  // Default: no overwrite. An existing receipt is a hard stop.
  const exists = await stat(receipt_path).then(
    () => true,
    () => false,
  );
  if (exists) {
    blocked_by.push("receipt_already_exists");
    return buildResult({ blocked_by, warnings, contract, expected_consent });
  }

  const body = {
    schema: AWAY_CONTRACT_RECEIPT_SCHEMA,
    truth_label: AWAY_CONTRACT_RECEIPT_TRUTH_LABEL,
    receipt_id: `away-receipt-${contract_id}-${internal.contract_hash.slice(7, 19)}`,
    contract_id,
    contract_hash: internal.contract_hash,
    operator_id: internal.verified_contract.operator_id,
    node_id: internal.verified_contract.node_id,
    mission_scope: internal.verified_contract.mission_scope,
    consent_phrase: expected_consent,
    consent_verified: true,
    validation_summary: {
      valid: true,
      schema: validation_result.schema,
      contract_hash: internal.contract_hash,
    },
    verification_summary: { ...internal.verification },
    boundary: receiptBoundary(),
    created_at: now_iso,
  };
  // receipt_hash excludes itself from the preimage: canonical bytes of the
  // body WITHOUT the hash field, then the hash is appended.
  const receipt_hash = `sha256:${sha256(stableStringify(body))}`;
  const receipt = { ...body, receipt_hash };

  await mkdir(receiptsDir, { recursive: true });
  const tmpPath = `${receipt_path}.tmp`;
  await writeFile(tmpPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  await rename(tmpPath, receipt_path);

  return buildResult({
    blocked_by,
    warnings,
    contract,
    expected_consent,
    written: true,
    contract_hash: internal.contract_hash,
    receipt_path,
    receipt_hash,
  });
}

function buildResult({
  blocked_by,
  warnings,
  contract = null,
  expected_consent = null,
  written = false,
  contract_hash = null,
  receipt_path = null,
  receipt_hash = null,
}) {
  return Object.freeze({
    written,
    rejected: !written,
    schema: AWAY_CONTRACT_RECEIPT_WRITE_RESULT_SCHEMA,
    truth_label: AWAY_CONTRACT_RECEIPT_TRUTH_LABEL,
    contract_id: isNonEmptyString(contract?.contract_id) ? contract.contract_id : null,
    contract_hash,
    receipt_path,
    receipt_hash,
    expected_consent,
    blocked_by: Object.freeze([...blocked_by]),
    warnings: Object.freeze([...warnings]),
    boundary: receiptBoundary(),
  });
}
