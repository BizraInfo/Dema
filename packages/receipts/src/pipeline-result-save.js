// Pipeline Result Save — preview-grade local persistence for the v0.1
// SAT-1..5 orchestrator pipeline envelope emitted by
// `dema orchestrator verify`.
//
// IMPORTANT NAMING (mirrors PR #83/#85/#87/#89 atomic-save canon):
//   "mint" is RESERVED for the canonical chain-bound receipt flow (ADR-008
//   §C12). This module is intentionally NOT a mint. It is a preview-grade
//   "save" that writes the pipeline envelope JSON to a content-addressed
//   file under $DEMA_HOME/receipts/. The save does NOT advance any chain,
//   does NOT pass SAT verification (the pipeline itself ran), and does NOT
//   call the governed gateway.
//
// SAVE-vs-CHAIN-BOUND: this save persists the deterministic SAT-1..5
// pipeline verdict (per-SAT verdicts + aggregate) for operator audit. A
// future C12 path may consume these envelopes as `sat_pipeline_result`
// inputs to `buildReceiptMintRequest`. The chain-bound mint itself is
// freeze-point item #4 — out of v0.1 scope here.
//
// Boundary:
//   - read-only over the envelope object (never mutates the envelope body)
//   - write-only to $DEMA_HOME/receipts/pipeline-<sha256>.json (no other path)
//   - no network call · no model invocation · no chain advance / no
//     governed-gateway handoff
//
// Atomic-write pattern (mitigates TOCTOU + crash safety; identical to the
// 4-PR save canon PR #83/#85/#87/#89):
//   1. mkdir receipts dir (recursive)
//   2. realpath containment check
//   3. write content to a unique temp file in the same dir (flag: "wx")
//   4. rename temp file to the final content-addressed filename
//   5. on any error: best-effort unlink of temp file
//
// NOTE on size cap: unlike PR #89 codebase-map-save, this helper does NOT
// add a MAX_SAVED_BYTES cap. Pipeline envelopes aggregate 5 SAT verdicts
// (each ~1 KiB) plus the source artifact's schema string — bounded by
// design to a few KiB. No need for a hatch.

import { mkdir, writeFile, rename, unlink, realpath } from "node:fs/promises";
import { join, isAbsolute, relative, resolve, sep } from "node:path";
import { homedir } from "node:os";
import { sha256Hex } from "./hash-util.js";

export const PIPELINE_RESULT_SAVE_CONSENT =
  "GO: save local orchestrator pipeline result";

export const PIPELINE_RESULT_SAVE_SCHEMA =
  "bizra.dema.orchestrator_pipeline_result_save.v0.1";

// Single source of truth for how the pipeline envelope is serialized for
// BOTH stdout and disk. Callers pass the SAME options to this function and
// to their stdout writer so the on-disk file matches stdout byte-for-byte
// (architect-locked invariant from PR #83).
export function serializePipelineResultForSave(
  envelope,
  { pretty = false } = {},
) {
  const body = pretty
    ? JSON.stringify(envelope, null, 2)
    : JSON.stringify(envelope);
  return body + "\n";
}

function resolveDemaHome(demaHome) {
  if (typeof demaHome === "string" && demaHome.length > 0) return demaHome;
  return process.env.DEMA_HOME || join(homedir(), ".dema");
}

// Compute the target save path (and content) for a pipeline envelope
// without performing any I/O. Useful for callers that want the path BEFORE
// deciding to write.
export function buildPipelineResultSavePath(
  envelope,
  { demaHome, pretty = false } = {},
) {
  const home = resolveDemaHome(demaHome);
  const content = serializePipelineResultForSave(envelope, { pretty });
  const sha = sha256Hex(content);
  const filename = `pipeline-${sha}.json`;
  const dir = join(home, "receipts");
  return {
    dir,
    filename,
    path: join(dir, filename),
    sha256: sha,
    content,
    dema_home: home,
  };
}

// Containment check: confirm finalPath resolves inside the realpath of
// receiptsDir. Mitigates symlink-escape attacks. Modeled on receipt-store's
// per-entry containment pattern (settled by PR #64 3-reviewer review) and
// the existing save mirrors (PR #83/#85/#87/#89).
async function assertContained(receiptsDir, finalPath) {
  const realRoot = await realpath(receiptsDir);
  const absFinal = resolve(receiptsDir, finalPath);
  const rel = relative(realRoot, absFinal);
  if (rel === ".." || rel.startsWith(".." + sep) || isAbsolute(rel)) {
    throw new Error(
      `pipeline-result-save: save target escapes receipts dir: ${absFinal}`,
    );
  }
}

// savePipelineResult: persist a SAT-1..5 orchestrator pipeline envelope to
// $DEMA_HOME/receipts/ under explicit consent + atomic write.
//
// Returns:
//   { saved: true,  path, filename, sha256, dema_home }
//   { saved: false, reason: "consent_missing" | "consent_mismatch" | "io_error",
//                  expected, error_message? }
//
// Never raises on consent failure. Raises only on unexpected I/O errors
// the caller should surface verbatim.
//
// Saves BOTH passed and non-passed pipeline envelopes equally — the
// architect-locked rule per ADR-005 audit principle (operator should be
// able to review WHY the pipeline failed by reading the saved envelope).
export async function savePipelineResult(
  envelope,
  { demaHome, consent, pretty = false } = {},
) {
  if (typeof consent !== "string" || consent.length === 0) {
    return {
      saved: false,
      reason: "consent_missing",
      expected: PIPELINE_RESULT_SAVE_CONSENT,
    };
  }
  if (consent !== PIPELINE_RESULT_SAVE_CONSENT) {
    return {
      saved: false,
      reason: "consent_mismatch",
      expected: PIPELINE_RESULT_SAVE_CONSENT,
    };
  }

  const {
    dir: receiptsDir,
    filename,
    path: finalPath,
    sha256: sha,
    content,
    dema_home,
  } = buildPipelineResultSavePath(envelope, { demaHome, pretty });

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
      expected: PIPELINE_RESULT_SAVE_CONSENT,
      error_message: err?.message ?? String(err),
    };
  }

  return Object.freeze({
    saved: true,
    path: finalPath,
    filename,
    sha256: sha,
    dema_home,
  });
}
