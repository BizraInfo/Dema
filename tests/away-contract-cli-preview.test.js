import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  AWAY_CONTRACT_SCHEMA,
  validateAwayContract,
} from "../packages/core/src/away-contract-schema.js";
import { verifyAwayContract } from "../packages/core/src/away-contract-verify.js";
import {
  expectedAwayContractReceiptConsent,
  writeAwayContractReceipt,
} from "../packages/core/src/away-contract-receipt.js";

// AWAY-CONTRACT-READINESS-CLI-1A — `dema away preview` reports readiness of a
// receipted Away Contract. Report only: it must not start work, must not
// loop, must not schedule, and must exit after reporting (spec §7).

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(new URL("../apps/cli/src/index.js", import.meta.url));
const NOW_ISO = "2026-07-04T02:00:00.000Z";

function validContract(overrides = {}) {
  return {
    schema: AWAY_CONTRACT_SCHEMA,
    contract_id: "away-2026-07-04-0009",
    operator_id: "mumu",
    node_id: "NODE0",
    mission_scope: "docs-only: preview CLI fixture",
    allowed_actions: ["READ_ONLY", "DOCS_ONLY", "TEST_ONLY"],
    forbidden_actions: ["PUSH_ALLOWED", "MODEL_ALLOWED", "NETWORK_ALLOWED"],
    data_scope: "repo:docs/**",
    model_policy: "forbidden",
    tool_policy: "npm test only",
    commit_policy: "none",
    push_policy: "forbidden",
    network_policy: "forbidden",
    mobile_escalation_policy: "LEVEL_1_SUMMARY_ONLY",
    risk_ceiling: 1,
    expires_at: "2026-07-04T12:00:00.000Z",
    stop_conditions: ["test failure"],
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
  const dir = mkdtempSync(join(tmpdir(), "away-preview-cli-"));
  return Promise.resolve(fn(dir)).finally(() =>
    rmSync(dir, { recursive: true, force: true }),
  );
}

async function writeTrio(dir, contract) {
  const validation = validateAwayContract(contract, { now_iso: NOW_ISO });
  const verify = verifyAwayContract({ contract, validation_result: validation }, { now_iso: NOW_ISO });
  const home = join(dir, "trio-home");
  const written = await writeAwayContractReceipt(
    {
      contract,
      validation_result: validation,
      verify_result: verify,
      typed_go: expectedAwayContractReceiptConsent(verify),
    },
    { dema_home: home, now_iso: NOW_ISO },
  );
  const contractFile = join(dir, "contract.json");
  const validationFile = join(dir, "validation.json");
  const receiptFile = join(dir, "receipt.json");
  writeFileSync(contractFile, JSON.stringify(contract));
  writeFileSync(validationFile, JSON.stringify(validation));
  writeFileSync(receiptFile, readFileSync(written.receipt_path, "utf8"));
  return { contractFile, validationFile, receiptFile };
}

test("receipted trio reports PREVIEW_READY with --json, exit 0", async () => {
  await withDir(async (dir) => {
    const { contractFile, validationFile, receiptFile } = await writeTrio(dir, validContract());
    const r = await runCli([
      "away", "preview",
      "--contract-file", contractFile,
      "--validation-file", validationFile,
      "--receipt-file", receiptFile,
      "--now", NOW_ISO,
      "--json",
    ]);
    assert.equal(r.code, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    assert.equal(out.state, "PREVIEW_READY");
    assert.equal(out.ready, true);
    assert.equal(out.truth_label, "ABSENCE_STEWARD_READINESS_PREVIEW_ONLY");
    assert.equal(out.boundary.steward_started, false);
  });
});

test("human output names the state and says nothing starts", async () => {
  await withDir(async (dir) => {
    const { contractFile, validationFile, receiptFile } = await writeTrio(dir, validContract());
    const r = await runCli([
      "away", "preview",
      "--contract-file", contractFile,
      "--validation-file", validationFile,
      "--receipt-file", receiptFile,
      "--now", NOW_ISO,
    ]);
    assert.equal(r.code, 0, r.stderr);
    assert.match(r.stdout, /PREVIEW_READY/);
    assert.match(r.stdout, /Preview only\. No Away Mode started\./);
    assert.match(r.stdout, /dema away start does not exist/);
  });
});

test("without --receipt-file a verified pair reports CONTRACT_VERIFIED, exit 0", async () => {
  await withDir(async (dir) => {
    const contract = validContract();
    const validation = validateAwayContract(contract, { now_iso: NOW_ISO });
    const contractFile = join(dir, "contract.json");
    const validationFile = join(dir, "validation.json");
    writeFileSync(contractFile, JSON.stringify(contract));
    writeFileSync(validationFile, JSON.stringify(validation));

    const r = await runCli([
      "away", "preview",
      "--contract-file", contractFile,
      "--validation-file", validationFile,
      "--now", NOW_ISO,
      "--json",
    ]);
    assert.equal(r.code, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    assert.equal(out.state, "CONTRACT_VERIFIED");
    assert.equal(out.ready, false);
  });
});

test("expired trio reports EXPIRED honestly, exit 0 (a report, not an error)", async () => {
  await withDir(async (dir) => {
    const { contractFile, validationFile, receiptFile } = await writeTrio(dir, validContract());
    const r = await runCli([
      "away", "preview",
      "--contract-file", contractFile,
      "--validation-file", validationFile,
      "--receipt-file", receiptFile,
      "--now", "2026-07-04T13:00:00.000Z",
      "--json",
    ]);
    assert.equal(r.code, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    assert.equal(out.state, "EXPIRED");
    assert.equal(out.ready, false);
  });
});

test("laundered contract reports REFUSED, exit 1", async () => {
  await withDir(async (dir) => {
    const { validationFile, receiptFile } = await writeTrio(dir, validContract());
    const drifted = validContract({ mission_scope: "docs-only PLUS push everything" });
    const driftedFile = join(dir, "drifted.json");
    writeFileSync(driftedFile, JSON.stringify(drifted));

    const r = await runCli([
      "away", "preview",
      "--contract-file", driftedFile,
      "--validation-file", validationFile,
      "--receipt-file", receiptFile,
      "--now", NOW_ISO,
      "--json",
    ]);
    assert.equal(r.code, 1);
    const out = JSON.parse(r.stdout);
    assert.equal(out.state, "REFUSED");
    assert.ok(out.blocked_by.length > 0);
  });
});

test("missing flags and unreadable/invalid files fail closed", async () => {
  const noContract = await runCli(["away", "preview", "--now", NOW_ISO]);
  assert.equal(noContract.code, 1);
  assert.match(noContract.stderr, /--contract-file/);

  await withDir(async (dir) => {
    const { contractFile, validationFile } = await writeTrio(dir, validContract());
    const noNow = await runCli([
      "away", "preview", "--contract-file", contractFile, "--validation-file", validationFile,
    ]);
    assert.equal(noNow.code, 1);
    assert.match(noNow.stderr, /--now/);

    const bad = join(dir, "bad.json");
    writeFileSync(bad, "{ nope ");
    const invalid = await runCli([
      "away", "preview",
      "--contract-file", contractFile,
      "--validation-file", validationFile,
      "--receipt-file", bad,
      "--now", NOW_ISO,
    ]);
    assert.equal(invalid.code, 1);
    assert.match(invalid.stderr, /invalid JSON|invalid_json/i);
  });
});

test("preview requires no DEMA_HOME and away start still fails closed", async () => {
  await withDir(async (dir) => {
    const { contractFile, validationFile, receiptFile } = await writeTrio(dir, validContract());
    const fakeHome = join(dir, "never-created");
    const r = await runCli(
      [
        "away", "preview",
        "--contract-file", contractFile,
        "--validation-file", validationFile,
        "--receipt-file", receiptFile,
        "--now", NOW_ISO,
        "--json",
      ],
      { DEMA_HOME: fakeHome },
    );
    assert.equal(r.code, 0, r.stderr);
  });

  const start = await runCli(["away", "start"]);
  assert.equal(start.code, 1);
  assert.match(start.stderr, /preview/);
  assert.match(start.stderr, /nothing starts/);
});
