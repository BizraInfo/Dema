// NODE0-SOURCE-LISTENER-SCAN-1A — read-only gatherer.
//
// Walks this node's own source and hands the kernel already-read file contents.
// Reads only; opens no socket, spawns no child process, and touches nothing
// outside the repository roots it is given.
//
// Dependency directories are excluded deliberately. Their implementation may
// contain listener code without proving that this product ships or invokes it;
// shipped entrypoints remain observable through package manifests and owned
// source. Scanning dependency internals would turn this bounded source-surface
// inventory into a noisy dependency census.

import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const EXCLUDED_DIRS = new Set([
  "node_modules",
  ".next",
  "dist",
  "build",
  ".git",
  "coverage",
]);

// Runtime declarations are not confined to JavaScript implementation files.
// Next listeners live in package scripts and App Router handlers live in
// TypeScript; omitting either produced a clean-looking but incomplete scan.
const SOURCE_EXTENSIONS = /(?:package\.json|\.(?:js|mjs|cjs|ts|tsx))$/;

export const DEFAULT_SOURCE_ROOTS = Object.freeze([
  "apps",
  "packages",
  "bin",
  "scripts",
]);

async function walk(dir, out, coverageIssues, repoRoot) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    coverageIssues.push(
      Object.freeze({ id: "unreadable_directory", path: dir }),
    );
    return out;
  }
  for (const entry of entries) {
    if (EXCLUDED_DIRS.has(entry.name)) continue;
    const absPath = resolve(join(dir, entry.name));
    if (!absPath.startsWith(repoRoot + "/") && absPath !== repoRoot) continue;
    if (entry.isDirectory()) await walk(absPath, out, coverageIssues, repoRoot);
    else if (SOURCE_EXTENSIONS.test(entry.name)) out.push(absPath);
  }
  return out;
}

/**
 * @param {{repoRoot?: string, roots?: string[]}} options
 * @returns {Promise<{
 *   files: Array<{path: string, source: string|null}>,
 *   coverage_issues: Array<{id: string, path: string}>
 * }>}
 */
export async function gatherRemoteWriteEvidence({
  repoRoot = process.cwd(),
  roots = DEFAULT_SOURCE_ROOTS,
} = {}) {
  const paths = [];
  const coverageIssues = [];
  const absRepoRoot = resolve(repoRoot);
  for (const root of roots) {
    await walk(join(absRepoRoot, root), paths, coverageIssues, absRepoRoot);
  }
  const files = await Promise.all(
    paths.map(async (path) => ({
      path,
      // null on failure: the kernel reports an explicit coverage issue rather
      // than treating the partial scan as clear.
      source: await readFile(path, "utf8").catch(() => null),
    })),
  );
  return Object.freeze({
    files: Object.freeze(files),
    coverage_issues: Object.freeze(coverageIssues),
  });
}
