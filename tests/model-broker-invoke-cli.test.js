import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const cliPath = fileURLToPath(
  new URL("../apps/cli/src/index.js", import.meta.url),
);
const SAVE_CONSENT = "GO: save local model route receipt";

function runCli(args, { stdin = null, env = {}, timeout = 10000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = execFile(
      "node",
      [cliPath, ...args],
      {
        env: {
          ...process.env,
          DEMA_BANNER_INTERACTIVE: "0",
          NODE_ENV: "test",
          ...env,
        },
        timeout,
      },
      (err, stdout, stderr) => {
        if (err && err.killed) {
          reject(
            new Error(`Process timed out. stdout=${stdout} stderr=${stderr}`),
          );
          return;
        }
        resolve({ stdout, stderr, exitCode: err?.code ?? 0 });
      },
    );
    if (stdin !== null) child.stdin.write(stdin);
    child.stdin.end();
  });
}

async function makeDemaHome() {
  return mkdtemp(join(tmpdir(), "dema-invoke-cli-"));
}

// =============================================================================
// All tests in this file MUST exit non-zero BEFORE any real HTTP call. Tests do
// not depend on a running Ollama. Successful-invocation tests live in
// tests/routed-llm-invocation.test.js (in-process with fetchImpl mock).
// =============================================================================

test("'--invoke' without --save-receipt exits non-zero with durability requirement", async () => {
  const home = await makeDemaHome();
  const { stderr, exitCode } = await runCli(
    [
      "model-broker",
      "route",
      "--task",
      "synthesis",
      "--invoke",
      "--prompt",
      "x",
      "--invoke-consent",
      "phrase",
    ],
    { env: { DEMA_HOME: home } },
  );
  assert.notEqual(exitCode, 0);
  assert.match(stderr, /--invoke requires --save-receipt/);
  assert.match(stderr, /durability/i);
});

test("'--invoke --save-receipt' without --invoke-consent exits non-zero with helpful stderr", async () => {
  const home = await makeDemaHome();
  const { stderr, exitCode } = await runCli(
    [
      "model-broker",
      "route",
      "--task",
      "synthesis",
      "--save-receipt",
      "--consent",
      SAVE_CONSENT,
      "--invoke",
      "--prompt",
      "hello",
    ],
    { env: { DEMA_HOME: home } },
  );
  assert.notEqual(exitCode, 0);
  assert.match(stderr, /--invoke requires --invoke-consent/);
  assert.match(stderr, /GO: invoke local LLM at/);
});

test("'--invoke --save-receipt --invoke-consent <wrong>' fails at adapter consent gate (no real HTTP)", async () => {
  const home = await makeDemaHome();
  // Use --registry-stdin so we have a whitelisted model and isolate the
  // failure cleanly to the consent gate (vs whitelist gate).
  const fixture = JSON.stringify({
    entries: [
      {
        id: "llama3.1:8b",
        provider: "ollama",
        model_name: "llama3.1:8b",
        role: "dema_face",
        size_class: "7B",
        locality: "local",
        allowed_tasks: ["synthesis"],
        max_concurrency: 1,
        context_limit: 8192,
        status: "active",
      },
    ],
  });
  const { stdout, stderr, exitCode } = await runCli(
    [
      "model-broker",
      "route",
      "--task",
      "synthesis",
      "--registry-stdin",
      "--save-receipt",
      "--consent",
      SAVE_CONSENT,
      "--invoke",
      "--prompt",
      "hello",
      "--invoke-consent",
      "definitely wrong phrase",
    ],
    { env: { DEMA_HOME: home }, stdin: fixture },
  );
  assert.notEqual(exitCode, 0);
  // Envelope appears on stdout with failed invocation status.
  const envelope = JSON.parse(stdout);
  assert.equal(
    envelope.schema,
    "bizra.dema.local_model_routed_invocation_result.v0.1",
  );
  assert.equal(envelope.invocation_result.invocation_status, "failed");
  assert.match(
    envelope.invocation_result.error_reason,
    /consent_phrase_mismatch/,
  );
  // Save fired before invocation → stderr has the saved-receipt line.
  assert.match(stderr, /saved receipt to:/);
});

test("'--invoke' with missing --prompt exits non-zero", async () => {
  const home = await makeDemaHome();
  const { stderr, exitCode } = await runCli(
    [
      "model-broker",
      "route",
      "--task",
      "synthesis",
      "--save-receipt",
      "--consent",
      SAVE_CONSENT,
      "--invoke",
      "--invoke-consent",
      "GO: invoke local LLM at llama3.1:8b",
    ],
    { env: { DEMA_HOME: home } },
  );
  assert.notEqual(exitCode, 0);
  assert.match(stderr, /--invoke requires --prompt/);
});

test("'--invoke' with default placeholder registry fails closed (no selected_model_id; no real HTTP)", async () => {
  const home = await makeDemaHome();
  const { stdout, stderr, exitCode } = await runCli(
    [
      "model-broker",
      "route",
      "--task",
      "synthesis",
      "--save-receipt",
      "--consent",
      SAVE_CONSENT,
      "--invoke",
      "--prompt",
      "hello",
      "--invoke-consent",
      "GO: invoke local LLM at anything",
    ],
    { env: { DEMA_HOME: home } },
  );
  assert.notEqual(exitCode, 0);
  // Envelope reports null selection and null invocation_result.
  const envelope = JSON.parse(stdout);
  assert.equal(
    envelope.schema,
    "bizra.dema.local_model_routed_invocation_result.v0.1",
  );
  assert.equal(envelope.selected_model_id, null);
  assert.equal(envelope.invocation_result, null);
  // Save still fired with the saved-receipt stderr note.
  assert.match(stderr, /saved receipt to:/);
});

test("'--invoke' with multiple registry input flags still fails mutual exclusion (existing v0.2 invariant preserved)", async () => {
  const home = await makeDemaHome();
  const { stderr, exitCode } = await runCli(
    [
      "model-broker",
      "route",
      "--task",
      "synthesis",
      "--registry-stdin",
      "--use-local-registry",
      "--save-receipt",
      "--consent",
      SAVE_CONSENT,
      "--invoke",
      "--prompt",
      "hello",
      "--invoke-consent",
      "GO: invoke local LLM at llama3.1:8b",
    ],
    { env: { DEMA_HOME: home }, stdin: "{}" },
  );
  assert.notEqual(exitCode, 0);
  assert.match(stderr, /mutually exclusive/);
});
