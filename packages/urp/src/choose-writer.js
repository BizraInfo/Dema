// URP-4.1B · Durable Choose Receipt Writer.
//
// Persists a kernel envelope produced by URP-4.1A (`buildChooseDecision`)
// to disk as a content-addressed JSON file. Append-only by virtue of
// content addressing: identical decisions produce identical bytes at
// identical paths (idempotent); different decisions produce different
// hashes at different paths (no collision possible). Bridge Rule 15 of
// URP-4.0 §7 falls out of the math.
//
// Validates the envelope BEFORE persisting (writer doesn't trust upstream
// blindly; revalidates schema + chosen:true + hash + forbidden fields +
// consent_verified). On any validation failure: returns frozen failure
// envelope, NO file written.
//
// No CLI surface here -- module only. URP-4.1C wires the operator-facing
// CLI that collects exact-string consent, calls the kernel, calls this
// writer, and emits the human/JSON result.

import { mkdir, writeFile, readFile, rename, stat } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import {
  URP_CHOOSE_RECEIPT_SCHEMA,
  DECISION_MARK_SHAREABLE,
  DECISION_MARK_LOCAL_ONLY,
} from "./choose-decision.js";

export const URP_CHOOSE_RECEIPT_WRITE_RESULT_SCHEMA =
  "bizra.dema.urp_choose_receipt_write_result.v0.1";

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
  file_write_performed: true,
  mutation_performed: true,
  private_key_loaded: false,
  network_used: false,
  federation_used: false,
  share_published: false,
  resource_offer_created: false,
  poi_score_calculated: false,
  token_minted: false,
  economic_claim_made: false,
});

const WRITER_BOUNDARY_FAIL = Object.freeze({
  file_write_performed: false,
  mutation_performed: false,
  private_key_loaded: false,
  network_used: false,
  federation_used: false,
  share_published: false,
  resource_offer_created: false,
  poi_score_calculated: false,
  token_minted: false,
  economic_claim_made: false,
});

function resolveHome(demaHome) {
  if (typeof demaHome === "string" && demaHome.length > 0) return demaHome;
  return process.env.DEMA_HOME || join(homedir(), ".dema");
}

function fail(error, details = {}) {
  return Object.freeze({
    schema: URP_CHOOSE_RECEIPT_WRITE_RESULT_SCHEMA,
    written: false,
    error,
    ...details,
    boundary: WRITER_BOUNDARY_FAIL,
  });
}

function findForbiddenField(json) {
  for (const field of FORBIDDEN_FIELDS) {
    if (json.includes(`"${field}":`)) return field;
  }
  return null;
}

function isValidDecision(d) {
  return d === DECISION_MARK_SHAREABLE || d === DECISION_MARK_LOCAL_ONLY;
}

async function fileExists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export async function saveChooseDecision(
  envelope,
  { demaHome, now: _now = new Date() } = {},
) {
  if (!envelope || typeof envelope !== "object") {
    return fail("invalid_input");
  }
  if (envelope.schema !== URP_CHOOSE_RECEIPT_SCHEMA) {
    return fail("wrong_schema", {
      received_schema: envelope.schema ?? null,
    });
  }
  if (envelope.chosen !== true) {
    return fail("chosen_false", {
      received_error: envelope.error ?? null,
    });
  }
  if (!isValidDecision(envelope.decision)) {
    return fail("invalid_decision", {
      received_decision: envelope.decision ?? null,
    });
  }
  if (envelope.consent_verified !== true) {
    return fail("consent_not_verified");
  }
  // Forbidden field scan FIRST -- more specific error than the hash check.
  // An injected forbidden field would also cause a hash mismatch, but the
  // semantically meaningful error is that the kernel was tampered with to
  // leak data. Defense-in-depth: catch the leak attempt explicitly.
  const fullJson = JSON.stringify(envelope);
  const forbidden = findForbiddenField(fullJson);
  if (forbidden) {
    return fail("forbidden_field_present", { field: forbidden });
  }

  const declaredHash = envelope.choose_hash;
  if (typeof declaredHash !== "string" || declaredHash.length !== 64) {
    return fail("missing_or_invalid_choose_hash", {
      received: declaredHash ?? null,
    });
  }

  // Recompute hash from stable body (mirrors kernel's computation: exclude
  // both choose_hash and decided_at_iso).
  const {
    choose_hash: _choose_hash,
    decided_at_iso: _decided_at_iso,
    ...stableBody
  } = envelope;
  const recomputedHash = sha256(stableStringify(stableBody));
  if (declaredHash !== recomputedHash) {
    return fail("body_hash_mismatch", {
      declared: declaredHash,
      recomputed: recomputedHash,
    });
  }

  const home = resolveHome(demaHome);
  const choicesDir = join(home, "urp", "choices");
  const finalFilename = `choose-${recomputedHash}.json`;
  const finalPath = join(choicesDir, finalFilename);

  await mkdir(choicesDir, { recursive: true, mode: 0o700 });

  // Idempotent re-write detection: if a file with the same content-addressed
  // hash already exists, return success without rewriting (content-addressing
  // guarantees identical bytes; no mutation possible by construction).
  const alreadyExisted = await fileExists(finalPath);

  if (!alreadyExisted) {
    const persistableJson = JSON.stringify(envelope, null, 2);
    const tmpPath = join(
      choicesDir,
      `.tmp-${finalFilename}.${process.pid}.${Date.now()}`,
    );
    try {
      await writeFile(tmpPath, persistableJson, {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600,
      });
      await rename(tmpPath, finalPath);
    } catch (err) {
      return fail("write_failed", {
        message: String(err?.message ?? err),
      });
    }

    // Read-back verify (matches URP-3.1B discipline).
    let readBack;
    try {
      readBack = JSON.parse(await readFile(finalPath, "utf8"));
    } catch (err) {
      return fail("read_back_failed", {
        message: String(err?.message ?? err),
        receipt_path: finalPath,
      });
    }
    const {
      choose_hash: _rb_ch,
      decided_at_iso: _rb_iso,
      ...readBackStable
    } = readBack;
    const verifyHash = sha256(stableStringify(readBackStable));
    if (verifyHash !== recomputedHash) {
      return fail("read_back_hash_mismatch", {
        expected: recomputedHash,
        got: verifyHash,
        receipt_path: finalPath,
      });
    }
  }

  // Confirm mode on disk
  let modeOctal = null;
  try {
    const st = await stat(finalPath);
    modeOctal = `0o${(st.mode & 0o777).toString(8).padStart(3, "0")}`;
  } catch {
    // non-fatal; result still reports success if the rename above didn't throw
  }

  return Object.freeze({
    schema: URP_CHOOSE_RECEIPT_WRITE_RESULT_SCHEMA,
    written: true,
    truth_label: "LOCAL_CHOOSE_RECEIPT_PERSISTED",
    receipt_path: finalPath,
    receipt_filename: finalFilename,
    choose_hash: recomputedHash,
    mode_octal: modeOctal,
    already_existed: alreadyExisted,
    verified_after_write: !alreadyExisted,
    boundary: WRITER_BOUNDARY_OK,
  });
}
