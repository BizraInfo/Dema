import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  AWAY_CONTRACT_SCHEMA,
  validateAwayContract,
} from "../packages/core/src/away-contract-schema.js";
import { verifyAwayContract } from "../packages/core/src/away-contract-verify.js";
import { expectedAwayContractReceiptConsent } from "../packages/core/src/away-contract-receipt.js";

// AWAY-CONTRACT-CLI-RECEIPT-1A — `dema away receipt` exposes the consent-gated
// receipt writer. Exact phrase required; write only under DEMA_HOME; writing a
// receipt never starts Away Mode.

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(new URL("../apps/cli/src/index.js", import.meta.url));
const NOW_ISO = "2026-07-03T22:00:00.000Z";

function validContract(overrides = {}) {
  return {
    schema: AWAY_CONTRACT_SCHEMA,
    contract_id: "away-2026-07-03-0005",
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
  const dir = mkdtempSync(join(tmpdir(), "away-receipt-cli-"));
  return Promise.resolve(fn(dir)).finally(() =>
    rmSync(dir, { recursive: true, force: true }),
  );
}

function writeFixture(dir, contract) {
  const validation = validateAwayContract(contract, { now_iso: NOW_ISO });
  const verify = verifyAwayContract({ contract, validation_result: validation }, { now_iso: NOW_ISO });
  const contractFile = join(dir, "contract.json");
  const validationFile = join(dir, "validation.json");
  writeFileSync(contractFile, JSON.stringify(contract));
  writeFileSync(validationFile, JSON.stringify(validation));
  return { contractFile, validationFile, phrase: expectedAwayContractReceiptConsent(verify) };
}

test("exact consent + valid pair writes the receipt under DEMA_HOME, exit 0", async () => {
  await withDir(async (dir) => {
    const home = join(dir, "dema-home");
    const { contractFile, validationFile, phrase } = writeFixture(dir, validContract());

    const r = await runCli(
      [
        "away", "receipt",
        "--contract-file", contractFile,
        "--validation-file", validationFile,
        "--now", NOW_ISO,
        "--consent", phrase,
        "--json",
      ],
      { DEMA_HOME: home },
    );
    assert.equal(r.code, 0, r.stderr);

    const out = JSON.parse(r.stdout);
    assert.equal(out.written, true);
    assert.equal(out.truth_label, "AWAY_CONTRACT_RECEIPT_WRITE_ONLY");
    assert.equal(
      out.receipt_path,
      join(home, "away-contracts", "receipts", "away-2026-07-03-0005.json"),
    );
    assert.ok(existsSync(out.receipt_path));
    const receipt = JSON.parse(readFileSync(out.receipt_path, "utf8"));
    assert.equal(receipt.consent_verified, true);
    assert.equal(receipt.boundary.contract_started, false);
  });
});

test("human output states receipt recorded but no Away Mode started", async () => {
  await withDir(async (dir) => {
    const home = join(dir, "dema-home");
    const { contractFile, validationFile, phrase } = writeFixture(dir, validContract());

    const r = await runCli(
      [
        "away", "receipt",
        "--contract-file", contractFile,
        "--validation-file", validationFile,
        "--now", NOW_ISO,
        "--consent", phrase,
      ],
      { DEMA_HOME: home },
    );
    assert.equal(r.code, 0, r.stderr);
    assert.match(r.stdout, /AWAY_CONTRACT_RECEIPT_WRITE_ONLY/);
    assert.match(r.stdout, /Receipt only\. No Away Mode started\./);
  });
});

test("missing --consent rejects and surfaces the expected phrase shape without writing", async () => {
  await withDir(async (dir) => {
    const home = join(dir, "dema-home");
    const { contractFile, validationFile } = writeFixture(dir, validContract());

    const r = await runCli(
      [
        "away", "receipt",
        "--contract-file", contractFile,
        "--validation-file", validationFile,
        "--now", NOW_ISO,
        "--json",
      ],
      { DEMA_HOME: home },
    );
    assert.equal(r.code, 1);
    const out = JSON.parse(r.stdout);
    assert.ok(out.blocked_by.includes("consent_missing"));
    assert.match(out.expected_consent, /^GO: write away-contract receipt /);
    assert.equal(existsSync(join(home, "away-contracts")), false);
  });
});

test("wrong consent phrase rejects byte-exactly without writing", async () => {
  await withDir(async (dir) => {
    const home = join(dir, "dema-home");
    const { contractFile, validationFile, phrase } = writeFixture(dir, validContract());

    const r = await runCli(
      [
        "away", "receipt",
        "--contract-file", contractFile,
        "--validation-file", validationFile,
        "--now", NOW_ISO,
        "--consent", `${phrase} `,
        "--json",
      ],
      { DEMA_HOME: home },
    );
    assert.equal(r.code, 1);
    const out = JSON.parse(r.stdout);
    assert.ok(out.blocked_by.includes("consent_mismatch"));
    assert.equal(existsSync(join(home, "away-contracts")), false);
  });
});

test("missing flags reject with usage", async () => {
  const noContract = await runCli(["away", "receipt", "--now", NOW_ISO]);
  assert.equal(noContract.code, 1);
  assert.match(noContract.stderr, /--contract-file/);

  await withDir(async (dir) => {
    const { contractFile, validationFile } = writeFixture(dir, validContract());
    const noValidation = await runCli([
      "away", "receipt", "--contract-file", contractFile, "--now", NOW_ISO,
    ]);
    assert.equal(noValidation.code, 1);
    assert.match(noValidation.stderr, /--validation-file/);

    const noNow = await runCli([
      "away", "receipt", "--contract-file", contractFile, "--validation-file", validationFile,
    ]);
    assert.equal(noNow.code, 1);
    assert.match(noNow.stderr, /--now/);
  });
});

test("laundered pair rejects before consent even matters", async () => {
  await withDir(async (dir) => {
    const home = join(dir, "dema-home");
    const { validationFile, phrase } = writeFixture(dir, validContract());
    const drifted = validContract({ mission_scope: "docs-only PLUS push everything" });
    const driftedFile = join(dir, "drifted.json");
    writeFileSync(driftedFile, JSON.stringify(drifted));

    const r = await runCli(
      [
        "away", "receipt",
        "--contract-file", driftedFile,
        "--validation-file", validationFile,
        "--now", NOW_ISO,
        "--consent", phrase,
        "--json",
      ],
      { DEMA_HOME: home },
    );
    assert.equal(r.code, 1);
    const out = JSON.parse(r.stdout);
    assert.equal(out.written, false);
    assert.equal(existsSync(join(home, "away-contracts")), false);
  });
});

test("duplicate receipt rejects on second run", async () => {
  await withDir(async (dir) => {
    const home = join(dir, "dema-home");
    const { contractFile, validationFile, phrase } = writeFixture(dir, validContract());
    const args = [
      "away", "receipt",
      "--contract-file", contractFile,
      "--validation-file", validationFile,
      "--now", NOW_ISO,
      "--consent", phrase,
      "--json",
    ];

    const first = await runCli(args, { DEMA_HOME: home });
    assert.equal(first.code, 0, first.stderr);

    const second = await runCli(args, { DEMA_HOME: home });
    assert.equal(second.code, 1);
    const out = JSON.parse(second.stdout);
    assert.ok(out.blocked_by.includes("receipt_already_exists"));
  });
});

test("result boundary stays all-false even on the write path", async () => {
  await withDir(async (dir) => {
    const home = join(dir, "dema-home");
    const { contractFile, validationFile, phrase } = writeFixture(dir, validContract());
    const r = await runCli(
      [
        "away", "receipt",
        "--contract-file", contractFile,
        "--validation-file", validationFile,
        "--now", NOW_ISO,
        "--consent", phrase,
        "--json",
      ],
      { DEMA_HOME: home },
    );
    const out = JSON.parse(r.stdout);
    assert.deepEqual(out.boundary, {
      execution_attempted: false,
      contract_started: false,
      model_invocation: false,
      network: false,
      token_mint: false,
      activation: false,
      daemon_started: false,
      compiler_invoked: false,
    });
  });
});
