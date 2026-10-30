import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const CLI = join(REPO_ROOT, "apps/cli/src/index.js");
const SCHEMA = "bizra.dema.peak_self_loop_preview.v0.1";

function freshHome() {
  return mkdtempSync(join(tmpdir(), "dema-pslcli-"));
}

function runCLI(args, home) {
  return execFileSync("node", [CLI, ...args], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      NO_COLOR: "1",
      NODE_ENV: "test",
      DEMA_NO_TUI: "1",
      DEMA_HOME: home,
    },
    timeout: 15000,
  }).toString();
}

test("dema peak-self-loop --json emits schema-tagged frozen preview", () => {
  const env = JSON.parse(runCLI(["peak-self-loop", "--json"], freshHome()));
  assert.equal(env.schema, SCHEMA);
  assert.equal(env.mode, "preview_only");
  assert.ok(env.snr_framework.score >= 0);
  assert.ok(env.proactive_self.harness.active_gates.length >= 1);
  for (const [k, v] of Object.entries(env.boundary)) {
    assert.equal(v, false, `boundary.${k} must be false`);
  }
});

test("CLI refuses hash-matched source code as a passed-gate signal", () => {
  const source_ref = "tests/peak-self-loop-cli.test.js";
  const bytes = readFileSync(join(REPO_ROOT, source_ref));
  const event = {
    id: "fake-gate",
    type: "gate_passed",
    weight: 99,
    label: "caller claimed a passed gate",
    truth_label: "MEASURED",
    source_ref,
    source_sha256: createHash("sha256").update(bytes).digest("hex"),
  };
  const home = freshHome();
  let failure;
  try {
    runCLI(
      [
        "peak-self-loop",
        "--json",
        `--signal-events-json=${JSON.stringify([event])}`,
      ],
      home,
    );
  } catch (error) {
    failure = error;
  }

  assert.ok(failure);
  assert.equal(failure.status, 1);
  const env = JSON.parse(failure.stdout.toString());
  assert.equal(env.caller_evidence_binding.complete, false);
  assert.equal(env.caller_evidence_binding.admitted_count, 0);
  assert.equal(
    env.caller_evidence_binding.rejected[0].reason,
    "gate_receipt_json_required",
  );
  assert.equal(env.snr_framework.verified_signal_count, 0);
  assert.equal(env.autonomous_rsi.merged_verdict, "HOLD_AND_REDUCE_NOISE");
  assert.deepEqual(readdirSync(home), []);
});

test("dema realm proof-studio --json routes to peak self-loop preview", () => {
  const env = JSON.parse(
    runCLI(["realm", "proof-studio", "--json"], freshHome()),
  );
  assert.equal(env.schema, SCHEMA);
  assert.equal(env.autonomous_rsi.not_autonomous_runtime, true);
});

test("dema realm go 5 --json dispatches to proof studio", () => {
  const env = JSON.parse(runCLI(["realm", "go", "5", "--json"], freshHome()));
  assert.equal(env.schema, SCHEMA);
});

test("dema peak-self-loop --spin-steps-json classifies OK:VERIFIED on converging steps", () => {
  const steps = [
    { context: { done: 0 }, action: { do: "read" } },
    { context: { done: 1 }, action: { do: "edit" }, verified: true },
  ];
  const env = JSON.parse(
    runCLI(
      [
        "peak-self-loop",
        "--json",
        `--spin-steps-json=${JSON.stringify(steps)}`,
      ],
      freshHome(),
    ),
  );
  assert.equal(env.zero_spin.status, "VERIFIED_PROGRESS");
  assert.equal(env.zero_spin.classification, "OK:VERIFIED");
  assert.equal(env.proactive_self.zero_spin.progress_verified, true);
});

test("dema peak-self-loop --spin-steps-json refuses malformed JSON", () => {
  const home = freshHome();
  let failure;
  try {
    runCLI(["peak-self-loop", "--json", "--spin-steps-json={not-json"], home);
  } catch (error) {
    failure = error;
  }
  assert.ok(failure);
  assert.equal(failure.status, 1);
});

test("dema peak-self-loop trailing --spin-steps-json without value exits 1", () => {
  const home = freshHome();
  let failure;
  try {
    runCLI(["peak-self-loop", "--json", "--spin-steps-json"], home);
  } catch (error) {
    failure = error;
  }
  assert.ok(failure, "trailing flag must not silently become NOT_SUPPLIED");
  assert.equal(failure.status, 1);
});

test("dema peak-self-loop writes nothing to DEMA_HOME", () => {
  const home = freshHome();
  const before = readdirSync(home).sort();
  runCLI(["peak-self-loop", "--json"], home);
  const after = readdirSync(home).sort();
  assert.deepEqual(after, before);
  assert.deepEqual(after, []);
});
