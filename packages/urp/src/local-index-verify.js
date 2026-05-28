import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import { URP_LOCAL_INDEX_SCHEMA } from "./local-index.js";

export const URP_LOCAL_INDEX_VERIFICATION_SCHEMA =
  "bizra.dema.urp_local_index_verification.v0.1";

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

const FILENAME_PATTERN = /^urp-index-([a-f0-9]{64})\.json$/;

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
});

function fail(error, details = {}) {
  return Object.freeze({
    schema: URP_LOCAL_INDEX_VERIFICATION_SCHEMA,
    verified: false,
    verdict: "FAILED",
    truth_label: "LOCAL_VERIFIED_RESOURCE_INDEX_FILE_FAILED",
    error,
    ...details,
    boundary: FAIL_BOUNDARY,
  });
}

function findForbiddenField(json) {
  for (const field of FORBIDDEN_FIELDS) {
    if (json.includes(`"${field}":`)) return field;
  }
  return null;
}

export async function verifyUrpLocalIndexFile(filePath) {
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

  if (body.schema !== URP_LOCAL_INDEX_SCHEMA) {
    return fail("wrong_schema", {
      file_path: filePath,
      received_schema: body.schema ?? null,
    });
  }

  if (body.mode !== "LOCAL_INDEX_ONLY") {
    return fail("wrong_mode", {
      file_path: filePath,
      received_mode: body.mode ?? null,
    });
  }

  if (body.truth_label !== "LOCAL_VERIFIED_RESOURCE_INDEX") {
    return fail("wrong_truth_label", {
      file_path: filePath,
      received: body.truth_label ?? null,
    });
  }

  if (body.share_status !== "MARKED_LOCAL_ONLY") {
    return fail("wrong_share_status", {
      file_path: filePath,
      received: body.share_status ?? null,
    });
  }

  const forbidden = findForbiddenField(raw);
  if (forbidden) {
    return fail("forbidden_field_present", {
      file_path: filePath,
      field: forbidden,
    });
  }

  const declaredHash = body.index_hash;
  if (typeof declaredHash !== "string" || declaredHash.length !== 64) {
    return fail("missing_or_invalid_index_hash", {
      file_path: filePath,
      received: declaredHash ?? null,
    });
  }

  const { index_hash: _ih, indexed_at_iso: _iat, ...stableBody } = body;
  const recomputedHash = sha256(stableStringify(stableBody));
  const bodyHashIntact = declaredHash === recomputedHash;
  if (!bodyHashIntact) {
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
    schema: URP_LOCAL_INDEX_VERIFICATION_SCHEMA,
    verified: true,
    verdict: "VERIFIED",
    truth_label: "LOCAL_VERIFIED_RESOURCE_INDEX_FILE_VERIFIED",
    index_hash: declaredHash,
    filename_hash_matches: filenameHashMatches,
    body_hash_intact: true,
    mode: body.mode,
    share_status: body.share_status,
    receipts_count:
      typeof body.receipts_count === "number" ? body.receipts_count : null,
    boundary: PASS_BOUNDARY,
  });
}
