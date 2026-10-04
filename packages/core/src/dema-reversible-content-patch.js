// DEMA-FOUNDER-RELIEF-REVERSIBLE-CONTENT-PATCH-0I — the A1 execution primitive
// the repair capsule was missing. The reversible execute-gate does RENAMES; a
// whitespace fix is a bounded CONTENT edit. This adds the smallest reversible
// content patch: strip trailing whitespace on a bounded set of exact lines,
// backup-before-write, content-hash before/after, and a proven undo. PURE core
// (strip) + injected-io executor. The executor is what `repo.patch_bounded`
// runs, gated by authorityVerdict; it touches nothing without an ALLOW lease.

import { createHash } from "node:crypto";

export const REVERSIBLE_PATCH_SCHEMA = "bizra.dema.reversible_content_patch.v0.1";
const sha256 = (s) => `sha256:${createHash("sha256").update(s).digest("hex")}`;

/** Pure: strip trailing whitespace on the given 1-indexed lines only. Returns
 *  { text, changed } — changed = how many lines actually lost trailing space.
 *  Bounded by construction: no line outside `lines` is touched. */
export function stripTrailingWhitespaceOnLines(text, lines = []) {
  if (typeof text !== "string") return { text, changed: 0, error: "text_required" };
  const want = new Set((Array.isArray(lines) ? lines : []).filter((n) => Number.isInteger(n) && n > 0));
  if (want.size === 0) return { text, changed: 0 };
  const rows = text.split("\n");
  let changed = 0;
  for (const n of want) {
    const i = n - 1;
    if (i >= rows.length) continue;
    const stripped = rows[i].replace(/[ \t]+$/, "");
    if (stripped !== rows[i]) { rows[i] = stripped; changed += 1; }
  }
  return { text: rows.join("\n"), changed };
}

/**
 * Apply the bounded patch reversibly. io is injected (readFile/writeFile),
 * so the primitive is unit-tested off any real file. Backs up the ORIGINAL
 * bytes, writes the stripped bytes, and returns a receipt whose undo restores
 * exactly the original. Refuses if nothing would change (no vacuous receipt).
 */
export function applyReversibleContentPatch({ file, lines, backupPath, readFile, writeFile, now = null } = {}) {
  if (typeof readFile !== "function" || typeof writeFile !== "function") {
    return Object.freeze({ ok: false, error: "io_required" });
  }
  if (typeof file !== "string" || !file) return Object.freeze({ ok: false, error: "file_required" });
  let before;
  try { before = readFile(file); } catch (e) { return Object.freeze({ ok: false, error: `read_failed:${String((e && e.message) || e)}` }); }
  const { text: after, changed, error } = stripTrailingWhitespaceOnLines(before, lines);
  if (error) return Object.freeze({ ok: false, error });
  if (changed === 0) return Object.freeze({ ok: false, error: "no_change_refused" });
  try {
    writeFile(backupPath, before);          // backup ORIGINAL first (fail-closed order)
    writeFile(file, after);
  } catch (e) { return Object.freeze({ ok: false, error: `write_failed:${String((e && e.message) || e)}` }); }
  return Object.freeze({
    schema: REVERSIBLE_PATCH_SCHEMA,
    ok: true, file, lines: Object.freeze([...lines]),
    lines_changed: changed,
    content_hash_before: sha256(before),
    content_hash_after: sha256(after),
    bytes_delta: after.length - before.length,
    backup_path: backupPath,
    undo: `restore ${file} from ${backupPath}`,
    at: typeof now === "string" ? now : null,
    authority_delta: 0,
  });
}

/** Prove reversibility: restore the file from the backup and confirm the hash. */
export function undoReversibleContentPatch({ receipt, readFile, writeFile } = {}) {
  if (!receipt || receipt.schema !== REVERSIBLE_PATCH_SCHEMA) return Object.freeze({ ok: false, error: "receipt_invalid" });
  if (typeof readFile !== "function" || typeof writeFile !== "function") return Object.freeze({ ok: false, error: "io_required" });
  let backup;
  try { backup = readFile(receipt.backup_path); } catch (e) { return Object.freeze({ ok: false, error: `backup_unreadable:${String((e && e.message) || e)}` }); }
  if (sha256(backup) !== receipt.content_hash_before) return Object.freeze({ ok: false, error: "backup_hash_mismatch" });
  try { writeFile(receipt.file, backup); } catch (e) { return Object.freeze({ ok: false, error: `restore_failed:${String((e && e.message) || e)}` }); }
  return Object.freeze({ ok: true, restored: receipt.file, hash: receipt.content_hash_before });
}
