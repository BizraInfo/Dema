import { mkdir, writeFile, readFile, rename, stat } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import { URP_LOCAL_INDEX_SCHEMA } from "./local-index.js";

export const URP_INDEX_WRITE_RESULT_SCHEMA =
  "bizra.dema.urp_local_index_write_result.v0.1";

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

const WRITER_BOUNDARY_OK = Object.freeze({
  private_key_loaded: false,
  file_write_performed: true,
  raw_artifact_included: false,
  full_receipt_json_included: false,
  personal_memory_included: false,
  network_used: false,
  federation_used: false,
  token_minted: false,
  poi_score_calculated: false,
  economic_claim_made: false,
});

const WRITER_BOUNDARY_FAIL = Object.freeze({
  private_key_loaded: false,
  file_write_performed: false,
  raw_artifact_included: false,
  full_receipt_json_included: false,
  personal_memory_included: false,
  network_used: false,
  federation_used: false,
  token_minted: false,
  poi_score_calculated: false,
  economic_claim_made: false,
});

function resolveHome(demaHome) {
  if (typeof demaHome === "string" && demaHome.length > 0) return demaHome;
  return process.env.DEMA_HOME || join(homedir(), ".dema");
}

function fail(error, details = {}) {
  return Object.freeze({
    schema: URP_INDEX_WRITE_RESULT_SCHEMA,
    written: false,
    error,
    ...details,
    boundary: WRITER_BOUNDARY_FAIL,
  });
}

function containsForbiddenField(obj) {
  const json = JSON.stringify(obj);
  for (const field of FORBIDDEN_FIELDS) {
    if (json.includes(`"${field}":`)) return field;
  }
  return null;
}

export async function saveUrpLocalIndex(
  index,
  { demaHome, now: _now = new Date() } = {},
) {
  if (!index || typeof index !== "object") {
    return fail("invalid_input");
  }

  if (index.indexed === false) {
    return fail("indexed_false_envelope", { received_schema: index.schema });
  }

  const candidate = index.index ?? index;

  if (candidate.schema !== URP_LOCAL_INDEX_SCHEMA) {
    return fail("wrong_schema", { received_schema: candidate.schema });
  }

  if (candidate.mode !== "LOCAL_INDEX_ONLY") {
    return fail("wrong_mode", { received_mode: candidate.mode });
  }

  if (candidate.truth_label !== "LOCAL_VERIFIED_RESOURCE_INDEX") {
    return fail("wrong_truth_label", { received: candidate.truth_label });
  }

  if (candidate.share_status !== "MARKED_LOCAL_ONLY") {
    return fail("wrong_share_status", { received: candidate.share_status });
  }

  const forbidden = containsForbiddenField(candidate);
  if (forbidden) {
    return fail("forbidden_field_present", { field: forbidden });
  }

  const { index_hash: declaredHash, indexed_at_iso, ...stableBody } = candidate;
  const recomputedHash = sha256(stableStringify(stableBody));
  if (declaredHash && declaredHash !== recomputedHash) {
    return fail("hash_mismatch", {
      declared: declaredHash,
      recomputed: recomputedHash,
    });
  }

  const home = resolveHome(demaHome);
  const indexDir = join(home, "urp", "indexes");
  const finalFilename = `urp-index-${recomputedHash}.json`;
  const finalPath = join(indexDir, finalFilename);
  const tmpPath = join(
    indexDir,
    `.tmp-${finalFilename}.${process.pid}.${Date.now()}`,
  );

  await mkdir(indexDir, { recursive: true });

  const persistableBody = {
    ...stableBody,
    index_hash: recomputedHash,
    indexed_at_iso: indexed_at_iso ?? new Date().toISOString(),
  };
  const json = JSON.stringify(persistableBody, null, 2);

  await writeFile(tmpPath, json, { encoding: "utf8", flag: "wx", mode: 0o600 });
  await rename(tmpPath, finalPath);

  const readBack = JSON.parse(await readFile(finalPath, "utf8"));
  const { index_hash: _ih, indexed_at_iso: _iat, ...readBackStable } = readBack;
  const verifyHash = sha256(stableStringify(readBackStable));
  const verifiedAfterWrite = verifyHash === recomputedHash;

  if (!verifiedAfterWrite) {
    return fail("read_back_hash_mismatch", {
      expected: recomputedHash,
      got: verifyHash,
      index_path: finalPath,
    });
  }

  const finalStat = await stat(finalPath);
  const finalMode = finalStat.mode & 0o777;

  return Object.freeze({
    schema: URP_INDEX_WRITE_RESULT_SCHEMA,
    written: true,
    index_hash: recomputedHash,
    index_path: finalPath,
    mode_octal: `0o${finalMode.toString(8).padStart(3, "0")}`,
    verified_after_write: true,
    boundary: WRITER_BOUNDARY_OK,
  });
}
