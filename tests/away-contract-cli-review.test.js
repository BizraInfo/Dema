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

// ABSENCE-STEWARD-RETURN-REVIEW-CLI-1A — `dema away review` renders the
// post-absence review report. Report only: no write, no runtime, no start.

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(new URL("../apps/cli/src/index.js", import.meta.url));
const LEFT_ISO = "2026-07-04T03:00:00.000Z";
const RETURNED_ISO = "2026-07-04T09:00:00.000Z";

function validContract(overrides = {}) {
  return {
    schema: AWAY_CONTRACT_SCHEMA,
    contract_id: "away-2026-07-04-0202",
    operator_id: "mumu",
    node_id: "NODE0",
    mission_scope: "docs-only: review CLI fixture",
    allowed_actions: ["READ_ONLY", "DOCS_ONLY"],
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
  const dir = mkdtempSync(join(tmpdir(), "away-review-cli-"));
  return Promise.resolve(fn(dir)).finally(() =>
    rmSync(dir, { recursive: true, force: true }),
  );
}

async function writeTrio(dir, contract) {
  const validation = validateAwayContract(contract, { now_iso: LEFT_ISO });
  const verify = verifyAwayContract({ contract, validation_result: validation }, { now_iso: LEFT_ISO });
  const home = join(dir, "trio-home");
  const written = await writeAwayContractReceipt(
    {
      contract,
      validation_result: validation,
      verify_result: verify,
      typed_go: expectedAwayContractReceiptConsent(verify),
    },
    { dema_home: home, now_iso: LEFT_ISO },
  );
  const contractFile = join(dir, "contract.json");
  const validationFile = join(dir, "validation.json");
  const receiptFile = join(dir, "receipt.json");
  writeFileSync(contractFile, JSON.stringify(contract));
  writeFileSync(validationFile, JSON.stringify(validation));
  writeFileSync(receiptFile, readFileSync(written.receipt_path, "utf8"));
  return { contractFile, validationFile, receiptFile };
}

test("receipted trio + window reports READY_BUT_NOT_STARTED with --json, exit 0", async () => {
  await withDir(async (dir) => {
    const { contractFile, validationFile, receiptFile } = await writeTrio(dir, validContract());
    const r = await runCli([
      "away", "review",
      "--contract-file", contractFile,
      "--validation-file", validationFile,
      "--receipt-file", receiptFile,
      "--left", LEFT_ISO,
      "--returned", RETURNED_ISO,
      "--json",
    ]);
    assert.equal(r.code, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    assert.equal(out.final_verdict, "READY_BUT_NOT_STARTED");
    assert.equal(out.truth_label, "ABSENCE_STEWARD_RETURN_REVIEW_REPORT_ONLY");
    assert.equal(out.executed_summary, "Nothing executed. I can only report readiness and receipts.");
    assert.equal(out.boundary.task_executed, false);
  });
});

test("human output opens with the nothing-hidden line and cites verdict + receipts", async () => {
  await withDir(async (dir) => {
    const { contractFile, validationFile, receiptFile } = await writeTrio(dir, validContract());
    const r = await runCli([
      "away", "review",
      "--contract-file", contractFile,
      "--validation-file", validationFile,
      "--receipt-file", receiptFile,
      "--left", LEFT_ISO,
      "--returned", RETURNED_ISO,
    ]);
    assert.equal(r.code, 0, r.stderr);
    const lines = r.stdout.trim().split("\n");
    assert.match(lines[1] ?? "", /Nothing is hidden\. Every claim below is either receipt-backed or marked NO_RECEIPT\./);
    assert.match(r.stdout, /READY_BUT_NOT_STARTED/);
    assert.match(r.stdout, /receipts_seen: sha256:/);
    assert.match(r.stdout, /Nothing executed\./);
    assert.match(r.stdout, /Review only\. No Away Mode started\./);
  });
});

test("expiry inside the window reports EXPIRED_BEFORE_START, exit 0", async () => {
  await withDir(async (dir) => {
    const { contractFile, validationFile, receiptFile } = await writeTrio(dir, validContract());
    const r = await runCli([
      "away", "review",
      "--contract-file", contractFile,
      "--validation-file", validationFile,
      "--receipt-file", receiptFile,
      "--left", LEFT_ISO,
      "--returned", "2026-07-04T13:00:00.000Z",
      "--json",
    ]);
    assert.equal(r.code, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    assert.equal(out.final_verdict, "EXPIRED_BEFORE_START");
  });
});

test("REVIEW_BLOCKED (laundered contract) exits 1 with refused events", async () => {
  await withDir(async (dir) => {
    const { validationFile, receiptFile } = await writeTrio(dir, validContract());
    const drifted = validContract({ mission_scope: "docs-only PLUS push everything" });
    const driftedFile = join(dir, "drifted.json");
    writeFileSync(driftedFile, JSON.stringify(drifted));

    const r = await runCli([
      "away", "review",
      "--contract-file", driftedFile,
      "--validation-file", validationFile,
      "--receipt-file", receiptFile,
      "--left", LEFT_ISO,
      "--returned", RETURNED_ISO,
      "--json",
    ]);
    assert.equal(r.code, 1);
    const out = JSON.parse(r.stdout);
    assert.equal(out.final_verdict, "REVIEW_BLOCKED");
    assert.ok(out.refused_events.length > 0);
  });
});

test("missing window flags and invalid JSON fail closed", async () => {
  await withDir(async (dir) => {
    const { contractFile, validationFile, receiptFile } = await writeTrio(dir, validContract());

    const noLeft = await runCli([
      "away", "review",
      "--contract-file", contractFile,
      "--validation-file", validationFile,
      "--receipt-file", receiptFile,
      "--returned", RETURNED_ISO,
    ]);
    assert.equal(noLeft.code, 1);
    assert.match(noLeft.stderr, /--left/);

    const noReturned = await runCli([
      "away", "review",
      "--contract-file", contractFile,
      "--validation-file", validationFile,
      "--receipt-file", receiptFile,
      "--left", LEFT_ISO,
    ]);
    assert.equal(noReturned.code, 1);
    assert.match(noReturned.stderr, /--returned/);

    const bad = join(dir, "bad.json");
    writeFileSync(bad, "{ nope ");
    const invalid = await runCli([
      "away", "review",
      "--contract-file", bad,
      "--validation-file", validationFile,
      "--left", LEFT_ISO,
      "--returned", RETURNED_ISO,
    ]);
    assert.equal(invalid.code, 1);
    assert.match(invalid.stderr, /invalid JSON|invalid_json/i);
  });
});

test("review needs no DEMA_HOME; away start still fails closed naming all five rungs", async () => {
  await withDir(async (dir) => {
    const { contractFile, validationFile, receiptFile } = await writeTrio(dir, validContract());
    const fakeHome = join(dir, "never-created");
    const r = await runCli(
      [
        "away", "review",
        "--contract-file", contractFile,
        "--validation-file", validationFile,
        "--receipt-file", receiptFile,
        "--left", LEFT_ISO,
        "--returned", RETURNED_ISO,
        "--json",
      ],
      { DEMA_HOME: fakeHome },
    );
    assert.equal(r.code, 0, r.stderr);
  });

  const start = await runCli(["away", "start"]);
  assert.equal(start.code, 1);
  assert.match(start.stderr, /review/);
  assert.match(start.stderr, /nothing starts/);
});
