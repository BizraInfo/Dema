import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = join(REPO_ROOT, "bin", "dema");

// dema monitors run — operator-invoked proof-health scan (MONITOR-GATHERER-1A
// + RECEIPT-MONITOR-PREVIEW-1A). Structural assertions only: live-repo finding
// counts vary by checkout state and are the monitor's job to report, not ours
// to pin here.

async function runCli(args, env = {}) {
  try {
    const { stdout, stderr } = await execFileAsync("node", [CLI, ...args], {
      cwd: REPO_ROOT,
      env: { ...process.env, ...env },
      maxBuffer: 16 * 1024 * 1024,
    });
    return { code: 0, stdout, stderr };
  } catch (err) {
    return { code: err.code ?? 1, stdout: err.stdout ?? "", stderr: err.stderr ?? "" };
  }
}

async function freshEnv() {
  const home = await mkdtemp(join(tmpdir(), "dema-monitors-home-"));
  const logs = await mkdtemp(join(tmpdir(), "dema-monitors-logs-"));
  await writeFile(join(logs, "2026-01-01-npm-test.log"), "# tests 1\n# fail 0\n1..1\n");
  await writeFile(join(logs, "2026-01-01-npm-check.log"), "ok\n");
  await mkdir(join(home, "stand", "receipts"), { recursive: true });
  return { DEMA_HOME: home, DEMA_STAND_LOG_DIR: logs };
}

test("monitors run --json emits verifiable gatherer+monitor envelopes, exit 0", async () => {
  const env = await freshEnv();
  const { code, stdout } = await runCli(["monitors", "run", "--json"], env);
  assert.equal(code, 0);
  const parsed = JSON.parse(stdout);
  assert.equal(parsed.gatherer.schema, "bizra.dema.monitor_gatherer.v0.1");
  assert.match(parsed.gatherer.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(parsed.monitor.schema, "bizra.dema.receipt_monitor_preview.v0.1");
  assert.equal(parsed.monitor.ok, true);
  assert.equal(parsed.monitor.mode, "operator_invoked_preview");
  for (const flag of Object.values(parsed.monitor.boundary)) assert.equal(flag, false);
  assert.equal(parsed.monitor.summary.authority_delta, 0);
  assert.equal(parsed.monitor.summary.mint_allowed, false);
  for (const f of parsed.monitor.findings) {
    assert.ok(["info", "warning", "critical"].includes(f.severity));
    assert.ok(f.evidence_ref.length > 0);
  }
});

test("monitors run --ci-unavailable reports the outward CI finding, never code failure", async () => {
  const env = await freshEnv();
  const { code, stdout } = await runCli(["monitors", "run", "--json", "--ci-unavailable"], env);
  assert.equal(code, 0);
  const parsed = JSON.parse(stdout);
  const codes = parsed.monitor.findings.map((f) => f.finding);
  assert.ok(codes.includes("ci_unavailable_outward_not_code"));
});

test("bare monitors prints usage and exits 0; unknown subcommand exits 1", async () => {
  const env = await freshEnv();
  const bare = await runCli(["monitors"], env);
  assert.equal(bare.code, 0);
  assert.match(bare.stdout, /dema monitors run/);
  const unknown = await runCli(["monitors", "banana"], env);
  assert.equal(unknown.code, 1);
});

test("human output states read-only boundary and no daemon", async () => {
  const env = await freshEnv();
  const { code, stdout } = await runCli(["monitors", "run"], env);
  assert.equal(code, 0);
  assert.match(stdout, /read-only · operator-invoked · no daemon/);
  assert.match(stdout, /no autofix · no receipt write · no mint · no authority/);
});
