// Integration tests for human-first output defaults (Task #7).
//
// Each flipped surface has two tests:
//   1. bare command  → human output (no leading '{', contains title)
//   2. --json flag   → valid JSON
//
// Surfaces covered: state · profiles · today · models scan · mission propose

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(new URL("../apps/cli/src/index.js", import.meta.url));

// --- dema state ---

test("dema state (no flag) emits human output, not JSON", async () => {
  const { stdout } = await execFileAsync("node", [cliPath, "state"]);
  assert.ok(!stdout.trimStart().startsWith("{"), "output must not start with {");
  assert.match(stdout, /Dema state/);
  assert.match(stdout, /dema state --json/);
});

test("dema state --json emits valid JSON with canonical schema", async () => {
  const { stdout } = await execFileAsync("node", [cliPath, "state", "--json"]);
  const data = JSON.parse(stdout);
  assert.equal(data.schema, "bizra.dema.node0_state.v0.1");
  assert.equal(data.executes, undefined);
  assert.equal(data.runtime.autonomous_daemon, false);
});

// --- dema profiles ---

test("dema profiles (no flag) emits human output, not JSON", async () => {
  const { stdout } = await execFileAsync("node", [cliPath, "profiles"]);
  assert.ok(!stdout.trimStart().startsWith("{"), "output must not start with {");
  assert.match(stdout, /Dema profiles/);
  assert.match(stdout, /dema profiles --json/);
});

test("dema profiles --json emits valid JSON with canonical schema", async () => {
  const { stdout } = await execFileAsync("node", [cliPath, "profiles", "--json"]);
  const data = JSON.parse(stdout);
  assert.equal(data.schema, "bizra.dema.profile_foundation.v0.1");
  assert.equal(data.boundary.federation_invoked, false);
});

// --- dema today ---

test("dema today (no flag) emits human output, not JSON", async () => {
  const root = await mkdtemp(join(tmpdir(), "dema-today-human-"));
  const { stdout } = await execFileAsync("node", [cliPath, "today"], {
    env: { ...process.env, DEMA_HOME: root }
  });
  assert.ok(!stdout.trimStart().startsWith("{"), "output must not start with {");
  assert.match(stdout, /Dema today/);
  assert.match(stdout, /Continuity tick recorded/);
  assert.match(stdout, /dema today --json/);
});

test("dema today --json emits valid JSON with tick + memory", async () => {
  const root = await mkdtemp(join(tmpdir(), "dema-today-json-"));
  const { stdout } = await execFileAsync("node", [cliPath, "today", "--json"], {
    env: { ...process.env, DEMA_HOME: root }
  });
  const data = JSON.parse(stdout);
  assert.equal(data.tick.schema, "bizra.dema.today_tick.v0.1");
  assert.equal(data.tick.missionExecuted, false);
});

// --- dema models scan ---

test("dema models scan (no flag) emits human output, not JSON", async () => {
  const { stdout } = await execFileAsync("node", [cliPath, "models", "scan"]);
  assert.ok(!stdout.trimStart().startsWith("{"), "output must not start with {");
  assert.match(stdout, /Dema models scan/);
  assert.match(stdout, /dema models scan --json/);
});

test("dema models scan --json emits valid JSON with canonical schema", async () => {
  const { stdout } = await execFileAsync("node", [cliPath, "models", "scan", "--json"]);
  const data = JSON.parse(stdout);
  assert.ok(data.schema.startsWith("bizra.dema.local_model_inventory"), `got: ${data.schema}`);
  assert.equal(data.boundary.model_invocation_performed, false);
});

// --- dema mission propose ---

test("dema mission propose (no flag) emits human output, not JSON", async () => {
  const root = await mkdtemp(join(tmpdir(), "dema-propose-human-"));
  const { stdout } = await execFileAsync("node", [cliPath, "mission", "propose"], {
    env: { ...process.env, DEMA_HOME: root }
  });
  assert.ok(!stdout.trimStart().startsWith("{"), "output must not start with {");
  assert.match(stdout, /Dema mission propose/);
  assert.match(stdout, /dema mission propose --json/);
});

test("dema mission propose --json emits valid JSON with executes=false", async () => {
  const root = await mkdtemp(join(tmpdir(), "dema-propose-json-"));
  const { stdout } = await execFileAsync("node", [cliPath, "mission", "propose", "--json"], {
    env: { ...process.env, DEMA_HOME: root }
  });
  const data = JSON.parse(stdout);
  assert.equal(data.executes, false);
  assert.equal(data.action, "bounded_diagnostic_activation");
});
