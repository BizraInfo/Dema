// PROOF-OF-SPEND-1A Save — preview-grade local persistence for
// `dema corpus spend` receipts. NOT a mint. Writes only under
// $DEMA_HOME/receipts/proof-of-spend-<sha256>.json.

import { mkdir, writeFile, rename, unlink, realpath } from "node:fs/promises";
import { join, isAbsolute, relative, resolve, sep } from "node:path";
import { homedir } from "node:os";

import { serializeProofOfSpendForSave } from "../../core/src/proof-of-spend-1a.js";
import { sha256Hex } from "./hash-util.js";

export const PROOF_OF_SPEND_SAVE_SCHEMA =
  "bizra.dema.proof_of_spend_save.v0.1";

export const MAX_SAVED_BYTES = 16 * 1024 * 1024;

function resolveDemaHome(demaHome) {
  if (typeof demaHome === "string" && demaHome.length > 0) return demaHome;
  return process.env.DEMA_HOME || join(homedir(), ".dema");
}

export function buildProofOfSpendSavePath(
  envelope,
  { demaHome, pretty = false } = {},
) {
  const home = resolveDemaHome(demaHome);
  const content = serializeProofOfSpendForSave(envelope, { pretty });
  const sha = sha256Hex(content);
  const filename = `proof-of-spend-${sha}.json`;
  const dir = join(home, "receipts");
  return Object.freeze({
    dir,
    filename,
    path: join(dir, filename),
    sha256: sha,
    content,
    dema_home: home,
    serialized_bytes: Buffer.byteLength(content, "utf8"),
  });
}

async function assertContained(receiptsDir, finalPath) {
  const realRoot = await realpath(receiptsDir);
  const absFinal = resolve(receiptsDir, finalPath);
  const rel = relative(realRoot, absFinal);
  if (rel === ".." || rel.startsWith(".." + sep) || isAbsolute(rel)) {
    throw new Error(
      `proof-of-spend-save: save target escapes receipts dir: ${absFinal}`,
    );
  }
}

export async function saveProofOfSpend(
  envelope,
  { demaHome, pretty = false, maxBytes = MAX_SAVED_BYTES } = {},
) {
  if (!envelope || envelope.no_mint !== true) {
    return Object.freeze({
      saved: false,
      reason: "invalid_envelope",
    });
  }
  if (envelope.truth_label !== "FOUNDER_COST_MEASURED_NOT_VALUE") {
    return Object.freeze({ saved: false, reason: "truth_label_mismatch" });
  }

  const built = buildProofOfSpendSavePath(envelope, { demaHome, pretty });
  const {
    dir: receiptsDir,
    filename,
    path: finalPath,
    sha256: sha,
    content,
    dema_home,
    serialized_bytes,
  } = built;

  if (serialized_bytes > maxBytes) {
    return Object.freeze({
      saved: false,
      reason: "oversized_serialized_envelope",
      max_saved_bytes: maxBytes,
      serialized_bytes,
    });
  }

  await mkdir(receiptsDir, { recursive: true });
  await assertContained(receiptsDir, filename);

  const tmpFilename = `${filename}.tmp-${process.pid}-${Date.now()}`;
  const tmpPath = join(receiptsDir, tmpFilename);

  try {
    await writeFile(tmpPath, content, { encoding: "utf8", flag: "wx" });
    await rename(tmpPath, finalPath);
  } catch (err) {
    try {
      await unlink(tmpPath);
    } catch {
      /* swallow */
    }
    if (err?.code === "EEXIST") {
      return Object.freeze({
        saved: true,
        path: finalPath,
        filename,
        sha256: sha,
        dema_home,
        serialized_bytes,
        schema: PROOF_OF_SPEND_SAVE_SCHEMA,
        no_mint: true,
        reason: "already_exists",
      });
    }
    return Object.freeze({
      saved: false,
      reason: "io_error",
      error_message: err?.message ?? String(err),
    });
  }

  return Object.freeze({
    saved: true,
    path: finalPath,
    filename,
    sha256: sha,
    dema_home,
    serialized_bytes,
    schema: PROOF_OF_SPEND_SAVE_SCHEMA,
    no_mint: true,
  });
}
