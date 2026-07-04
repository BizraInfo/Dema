import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

import {
  ABSENCE_STEWARD_QUEUE_ITEM_SCHEMA,
  ABSENCE_STEWARD_QUEUE_SCHEMA_TRUTH_LABEL,
  absenceStewardQueueBoundary,
} from "../packages/core/src/absence-steward-queue-schema.js";

// ABSENCE-STEWARD-QUEUE-CLI-DRAFT-1A — `dema away queue draft` validates a
// proposal. It does not store it, approve it, execute it, or receipt it.

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(new URL("../apps/cli/src/index.js", import.meta.url));
const NOW_ISO = "2026-07-04T05:00:00.000Z";

function stable(v) {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object")
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(",")}}`;
  return JSON.stringify(v);
}

function withHash(body) {
  const { queue_item_hash, ...rest } = body;
  const normalized = {
    ...rest,
    allowed_by_contract: [...new Set(rest.allowed_by_contract)].sort(),
    forbidden_by_contract: [...new Set(rest.forbidden_by_contract)].sort(),
  };
  return {
    ...body,
    queue_item_hash:
      "sha256:" + createHash("sha256").update(stable(normalized), "utf8").digest("hex"),
  };
}

function validItem(overrides = {}) {
  return withHash({
    schema: ABSENCE_STEWARD_QUEUE_ITEM_SCHEMA,
    queue_item_id: "qitem-docs-refresh-0007",
    truth_label: ABSENCE_STEWARD_QUEUE_SCHEMA_TRUTH_LABEL,
    operator_id: "mumu",
    node_id: "NODE0",
    contract_id: "away-2026-07-04-0101",
    contract_hash: `sha256:${"a".repeat(64)}`,
    readiness_report_hash: `sha256:${"b".repeat(64)}`,
    return_review_requirement: true,
    proposed_action_class: "DOCS_ONLY",
    proposed_action_summary: "refresh stale TESTING rows",
    proposed_inputs_summary: "docs/TESTING.md",
    required_human_decision: true,
    allowed_by_contract: ["READ_ONLY", "DOCS_ONLY"],
    forbidden_by_contract: ["PUSH_ALLOWED", "MODEL_ALLOWED"],
    status: "PROPOSED",
    created_at: "2026-07-04T04:00:00.000Z",
    expires_at: "2026-07-04T12:00:00.000Z",
    boundary: absenceStewardQueueBoundary(),
    ...overrides,
  });
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
  const dir = mkdtempSync(join(tmpdir(), "away-queue-cli-"));
  return Promise.resolve(fn(dir)).finally(() =>
    rmSync(dir, { recursive: true, force: true }),
  );
}

test("valid item + --json emits validation result, exit 0", async () => {
  await withDir(async (dir) => {
    const file = join(dir, "item.json");
    writeFileSync(file, JSON.stringify(validItem()));
    const r = await runCli(["away", "queue", "draft", "--item-file", file, "--now", NOW_ISO, "--json"]);
    assert.equal(r.code, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    assert.equal(out.valid, true);
    assert.equal(out.truth_label, ABSENCE_STEWARD_QUEUE_SCHEMA_TRUTH_LABEL);
    assert.match(out.item_hash, /^sha256:[a-f0-9]{64}$/);
  });
});

test("human output states validation only, no queue stored, no approval, no execution", async () => {
  await withDir(async (dir) => {
    const file = join(dir, "item.json");
    writeFileSync(file, JSON.stringify(validItem()));
    const r = await runCli(["away", "queue", "draft", "--item-file", file, "--now", NOW_ISO]);
    assert.equal(r.code, 0, r.stderr);
    assert.match(r.stdout, /ABSENCE STEWARD QUEUE DRAFT — VALIDATION ONLY/);
    assert.match(r.stdout, /ABSENCE_STEWARD_QUEUE_CLI_DRAFT_ONLY/);
    assert.match(r.stdout, /qitem-docs-refresh-0007/);
    assert.match(r.stdout, /Draft only\. No queue stored\. No approval\. No execution\./);
  });
});

test("missing flags and invalid JSON fail closed", async () => {
  const noFile = await runCli(["away", "queue", "draft", "--now", NOW_ISO]);
  assert.equal(noFile.code, 1);
  assert.match(noFile.stderr, /--item-file/);

  await withDir(async (dir) => {
    const file = join(dir, "item.json");
    writeFileSync(file, JSON.stringify(validItem()));
    const noNow = await runCli(["away", "queue", "draft", "--item-file", file]);
    assert.equal(noNow.code, 1);
    assert.match(noNow.stderr, /--now/);

    const bad = join(dir, "bad.json");
    writeFileSync(bad, "{ nope ");
    const invalid = await runCli(["away", "queue", "draft", "--item-file", bad, "--now", NOW_ISO]);
    assert.equal(invalid.code, 1);
    assert.match(invalid.stderr, /invalid JSON|invalid_json/i);
  });
});

test("invalid items fail exit 1 with blocked_by: EXECUTING, consent_granted, expired PROPOSED", async () => {
  await withDir(async (dir) => {
    const cases = [
      [validItem({ status: "EXECUTING" }), NOW_ISO, "status_not_allowed"],
      [validItem({ consent_granted: true }), NOW_ISO, "consent_field_forbidden"],
      [validItem(), "2026-07-04T13:00:00.000Z", "expired_item_must_carry_expired_status"],
    ];
    for (const [item, now, code] of cases) {
      const file = join(dir, "case.json");
      writeFileSync(file, JSON.stringify(item));
      const r = await runCli(["away", "queue", "draft", "--item-file", file, "--now", now, "--json"]);
      assert.equal(r.code, 1, code);
      const out = JSON.parse(r.stdout);
      assert.equal(out.valid, false);
      assert.ok(out.blocked_by.includes(code), `${code}: got ${out.blocked_by}`);
    }
  });
});

test("no DEMA_HOME needed; no directories created", async () => {
  await withDir(async (dir) => {
    const file = join(dir, "item.json");
    writeFileSync(file, JSON.stringify(validItem()));
    const fakeHome = join(dir, "never-created");
    const r = await runCli(
      ["away", "queue", "draft", "--item-file", file, "--now", NOW_ISO, "--json"],
      { DEMA_HOME: fakeHome },
    );
    assert.equal(r.code, 0, r.stderr);
    assert.equal(existsSync(fakeHome), false);
  });
});

test("unknown away queue subcommand and away start both fail closed", async () => {
  const badSub = await runCli(["away", "queue", "run"]);
  assert.equal(badSub.code, 1);
  assert.match(badSub.stderr, /draft/);
  assert.doesNotMatch(badSub.stderr, /started/i);

  const start = await runCli(["away", "start"]);
  assert.equal(start.code, 1);
  assert.match(start.stderr, /nothing starts/);
});

test("CLI source never reaches the queue receipt writer", () => {
  const source = readFileSync(
    new URL("../apps/cli/src/commands/away.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /writeAbsenceStewardQueueReceipt|absence-steward-queue-receipt/);
});
