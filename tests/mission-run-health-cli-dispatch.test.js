/**
 * NODE0-RESURRECTION-CORRECTION-1B — `dema mission run health` CLI dispatch.
 *
 * Regression origin: the generic `if (subcommand === "run")` branch had no
 * argv[2] guard and calls process.exit(), so the dedicated `run health` branch
 * further down was unreachable. `dema mission run health` — documented in
 * docs/ARCHITECTURE.md and in the CLI's own usage text — failed with
 * `file_not_found: health`, because argv[2] was treated as a path.
 *
 * It survived because NO test exercised the CLI path: the kernel tests call
 * saveHealthSnapshotReceipt() directly, and mission-manifest.test.js only
 * regex-matches the consent phrase in prose. This file closes that hole.
 *
 * Every test binds DEMA_HOME to a fresh temp dir, so nothing touches the
 * operator's real receipts.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(
  new URL("../apps/cli/src/index.js", import.meta.url),
);
const CONSENT = "RUN NODE0 HEALTH SNAPSHOT";

async function isolatedHome() {
  return mkdtemp(join(tmpdir(), "dema-health-cli-"));
}

async function receiptCount(home) {
  try {
    return (await readdir(join(home, "receipts"))).filter((f) =>
      f.startsWith("mission-health-"),
    ).length;
  } catch {
    return 0;
  }
}

/** Run the CLI, returning stdout + exit code whether it succeeded or not. */
async function runCli(args, home) {
  try {
    const { stdout } = await execFileAsync("node", [cliPath, ...args], {
      env: { ...process.env, DEMA_HOME: home },
    });
    return { stdout, code: 0 };
  } catch (error) {
    return { stdout: error.stdout ?? "", code: error.code ?? 1 };
  }
}

test("C1 dry-run reaches the health branch and writes nothing", async () => {
  const home = await isolatedHome();
  const { stdout } = await runCli(
    ["mission", "run", "health", "--dry-run", "--json"],
    home,
  );
  const out = JSON.parse(stdout);
  assert.equal(out.reason, "dry_run");
  assert.equal(out.saved, false);
  assert.equal(out.truth_label, "LOCAL_OPERATOR_MISSION");
  assert.equal(await receiptCount(home), 0);
});

test("C2 missing consent refuses and writes nothing", async () => {
  const home = await isolatedHome();
  const { stdout, code } = await runCli(
    ["mission", "run", "health", "--json"],
    home,
  );
  const out = JSON.parse(stdout);
  assert.equal(out.saved, false);
  assert.equal(out.reason, "consent_phrase_mismatch");
  assert.equal(out.required_phrase, CONSENT);
  assert.equal(code, 1);
  assert.equal(await receiptCount(home), 0);
});

test("C2b a near-miss consent phrase still refuses", async () => {
  const home = await isolatedHome();
  const { stdout } = await runCli(
    ["mission", "run", "health", "--consent", "run node0 health snapshot", "--json"],
    home,
  );
  assert.equal(JSON.parse(stdout).reason, "consent_phrase_mismatch");
  assert.equal(await receiptCount(home), 0);
});

test("C3 exact consent writes exactly one receipt below DEMA_HOME", async () => {
  const home = await isolatedHome();
  const { stdout } = await runCli(
    ["mission", "run", "health", "--consent", CONSENT, "--json"],
    home,
  );
  const out = JSON.parse(stdout);
  assert.equal(out.saved, true);
  assert.equal(out.reason, "consent_verified");
  assert.ok(
    out.path.startsWith(home),
    `receipt escaped the isolated home: ${out.path}`,
  );
  assert.equal(await receiptCount(home), 1);
});

test("C4 the written receipt verifies through the shipped verifier", async () => {
  const home = await isolatedHome();
  const saved = JSON.parse(
    (await runCli(["mission", "run", "health", "--consent", CONSENT, "--json"], home))
      .stdout,
  );
  const { stdout } = await runCli(["mission", "verify", saved.path, "--json"], home);
  const verified = JSON.parse(stdout);
  assert.equal(verified.verdict, "VERIFIED");
  assert.equal(verified.checks_failing, 0);
  assert.ok(verified.checks_total > 0, "a verifier that checked nothing is not a pass");
});

test("C5 the result separates receipt verification from the health verdict", async () => {
  const home = await isolatedHome();
  const { stdout } = await runCli(
    ["mission", "run", "health", "--consent", CONSENT, "--json"],
    home,
  );
  const out = JSON.parse(stdout);
  // Integrity of what we wrote, and what the mission found, are different truths.
  assert.equal(out.receipt_verification.verdict, "VERIFIED");
  assert.equal(out.receipt_verification.checks_failing, 0);
  assert.ok(
    out.receipt_verification.checks_total > 0,
    "a verification block reporting zero checks is vacuous",
  );
  assert.ok(
    ["PASSED", "FAILED", "INCOMPLETE"].includes(out.health_mission_verdict),
    `health_mission_verdict must be reported as measured, got ${out.health_mission_verdict}`,
  );
  assert.notEqual(
    out.receipt_verification.verdict,
    out.health_mission_verdict,
    "the two verdicts must be separately addressable fields",
  );
});

test("C6 the generic file-run path is still reachable", async () => {
  const home = await isolatedHome();
  const file = join(home, "sample.md");
  await writeFile(file, "# a real local file\n");
  const { stdout } = await runCli(["mission", "run", file, "--json"], home);
  const out = JSON.parse(stdout);
  assert.equal(out.preview_only, true);
  assert.equal(await receiptCount(home), 0);
});

test("C7 the token 'health' is never interpreted as a filename", async () => {
  const home = await isolatedHome();
  for (const args of [
    ["mission", "run", "health", "--json"],
    ["mission", "run", "health", "--dry-run", "--json"],
    ["mission", "run", "health", "--consent", CONSENT, "--json"],
  ]) {
    const { stdout } = await runCli(args, home);
    assert.doesNotMatch(
      stdout,
      /file_not_found/,
      `'health' fell through to the generic file branch for: ${args.join(" ")}`,
    );
    assert.doesNotMatch(stdout, /"file":\s*"health"/);
  }
});

test("C8 unknown or malformed run input fails with a bounded typed result", async () => {
  const home = await isolatedHome();
  const missing = await runCli(
    ["mission", "run", join(home, "nope.md"), "--json"],
    home,
  );
  const out = JSON.parse(missing.stdout);
  assert.equal(out.refused, true);
  assert.equal(out.reason_code, "file_not_found");
  assert.equal(missing.code, 1);

  const noArg = await runCli(["mission", "run", "--json"], home);
  assert.equal(noArg.code, 1);
  assert.equal(await receiptCount(home), 0);
});
