import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import {
  PROOF_ROOM_BUNDLE_SCHEMA,
  PROOF_ROOM_WRITE_CONSENT,
  PROOF_ROOM_PUBLIC_SAFE_WRITE_CONSENT,
  PROOF_ROOM_PUBLIC_SAFE_ARTIFACT_RELATIVE_DIR,
  REDACTED_REPO_ROOT_PLACEHOLDER,
  CORE_PROOF_ROOM_GATES,
  buildProofRoomBundle,
  evaluateProofRoomWrite,
  evaluateGateOk,
  formatProofRoomReport,
  parseTapSummary,
  readJsonOk,
  redactProofRoomBundle,
} from "../packages/core/src/proof-room-bundle.js";
import { evaluateArtifactSafety } from "../packages/core/src/artifact-safety-eval.js";

const execFileAsync = promisify(execFile);
const scriptPath = fileURLToPath(
  new URL("../scripts/proof-room-bundle.mjs", import.meta.url),
);
test("evaluateProofRoomWrite requires exact micro-consent phrase", () => {
  const deny = evaluateProofRoomWrite({
    consent_phrase: "GO: write something else",
  });
  assert.equal(deny.allowed, false);
  assert.ok(deny.violations.some((v) => v.code === "consent_phrase_mismatch"));

  const allow = evaluateProofRoomWrite({
    consent_phrase: PROOF_ROOM_WRITE_CONSENT,
  });
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

test("release readiness gate accepts only the coverage-threshold advisory risk", () => {
  const gate = CORE_PROOF_ROOM_GATES.find((item) => item.id === "release_readiness");
  const advisory = evaluateGateOk(
    JSON.stringify({
      readiness_score: 97,
      risks: [{ code: "qa.coverage_threshold_missing" }],
    }),
    gate,
  );
  assert.equal(advisory.ok, true);
  assert.deepEqual(advisory.summary.unallowed_risk_codes, []);

  const unrelated = evaluateGateOk(
    JSON.stringify({
      readiness_score: 97,
      risks: [{ code: "ci.actions_not_sha_pinned" }],
    }),
    gate,
  );
  assert.equal(unrelated.ok, false);
  assert.deepEqual(unrelated.summary.unallowed_risk_codes, [
    "ci.actions_not_sha_pinned",
  ]);
});

test("buildProofRoomBundle composes mocked gates", async () => {
  const run = async ({ gate }) => ({
    id: gate.id,
    command: gate.argv.join(" "),
    exit_code: 0,
    ok: true,
    stdout_sha256: "abc",
    stdout_bytes: 3,
    summary:
      gate.id === "npm_test"
        ? { pass: 2437, fail: 0, total: 2437, ok: true }
        : { json_ok: true },
    error: null,
    duration_ms: 1,
  });

  const report = await buildProofRoomBundle({
    root: "/tmp/dema",
    full: true,
    run,
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
    duration_ms: 1,
  });

  const report = await buildProofRoomBundle({ root: "/tmp/dema", run });
  assert.equal(report.ok, false);
  assert.ok(
    report.self_harness.self_critique.some((line) =>
      line.includes("do not publish"),
    ),
  );
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
      duration_ms: 2,
    }),
  });
  const text = formatProofRoomReport(report);
  assert.match(text, /DEMA Proof Room Bundle/);
  assert.match(text, /PASS/);
});

test("proof-room-bundle CLI --json exits 0 on current repo", async () => {
  const { stdout } = await execFileAsync(
    process.execPath,
    [scriptPath, "--json"],
    {
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
      timeout: 300_000,
    },
  );
  const report = JSON.parse(stdout);
  assert.equal(report.schema, PROOF_ROOM_BUNDLE_SCHEMA);
  assert.equal(report.ok, true);
});

test("redactProofRoomBundle scrubs repo_root + emits basename + sha256", () => {
  const original = {
    schema: PROOF_ROOM_BUNDLE_SCHEMA,
    mode: "PROOF_ROOM_CORE",
    truth_label: "MEASURED",
    ok: true,
    generated_at: "2026-05-23T06:00:00.000Z",
    repo_root: "/home/operator/Downloads/Dema",
    gates: [],
    self_harness: {
      gates_run: 0,
      gates_passed: 0,
      gates_failed: 0,
      failed_gate_ids: [],
      replay_command: "x",
      full_replay_command: "y",
      micro_consent_write: "z",
      self_critique: [],
    },
    boundary: {},
    next_safe_action: "x",
  };
  const redacted = redactProofRoomBundle(original);
  assert.equal(redacted.repo_root, REDACTED_REPO_ROOT_PLACEHOLDER);
  assert.equal(redacted.repo_root_basename, "Dema");
  assert.match(redacted.repo_root_sha256, /^[0-9a-f]{64}$/);
  assert.equal(redacted.redacted, true);
  assert.equal(redacted.truth_label, "PUBLIC_SAFE");
  assert.equal(
    original.repo_root,
    "/home/operator/Downloads/Dema",
    "input must not be mutated",
  );
});

test("redactProofRoomBundle never publishes an operator worktree basename", () => {
  const original = {
    schema: PROOF_ROOM_BUNDLE_SCHEMA,
    mode: "PROOF_ROOM_CORE",
    truth_label: "MEASURED",
    ok: true,
    generated_at: "2026-07-19T00:00:00.000Z",
    repo_root: "/MOUNT/private-client-worktree-7a",
    gates: [],
    self_harness: {
      gates_run: 0,
      gates_passed: 0,
      gates_failed: 0,
      failed_gate_ids: [],
      replay_command: "x",
      full_replay_command: "y",
      micro_consent_write: "z",
      self_critique: [],
    },
    boundary: {},
    next_safe_action: "x",
  };

  const redacted = redactProofRoomBundle(original);

  assert.equal(redacted.repo_root_basename, "Dema");
  assert.doesNotMatch(JSON.stringify(redacted), /private-client-worktree-7a/);
});

test("redactProofRoomBundle is idempotent", () => {
  const original = {
    schema: PROOF_ROOM_BUNDLE_SCHEMA,
    truth_label: "MEASURED",
    ok: true,
    repo_root: "/tmp/x",
    gates: [],
    self_harness: {
      gates_run: 0,
      gates_passed: 0,
      gates_failed: 0,
      failed_gate_ids: [],
      replay_command: "x",
      full_replay_command: "y",
      micro_consent_write: "z",
      self_critique: [],
    },
    boundary: {},
  };
  const once = redactProofRoomBundle(original);
  const twice = redactProofRoomBundle(once);
  assert.equal(twice.repo_root, REDACTED_REPO_ROOT_PLACEHOLDER);
  assert.equal(twice.repo_root_sha256, once.repo_root_sha256);
  assert.strictEqual(twice, once, "second call must return same frozen object");
});

test("redacted bundle passes Layer 1 artifact-safety eval as PUBLIC_SAFE", () => {
  const bundle = {
    schema: PROOF_ROOM_BUNDLE_SCHEMA,
    mode: "PROOF_ROOM_CORE",
    truth_label: "MEASURED",
    ok: true,
    repo_root: "/home/operator/Downloads/Dema",
    gates: [],
    self_harness: {
      gates_run: 0,
      gates_passed: 0,
      gates_failed: 0,
      failed_gate_ids: [],
      replay_command: "npm run proof:room",
      full_replay_command: "npm run proof:room -- --full",
      micro_consent_write: PROOF_ROOM_WRITE_CONSENT,
      self_critique: ["safe"],
    },
    boundary: {
      read_only: true,
      runtime_execution_performed: false,
      receipt_mint_performed: false,
      network_used: false,
      federation_invoked: false,
    },
  };
  const redacted = redactProofRoomBundle(bundle);
  const eval1 = evaluateArtifactSafety(JSON.stringify(redacted, null, 2));
  assert.equal(
    eval1.verdict,
    "PUBLIC_SAFE",
    `got ${eval1.verdict}; findings: ${JSON.stringify(eval1.findings)}`,
  );
  assert.equal(eval1.score, 1);
});

test("evaluateProofRoomWrite accepts public-safe required_phrase override", () => {
  const accepted = evaluateProofRoomWrite({
    consent_phrase: PROOF_ROOM_PUBLIC_SAFE_WRITE_CONSENT,
    required_phrase: PROOF_ROOM_PUBLIC_SAFE_WRITE_CONSENT,
  });
  assert.equal(accepted.allowed, true);
  assert.equal(
    accepted.consent_phrase_required,
    PROOF_ROOM_PUBLIC_SAFE_WRITE_CONSENT,
  );

  // Default required_phrase must still be the non-public-safe one (back-compat).
  const refused = evaluateProofRoomWrite({
    consent_phrase: PROOF_ROOM_PUBLIC_SAFE_WRITE_CONSENT,
  });
  assert.equal(refused.allowed, false);
});

test("proof-room-bundle CLI --public-safe --json emits redacted bundle", async () => {
  const { stdout } = await execFileAsync(
    process.execPath,
    [scriptPath, "--public-safe", "--json"],
    {
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
      timeout: 300_000,
    },
  );
  const report = JSON.parse(stdout);
  assert.equal(report.redacted, true);
  assert.equal(report.repo_root, REDACTED_REPO_ROOT_PLACEHOLDER);
  assert.equal(report.repo_root_basename, "Dema");
  assert.match(report.repo_root_sha256, /^[0-9a-f]{64}$/);
  // Verify the rendered JSON passes Layer 1 artifact-safety eval.
  const safety = evaluateArtifactSafety(stdout);
  assert.equal(
    safety.verdict,
    "PUBLIC_SAFE",
    `findings: ${JSON.stringify(safety.findings)}`,
  );
});

test("formatProofRoomReport flags redacted bundle in header", async () => {
  const bundle = await buildProofRoomBundle({
    root: "/tmp/dema",
    run: async ({ gate }) => ({
      id: gate.id,
      command: "node x",
      exit_code: 0,
      ok: true,
      stdout_sha256: "x",
      stdout_bytes: 1,
      summary: null,
      error: null,
      duration_ms: 1,
    }),
  });
  const redacted = redactProofRoomBundle(bundle);
  const text = formatProofRoomReport(redacted);
  assert.match(text, /Redacted: true/);
  assert.match(text, /repo_root_basename=dema/i);
});

test("PROOF_ROOM_PUBLIC_SAFE_ARTIFACT_RELATIVE_DIR is the parallel public-safe dir", () => {
  assert.equal(
    PROOF_ROOM_PUBLIC_SAFE_ARTIFACT_RELATIVE_DIR,
    "artifacts/proofs/proof-room-v0.1-public-safe",
  );
});
