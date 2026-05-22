import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import {
  PROOF_ROOM_BUNDLE_SCHEMA,
  PROOF_ROOM_WRITE_CONSENT,
  CORE_PROOF_ROOM_GATES,
  buildProofRoomBundle,
  evaluateProofRoomWrite,
  formatProofRoomReport,
  parseTapSummary,
  readJsonOk
} from "../packages/core/src/proof-room-bundle.js";

const execFileAsync = promisify(execFile);
const scriptPath = fileURLToPath(new URL("../scripts/proof-room-bundle.mjs", import.meta.url));

test("evaluateProofRoomWrite requires exact micro-consent phrase", () => {
  const deny = evaluateProofRoomWrite({ consent_phrase: "GO: write something else" });
  assert.equal(deny.allowed, false);
  assert.ok(deny.violations.some((v) => v.code === "consent_phrase_mismatch"));

  const allow = evaluateProofRoomWrite({ consent_phrase: PROOF_ROOM_WRITE_CONSENT });
  assert.equal(allow.allowed, true);
  assert.equal(allow.filesystem_write_performed, false);
});

test("parseTapSummary and readJsonOk helpers", () => {
  const tap = parseTapSummary("# tests 10\n# pass 10\n# fail 0\n");
  assert.equal(tap.ok, true);
  assert.equal(tap.total, 10);

  assert.equal(readJsonOk('{"ok":true}'), true);
  assert.equal(readJsonOk('{"ok":false}'), false);
});

test("buildProofRoomBundle composes mocked gates", async () => {
  const run = async ({ gate }) => ({
    id: gate.id,
    command: gate.argv.join(" "),
    exit_code: 0,
    ok: true,
    stdout_sha256: "abc",
    stdout_bytes: 3,
    summary: gate.id === "npm_test" ? { pass: 2437, fail: 0, total: 2437, ok: true } : { json_ok: true },
    error: null,
    duration_ms: 1
  });

  const report = await buildProofRoomBundle({
    root: "/tmp/dema",
    full: true,
    run
  });

  assert.equal(report.schema, PROOF_ROOM_BUNDLE_SCHEMA);
  assert.equal(report.ok, true);
  assert.equal(report.gates.length, CORE_PROOF_ROOM_GATES.length + 1);
  assert.equal(report.boundary.runtime_execution_performed, false);
  assert.equal(report.boundary.receipt_mint_performed, false);
  assert.match(report.self_harness.replay_command, /proof:room/);
});

test("buildProofRoomBundle fails closed when a mocked gate fails", async () => {
  const run = async ({ gate }) => ({
    id: gate.id,
    command: gate.argv.join(" "),
    exit_code: 1,
    ok: false,
    stdout_sha256: "dead",
    stdout_bytes: 4,
    summary: null,
    error: "simulated failure",
    duration_ms: 1
  });

  const report = await buildProofRoomBundle({ root: "/tmp/dema", run });
  assert.equal(report.ok, false);
  assert.ok(report.self_harness.self_critique.some((line) => line.includes("do not publish")));
});

test("formatProofRoomReport renders human summary", async () => {
  const report = await buildProofRoomBundle({
    root: "/tmp/dema",
    run: async ({ gate }) => ({
      id: gate.id,
      command: "node test",
      exit_code: 0,
      ok: true,
      stdout_sha256: "x",
      stdout_bytes: 1,
      summary: null,
      error: null,
      duration_ms: 2
    })
  });
  const text = formatProofRoomReport(report);
  assert.match(text, /DEMA Proof Room Bundle/);
  assert.match(text, /PASS/);
});

test("proof-room-bundle CLI --json exits 0 on current repo", async () => {
  const { stdout } = await execFileAsync(process.execPath, [scriptPath, "--json"], {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
    timeout: 300_000
  });
  const report = JSON.parse(stdout);
  assert.equal(report.schema, PROOF_ROOM_BUNDLE_SCHEMA);
  assert.equal(report.ok, true);
});
