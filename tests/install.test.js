import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { existsSync } from "node:fs";

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const INSTALL_SCRIPT = join(__dirname, "..", "scripts", "install", "install.sh");
const INSTALL_UNIX_SHIM = join(__dirname, "..", "scripts", "install", "install-unix.sh");
const REPO_ROOT = join(__dirname, "..");

// ─── BASE TESTS (Node0 default path + candidate path) ───────────────────────

test("install.sh exists and is executable", () => {
  assert.equal(existsSync(INSTALL_SCRIPT), true);
});

test("install.sh --help describes unified installer + seed-pattern invariant", async () => {
  const { stdout } = await execFileAsync("bash", [INSTALL_SCRIPT, "--help"], { cwd: REPO_ROOT });
  assert.match(stdout, /Unified Dema installer/);
  assert.match(stdout, /seed-pattern invariant/);
  // Help text may wrap; check both halves of the canonical sentence appear
  assert.match(stdout, /every node/);
  assert.match(stdout, /full system DNA/);
  assert.match(stdout, /DEFAULT BEHAVIOR/);
  assert.match(stdout, /CANDIDATE BEHAVIOR/);
});

test("install.sh --dry-run default path bootstraps Node0", async () => {
  const safeHome = "/tmp/install-test-default-" + Date.now();
  const { stdout } = await execFileAsync(
    "bash",
    [INSTALL_SCRIPT, "--dry-run"],
    { cwd: REPO_ROOT, env: { ...process.env, DEMA_HOME: safeHome } }
  );
  assert.match(stdout, /dry-run mode/);
  assert.match(stdout, /ordinal\s+:\s+0/);
  assert.match(stdout, /node\s+:\s+Node0/);
  assert.match(stdout, /Would create.*memory/);
  assert.match(stdout, /Would create.*profile\.json/);
  assert.equal(existsSync(safeHome), false, "dry-run must not create directory");
});

test("install.sh --dry-run candidate path bootstraps Node-N with paired receipt", async () => {
  const safeHome = "/tmp/install-test-candidate-" + Date.now();
  const { stdout } = await execFileAsync(
    "bash",
    [
      INSTALL_SCRIPT,
      "--dry-run",
      "--operator", "Samy",
      "--ordinal", "1",
      "--paired-receipt-id", "2026-05-18_082658",
      "--paired-receipt-hash", "8ac3d72699be44df51e79733a944036ab296b5698884ab3a47cf77eb64ad323c",
      "--paired-receipt-date", "2026-05-18"
    ],
    { cwd: REPO_ROOT, env: { ...process.env, DEMA_HOME: safeHome } }
  );
  assert.match(stdout, /operator\s+:\s+Samy/);
  assert.match(stdout, /ordinal\s+:\s+1/);
  assert.match(stdout, /node\s+:\s+Node1/);
  assert.match(stdout, /paired_receipt_id\s+:\s+2026-05-18_082658/);
  assert.match(stdout, /paired_receipt_hash\s+:\s+8ac3d72699be44df/);
  assert.match(stdout, /Would create.*node1-self-witness\.json/);
  assert.equal(existsSync(safeHome), false, "dry-run must not create directory");
});

test("install.sh candidate path REQUIRES --operator when --ordinal >= 1", async () => {
  try {
    await execFileAsync(
      "bash",
      [INSTALL_SCRIPT, "--dry-run", "--ordinal", "1", "--paired-receipt-id", "x", "--paired-receipt-hash", "y"],
      { cwd: REPO_ROOT }
    );
    assert.fail("expected non-zero exit");
  } catch (err) {
    assert.equal(err.code, 2);
    assert.match(err.stderr, /--operator NAME required/);
  }
});

test("install.sh candidate path REQUIRES paired-receipt-id and paired-receipt-hash", async () => {
  try {
    await execFileAsync(
      "bash",
      [INSTALL_SCRIPT, "--dry-run", "--operator", "X", "--ordinal", "1"],
      { cwd: REPO_ROOT }
    );
    assert.fail("expected non-zero exit");
  } catch (err) {
    assert.equal(err.code, 2);
    assert.match(err.stderr, /paired-receipt-id and --paired-receipt-hash required/);
  }
});

test("install.sh --check reports state without writing", async () => {
  const safeHome = "/tmp/install-test-check-" + Date.now();
  const { stdout } = await execFileAsync(
    "bash",
    [INSTALL_SCRIPT, "--check"],
    { cwd: REPO_ROOT, env: { ...process.env, DEMA_HOME: safeHome } }
  );
  assert.match(stdout, /check mode/);
  assert.match(stdout, /does not exist/);
  assert.equal(existsSync(safeHome), false);
});

test("install.sh --dry-run --device-label honors device flag", async () => {
  const { stdout } = await execFileAsync(
    "bash",
    [
      INSTALL_SCRIPT,
      "--dry-run",
      "--operator", "Test",
      "--ordinal", "1",
      "--paired-receipt-id", "x",
      "--paired-receipt-hash", "y",
      "--device-label", "Asus VivoBook"
    ],
    { cwd: REPO_ROOT }
  );
  assert.match(stdout, /device_label\s+:\s+Asus VivoBook/);
});

test("install.sh --dry-run --language honors language flag", async () => {
  const { stdout } = await execFileAsync(
    "bash",
    [
      INSTALL_SCRIPT,
      "--dry-run",
      "--operator", "Test",
      "--ordinal", "1",
      "--paired-receipt-id", "x",
      "--paired-receipt-hash", "y",
      "--language", "ar"
    ],
    { cwd: REPO_ROOT }
  );
  assert.match(stdout, /language\s+:\s+ar/);
});

test("install.sh exit 2 on unknown flag", async () => {
  try {
    await execFileAsync("bash", [INSTALL_SCRIPT, "--foo"], { cwd: REPO_ROOT });
    assert.fail("expected non-zero exit");
  } catch (err) {
    assert.equal(err.code, 2);
    assert.match(err.stderr, /Unknown flag: --foo/);
  }
});

// ─── ADVERSARIAL TESTS (Master Craftsmanship #7) ────────────────────────────

test("ADVERSARIAL: install.sh refuses ordinal 3 (forbidden in canon_registry)", async () => {
  try {
    await execFileAsync(
      "bash",
      [INSTALL_SCRIPT, "--dry-run", "--operator", "X", "--ordinal", "3", "--paired-receipt-id", "a", "--paired-receipt-hash", "b"],
      { cwd: REPO_ROOT }
    );
    assert.fail("expected non-zero exit for forbidden ordinal");
  } catch (err) {
    assert.equal(err.code, 2);
    assert.match(err.stderr, /forbidden_topology_phrases/);
    assert.match(err.stderr, /ordinal 3/);
  }
});

test("ADVERSARIAL: install.sh refuses ordinal 4 (forbidden in canon_registry)", async () => {
  try {
    await execFileAsync(
      "bash",
      [INSTALL_SCRIPT, "--dry-run", "--operator", "X", "--ordinal", "4", "--paired-receipt-id", "a", "--paired-receipt-hash", "b"],
      { cwd: REPO_ROOT }
    );
    assert.fail("expected non-zero exit for forbidden ordinal");
  } catch (err) {
    assert.equal(err.code, 2);
    assert.match(err.stderr, /forbidden_topology_phrases/);
  }
});

test("ADVERSARIAL: install.sh refuses non-integer ordinal (e.g., '1.5')", async () => {
  try {
    await execFileAsync(
      "bash",
      [INSTALL_SCRIPT, "--dry-run", "--operator", "X", "--ordinal", "1.5", "--paired-receipt-id", "a", "--paired-receipt-hash", "b"],
      { cwd: REPO_ROOT }
    );
    assert.fail("expected non-zero exit for non-integer ordinal");
  } catch (err) {
    assert.equal(err.code, 2);
    assert.match(err.stderr, /--ordinal must be a non-negative integer/);
  }
});

test("ADVERSARIAL: install.sh refuses negative ordinal", async () => {
  try {
    await execFileAsync(
      "bash",
      [INSTALL_SCRIPT, "--dry-run", "--operator", "X", "--ordinal", "-1", "--paired-receipt-id", "a", "--paired-receipt-hash", "b"],
      { cwd: REPO_ROOT }
    );
    assert.fail("expected non-zero exit");
  } catch (err) {
    assert.equal(err.code, 2);
    assert.match(err.stderr, /non-negative integer/);
  }
});

test("ADVERSARIAL: install.sh dry-run with custom DEMA_HOME does NOT create directory", async () => {
  const safeHome = "/tmp/install-test-isolation-" + Date.now();
  await execFileAsync(
    "bash",
    [INSTALL_SCRIPT, "--dry-run"],
    { cwd: REPO_ROOT, env: { ...process.env, DEMA_HOME: safeHome } }
  );
  assert.equal(existsSync(safeHome), false, "dry-run must not create the directory");
});

test("ADVERSARIAL: install.sh ordinal 2 succeeds in dry-run (Node2 is allowed)", async () => {
  const { stdout } = await execFileAsync(
    "bash",
    [INSTALL_SCRIPT, "--dry-run", "--operator", "VivoBookFriend", "--ordinal", "2", "--paired-receipt-id", "future_id", "--paired-receipt-hash", "future_hash"],
    { cwd: REPO_ROOT }
  );
  assert.match(stdout, /ordinal\s+:\s+2/);
  assert.match(stdout, /node\s+:\s+Node2/);
  assert.match(stdout, /Would create.*node2-self-witness\.json/);
});

// ─── install-unix.sh BACKWARD-COMPAT WRAPPER TESTS ──────────────────────────

test("install-unix.sh wrapper exists and delegates to install.sh", async () => {
  assert.equal(existsSync(INSTALL_UNIX_SHIM), true);
  const { stdout } = await execFileAsync("bash", [INSTALL_UNIX_SHIM, "--help"], { cwd: REPO_ROOT });
  assert.match(stdout, /Unified Dema installer/, "wrapper must pass through to install.sh");
});

test("install-unix.sh wrapper --dry-run produces same output as install.sh --dry-run", async () => {
  const safeHome = "/tmp/install-test-wrapper-" + Date.now();
  const env = { ...process.env, DEMA_HOME: safeHome };
  const a = await execFileAsync("bash", [INSTALL_UNIX_SHIM, "--dry-run"], { cwd: REPO_ROOT, env });
  const b = await execFileAsync("bash", [INSTALL_SCRIPT, "--dry-run"], { cwd: REPO_ROOT, env });
  assert.equal(a.stdout, b.stdout, "wrapper must produce byte-equal output to canonical script");
});

// ─── BOUNDARY DISCIPLINE TESTS ──────────────────────────────────────────────

test("install.sh --dry-run output declares boundary discipline explicitly", async () => {
  const { stdout } = await execFileAsync("bash", [INSTALL_SCRIPT, "--dry-run"], { cwd: REPO_ROOT });
  assert.match(stdout, /no network/);
  assert.match(stdout, /no federation/);
  assert.match(stdout, /no runtime/);
  assert.match(stdout, /no mint/);
});

test("install.sh --help cites Node ordinal law + seed-pattern invariant + ADR-005", async () => {
  const { stdout } = await execFileAsync("bash", [INSTALL_SCRIPT, "--help"], { cwd: REPO_ROOT });
  assert.match(stdout, /Node ordinal law/);
  assert.match(stdout, /seed-pattern invariant/);
  assert.match(stdout, /ADR-005/);
  assert.match(stdout, /Daughter Test/);
});

test("install.sh --help describes boundary discipline of the operation", async () => {
  const { stdout } = await execFileAsync("bash", [INSTALL_SCRIPT, "--help"], { cwd: REPO_ROOT });
  assert.match(stdout, /Boundary discipline/);
  assert.match(stdout, /network_used\s*:\s*false/);
  assert.match(stdout, /federation_invoked\s*:\s*false/);
  assert.match(stdout, /consent_collected\s*:\s*false/);
});
