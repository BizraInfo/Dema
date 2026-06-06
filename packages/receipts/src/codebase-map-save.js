// Codebase Map Save — preview-grade local persistence for the v0.1
// architecture-map envelope emitted by `dema codebase map <abs-path>`.
//
// IMPORTANT NAMING (mirrors PR #83 route-receipt-save + PR #85
// invocation-result-save + PR #87 verification-result-save):
//   "mint" is RESERVED for the canonical chain-bound receipt flow (ADR-008
//   §C12). This module is intentionally NOT a mint. It is a preview-grade
//   "save" that writes the codebase-map envelope JSON to a content-addressed
//   file under $DEMA_HOME/receipts/. The save does NOT advance any chain,
//   does NOT pass SAT verification, and does NOT call the governed gateway.
//
// SAVE-vs-CHAIN-BOUND: this save persists Dema's architecture-map snapshot
// for operator audit. A future C12 path may consume these envelopes and
// graduate them into chain-bound mints; that path is out of v0.2 scope.
//
// Boundary:
//   - read-only over the envelope object (never mutates the envelope body)
//   - write-only to $DEMA_HOME/receipts/codebase-map-<sha256>.json (no other path)
//   - no network call
//   - no model invocation
//   - no chain advance / no governed-gateway handoff
//   - no target-repo mutation (target was already read-only at v0.1)
//
// Atomic-write pattern (mitigates TOCTOU + crash safety; same as the
// 3-PR mirror PR #83 / PR #85 / PR #87):
//   1. mkdir receipts dir (recursive)
//   2. realpath containment check
//   3. write content to a unique temp file in the same dir (flag: "wx")
//   4. rename temp file to the final content-addressed filename
//   5. on any error: best-effort unlink of temp file
//
// NEW design delta (unique to codebase-map vs the 3-PR mirror):
//   MAX_SAVED_BYTES safety cap. Architecture maps grow with repo size and
//   can produce envelopes much larger than the route/invocation/verification
//   envelopes (which are all <100 KiB). Cap at 256 MiB serialized; fail-closed
//   if exceeded. Caller exits non-zero before any stdout write.

import { createHash } from "node:crypto";
import { mkdir, writeFile, rename, unlink, realpath } from "node:fs/promises";
import { join, isAbsolute, relative, resolve, sep } from "node:path";
import { homedir } from "node:os";

export const CODEBASE_MAP_SAVE_CONSENT =
  "GO: save local codebase architecture map";

export const CODEBASE_MAP_SAVE_SCHEMA =
  "bizra.dema.codebase_architecture_map_save.v0.1";

// 256 MiB cap on the serialized envelope. Picked to comfortably accommodate
// a full-corpus scan with --include-tests --hotspots (largest case observed
// in the Dema self-scan is ~5 MiB; the cap leaves 50× headroom for larger
// target repos while still hard-capping disk + memory pressure).
export const MAX_SAVED_BYTES = 268_435_456;

function sha256Hex(content) {
  return createHash("sha256").update(content).digest("hex");
}

// Single source of truth for how the codebase-map envelope is serialized for
// BOTH stdout and disk. Callers pass the SAME options to this function and
// to their stdout writer so the on-disk file matches stdout byte-for-byte
// (architect-locked invariant from PR #83).
export function serializeCodebaseMapForSave(envelope, { pretty = false } = {}) {
  const body = pretty
    ? JSON.stringify(envelope, null, 2)
    : JSON.stringify(envelope);
  return body + "\n";
}

function resolveDemaHome(demaHome) {
  if (typeof demaHome === "string" && demaHome.length > 0) return demaHome;
  return process.env.DEMA_HOME || join(homedir(), ".dema");
}

// Compute the target save path (and content) for a codebase-map envelope
// without performing any I/O. Useful for callers that want the path BEFORE
// deciding to write.
export function buildCodebaseMapSavePath(
  envelope,
  { demaHome, pretty = false } = {},
) {
  const home = resolveDemaHome(demaHome);
  const content = serializeCodebaseMapForSave(envelope, { pretty });
  const sha = sha256Hex(content);
  const filename = `codebase-map-${sha}.json`;
  const dir = join(home, "receipts");
  return {
    dir,
    filename,
    path: join(dir, filename),
    sha256: sha,
    content,
    dema_home: home,
    serialized_bytes: Buffer.byteLength(content, "utf8"),
  };
}

// Containment check: confirm finalPath resolves inside the realpath of
// receiptsDir. Mitigates symlink-escape attacks. Modeled on receipt-store's
// per-entry containment pattern (settled by PR #64 3-reviewer review) and
// the existing save mirrors (PR #83 / PR #85 / PR #87).
async function assertContained(receiptsDir, finalPath) {
  const realRoot = await realpath(receiptsDir);
  const absFinal = resolve(receiptsDir, finalPath);
  const rel = relative(realRoot, absFinal);
  if (rel === ".." || rel.startsWith(".." + sep) || isAbsolute(rel)) {
    throw new Error(
      `codebase-map-save: save target escapes receipts dir: ${absFinal}`,
    );
  }
}

// saveCodebaseMap: persist a codebase-architecture-map envelope to
// $DEMA_HOME/receipts/ under explicit consent + atomic write.
//
// Returns:
//   { saved: true,  path, filename, sha256, dema_home, serialized_bytes }
//   { saved: false, reason: "consent_missing" | "consent_mismatch"
//                          | "oversized_serialized_envelope" | "io_error",
//                  expected, max_saved_bytes?, serialized_bytes?, error_message? }
//
// Never raises on consent/size failure. Raises only on unexpected I/O errors
// the caller should surface verbatim.
//
// Saves complete, partial, and error_reason envelopes equally — the
// architect-locked rule per ADR-005 audit principle (operator should be able
// to review WHY a scan stopped short by reading the saved envelope).
//
// The `maxBytes` parameter defaults to MAX_SAVED_BYTES (256 MiB) and exists
// for test injection — tests can use a tiny cap to exercise the
// oversized_serialized_envelope path without allocating 270 MiB strings.
// Production callers should NEVER override it.
export async function saveCodebaseMap(
  envelope,
  { demaHome, consent, pretty = false, maxBytes = MAX_SAVED_BYTES } = {},
) {
  if (typeof consent !== "string" || consent.length === 0) {
    return {
      saved: false,
      reason: "consent_missing",
      expected: CODEBASE_MAP_SAVE_CONSENT,
    };
  }
  if (consent !== CODEBASE_MAP_SAVE_CONSENT) {
    return {
      saved: false,
      reason: "consent_mismatch",
      expected: CODEBASE_MAP_SAVE_CONSENT,
    };
  }

  const built = buildCodebaseMapSavePath(envelope, { demaHome, pretty });
  const {
    dir: receiptsDir,
    filename,
    path: finalPath,
    sha256: sha,
    content,
    dema_home,
    serialized_bytes,
  } = built;

  // NEW (v0.2): hard cap on serialized envelope size. Unique to codebase-map
  // because architecture maps grow with repo size. Default cap is 256 MiB;
  // overridable via `maxBytes` for tests. Fail-closed on overflow.
  if (serialized_bytes > maxBytes) {
    return {
      saved: false,
      reason: "oversized_serialized_envelope",
      expected: CODEBASE_MAP_SAVE_CONSENT,
      max_saved_bytes: maxBytes,
      serialized_bytes,
    };
  }

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
    try {
      await unlink(tmpPath);
    } catch {
      /* swallow */
    }
    return {
      saved: false,
      reason: "io_error",
      expected: CODEBASE_MAP_SAVE_CONSENT,
      error_message: err?.message ?? String(err),
    };
  }

  return Object.freeze({
    saved: true,
    path: finalPath,
    filename,
    sha256: sha,
    dema_home,
    serialized_bytes,
  });
}
