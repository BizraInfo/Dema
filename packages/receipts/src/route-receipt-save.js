// Route Receipt Save — preview-grade local persistence for the v0.1
// route receipt emitted by `dema model-broker route`.
//
// IMPORTANT NAMING (per ADR-008 §C12 + 2026-05-21 architect decision):
//   "mint" is RESERVED for the canonical chain-bound receipt flow
//   (PAT-6 → SAT-1..5 → governed gateway → chain advance, with OTS
//   attestation for founding-grade). See receipt-mint-integration.js.
//   This module is intentionally NOT a mint. It is a preview-grade
//   "save" that writes the route receipt JSON to a content-addressed
//   file under $DEMA_HOME/receipts/. The save does NOT advance any
//   chain, does NOT pass SAT verification, and does NOT call the
//   governed gateway.
//
// Boundary:
//   - read-only over the receipt object (never mutates the receipt body)
//   - write-only to $DEMA_HOME/receipts/route-<sha256>.json (no other path)
//   - no network call
//   - no model invocation
//   - no chain advance / no governed-gateway handoff
//
// Atomic-write pattern (mitigates TOCTOU + crash safety):
//   1. mkdir receipts dir (recursive)
//   2. write content to a unique temp file in the same dir
//   3. rename temp file to the final content-addressed filename
//   4. on any error: best-effort unlink of temp file
//
// Consent contract (per ADR-005):
//   - exact-string match against ROUTE_RECEIPT_SAVE_CONSENT
//   - mismatch / missing returns { saved: false, reason: "consent_*" }
//   - the helper never raises on consent failure; caller decides exit

import { createHash } from "node:crypto";
import { mkdir, writeFile, rename, unlink, realpath } from "node:fs/promises";
import { join, isAbsolute, relative, resolve, sep } from "node:path";
import { homedir } from "node:os";

export const ROUTE_RECEIPT_SAVE_CONSENT = "GO: save local model route receipt";

export const ROUTE_RECEIPT_SAVE_SCHEMA = "bizra.dema.local_model_route_receipt_save.v0.1";

function sha256Hex(content) {
  return createHash("sha256").update(content).digest("hex");
}

// Single source of truth for how the route receipt is serialized for both
// stdout and disk. Callers pass the SAME options to this function and to
// their stdout writer so the on-disk file matches stdout byte-for-byte.
export function serializeRouteReceiptForSave(receipt, { pretty = false } = {}) {
  const body = pretty
    ? JSON.stringify(receipt, null, 2)
    : JSON.stringify(receipt);
  return body + "\n";
}

function resolveDemaHome(demaHome) {
  if (typeof demaHome === "string" && demaHome.length > 0) return demaHome;
  return process.env.DEMA_HOME || join(homedir(), ".dema");
}

// Compute the target save path (and content) for a route receipt without
// performing any I/O. Useful for callers that want the path BEFORE deciding
// to write.
export function buildRouteReceiptSavePath(receipt, { demaHome, pretty = false } = {}) {
  const home = resolveDemaHome(demaHome);
  const content = serializeRouteReceiptForSave(receipt, { pretty });
  const sha = sha256Hex(content);
  const filename = `route-${sha}.json`;
  const dir = join(home, "receipts");
  return {
    dir,
    filename,
    path: join(dir, filename),
    sha256: sha,
    content,
    dema_home: home
  };
}

// Containment check: confirm finalPath resolves inside the realpath of
// receiptsDir. Mitigates symlink-escape attacks. Modeled on receipt-store's
// per-entry containment pattern (settled by PR #64 3-reviewer review).
async function assertContained(receiptsDir, finalPath) {
  const realRoot = await realpath(receiptsDir);
  const absFinal = resolve(receiptsDir, finalPath);
  const rel = relative(realRoot, absFinal);
  if (rel === ".." || rel.startsWith(".." + sep) || isAbsolute(rel)) {
    throw new Error(`route-receipt-save: save target escapes receipts dir: ${absFinal}`);
  }
}

// saveRouteReceipt: persist a route receipt to $DEMA_HOME/receipts/ under
// explicit consent + atomic write.
//
// Returns:
//   { saved: true,  path, filename, sha256, dema_home }
//   { saved: false, reason: "consent_missing" | "consent_mismatch" | "io_error", expected, error_message }
//
// Never raises on consent failure. Raises only on unexpected I/O errors
// the caller should surface verbatim.
export async function saveRouteReceipt(receipt, { demaHome, consent, pretty = false } = {}) {
  if (typeof consent !== "string" || consent.length === 0) {
    return {
      saved: false,
      reason: "consent_missing",
      expected: ROUTE_RECEIPT_SAVE_CONSENT
    };
  }
  if (consent !== ROUTE_RECEIPT_SAVE_CONSENT) {
    return {
      saved: false,
      reason: "consent_mismatch",
      expected: ROUTE_RECEIPT_SAVE_CONSENT
    };
  }

  const { dir: receiptsDir, filename, path: finalPath, sha256: sha, content, dema_home } =
    buildRouteReceiptSavePath(receipt, { demaHome, pretty });

  await mkdir(receiptsDir, { recursive: true });

  // Containment check (post-mkdir so realpath resolves).
  await assertContained(receiptsDir, filename);

  // Unique temp filename in the same dir as final (ensures rename atomicity
  // across the same filesystem).
  const tmpFilename = `${filename}.tmp-${process.pid}-${Date.now()}`;
  const tmpPath = join(receiptsDir, tmpFilename);

  try {
    // Exclusive-create write: refuse to overwrite any pre-existing temp file
    // from a concurrent invocation. Same-content concurrent saves resolve
    // when one wins the rename.
    await writeFile(tmpPath, content, { encoding: "utf8", flag: "wx" });
    await rename(tmpPath, finalPath);
  } catch (err) {
    // Best-effort cleanup of the temp file. Ignore unlink failures (the
    // original error is what matters).
    try { await unlink(tmpPath); } catch { /* swallow */ }
    return {
      saved: false,
      reason: "io_error",
      expected: ROUTE_RECEIPT_SAVE_CONSENT,
      error_message: err?.message ?? String(err)
    };
  }

  return Object.freeze({
    saved: true,
    path: finalPath,
    filename,
    sha256: sha,
    dema_home
  });
}
