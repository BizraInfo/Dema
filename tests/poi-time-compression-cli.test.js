import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { verifyPoiTimeCompression } from "../packages/core/src/poi-time-compression.js";

const execFileAsync = promisify(execFile);
const CLI = fileURLToPath(new URL("../bin/dema", import.meta.url));
const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url));

const CONSENT = "GO: poi time compression preview";

const RECORD_FLAGS = [
  "--task", "cli-fixture-slice",
  "--task-name", "CLI fixture slice",
  "--baseline-hours", "240",
  "--baseline-source", "model_estimate",
  "--reference-class", "human_only_team",
  "--actual-hours", "5",
  "--operating-mode", "ai_agent_proof_loop",
  "--gates-required", "npm_test,npm_run_check",
  "--gates-passed", "npm_test,npm_run_check",
  "--observation-required", "true",
];

async function makeEnv() {
  const home = await mkdtemp(join(tmpdir(), "dema-poi-home-"));
  return { env: { ...process.env, DEMA_HOME: home }, home };
}

async function runPoi(args, env) {
  return execFileAsync(process.execPath, [CLI, "poi", "compression", ...args], {
    cwd: REPO_ROOT,
    env,
    maxBuffer: 4 * 1024 * 1024,
  });
}

test("record --json emits the 48x candidate payload without writing a receipt", async () => {
  const { env, home } = await makeEnv();
  const { stdout } = await runPoi(["record", ...RECORD_FLAGS, "--json"], env);
  const payload = JSON.parse(stdout);
  assert.equal(payload.schema, "bizra.dema.poi_time_compression.v0.1");
  assert.equal(payload.compression.ratio, 48);
  assert.equal(payload.no_mint, true);
  assert.equal(payload.receipt_path, null);
  await assert.rejects(readdir(join(home, "poi", "compression", "receipts")));
});

test("record --receipt refuses without the exact consent phrase", async () => {
  const { env } = await makeEnv();
  await assert.rejects(
    runPoi(["record", ...RECORD_FLAGS, "--receipt", "--consent", "yes please"], env),
    (error) => {
      assert.match(error.stderr, /exact consent phrase/);
      return true;
    },
  );
});

test("record --receipt with exact consent writes a byte-exact verifiable receipt; verify passes", async () => {
  const { env, home } = await makeEnv();
  const { stdout } = await runPoi(
    ["record", ...RECORD_FLAGS, "--receipt", "--consent", CONSENT, "--json"],
    env,
  );
  const payload = JSON.parse(stdout);
  assert.ok(payload.receipt_path.includes(join("poi", "compression", "receipts")));

  const names = await readdir(join(home, "poi", "compression", "receipts"));
  assert.equal(names.length, 1);
  assert.match(names[0], /^poi-compression-\d{4}-\d{2}-\d{2}-[0-9a-f]{8}\.json$/);

  // File content must be the byte-exact hashed payload — no injected fields.
  const stored = JSON.parse(await readFile(payload.receipt_path, "utf8"));
  assert.equal(verifyPoiTimeCompression(stored).ok, true);
  assert.equal(stored.receipt_path, undefined);

  const { stdout: verifyOut } = await runPoi(["verify", "--json"], env);
  const verdict = JSON.parse(verifyOut);
  assert.equal(verdict.ok, true);
  assert.equal(verdict.receipt_count, 1);

  const { stdout: showOut } = await runPoi(["show"], env);
  assert.match(showOut, /48x/);
});

test("record refuses when a required quality gate did not pass", async () => {
  const { env } = await makeEnv();
  const flags = [...RECORD_FLAGS];
  flags[flags.lastIndexOf("npm_test,npm_run_check")] = "npm_test"; // passed list loses npm_run_check
  await assert.rejects(runPoi(["record", ...flags, "--json"], env), (error) => {
    const payload = JSON.parse(error.stdout);
    assert.equal(payload.ok, false);
    assert.ok(payload.blocked_by.includes("quality_gate_failed:npm_run_check"));
    return true;
  });
});

test("verify fails closed on an empty receipt store", async () => {
  const { env } = await makeEnv();
  await assert.rejects(runPoi(["verify", "--json"], env), (error) => {
    const verdict = JSON.parse(error.stdout);
    assert.equal(verdict.ok, false);
    assert.equal(verdict.receipt_count, 0);
    return true;
  });
});
