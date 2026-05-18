#!/usr/bin/env node
//
// baseline-l1-diff — compute numerical delta between two L1 baselines.
//
// Reads two `bizra.dema.baseline_l1.v0.1` snapshots and emits a
// schema-tagged delta JSON. Answers the question the baseline tooling
// was built for: "did this commit (or sequence) help?"
//
// The delta includes per-metric numerical change, a "verify-before-assert"
// score (tests-LOC growth vs packages-LOC growth ratio), and a verdict
// that names asymmetry honestly without prescribing action.
//
// Read-only · no chain advance · no receipt mint · no model invocation.
// Deterministic given the two input baselines.
//
// Usage:
//   npm run baseline:l1:diff -- <before-sha> <after-sha>
//   npm run baseline:l1:diff -- d60767a e436b7c
//   (auto-resolves to docs/baselines/dema-baseline-l1-<sha>.json)
//
//   npm run baseline:l1:diff -- --files <before.json> <after.json>

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, join } from "node:path";

import { PREVIEW_BOUNDARY_CANONICAL_KEYS } from "../packages/core/src/preview-boundary.js";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const argv = process.argv.slice(2);

function resolveBaselinePath(arg) {
  if (existsSync(arg)) return arg;
  const inBaselineDir = join(root, "docs", "baselines", `dema-baseline-l1-${arg}.json`);
  if (existsSync(inBaselineDir)) return inBaselineDir;
  throw new Error(`baseline not found: ${arg} (tried direct path and docs/baselines/dema-baseline-l1-${arg}.json)`);
}

function parseArgs() {
  if (argv.includes("--help") || argv.length < 2) {
    process.stderr.write("usage: baseline-l1-diff [--files] <before> <after>\n");
    process.exit(2);
  }
  const useFiles = argv[0] === "--files";
  const pair = useFiles ? argv.slice(1, 3) : argv.slice(0, 2);
  if (pair.length !== 2) {
    process.stderr.write("error: need exactly 2 baselines\n");
    process.exit(2);
  }
  return { before: resolveBaselinePath(pair[0]), after: resolveBaselinePath(pair[1]) };
}

function loadBaseline(path) {
  const data = JSON.parse(readFileSync(path, "utf8"));
  if (data.schema !== "bizra.dema.baseline_l1.v0.1") {
    throw new Error(`${path}: not a baseline_l1.v0.1 (got schema='${data.schema}')`);
  }
  return data;
}

function deltaInt(beforeVal, afterVal) {
  const b = typeof beforeVal === "number" ? beforeVal : 0;
  const a = typeof afterVal === "number" ? afterVal : 0;
  return { before: b, after: a, delta: a - b };
}

function pctGrowth(beforeVal, afterVal) {
  if (typeof beforeVal !== "number" || typeof afterVal !== "number" || beforeVal === 0) return null;
  return Math.round(((afterVal - beforeVal) / beforeVal) * 1000) / 10;
}

function computeAsymmetryScore(beforeSrc, afterSrc) {
  // The "verify-before-asserting" trend: tests should grow at least as fast
  // as packages. Higher ratio = more discipline per LOC of code shipped.
  const testsGrowth = pctGrowth(beforeSrc.tests_loc, afterSrc.tests_loc);
  const packagesGrowth = pctGrowth(beforeSrc.packages_loc, afterSrc.packages_loc);
  if (testsGrowth === null || packagesGrowth === null) return null;
  if (packagesGrowth === 0) return testsGrowth > 0 ? "tests_only" : "no_change";
  if (packagesGrowth < 0) return "shrinking_packages";
  const ratio = testsGrowth / packagesGrowth;
  if (ratio >= 1) return "tests_keep_up_or_outpace_packages";
  if (ratio >= 0.5) return "tests_lag_packages_within_acceptable_range";
  return "tests_lag_packages_significantly";
}

const { before: beforePath, after: afterPath } = parseArgs();
const before = loadBaseline(beforePath);
const after = loadBaseline(afterPath);

const delta = Object.freeze({
  schema: "bizra.dema.baseline_l1_diff.v0.1",
  truth_label: "NODE0_LOCAL_SEED",
  mode: "snapshot_diff",
  computed_at: new Date().toISOString(),
  pair: Object.freeze({
    before: Object.freeze({
      sha: before.git?.short_sha ?? null,
      branch: before.git?.branch ?? null,
      measured_at: before.measured_at ?? null
    }),
    after: Object.freeze({
      sha: after.git?.short_sha ?? null,
      branch: after.git?.branch ?? null,
      measured_at: after.measured_at ?? null
    })
  }),
  source_state_delta: Object.freeze({
    packages_loc: deltaInt(before.source_state?.packages_loc, after.source_state?.packages_loc),
    packages_files: deltaInt(before.source_state?.packages_files, after.source_state?.packages_files),
    tests_loc: deltaInt(before.source_state?.tests_loc, after.source_state?.tests_loc),
    tests_files: deltaInt(before.source_state?.tests_files, after.source_state?.tests_files),
    scripts_loc: deltaInt(before.source_state?.scripts_loc, after.source_state?.scripts_loc),
    scripts_files: deltaInt(before.source_state?.scripts_files, after.source_state?.scripts_files),
    apps_loc: deltaInt(before.source_state?.apps_loc, after.source_state?.apps_loc),
    schemas_declared_unique: deltaInt(before.source_state?.schemas_declared_unique, after.source_state?.schemas_declared_unique),
    cli_commands_in_help: deltaInt(before.source_state?.cli_commands_in_help, after.source_state?.cli_commands_in_help)
  }),
  test_state_delta: Object.freeze({
    pass: deltaInt(before.test_state?.pass, after.test_state?.pass),
    fail: deltaInt(before.test_state?.fail, after.test_state?.fail),
    total: deltaInt(before.test_state?.total, after.test_state?.total)
  }),
  growth_percent: Object.freeze({
    packages_loc: pctGrowth(before.source_state?.packages_loc, after.source_state?.packages_loc),
    tests_loc: pctGrowth(before.source_state?.tests_loc, after.source_state?.tests_loc),
    tests_pass: pctGrowth(before.test_state?.pass, after.test_state?.pass)
  }),
  verify_before_assert_trend: computeAsymmetryScore(before.source_state ?? {}, after.source_state ?? {}),
  boundary: Object.freeze(Object.fromEntries(PREVIEW_BOUNDARY_CANONICAL_KEYS.map((k) => [k, false]))),
  notes: Object.freeze([
    "Diff is observational not prescriptive · operator decides what the trend means.",
    "verify_before_assert_trend names the test-growth vs packages-growth ratio honestly.",
    "Schema mismatch (missing field) yields delta=0 against treated-as-zero · investigate if unexpected."
  ])
});

console.log(JSON.stringify(delta, null, 2));
