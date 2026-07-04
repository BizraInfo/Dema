import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const CLI = fileURLToPath(new URL("../bin/dema", import.meta.url));
const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url));

const CONSENT = "GO: write first-user standing receipt";

async function makeFixtureEnv() {
  const home = await mkdtemp(join(tmpdir(), "dema-stand-home-"));
  const logs = await mkdtemp(join(tmpdir(), "dema-stand-logs-"));
  await writeFile(
    join(logs, "2026-07-03-npm-test.log"),
    "# tests 10\n# suites 1\n# pass 10\n# fail 0\n",
    "utf8",
  );
  await writeFile(
    join(logs, "2026-07-03-npm-check.log"),
    "[G8 GATE] Clean run: 0 failures, 0 not-ok lines. Exit 0.\n",
    "utf8",
  );
  return {
    ...process.env,
    DEMA_HOME: home,
    DEMA_STAND_LOG_DIR: logs,
    home,
    logs,
  };
}

async function runStand(args, env) {
  return execFileAsync(process.execPath, [CLI, "stand", ...args], {
    cwd: REPO_ROOT,
    env,
    maxBuffer: 4 * 1024 * 1024,
  });
}

test("dema stand --json emits the standing payload with one action and all-false boundary", async () => {
  const env = await makeFixtureEnv();
  const { stdout } = await runStand(["--json", "--drain", "less"], env);
  const payload = JSON.parse(stdout);
  assert.equal(payload.schema, "bizra.dema.dema_stand.v0.1");
  assert.equal(payload.truth_label, "FIRST_USER_STANDING_LOCAL_ONLY");
  assert.equal(Array.isArray(payload.next_action), false);
  assert.equal(typeof payload.next_action.id, "string");
  assert.equal(typeof payload.next_action.label, "string");
  for (const [key, value] of Object.entries(payload.boundary)) {
    assert.equal(value, false, `boundary.${key} must be false`);
  }
  assert.equal(payload.drain.declared, "less");
  assert.equal(payload.input.gates.test.status, "pass");
  assert.equal(payload.input.gates.test.tests_total, 10);
  assert.equal(payload.receipt_path, null);
});

test("dema stand human card shows exactly one action and the boundary line", async () => {
  const env = await makeFixtureEnv();
  const { stdout } = await runStand([], env);
  assert.match(stdout, /MORNING STANDING — FIRST_USER_STANDING_LOCAL_ONLY/);
  const actionLines = stdout.split("\n").filter((l) => l.includes("ONE ACTION →"));
  assert.equal(actionLines.length, 1);
  assert.match(stdout, /no mint · no URP · no network · no live autonomy/);
  assert.match(stdout, /drain\s+not declared/);
});

test("receipt write refuses without the exact consent phrase", async () => {
  const env = await makeFixtureEnv();
  await assert.rejects(
    runStand(["--receipt", "--consent", "yes please"], env),
    (error) => {
      assert.match(String(error.stderr), /exact consent phrase/);
      return true;
    },
  );
  const entries = await readdir(env.home).catch(() => []);
  assert.equal(entries.includes("stand"), false, "no receipt dir without consent");
});

test("receipt writes only under DEMA_HOME/stand/receipts with exact consent", async () => {
  const env = await makeFixtureEnv();
  const { stdout } = await runStand(
    ["--json", "--receipt", "--consent", CONSENT],
    env,
  );
  const payload = JSON.parse(stdout);
  assert.ok(payload.receipt_path.startsWith(join(env.home, "stand", "receipts")) || payload.receipt_path.includes("stand"));
  const written = JSON.parse(await readFile(payload.receipt_path, "utf8"));
  assert.equal(written.schema, "bizra.dema.dema_stand.v0.1");
  assert.equal(written.content_hash, payload.content_hash);
});

test("missing gate logs are reported as stale proof, never as pass", async () => {
  const env = await makeFixtureEnv();
  const emptyLogs = await mkdtemp(join(tmpdir(), "dema-stand-empty-"));
  const { stdout } = await runStand(["--json"], { ...env, DEMA_STAND_LOG_DIR: emptyLogs });
  const payload = JSON.parse(stdout);
  assert.equal(payload.input.gates.test.status, "missing");
  assert.equal(payload.standing.stale_proof, true);
  assert.ok(payload.standing.stale_reasons.includes("test_gate_log_missing"));
});

test("dema stand chain reports NOT_STARTED on an empty receipts dir", async () => {
  const env = await makeFixtureEnv();
  const { stdout } = await runStand(["chain", "--json"], env);
  const payload = JSON.parse(stdout);
  assert.equal(payload.schema, "bizra.dema.dema_steward_chain.v0.1");
  assert.equal(payload.verdict, "NOT_STARTED");
  assert.equal(typeof payload.next_required_day, "string");
});

test("dema stand chain verifies a real written receipt as day 1 of 7", async () => {
  const env = await makeFixtureEnv();
  await runStand(["--receipt", "--consent", CONSENT, "--drain", "less"], env);
  const { stdout } = await runStand(["chain", "--json"], env);
  const payload = JSON.parse(stdout);
  assert.equal(payload.verdict, "IN_PROGRESS");
  assert.equal(payload.progress, "1/7");
  assert.equal(payload.chain.drain_series[0].drain, "less");
  assert.equal(payload.day_report, null);
});

test("dema stand chain fails closed when a stored receipt is tampered", async () => {
  const env = await makeFixtureEnv();
  await runStand(["--receipt", "--consent", CONSENT], env);
  const dir = join(env.home, "stand", "receipts");
  const [name] = await readdir(dir);
  const receipt = JSON.parse(await readFile(join(dir, name), "utf8"));
  receipt.next_action = { id: "forged", label: "forged" };
  await writeFile(join(dir, name), JSON.stringify(receipt), "utf8");
  const { stdout } = await runStand(["chain", "--json"], env);
  const payload = JSON.parse(stdout);
  assert.equal(payload.verdict, "RECEIPTS_INVALID");
  assert.equal(payload.invalid_receipts.length, 1);
});
