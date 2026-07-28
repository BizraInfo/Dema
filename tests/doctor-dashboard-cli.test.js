// Integration tests for `dema doctor` dashboard (Task #8).
//
// All tests run against a clean DEMA_HOME (no adapter, no gateway).
// This matches the default-fail scenario that most new users encounter.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(
  new URL("../apps/cli/src/index.js", import.meta.url),
);

async function freshEnv() {
  const root = await mkdtemp(join(tmpdir(), "dema-doctor-cli-"));
  const env = { ...process.env, DEMA_HOME: root };
  delete env.DEMA_NODE0_ADAPTER;
  delete env.DEMA_NODE0_STATUS_COMMAND;
  return env;
}

test("dema doctor (no flags) → stdout contains header and Verdict", async () => {
  const env = await freshEnv();
  const result = await execFileAsync("node", [cliPath, "doctor"], {
    env,
  }).catch((e) => e);
  assert.match(result.stdout, /Dema Doctor —/);
  assert.match(result.stdout, /Verdict:/);
});

test("dema doctor --json → JSON.parse succeeds, schema field present", async () => {
  const env = await freshEnv();
  const result = await execFileAsync("node", [cliPath, "doctor", "--json"], {
    env,
  }).catch((e) => e);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.schema, "bizra.dema.doctor_dashboard.v0.1");
  assert.ok(Array.isArray(parsed.predicates));
  assert.ok(typeof parsed.verdict === "string");
});

// TASK-036 defect 2, end to end: point the gateway adapter at a port with
// nothing listening. The adapter payload is honest here (truth_label DEGRADED,
// gateway.reachable false, four "unreachable" findings), so doctor must not
// contradict it by printing a green reachable probe.
test("dema doctor → a dead gateway is not reported as reachable", async () => {
  const env = await freshEnv();
  env.DEMA_NODE0_ADAPTER = "gateway-http";
  env.DEMA_GATEWAY_URL = "http://127.0.0.1:9"; // discard port; nothing listens
  const result = await execFileAsync(
    "node",
    [cliPath, "doctor", "--no-color"],
    { env },
  ).catch((e) => e);
  const probeLine = result.stdout
    .split("\n")
    .find((l) => l.includes("Gateway probe"));
  assert.ok(probeLine, "Gateway probe line expected in doctor output");
  // \b does not break between "un" and "reachable", so this matches the bare
  // claim only — "unreachable" and "not probed" both pass.
  assert.doesNotMatch(
    probeLine,
    /\breachable\b/,
    `dead gateway reported as reachable: ${probeLine}`,
  );
});

test("dema doctor --no-color → stdout contains no ANSI escape codes", async () => {
  const env = await freshEnv();
  const result = await execFileAsync(
    "node",
    [cliPath, "doctor", "--no-color"],
    { env },
  ).catch((e) => e);
  assert.ok(
    !result.stdout.includes("\x1b["),
    "ANSI codes must be absent with --no-color",
  );
});
