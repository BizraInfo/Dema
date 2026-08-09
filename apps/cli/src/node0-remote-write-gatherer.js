// NODE0-REMOTE-WRITE-GUARD-1A — read-only gatherer.
//
// Walks this node's own source and hands the kernel already-read file contents.
// Reads only; opens no socket, spawns no child process, and touches nothing
// outside the repository roots it is given.
//
// Dependency directories are excluded deliberately. A listener inside
// `node_modules` belongs to a dependency's own dev server and is not a
// capability THIS node exposes — counting it would produce a permanent false
// VIOLATED and train the next reader to ignore the guard.

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const EXCLUDED_DIRS = new Set([
  "node_modules",
  ".next",
  "dist",
  "build",
  ".git",
  "coverage",
]);

const SOURCE_EXTENSIONS = /\.(js|mjs|cjs)$/;

export const DEFAULT_SOURCE_ROOTS = Object.freeze([
  "apps",
  "packages",
  "bin",
  "scripts",
]);

async function walk(dir, out) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out; // an unreadable directory yields nothing rather than throwing
  }
  for (const entry of entries) {
    if (EXCLUDED_DIRS.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(path, out);
    else if (SOURCE_EXTENSIONS.test(entry.name)) out.push(path);
  }
  return out;
}

/**
 * @param {{repoRoot?: string, roots?: string[]}} options
 * @returns {Promise<{files: Array<{path: string, source: string|null}>}>}
 */
export async function gatherRemoteWriteEvidence({
  repoRoot = process.cwd(),
  roots = DEFAULT_SOURCE_ROOTS,
} = {}) {
  const paths = [];
  for (const root of roots) await walk(join(repoRoot, root), paths);
  const files = await Promise.all(
    paths.map(async (path) => ({
      path,
      // null on failure: the kernel reports an unreadable file as a finding
      // rather than treating it as clean.
      source: await readFile(path, "utf8").catch(() => null),
    })),
  );
  return Object.freeze({ files: Object.freeze(files) });
}
