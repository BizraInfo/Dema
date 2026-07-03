import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { mkdtempSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// AWAY-CONTRACT-CLI-DRAFT-1A — `dema away draft` exposes the pure compiler.
// Draft only: no verify, no receipt, no DEMA_HOME requirement, no Away Mode.

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(new URL("../apps/cli/src/index.js", import.meta.url));
const NOW_ISO = "2026-07-03T22:00:00.000Z";

function validIntent(overrides = {}) {
  return {
    operator_id: "mumu",
    node_id: "NODE0",
    mission_scope: "docs-only: refresh stale TESTING rows",
    allowed_actions: ["READ_ONLY", "DOCS_ONLY", "TEST_ONLY", "LOCAL_EDIT", "COMMIT_ALLOWED"],
    forbidden_actions: ["PUSH_ALLOWED", "MODEL_ALLOWED", "NETWORK_ALLOWED"],
    data_scope: "repo:docs/**",
    model_policy: "forbidden",
    tool_policy: "npm test · npm run check only",
    commit_policy: "local commits on the active feat branch only",
    push_policy: "forbidden",
    network_policy: "forbidden",
    mobile_escalation_policy: "LEVEL_1_SUMMARY_ONLY",
    risk_ceiling: 1,
    expires_at: "2026-07-04T06:00:00.000Z",
    stop_conditions: ["test failure", "unexpected file mutation"],
    receipt_required: true,
    review_required_on_return: true,
    ...overrides,
  };
}

async function runCli(args, envOverrides = {}) {
  const env = { ...process.env, NODE_ENV: "test", ...envOverrides };
  try {
    const { stdout, stderr } = await execFileAsync("node", [cliPath, ...args], { env });
    return { code: 0, stdout, stderr };
  } catch (e) {
    return { code: e.code ?? 1, stdout: e.stdout ?? "", stderr: e.stderr ?? "" };
  }
}

function withDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), "away-cli-"));
  return Promise.resolve(fn(dir)).finally(() =>
    rmSync(dir, { recursive: true, force: true }),
  );
}

test("valid intent file + --json emits the compiler result, exit 0", async () => {
  await withDir(async (dir) => {
    const file = join(dir, "intent.json");
    writeFileSync(file, JSON.stringify(validIntent()));

    const r = await runCli(["away", "draft", "--intent-file", file, "--now", NOW_ISO, "--json"]);
    assert.equal(r.code, 0, r.stderr);

    const out = JSON.parse(r.stdout);
    assert.equal(out.compiled, true);
    assert.equal(out.truth_label, "AWAY_CONTRACT_COMPILATION_ONLY");
    assert.match(out.contract_hash, /^sha256:[a-f0-9]{64}$/);
    assert.equal(out.contract.schema, "bizra.dema.away_contract.v0.1");
    assert.equal(out.boundary.contract_started, false);
    assert.equal(out.boundary.receipt_written, false);
  });
});

test("custom --contract-id-prefix flows through", async () => {
  await withDir(async (dir) => {
    const file = join(dir, "intent.json");
    writeFileSync(file, JSON.stringify(validIntent()));

    const r = await runCli([
      "away", "draft", "--intent-file", file, "--now", NOW_ISO,
      "--contract-id-prefix", "node0-away", "--json",
    ]);
    assert.equal(r.code, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    assert.match(out.contract_id, /^node0-away-[a-f0-9]{12}$/);
  });
});

test("human preview names the verdict and states draft-only", async () => {
  await withDir(async (dir) => {
    const file = join(dir, "intent.json");
    writeFileSync(file, JSON.stringify(validIntent()));

    const r = await runCli(["away", "draft", "--intent-file", file, "--now", NOW_ISO]);
    assert.equal(r.code, 0, r.stderr);
    assert.match(r.stdout, /AWAY_CONTRACT_COMPILATION_ONLY/);
    assert.match(r.stdout, /contract_id/);
    assert.match(r.stdout, /sha256:/);
    assert.match(r.stdout, /Draft only\. No Away Mode started\./);
  });
});

test("missing --intent-file and missing --now reject with usage, exit 1", async () => {
  const noFile = await runCli(["away", "draft", "--now", NOW_ISO]);
  assert.equal(noFile.code, 1);
  assert.match(noFile.stderr, /--intent-file/);

  await withDir(async (dir) => {
    const file = join(dir, "intent.json");
    writeFileSync(file, JSON.stringify(validIntent()));
    const noNow = await runCli(["away", "draft", "--intent-file", file]);
    assert.equal(noNow.code, 1);
    assert.match(noNow.stderr, /--now/);
  });
});

test("invalid JSON and missing file fail closed with precise reasons", async () => {
  await withDir(async (dir) => {
    const bad = join(dir, "bad.json");
    writeFileSync(bad, "{ not json ");
    const invalid = await runCli(["away", "draft", "--intent-file", bad, "--now", NOW_ISO]);
    assert.equal(invalid.code, 1);
    assert.match(invalid.stderr, /invalid JSON|invalid_json/i);
  });

  const missing = await runCli([
    "away", "draft", "--intent-file", "/no/such/intent.json", "--now", NOW_ISO,
  ]);
  assert.equal(missing.code, 1);
  assert.match(missing.stderr, /ENOENT|cannot read/i);
});

test("compiler rejection exits non-zero and surfaces blocked_by", async () => {
  await withDir(async (dir) => {
    const file = join(dir, "intent.json");
    writeFileSync(file, JSON.stringify(validIntent({ risk_ceiling: 99 })));

    const r = await runCli(["away", "draft", "--intent-file", file, "--now", NOW_ISO, "--json"]);
    assert.equal(r.code, 1);
    const out = JSON.parse(r.stdout);
    assert.equal(out.compiled, false);
    assert.ok(out.blocked_by.includes("compiled_contract_invalid"));
  });
});

test("draft needs no DEMA_HOME and never creates receipt directories", async () => {
  await withDir(async (dir) => {
    const file = join(dir, "intent.json");
    writeFileSync(file, JSON.stringify(validIntent()));
    const fakeHome = join(dir, "dema-home-never-created");

    const r = await runCli(
      ["away", "draft", "--intent-file", file, "--now", NOW_ISO, "--json"],
      { DEMA_HOME: fakeHome },
    );
    assert.equal(r.code, 0, r.stderr);
    assert.equal(existsSync(fakeHome), false);
    assert.equal(existsSync(join(fakeHome, "away-contracts")), false);
  });
});

test("boundary in output keeps model/network/mint/activation/daemon all false", async () => {
  await withDir(async (dir) => {
    const file = join(dir, "intent.json");
    writeFileSync(file, JSON.stringify(validIntent()));

    const r = await runCli(["away", "draft", "--intent-file", file, "--now", NOW_ISO, "--json"]);
    const out = JSON.parse(r.stdout);
    assert.deepEqual(out.boundary, {
      execution_attempted: false,
      contract_started: false,
      receipt_written: false,
      model_invocation: false,
      network: false,
      token_mint: false,
      activation: false,
      daemon_started: false,
      external_policy_compiled: false,
    });
  });
});

test("unknown away subcommand fails closed with usage", async () => {
  const r = await runCli(["away", "start"]);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /draft/);
  assert.doesNotMatch(r.stderr, /started/i);
});
