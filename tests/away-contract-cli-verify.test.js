import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { mkdtempSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  AWAY_CONTRACT_SCHEMA,
  validateAwayContract,
} from "../packages/core/src/away-contract-schema.js";

// AWAY-CONTRACT-CLI-VERIFY-1A — `dema away verify` exposes the body-bound
// verifier. Verify only: no draft, no receipt, no DEMA_HOME, no Away Mode.

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(new URL("../apps/cli/src/index.js", import.meta.url));
const NOW_ISO = "2026-07-03T22:00:00.000Z";

function validContract(overrides = {}) {
  return {
    schema: AWAY_CONTRACT_SCHEMA,
    contract_id: "away-2026-07-03-0004",
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
  const dir = mkdtempSync(join(tmpdir(), "away-verify-cli-"));
  return Promise.resolve(fn(dir)).finally(() =>
    rmSync(dir, { recursive: true, force: true }),
  );
}

function writePair(dir, contract) {
  const validation = validateAwayContract(contract, { now_iso: NOW_ISO });
  const contractFile = join(dir, "contract.json");
  const validationFile = join(dir, "validation.json");
  writeFileSync(contractFile, JSON.stringify(contract));
  writeFileSync(validationFile, JSON.stringify(validation));
  return { contractFile, validationFile, validation };
}

test("valid pair + --json emits verifier result, exit 0", async () => {
  await withDir(async (dir) => {
    const { contractFile, validationFile } = writePair(dir, validContract());

    const r = await runCli([
      "away", "verify",
      "--contract-file", contractFile,
      "--validation-file", validationFile,
      "--now", NOW_ISO,
      "--json",
    ]);
    assert.equal(r.code, 0, r.stderr);

    const out = JSON.parse(r.stdout);
    assert.equal(out.valid, true);
    assert.equal(out.truth_label, "AWAY_CONTRACT_VERIFY_ONLY");
    assert.equal(out.verification.contract_hash_matches, true);
    assert.equal(out.verification.normalized_body_matches, true);
    assert.equal(out.verification.launder_attempt_detected, false);
    assert.match(out.contract_hash, /^sha256:[a-f0-9]{64}$/);
  });
});

test("human preview names verdict, binding checks, and states verify-only", async () => {
  await withDir(async (dir) => {
    const { contractFile, validationFile } = writePair(dir, validContract());

    const r = await runCli([
      "away", "verify",
      "--contract-file", contractFile,
      "--validation-file", validationFile,
      "--now", NOW_ISO,
    ]);
    assert.equal(r.code, 0, r.stderr);
    assert.match(r.stdout, /AWAY_CONTRACT_VERIFY_ONLY/);
    assert.match(r.stdout, /contract_hash_matches/);
    assert.match(r.stdout, /normalized_body_matches/);
    assert.match(r.stdout, /launder_attempt_detected/);
    assert.match(r.stdout, /Verify only\. No Away Mode started\./);
  });
});

test("missing flags reject with usage, exit 1", async () => {
  await withDir(async (dir) => {
    const { contractFile, validationFile } = writePair(dir, validContract());

    const noContract = await runCli([
      "away", "verify", "--validation-file", validationFile, "--now", NOW_ISO,
    ]);
    assert.equal(noContract.code, 1);
    assert.match(noContract.stderr, /--contract-file/);

    const noValidation = await runCli([
      "away", "verify", "--contract-file", contractFile, "--now", NOW_ISO,
    ]);
    assert.equal(noValidation.code, 1);
    assert.match(noValidation.stderr, /--validation-file/);

    const noNow = await runCli([
      "away", "verify", "--contract-file", contractFile, "--validation-file", validationFile,
    ]);
    assert.equal(noNow.code, 1);
    assert.match(noNow.stderr, /--now/);
  });
});

test("missing files and invalid JSON fail closed with precise reasons", async () => {
  await withDir(async (dir) => {
    const { contractFile, validationFile } = writePair(dir, validContract());

    const missingContract = await runCli([
      "away", "verify",
      "--contract-file", "/no/such/contract.json",
      "--validation-file", validationFile,
      "--now", NOW_ISO,
    ]);
    assert.equal(missingContract.code, 1);
    assert.match(missingContract.stderr, /ENOENT|cannot read/i);

    const missingValidation = await runCli([
      "away", "verify",
      "--contract-file", contractFile,
      "--validation-file", "/no/such/validation.json",
      "--now", NOW_ISO,
    ]);
    assert.equal(missingValidation.code, 1);
    assert.match(missingValidation.stderr, /ENOENT|cannot read/i);

    const badFile = join(dir, "bad.json");
    writeFileSync(badFile, "{ nope ");
    for (const args of [
      ["--contract-file", badFile, "--validation-file", validationFile],
      ["--contract-file", contractFile, "--validation-file", badFile],
    ]) {
      const r = await runCli(["away", "verify", ...args, "--now", NOW_ISO]);
      assert.equal(r.code, 1);
      assert.match(r.stderr, /invalid JSON|invalid_json/i);
    }
  });
});

test("laundered pair exits non-zero and surfaces blocked_by", async () => {
  await withDir(async (dir) => {
    const { validationFile } = writePair(dir, validContract());
    const drifted = validContract({ mission_scope: "docs-only PLUS push everything" });
    const driftedFile = join(dir, "drifted.json");
    writeFileSync(driftedFile, JSON.stringify(drifted));

    const r = await runCli([
      "away", "verify",
      "--contract-file", driftedFile,
      "--validation-file", validationFile,
      "--now", NOW_ISO,
      "--json",
    ]);
    assert.equal(r.code, 1);
    const out = JSON.parse(r.stdout);
    assert.equal(out.valid, false);
    assert.ok(out.blocked_by.length > 0);
    assert.equal(out.verification.launder_attempt_detected, true);
  });
});

test("verify needs no DEMA_HOME and never creates receipt directories", async () => {
  await withDir(async (dir) => {
    const { contractFile, validationFile } = writePair(dir, validContract());
    const fakeHome = join(dir, "dema-home-never-created");

    const r = await runCli(
      [
        "away", "verify",
        "--contract-file", contractFile,
        "--validation-file", validationFile,
        "--now", NOW_ISO,
        "--json",
      ],
      { DEMA_HOME: fakeHome },
    );
    assert.equal(r.code, 0, r.stderr);
    assert.equal(existsSync(fakeHome), false);
  });
});

test("boundary keeps execution/model/network/mint/activation/daemon all false", async () => {
  await withDir(async (dir) => {
    const { contractFile, validationFile } = writePair(dir, validContract());
    const r = await runCli([
      "away", "verify",
      "--contract-file", contractFile,
      "--validation-file", validationFile,
      "--now", NOW_ISO,
      "--json",
    ]);
    const out = JSON.parse(r.stdout);
    assert.deepEqual(out.boundary, {
      execution_attempted: false,
      model_invocation: false,
      network: false,
      token_mint: false,
      activation: false,
      daemon_started: false,
      contract_started: false,
      compiler_invoked: false,
    });
  });
});

test("unknown away subcommands still fail closed and name both rungs", async () => {
  const r = await runCli(["away", "start"]);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /draft/);
  assert.match(r.stderr, /verify/);
});
