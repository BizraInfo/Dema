import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import {
  buildBoundaryInvariantCheckReport,
  findBoundaryViolations,
} from "../scripts/review/boundary-invariant-check.mjs";

const execFileAsync = promisify(execFile);
const scriptPath = fileURLToPath(
  new URL("../scripts/review/boundary-invariant-check.mjs", import.meta.url),
);

test("boundary invariant check passes on current preview modules", () => {
  const report = buildBoundaryInvariantCheckReport();
  assert.equal(
    report.schema,
    "bizra.dema.review.boundary_invariant_check.v0.1",
  );
  assert.equal(report.mode, "READ_ONLY_AUDIT");
  assert.equal(report.ok, true);
  assert.ok(
    report.modules_scanned > 0,
    "must discover at least one preview module",
  );
  assert.equal(report.modules_violated, 0);
  assert.deepEqual(report.violations, []);
});

test("boundary invariant check is a read-only audit with all authority flags false", () => {
  const report = buildBoundaryInvariantCheckReport();
  assert.equal(report.boundary.read_only_audit, true);
  assert.equal(report.boundary.runtime_execution, false);
  assert.equal(report.boundary.mutation_performed, false);
  assert.equal(report.boundary.receipt_minted, false);
  assert.equal(report.boundary.filesystem_write_performed, false);
  assert.equal(report.boundary.ci_modified, false);
});

test("boundary invariant check CLI emits a schema-tagged report", async () => {
  const { stdout } = await execFileAsync("node", [scriptPath]);
  const report = JSON.parse(stdout);
  assert.equal(
    report.schema,
    "bizra.dema.review.boundary_invariant_check.v0.1",
  );
  assert.equal(report.ok, true);
  assert.equal(report.boundary.read_only_audit, true);
});

test("findBoundaryViolations flags an authority flag set to true", () => {
  const sample = `export const BAD = Object.freeze({
  runtime: true,
  mint: false
});`;
  const violations = findBoundaryViolations(sample, "(memory)");
  assert.equal(violations.length, 1);
  assert.equal(violations[0].key, "runtime");
  assert.equal(violations[0].file, "(memory)");
  assert.ok(violations[0].line >= 1);
});

test("findBoundaryViolations does not flag non-authority keys set to true", () => {
  const sample = `export const PLAN = Object.freeze({
  exact_lookup_only: true,
  revocation_precedes_allow: true,
  expires_at_required: true,
  requires_human_consent: true
});`;
  const violations = findBoundaryViolations(sample, "(memory)");
  assert.equal(violations.length, 0);
});

test("findBoundaryViolations skips lines that are pure // comments", () => {
  const sample = `// runtime: true is forbidden in BOUNDARY blocks.
const OK = Object.freeze({
  runtime: false,
  federation: false
});`;
  const violations = findBoundaryViolations(sample, "(memory)");
  assert.equal(
    violations.length,
    0,
    "comment-only lines must not produce violations",
  );
});

test("findBoundaryViolations clean source produces zero violations", () => {
  const sample = `export const BOUNDARY = Object.freeze({
  runtime: false,
  federation: false,
  mint: false,
  node_connection: false,
  economic_settlement: false,
  raw_data_exchange: false
});`;
  const violations = findBoundaryViolations(sample, "(memory)");
  assert.equal(violations.length, 0);
});

test("boundary invariant check scans every authority flag listed in the allowlist", () => {
  const report = buildBoundaryInvariantCheckReport();
  assert.ok(
    report.authority_flags_checked >= 30,
    "must check at least 30 authority flags",
  );
});

test("boundary invariant check module imports only Node built-ins (no fs/network/process spawn beyond audit primitives)", async () => {
  const { readFile } = await import("node:fs/promises");
  const body = await readFile(scriptPath, "utf8");
  assert.ok(!/from ['"]node:http/.test(body), "must not import node:http");
  assert.ok(!/from ['"]node:net/.test(body), "must not import node:net");
  assert.ok(
    !/from ['"]node:child_process/.test(body),
    "must not import node:child_process",
  );
  assert.ok(
    !/spawn\(|execSync\(|execFile\(|spawnSync\(/.test(body),
    "must not invoke processes from the script body",
  );
});
