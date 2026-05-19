// Master Craftsmanship Audit CLI integration tests
//
// Tests the `dema master-craftsmanship audit` surface via subprocess execution.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(new URL("../apps/cli/src/index.js", import.meta.url));
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Runs the CLI and returns { stdout, stderr, exitCode }. Never throws on non-zero exit.
async function runCLI(args, env = {}) {
  try {
    const { stdout, stderr } = await execFileAsync("node", [cliPath, ...args], {
      cwd: REPO_ROOT,
      env: { ...process.env, NODE_ENV: "test", ...env },
    });
    return { stdout, stderr, exitCode: 0 };
  } catch (err) {
    return {
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? "",
      exitCode: err.code ?? 1,
    };
  }
}

// ─── CLI-01: default subject → COMPLIANT 10/10 in stdout ─────────────────────

test("CLI-01: dema master-craftsmanship audit (no args) → COMPLIANT (10/10 in stdout", async () => {
  const { stdout, exitCode } = await runCLI(["master-craftsmanship", "audit"]);
  assert.ok(
    stdout.includes("COMPLIANT (10/10"),
    `Expected "COMPLIANT (10/10" in stdout, got:\n${stdout}`
  );
  assert.equal(exitCode, 0, "exit code must be 0 for compliant result");
});

// ─── CLI-02: --json flag → JSON.parse succeeds · schema matches ───────────────

test("CLI-02: dema master-craftsmanship audit --json → valid JSON with correct schema", async () => {
  const { stdout, exitCode } = await runCLI(["master-craftsmanship", "audit", "--json"]);
  let parsed;
  assert.doesNotThrow(() => {
    parsed = JSON.parse(stdout);
  }, `stdout must be valid JSON, got:\n${stdout}`);
  assert.equal(parsed.schema, "bizra.dema.master_craftsmanship_audit.v0.1");
  assert.equal(parsed.overall_compliant, true);
  assert.equal(exitCode, 0);
});

// ─── CLI-03: explicit path to craftsmanship-witness module → COMPLIANT ────────

test("CLI-03: dema master-craftsmanship audit packages/core/src/craftsmanship-witness-preview.js → COMPLIANT", async () => {
  const { stdout, exitCode } = await runCLI([
    "master-craftsmanship",
    "audit",
    "packages/core/src/craftsmanship-witness-preview.js",
  ]);
  assert.ok(
    stdout.includes("COMPLIANT (10/10"),
    `Expected "COMPLIANT (10/10" in stdout, got:\n${stdout}`
  );
  assert.equal(exitCode, 0);
});

// ─── CLI-04: nonexistent path → graceful error in stdout, exit 1 ─────────────

test("CLI-04: dema master-craftsmanship audit nonexistent.js → graceful error, exit 1", async () => {
  const { stdout, exitCode } = await runCLI([
    "master-craftsmanship",
    "audit",
    "nonexistent-file-does-not-exist.js",
  ]);
  // Must not crash; output must indicate failure
  assert.ok(
    stdout.includes("NON-COMPLIANT") ||
    stdout.includes("read_fail") ||
    stdout.includes("PARTIAL"),
    `Expected failure indication in stdout, got:\n${stdout}`
  );
  assert.equal(exitCode, 1, "exit code must be 1 for non-compliant result");
});
