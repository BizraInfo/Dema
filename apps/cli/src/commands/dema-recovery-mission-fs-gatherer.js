// DEMA-RECOVERY-MISSION-GATHERER-1B — read-only metadata effect adapter.
//
// The ONLY fs surface for this slice. Walks ONE bounded root (bounded by the
// caller's --root) collecting ONLY fs.lstatSync/readdirSync METADATA
// (relative_path, extension, size_bytes, mtime_iso) — never reads file
// content, never mutates, never lists outside the declared root. A symlink is
// followed only if its real target stays inside the root; a target that
// escapes the root is skipped, never walked; a symlink to an ancestor INSIDE
// the root is a cycle, so every real directory (device+inode) is visited once.
// Fail-closed on cap overrun: once
// the collected row count reaches maxFiles, this throws rather than silently
// truncating — the caller decides how to report that (never a partial,
// unlabeled result). Unreadable directories are skipped (permission gaps are
// not fatal; a capped/overrun walk is).

import { readdirSync, lstatSync, realpathSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";

export class RecoveryMissionGatherCapExceededError extends Error {
  constructor(cap) {
    super(`recovery mission gather exceeded max_files cap (${cap})`);
    this.name = "RecoveryMissionGatherCapExceededError";
    this.code = "max_files_exceeded";
  }
}

export function gatherRecoveryMissionFiles({ root, exclude = [], maxFiles = 5000 } = {}) {
  const rootReal = realpathSync(root);
  const rows = [];
  const rootStat = lstatSync(rootReal);
  walk(rootReal, rootReal, exclude, rows, maxFiles, new Set([dirKey(rootStat)]));
  return rows;
}

/**
 * Identity of a directory for cycle detection. device+inode rather than path, so
 * the same directory reached through a bind mount is still recognised as itself.
 */
function dirKey(stat) {
  return `${stat.dev}:${stat.ino}`;
}

function walk(dir, rootReal, exclude, rows, maxFiles, seen) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return; // unreadable dir — skip, never abort the whole walk on one permission gap
  }
  for (const entry of entries) {
    const abs = join(dir, entry.name);
    if (exclude.includes(abs)) continue;
    let stat;
    try {
      stat = lstatSync(abs);
    } catch {
      continue;
    }
    let walkTarget = abs;
    if (stat.isSymbolicLink()) {
      let target;
      try {
        target = realpathSync(abs);
      } catch {
        continue;
      }
      // Never follow a symlink whose real target escapes the declared root.
      if (target !== rootReal && !target.startsWith(rootReal + sep)) continue;
      try {
        stat = lstatSync(target);
      } catch {
        continue;
      }
      walkTarget = target;
    }
    if (stat.isDirectory()) {
      // A symlink to an ancestor makes a cycle. The max_files cap only advances
      // when a regular file is pushed, so a directory-only cycle never trips it
      // and the walk would recurse until the stack dies. Visit each real
      // directory once.
      const key = dirKey(stat);
      if (seen.has(key)) continue;
      seen.add(key);
      walk(walkTarget, rootReal, exclude, rows, maxFiles, seen);
      continue;
    }
    if (!stat.isFile()) continue;
    if (rows.length >= maxFiles) throw new RecoveryMissionGatherCapExceededError(maxFiles);
    rows.push({
      root: rootReal,
      relative_path: relative(rootReal, abs).split(sep).join("/"),
      extension: extname(entry.name).toLowerCase(),
      size_bytes: stat.size,
      mtime_iso: Number.isFinite(stat.mtimeMs) ? new Date(stat.mtimeMs).toISOString() : null,
    });
  }
}
