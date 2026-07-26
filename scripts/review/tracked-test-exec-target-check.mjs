#!/usr/bin/env node
/**
 * TRACKED-TEST-EXEC-TARGET-GUARD-1A — read-only.
 *
 * Fails when a tracked test resolves a repository-local file with
 * `new URL("../x", import.meta.url)` and that file is not tracked by git.
 *
 * Why this exists: `npm test` discovers `tests/*.test.js` from the filesystem
 * and those tests shell out to repository scripts by resolved path. A target
 * that exists in the working tree but was never committed makes the suite pass
 * dirty and fail from a clean checkout. Measured instance:
 * tests/node0-library-safe-plan.test.js ->
 * scripts/review/node0-library-safe-plan-replay.mjs — six failures in a
 * detached checkout of 5a6b3cd, repaired by c51467e.
 *
 * Deliberately narrow. It covers the ONE observed failure shape: a static
 * `new URL(<string literal>, import.meta.url)` naming a repo-local file. It
 * does NOT trace the filesystem, resolve computed paths, or follow a target
 * through variable assignment — a second shape earns a second rule, measured
 * first. Module `import` is already covered by the loader.
 *
 *   node scripts/review/tracked-test-exec-target-check.mjs [--json]
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize } from "node:path";

export const SCHEMA = "bizra.dema.review.tracked_test_exec_target.v0.1";

const URL_LITERAL = /new URL\(\s*"([^"]+)"\s*,\s*import\.meta\.url\s*\)/g;

/**
 * Comments are prose, not edges. A doc block or a commented-out line naming a
 * path must not fail the gate — this guard's own header describes the defect
 * using the very pattern it scans for, and flagged itself until this existed.
 * `//` is only treated as a comment at line start or after whitespace, so the
 * `//` inside a "https://…" literal survives.
 */
export function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
}

/**
 * Pure. `tests` is [{path, source}], `tracked` a Set of repo-relative paths,
 * `probe` a repo-relative path -> "file" | "dir" | "absent".
 */
export function scanExecTargets({ tests, tracked, probe }) {
  let file_edges = 0;
  let tracked_targets = 0;
  let directory_targets = 0;
  let external_targets = 0;
  const untracked_targets = [];
  const missing_targets = [];

  for (const { path, source } of tests) {
    for (const [, spec] of stripComments(source).matchAll(URL_LITERAL)) {
      if (!spec.startsWith(".")) continue;
      const target = normalize(join(dirname(path), spec));
      if (target === "." || target === "") continue;
      if (target.startsWith("..")) {
        external_targets += 1;
        continue;
      }
      const kind = probe(target);
      if (kind === "dir") {
        directory_targets += 1;
        continue;
      }
      file_edges += 1;
      if (tracked.has(target)) tracked_targets += 1;
      else if (kind === "file") untracked_targets.push({ test: path, target });
      else missing_targets.push({ test: path, target });
    }
  }

  return {
    schema: SCHEMA,
    ok: untracked_targets.length === 0 && missing_targets.length === 0,
    tracked_test_files: tests.length,
    file_edges,
    tracked_targets,
    directory_targets,
    external_targets,
    untracked_targets,
    missing_targets,
    boundary: {
      read_only_audit: true,
      runtime_execution_performed: false,
      mutation_performed: false,
      network_performed: false,
      staging_performed: false,
    },
  };
}

function gitList(pattern) {
  const args = pattern ? ["ls-files", pattern] : ["ls-files"];
  return execFileSync("git", args, { encoding: "utf8" }).split("\n").filter(Boolean);
}

function main() {
  const tracked = new Set(gitList());
  const tests = gitList("tests/*.test.js").map((path) => ({
    path,
    source: readFileSync(path, "utf8"),
  }));
  const probe = (rel) => {
    if (!existsSync(rel)) return "absent";
    return statSync(rel).isDirectory() ? "dir" : "file";
  };

  const report = scanExecTargets({ tests, tracked, probe });

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`${SCHEMA}`);
    console.log(`  result: ${report.ok ? "PASS" : "FAIL"}`);
    console.log(
      `  ${report.tracked_test_files} tracked tests · ${report.file_edges} repo-local file targets · ` +
        `${report.tracked_targets} tracked · ${report.directory_targets} directory · ${report.external_targets} external`,
    );
    for (const { test, target } of report.untracked_targets) {
      console.log(`  UNTRACKED  ${test} -> ${target} (present on disk, never committed)`);
    }
    for (const { test, target } of report.missing_targets) {
      console.log(`  MISSING    ${test} -> ${target}`);
    }
    console.log("  Boundary: read-only audit · no runtime · no network · no staging.");
  }

  process.exit(report.ok ? 0 : 1);
}

if (process.argv[1] && process.argv[1].endsWith("tracked-test-exec-target-check.mjs")) main();
