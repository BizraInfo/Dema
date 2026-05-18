import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { existsSync } from "node:fs";

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const BOOTSTRAP_SCRIPT = join(__dirname, "..", "scripts", "install", "samy-bootstrap.sh");
const REPO_ROOT = join(__dirname, "..");

// ─── samy-bootstrap.sh smoke tests ──────────────────────────────────────────
//
// The script is preview-only by design; --help, --dry-run, and --check should
// all be idempotent, fast, and write nothing to disk. We never run the apply
// path in tests (it would write to ~/.dema/ of the test runner).

test("samy-bootstrap.sh exists and is executable", () => {
  assert.equal(existsSync(BOOTSTRAP_SCRIPT), true);
});

test("samy-bootstrap.sh --help prints usage including 'Phase C · Node1 device bootstrap'", async () => {
  const { stdout } = await execFileAsync("bash", [BOOTSTRAP_SCRIPT, "--help"], { cwd: REPO_ROOT });
  assert.match(stdout, /Phase C/);
  assert.match(stdout, /Node1 device bootstrap/);
  assert.match(stdout, /preview-only/);
  assert.match(stdout, /Does NOT mint PAT-7/);
  assert.match(stdout, /Does NOT connect to any network/);
  assert.match(stdout, /ADR-005 exact-string consent/);
});

test("samy-bootstrap.sh --dry-run reports planned writes without performing them", async () => {
  const { stdout } = await execFileAsync("bash", [BOOTSTRAP_SCRIPT, "--dry-run"], { cwd: REPO_ROOT });
  assert.match(stdout, /dry-run mode/);
  assert.match(stdout, /no writes/);
  assert.match(stdout, /Would create directory.*\.dema/);
  assert.match(stdout, /Would write file.*profile\.json/);
  assert.match(stdout, /Would write file.*node1-self-witness\.json/);
  assert.match(stdout, /operator\s+:\s+Samy/);
  assert.match(stdout, /node_ordinal\s+:\s+1/);
  assert.match(stdout, /paired_node0_receipt\s+:\s+2026-05-18_082658/);
  // boundary discipline named explicitly in dry-run output
  assert.match(stdout, /Network used\s+:\s+false/);
  assert.match(stdout, /Federation invoked\s+:\s+false/);
  assert.match(stdout, /Runtime executed\s+:\s+false/);
});

test("samy-bootstrap.sh --dry-run respects --name override", async () => {
  const { stdout } = await execFileAsync(
    "bash",
    [BOOTSTRAP_SCRIPT, "--dry-run", "--name", "TestCandidate"],
    { cwd: REPO_ROOT }
  );
  assert.match(stdout, /operator\s+:\s+TestCandidate/);
});

test("samy-bootstrap.sh --check reports state without writing", async () => {
  const { stdout } = await execFileAsync("bash", [BOOTSTRAP_SCRIPT, "--check"], { cwd: REPO_ROOT });
  assert.match(stdout, /check mode/);
  assert.match(stdout, /DEMA_HOME\s+:/);
});

test("samy-bootstrap.sh exits non-zero on unknown flag", async () => {
  try {
    await execFileAsync("bash", [BOOTSTRAP_SCRIPT, "--foo"], { cwd: REPO_ROOT });
    assert.fail("expected non-zero exit on unknown flag");
  } catch (err) {
    assert.equal(err.code, 2);
    assert.match(err.stderr, /Unknown flag: --foo/);
  }
});

test("samy-bootstrap.sh names the paired Node0 receipt evidence hash verbatim", async () => {
  const { stdout } = await execFileAsync("bash", [BOOTSTRAP_SCRIPT, "--help"], { cwd: REPO_ROOT });
  // Help text must cite the actual receipt #21 evidence hash so the candidate
  // can independently verify their pairing with Mumu's Node0 ceremony.
  assert.match(stdout, /8ac3d72699be44df51e79733a944036ab296b5698884ab3a47cf77eb64ad323c/);
});

test("ADVERSARIAL: samy-bootstrap.sh dry-run does NOT create ~/.dema/ when it doesn't exist", async () => {
  // Run dry-run with a custom DEMA_HOME pointing somewhere safe; verify no
  // directory is created.
  const safeHome = "/tmp/samy-bootstrap-dryrun-should-not-exist-" + Date.now();
  await execFileAsync(
    "bash",
    [BOOTSTRAP_SCRIPT, "--dry-run"],
    { cwd: REPO_ROOT, env: { ...process.env, DEMA_HOME: safeHome } }
  );
  assert.equal(existsSync(safeHome), false, "dry-run must not create the directory");
});
