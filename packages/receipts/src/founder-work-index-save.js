// Founder Work Index Save — preview-grade local persistence for
// `dema corpus index` receipts. NOT a mint. Writes only under
// $DEMA_HOME/receipts/founder-work-index-<sha256>.json.

import { mkdir, writeFile, rename, unlink, realpath } from "node:fs/promises";
import { join, isAbsolute, relative, resolve, sep } from "node:path";
import { homedir } from "node:os";
import { sha256Hex } from "./hash-util.js";

export const FOUNDER_WORK_INDEX_SAVE_SCHEMA =
  "bizra.dema.founder_work_index_save.v0.1";

export const MAX_SAVED_BYTES = 16 * 1024 * 1024;

export function serializeFounderWorkIndexForSave(envelope, { pretty = false } = {}) {
  const body = pretty
    ? JSON.stringify(envelope, null, 2)
    : JSON.stringify(envelope);
  return body + "\n";
}

function resolveDemaHome(demaHome) {
  if (typeof demaHome === "string" && demaHome.length > 0) return demaHome;
  return process.env.DEMA_HOME || join(homedir(), ".dema");
}

export function buildFounderWorkIndexSavePath(
  envelope,
  { demaHome, pretty = false } = {},
) {
  const home = resolveDemaHome(demaHome);
  const content = serializeFounderWorkIndexForSave(envelope, { pretty });
  const sha = sha256Hex(content);
  const filename = `founder-work-index-${sha}.json`;
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
      `founder-work-index-save: save target escapes receipts dir: ${absFinal}`,
    );
  }
}

export async function saveFounderWorkIndex(
  envelope,
  { demaHome, pretty = false, maxBytes = MAX_SAVED_BYTES } = {},
) {
  if (!envelope || envelope.no_mint !== true) {
    return Object.freeze({
      saved: false,
      reason: "invalid_envelope",
    });
  }

  const built = buildFounderWorkIndexSavePath(envelope, { demaHome, pretty });
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
    schema: FOUNDER_WORK_INDEX_SAVE_SCHEMA,
    no_mint: true,
  });
}
