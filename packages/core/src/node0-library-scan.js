/**
 * مكتبة نود0 · NODE0-LIBRARY-CENSUS-1A — read-only gatherer.
 *
 * Walks declared roots and hands metadata rows to the pure census kernel.
 * Reads no content, follows no symlinks, moves nothing, touches no network.
 *
 * Unlike the first-encounter scanner this does NOT hash: hashing 756k files
 * costs hours and a census only needs to know what exists, not to prove it.
 * `file_hash` is therefore the fixed sentinel below — the metadata contract
 * still holds, and nothing downstream can mistake a census row for a sealed one.
 */

import { readdirSync, lstatSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

import { buildCensus } from "./node0-library-census.js";

/** 64 zeroes — structurally a hash, semantically "not hashed in this pass". */
export const CENSUS_UNHASHED = "0".repeat(64);

const SKIP_DIRS = new Set([
  "node_modules", ".git", ".next", "__pycache__", ".venv", "venv",
  "site-packages", ".gradle", "target", "dist", "build", ".npm", ".pnpm-store", ".cache",
]);

/**
 * @param roots absolute paths
 * @param measuredAt ISO string — injected, never read from a clock here, so a
 *                   census is reproducible and the caller owns the stamp.
 */
export function scanLibrary(roots, measuredAt, { onProgress } = {}) {
  if (!Array.isArray(roots) || roots.length === 0) throw new Error("ROOTS_REQUIRED");
  const records = [];
  const skipped = { machine_dirs: 0, symlinks: 0, unreadable: 0, not_regular: 0 };
  const byRoot = {};

  for (const rootArg of roots) {
    const root = resolve(rootArg);
    byRoot[root] = { files: 0, bytes: 0 };
    walk(root, root);
  }

  function walk(dir, root) {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      skipped.unreadable += 1;
      return;
    }
    for (const entry of entries) {
      const abs = join(dir, entry.name);
      if (entry.isSymbolicLink()) { skipped.symlinks += 1; continue; }
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) { skipped.machine_dirs += 1; continue; }
        walk(abs, root);
        continue;
      }
      if (!entry.isFile()) { skipped.not_regular += 1; continue; }
      let st;
      try { st = lstatSync(abs); } catch { skipped.unreadable += 1; continue; }

      records.push({
        relative_path: `${root}/${relative(root, abs)}`,
        extension: extname(entry.name),
        size: st.size,
        modified_time: new Date(st.mtimeMs).toISOString(),
        file_hash: CENSUS_UNHASHED,
      });
      byRoot[root].files += 1;
      byRoot[root].bytes += st.size;
      if (onProgress && records.length % 100000 === 0) onProgress(records.length);
    }
  }

  const census = buildCensus(records, { roots: roots.map((r) => resolve(r)), measured_at: measuredAt });
  // `records` rides along for callers that need per-file rows (dedupe). It is
  // deliberately not part of the census contract — the census is a summary, and
  // a summary that silently carried 756,000 rows would be a different artifact.
  return { ...census, by_root: byRoot, skipped, records };
}
