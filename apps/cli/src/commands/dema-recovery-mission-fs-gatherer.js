// DEMA-RECOVERY-MISSION-GATHERER-1B — read-only metadata effect adapter.
//
// The ONLY fs surface for this slice. Walks ONE bounded root (bounded by the
// caller's --root) collecting ONLY fs.lstatSync/readdirSync METADATA
// (relative_path, extension, size_bytes, mtime_iso) — never reads file
// content, never mutates, never lists outside the declared root. A symlink is
// followed only if its real target stays inside the root; a target that
// escapes the root is skipped, never walked. Fail-closed on cap overrun: once
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
  walk(rootReal, rootReal, exclude, rows, maxFiles);
  return rows;
}

function walk(dir, rootReal, exclude, rows, maxFiles) {
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
      walk(walkTarget, rootReal, exclude, rows, maxFiles);
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
