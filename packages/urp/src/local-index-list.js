import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import { URP_LOCAL_INDEX_SCHEMA } from "./local-index.js";

export const URP_LOCAL_INDEX_LIST_SCHEMA =
  "bizra.dema.urp_local_index_list.v0.1";

const FILENAME_PATTERN = /^urp-index-([a-f0-9]{64})\.json$/;

const READ_ONLY_BOUNDARY = Object.freeze({
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

export async function listUrpLocalIndexes({ demaHome } = {}) {
  const home = resolveHome(demaHome);
  const indexesDir = join(home, "urp", "indexes");

  let filenames;
  try {
    filenames = await readdir(indexesDir);
  } catch {
    return Object.freeze({
      schema: URP_LOCAL_INDEX_LIST_SCHEMA,
      indexes_dir: indexesDir,
      count: 0,
      entries: Object.freeze([]),
      corruption_detected: false,
      boundary: READ_ONLY_BOUNDARY,
    });
  }

  const matched = filenames
    .map((f) => ({ filename: f, match: f.match(FILENAME_PATTERN) }))
    .filter((x) => x.match !== null)
    .sort((a, b) => a.filename.localeCompare(b.filename));

  const entries = [];
  let corruption = false;
  for (const { filename, match } of matched) {
    const filenameHash = match[1];
    const fullPath = join(indexesDir, filename);
    let body;
    try {
      const raw = await readFile(fullPath, "utf8");
      body = JSON.parse(raw);
    } catch (err) {
      corruption = true;
      entries.push(
        Object.freeze({
          filename,
          filename_hash: filenameHash,
          readable: false,
          error: "unreadable_or_invalid_json",
          message: String(err?.message ?? err),
        }),
      );
      continue;
    }

    if (body?.schema !== URP_LOCAL_INDEX_SCHEMA) {
      corruption = true;
      entries.push(
        Object.freeze({
          filename,
          filename_hash: filenameHash,
          readable: true,
          schema_match: false,
          received_schema: body?.schema ?? null,
          error: "wrong_schema",
        }),
      );
      continue;
    }

    const declaredHash = body.index_hash;
    const { index_hash: _ih, indexed_at_iso: _iat, ...stableBody } = body;
    const recomputedHash = sha256(stableStringify(stableBody));
    const filenameMatches = filenameHash === declaredHash;
    const bodyHashIntact = declaredHash === recomputedHash;
    if (!filenameMatches || !bodyHashIntact) corruption = true;

    entries.push(
      Object.freeze({
        filename,
        index_hash: declaredHash,
        filename_hash: filenameHash,
        filename_hash_matches: filenameMatches,
        body_hash_intact: bodyHashIntact,
        receipts_count:
          typeof body.receipts_count === "number" ? body.receipts_count : null,
        truth_label: body.truth_label ?? null,
        share_status: body.share_status ?? null,
        mode: body.mode ?? null,
        indexed_at_iso: body.indexed_at_iso ?? null,
      }),
    );
  }

  return Object.freeze({
    schema: URP_LOCAL_INDEX_LIST_SCHEMA,
    indexes_dir: indexesDir,
    count: entries.length,
    entries: Object.freeze(entries),
    corruption_detected: corruption,
    boundary: READ_ONLY_BOUNDARY,
  });
}
