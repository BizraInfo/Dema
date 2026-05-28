// URP-4.1C+ · Choose Receipt List (read surface for Stage 4 Choose).
//
// Mirrors URP-3.1C+ list-local-index pattern exactly, adapted to the
// choose-receipt schema. Enumerates content-addressed choose receipts under
// $DEMA_HOME/urp/choices/choose-<sha256>.json and validates per-entry
// integrity: filename-hash parity + body-hash recompute.
//
// NO file write. NO network. NO mutation. Pure read-and-enumerate.

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import { URP_CHOOSE_RECEIPT_SCHEMA } from "./choose-decision.js";

export const URP_CHOOSE_LIST_SCHEMA = "bizra.dema.urp_choose_list.v0.1";

const FILENAME_PATTERN = /^choose-([a-f0-9]{64})\.json$/;

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

export async function listChooseDecisions({ demaHome } = {}) {
  const home = resolveHome(demaHome);
  const choicesDir = join(home, "urp", "choices");

  let filenames;
  try {
    filenames = await readdir(choicesDir);
  } catch {
    return Object.freeze({
      schema: URP_CHOOSE_LIST_SCHEMA,
      choices_dir: choicesDir,
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
    const fullPath = join(choicesDir, filename);
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

    if (body?.schema !== URP_CHOOSE_RECEIPT_SCHEMA) {
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

    const declaredHash = body.choose_hash;
    const { choose_hash: _ch, decided_at_iso: _iso, ...stableBody } = body;
    const recomputedHash = sha256(stableStringify(stableBody));
    const filenameMatches = filenameHash === declaredHash;
    const bodyHashIntact = declaredHash === recomputedHash;
    if (!filenameMatches || !bodyHashIntact) corruption = true;

    entries.push(
      Object.freeze({
        filename,
        choose_hash: declaredHash,
        filename_hash: filenameHash,
        filename_hash_matches: filenameMatches,
        body_hash_intact: bodyHashIntact,
        decision: body.decision ?? null,
        previous_share_status: body.previous_share_status ?? null,
        next_share_status: body.next_share_status ?? null,
        source_index_hash: body.source_index_hash ?? null,
        consent_verified:
          typeof body.consent_verified === "boolean"
            ? body.consent_verified
            : null,
        decided_at_iso: body.decided_at_iso ?? null,
      }),
    );
  }

  return Object.freeze({
    schema: URP_CHOOSE_LIST_SCHEMA,
    choices_dir: choicesDir,
    count: entries.length,
    entries: Object.freeze(entries),
    corruption_detected: corruption,
    boundary: READ_ONLY_BOUNDARY,
  });
}
