// URP-4.1C-ter · Choose Receipt Verify-by-Path.
//
// Mirrors URP-3.1C-ter verify-local-index-file discipline exactly, adapted
// for the choose-receipt schema. Verifies a single $DEMA_HOME/urp/choices/
// choose-<sha256>.json file by absolute path. Fail-fast layered validation
// with explicit error codes per layer.
//
// Reads only. NO mutation, NO network, NO key load. Per
// [[writer-forbidden-field-check-before-hash-recompute]]: forbidden-field
// scan fires BEFORE hash recompute so injection attempts surface with the
// semantically meaningful error.

import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import {
  URP_CHOOSE_RECEIPT_SCHEMA,
  DECISION_MARK_SHAREABLE,
  DECISION_MARK_LOCAL_ONLY,
} from "./choose-decision.js";

export const URP_CHOOSE_VERIFY_RESULT_SCHEMA =
  "bizra.dema.urp_choose_verification.v0.1";

const FILENAME_PATTERN = /^choose-([a-f0-9]{64})\.json$/;

const FORBIDDEN_FIELDS = Object.freeze([
  "private_key",
  "private_key_pem",
  "raw_artifact",
  "artifact_content",
  "full_receipt_json",
  "personal_memory",
  "mint_candidate",
  "token_eligible",
  "reward",
  "bzc",
  "imp",
  "economic_value",
  "federation_target",
]);

const PASS_BOUNDARY = Object.freeze({
  file_read_performed: true,
  file_write_performed: false,
  private_key_loaded: false,
  raw_artifact_included: false,
  full_receipt_json_included: false,
  personal_memory_included: false,
  network_used: false,
  federation_used: false,
  token_minted: false,
  poi_score_calculated: false,
  economic_claim_made: false,
  mutation_performed: false,
});

const FAIL_BOUNDARY = Object.freeze({
  file_read_performed: true,
  file_write_performed: false,
  private_key_loaded: false,
  raw_artifact_included: false,
  full_receipt_json_included: false,
  personal_memory_included: false,
  network_used: false,
  federation_used: false,
  token_minted: false,
  poi_score_calculated: false,
  economic_claim_made: false,
  mutation_performed: false,
});

function fail(error, details = {}) {
  return Object.freeze({
    schema: URP_CHOOSE_VERIFY_RESULT_SCHEMA,
    verified: false,
    verdict: "FAILED",
    truth_label: "LOCAL_CHOOSE_RECEIPT_FAILED",
    error,
    ...details,
    boundary: FAIL_BOUNDARY,
  });
}

function findForbiddenField(rawJson) {
  for (const field of FORBIDDEN_FIELDS) {
    if (rawJson.includes(`"${field}":`)) return field;
  }
  return null;
}

function isValidDecision(d) {
  return d === DECISION_MARK_SHAREABLE || d === DECISION_MARK_LOCAL_ONLY;
}

export async function verifyChooseReceiptFile(filePath) {
  if (typeof filePath !== "string" || filePath.length === 0) {
    return fail("missing_path");
  }

  let raw;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (err) {
    return fail("cannot_read_file", {
      file_path: filePath,
      message: String(err?.message ?? err),
    });
  }

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return fail("invalid_json", { file_path: filePath });
  }

  if (!body || typeof body !== "object") {
    return fail("invalid_body_shape", { file_path: filePath });
  }

  if (body.schema !== URP_CHOOSE_RECEIPT_SCHEMA) {
    return fail("wrong_schema", {
      file_path: filePath,
      received_schema: body.schema ?? null,
    });
  }

  if (body.chosen !== true) {
    return fail("chosen_false", { file_path: filePath });
  }

  if (!isValidDecision(body.decision)) {
    return fail("invalid_decision", {
      file_path: filePath,
      received_decision: body.decision ?? null,
    });
  }

  if (body.consent_verified !== true) {
    return fail("consent_not_verified", { file_path: filePath });
  }

  // Forbidden-field scan BEFORE hash check (per
  // [[writer-forbidden-field-check-before-hash-recompute]] memory entry).
  const forbidden = findForbiddenField(raw);
  if (forbidden) {
    return fail("forbidden_field_present", {
      file_path: filePath,
      field: forbidden,
    });
  }

  const declaredHash = body.choose_hash;
  if (typeof declaredHash !== "string" || declaredHash.length !== 64) {
    return fail("missing_or_invalid_choose_hash", {
      file_path: filePath,
      received: declaredHash ?? null,
    });
  }

  const { choose_hash: _ch, decided_at_iso: _iso, ...stableBody } = body;
  const recomputedHash = sha256(stableStringify(stableBody));
  if (declaredHash !== recomputedHash) {
    return fail("body_hash_mismatch", {
      file_path: filePath,
      declared: declaredHash,
      recomputed: recomputedHash,
    });
  }

  const filenameMatch = basename(filePath).match(FILENAME_PATTERN);
  let filenameHashMatches = null;
  if (filenameMatch) {
    filenameHashMatches = filenameMatch[1] === declaredHash;
    if (!filenameHashMatches) {
      return fail("filename_hash_mismatch", {
        file_path: filePath,
        filename_hash: filenameMatch[1],
        body_hash: declaredHash,
      });
    }
  }

  return Object.freeze({
    schema: URP_CHOOSE_VERIFY_RESULT_SCHEMA,
    verified: true,
    verdict: "VERIFIED",
    truth_label: "LOCAL_CHOOSE_RECEIPT_FILE_VERIFIED",
    choose_hash: declaredHash,
    filename_hash_matches: filenameHashMatches,
    body_hash_intact: true,
    decision: body.decision,
    previous_share_status: body.previous_share_status ?? null,
    next_share_status: body.next_share_status ?? null,
    source_index_hash: body.source_index_hash ?? null,
    consent_verified: true,
    decided_at_iso: body.decided_at_iso ?? null,
    boundary: PASS_BOUNDARY,
  });
}
