// NODE0-QUALITY-EVIDENCE-CARD-1B — preview-grade local persistence.
// NOT a mint. Writes only under $DEMA_HOME/receipts/node0-quality-evidence-card-<sha256>.json.

import { mkdir, writeFile, rename, unlink, realpath } from "node:fs/promises";
import { join, isAbsolute, relative, resolve, sep } from "node:path";
import { homedir } from "node:os";
import { sha256Hex } from "./hash-util.js";

export const NODE0_QUALITY_EVIDENCE_CARD_SAVE_SCHEMA =
  "bizra.dema.node0_quality_evidence_card_save.v0.1";

export const MAX_SAVED_BYTES = 512 * 1024;

export function serializeNode0QualityEvidenceCardForSave(card, { pretty = false } = {}) {
  const body = pretty ? JSON.stringify(card, null, 2) : JSON.stringify(card);
  return body + "\n";
}

function resolveDemaHome(demaHome) {
  if (typeof demaHome === "string" && demaHome.length > 0) return demaHome;
  return process.env.DEMA_HOME || join(homedir(), ".dema");
}

export function buildNode0QualityEvidenceCardSavePath(
  card,
  { demaHome, pretty = false } = {},
) {
  const home = resolveDemaHome(demaHome);
  const content = serializeNode0QualityEvidenceCardForSave(card, { pretty });
  const sha = sha256Hex(content);
  const filename = `node0-quality-evidence-card-${sha}.json`;
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
      `node0-quality-evidence-card-save: save target escapes receipts dir: ${absFinal}`,
    );
  }
}

export async function saveNode0QualityEvidenceCard(
  card,
  { demaHome, pretty = false, maxBytes = MAX_SAVED_BYTES } = {},
) {
  if (!card || card.no_mint !== true) {
    return Object.freeze({
      saved: false,
      reason: "invalid_card",
    });
  }

  const built = buildNode0QualityEvidenceCardSavePath(card, { demaHome, pretty });
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
      reason: "oversized_serialized_card",
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
    schema: NODE0_QUALITY_EVIDENCE_CARD_SAVE_SCHEMA,
    no_mint: true,
  });
}
