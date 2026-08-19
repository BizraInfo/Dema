#!/usr/bin/env node
//
// baseline-l1 — L1 engineering-performance snapshot for Dema.
//
// Emits a schema-tagged JSON snapshot of measurable-now metrics. Each
// snapshot binds to a specific commit SHA so future runs are comparable.
// L1 covers what `Key Maker Epistemic Conduct v0.1` §6 calls
// certainty-grade engineering claims: LOC, test file count, test
// pass/fail, schema count, CLI command count, gate states.
//
// L2+ (reasoning-shape · reviewer experience · operator impact) is NOT
// in scope for this script — see key-maker-epistemic-conduct-v0.1.md §10.
//
// Read-only · no chain advance · no receipt mint · no model invocation.
//
// Usage:
//   npm run baseline:l1                    → emits JSON to stdout
//   npm run baseline:l1 -- --save          → also writes to docs/baselines/
//   npm run baseline:l1 -- --include-tests → runs npm test and records counts

import { execFileSync } from "node:child_process";
import {
  readdirSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";

import { PREVIEW_BOUNDARY_CANONICAL_KEYS } from "../packages/core/src/preview-boundary.js";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const argv = process.argv.slice(2);
const shouldSave = argv.includes("--save");
const shouldRunTests = argv.includes("--include-tests");

function git(args) {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

function countLinesIn(dir, exts) {
  let total = 0;
  let files = 0;
  function walk(d) {
    let entries;
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const p = join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (exts.some((e) => entry.name.endsWith(e))) {
        try {
          total += readFileSync(p, "utf8").split("\n").length;
          files += 1;
        } catch {
          /* unreadable file · skip */
        }
      }
    }
  }
  walk(dir);
  return { lines: total, files };
}

function countSchemaDeclarations() {
  const seen = new Set();
  const pattern = /["`]bizra\.dema\.[a-z0-9._]+["`]/g;
  function walk(d) {
    let entries;
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const p = join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name.endsWith(".js") || entry.name.endsWith(".mjs")) {
        try {
          const matches = readFileSync(p, "utf8").matchAll(pattern);
          for (const m of matches) {
            seen.add(m[0].slice(1, -1));
          }
        } catch {
          /* skip */
        }
      }
    }
  }
  walk(join(root, "packages"));
  return { unique: seen.size, names: [...seen].sort() };
}

function countCliCommandsInHelp() {
  try {
    const src = readFileSync(join(root, "apps/cli/src/index.js"), "utf8");
    const helpMatch = src.match(/const HELP\s*=\s*`([\s\S]*?)`/);
    if (!helpMatch) return null;
    const lines = helpMatch[1]
      .split("\n")
      .filter((l) => /^\s+dema\s+\S/.test(l));
    return lines.length;
  } catch {
    return null;
  }
}

// Parse the TAP summary out of whatever we captured. Separated from the spawn
// so a FAILING suite and an UNMEASURABLE one cannot be reported the same way:
// a suite that ran and failed is a measurement, and only a suite we could not
// read at all is incomplete.
function parseTap(out) {
  if (typeof out !== "string" || out === "") return null;
  const m = (re) => (out.match(re) || [])[1];
  const total = m(/# tests (\d+)/);
  if (total === undefined) return null;
  return {
    pass: parseInt(m(/# pass (\d+)/) ?? "0", 10),
    fail: parseInt(m(/# fail (\d+)/) ?? "0", 10),
    total: parseInt(total, 10),
    completed: true,
  };
}

function runTestSuite() {
  // maxBuffer is explicit: the default 1 MB was silently exceeded once the suite
  // passed ~9k tests, so the instrument broke on exactly the growth it exists to
  // measure and reported ENOBUFS instead of a count.
  const opts = {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    maxBuffer: 256 * 1024 * 1024,
  };
  try {
    return parseTap(execFileSync("npm", ["test", "--silent"], opts))
      ?? { pass: 0, fail: 0, total: 0, completed: false, error: "tap_summary_unparseable" };
  } catch (err) {
    // A non-zero exit means the suite RAN and something failed. Its output is
    // still on the error, and a real count is a measurement — not an absence.
    const parsed = parseTap(err && typeof err.stdout === "string" ? err.stdout : "");
    if (parsed) return { ...parsed, completed: true, exit_nonzero: true };
    return {
      pass: 0, fail: 0, total: 0, completed: false,
      error: String(err).slice(0, 200),
    };
  }
}

const packagesLoc = countLinesIn(join(root, "packages"), [".js", ".mjs"]);
const testsLoc = countLinesIn(join(root, "tests"), [".js", ".mjs"]);
const scriptsLoc = countLinesIn(join(root, "scripts"), [".js", ".mjs"]);
const appsLoc = countLinesIn(join(root, "apps"), [".js", ".mjs"]);
const schemas = countSchemaDeclarations();
const cliCommands = countCliCommandsInHelp();

const baseline = Object.freeze({
  schema: "bizra.dema.baseline_l1.v0.1",
  truth_label: "NODE0_LOCAL_SEED",
  mode: "snapshot",
  measured_at: new Date().toISOString(),
  git: {
    commit_sha: git(["rev-parse", "HEAD"]),
    short_sha: git(["rev-parse", "--short", "HEAD"]),
    branch: git(["rev-parse", "--abbrev-ref", "HEAD"]),
    working_tree_clean: git(["status", "--porcelain"]) === "",
  },
  source_state: {
    packages_loc: packagesLoc.lines,
    packages_files: packagesLoc.files,
    tests_loc: testsLoc.lines,
    tests_files: testsLoc.files,
    scripts_loc: scriptsLoc.lines,
    scripts_files: scriptsLoc.files,
    apps_loc: appsLoc.lines,
    apps_files: appsLoc.files,
    schemas_declared_unique: schemas.unique,
    cli_commands_in_help: cliCommands,
  },
  test_state: shouldRunTests
    ? runTestSuite()
    : {
        completed: false,
        skipped: true,
        hint: "rerun with --include-tests to populate",
      },
  boundary: Object.fromEntries(
    PREVIEW_BOUNDARY_CANONICAL_KEYS.map((k) => [k, false]),
  ),
  notes: [
    "L1 only · engineering metrics measurable from source state alone.",
    "L2 (reasoning-shape) requires fixture+scorer; see key-maker-epistemic-conduct-v0.1.md §12.",
    "L3 (reviewer experience) requires Ring-1 form data.",
    "L4 (operator-life impact) is unmeasurable at Ring-0 per claim discipline.",
    "Use --save to write to docs/baselines/dema-baseline-l1-<short_sha>.json",
  ],
});

const json = JSON.stringify(baseline, null, 2);
console.log(json);

if (shouldSave) {
  const outDir = join(root, "docs", "baselines");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const filename = `dema-baseline-l1-${baseline.git.short_sha || "unknown"}.json`;
  const outPath = join(outDir, filename);
  writeFileSync(outPath, json + "\n");
  process.stderr.write(`saved: ${outPath}\n`);
}
