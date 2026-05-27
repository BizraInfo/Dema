import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const cliPath = fileURLToPath(
  new URL("../apps/cli/src/index.js", import.meta.url),
);
const SAVE_RECEIPT_CONSENT = "GO: save local model route receipt";
const SAVE_INVOCATION_CONSENT = "GO: save local model invocation result";

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
  return mkdtemp(join(tmpdir(), "dema-invocation-save-"));
}

// All tests in this file exercise paths that DO NOT call a real Ollama. The
// invocation envelope is always produced (even on failure), and saving it to
// disk has no network side-effect. Successful real-model invocation tests
// live in tests/routed-llm-invocation.test.js with fetchImpl mock.

// Common args that bring us through route → save → invoke and produce an
// envelope (even when invocation fails downstream). Uses the default
// placeholder registry which routes nothing — envelope.invocation_result
// will be null. Saving still works because the envelope itself is well-formed.
function placeholderInvokeArgs() {
  return [
    "model-broker",
    "route",
    "--task",
    "synthesis",
    "--save-receipt",
    "--consent",
    SAVE_RECEIPT_CONSENT,
    "--invoke",
    "--prompt",
    "hello",
    "--invoke-consent",
    "GO: invoke local LLM at anything",
  ];
}

test("'--save-invocation-result' with valid consent writes file under $DEMA_HOME/receipts/invocation-<hash>.json", async () => {
  const home = await makeDemaHome();
  const { exitCode } = await runCli(
    [
      ...placeholderInvokeArgs(),
      "--save-invocation-result",
      "--save-invocation-consent",
      SAVE_INVOCATION_CONSENT,
    ],
    { env: { DEMA_HOME: home } },
  );
  // Exit code may be non-zero because the underlying invocation has no
  // selected model (placeholder discipline); save still happens.
  assert.notEqual(exitCode, 0);
  const files = await readdir(join(home, "receipts"));
  const invocationFiles = files.filter(
    (f) => f.startsWith("invocation-") && f.endsWith(".json"),
  );
  assert.equal(
    invocationFiles.length,
    1,
    `expected 1 invocation file; got ${invocationFiles.length}: ${files.join(",")}`,
  );
  assert.match(invocationFiles[0], /^invocation-[a-f0-9]{64}\.json$/);
});

test("'--save-invocation-result' without --save-invocation-consent exits non-zero and names required phrase", async () => {
  const home = await makeDemaHome();
  const { stderr, exitCode } = await runCli(
    [...placeholderInvokeArgs(), "--save-invocation-result"],
    { env: { DEMA_HOME: home } },
  );
  assert.notEqual(exitCode, 0);
  assert.match(stderr, /requires --save-invocation-consent/);
  assert.match(stderr, /GO: save local model invocation result/);
});

test("'--save-invocation-result' with wrong consent exits non-zero with consent_mismatch", async () => {
  const home = await makeDemaHome();
  const { stderr, exitCode } = await runCli(
    [
      ...placeholderInvokeArgs(),
      "--save-invocation-result",
      "--save-invocation-consent",
      "wrong phrase",
    ],
    { env: { DEMA_HOME: home } },
  );
  assert.notEqual(exitCode, 0);
  assert.match(stderr, /consent phrase mismatch/);
});

test("with valid consent, stdout still emits parseable envelope JSON (unchanged behavior)", async () => {
  const home = await makeDemaHome();
  const { stdout } = await runCli(
    [
      ...placeholderInvokeArgs(),
      "--save-invocation-result",
      "--save-invocation-consent",
      SAVE_INVOCATION_CONSENT,
    ],
    { env: { DEMA_HOME: home } },
  );
  const envelope = JSON.parse(stdout);
  assert.equal(
    envelope.schema,
    "bizra.dema.local_model_routed_invocation_result.v0.1",
  );
});

test("with valid consent, saved invocation file matches stdout byte-for-byte", async () => {
  const home = await makeDemaHome();
  const { stdout } = await runCli(
    [
      ...placeholderInvokeArgs(),
      "--save-invocation-result",
      "--save-invocation-consent",
      SAVE_INVOCATION_CONSENT,
    ],
    { env: { DEMA_HOME: home } },
  );
  const files = await readdir(join(home, "receipts"));
  const invocationFile = files.find(
    (f) => f.startsWith("invocation-") && f.endsWith(".json"),
  );
  assert.ok(invocationFile, "expected invocation file");
  const onDisk = await readFile(join(home, "receipts", invocationFile), "utf8");
  assert.equal(onDisk, stdout, "on-disk file must match stdout byte-for-byte");
  // Verify content-addressed filename: sha256 of bytes = the hash in the filename.
  const expectedSha = createHash("sha256").update(onDisk).digest("hex");
  assert.equal(invocationFile, `invocation-${expectedSha}.json`);
});

test("with valid consent, stderr contains 'saved invocation result to:' info line", async () => {
  const home = await makeDemaHome();
  const { stderr } = await runCli(
    [
      ...placeholderInvokeArgs(),
      "--save-invocation-result",
      "--save-invocation-consent",
      SAVE_INVOCATION_CONSENT,
    ],
    { env: { DEMA_HOME: home } },
  );
  assert.match(stderr, /saved invocation result to:/);
  assert.match(stderr, new RegExp(home.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("failed invocation envelope is STILL saved (auditability for both success and failure)", async () => {
  // Use --registry-stdin with a whitelisted model, then mismatched invoke
  // consent → adapter fails at gate 4 → envelope contains invocation_result
  // with invocation_status=failed. Save must still capture it.
  const home = await makeDemaHome();
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
  const { stdout, exitCode } = await runCli(
    [
      "model-broker",
      "route",
      "--task",
      "synthesis",
      "--registry-stdin",
      "--save-receipt",
      "--consent",
      SAVE_RECEIPT_CONSENT,
      "--invoke",
      "--prompt",
      "hello",
      "--invoke-consent",
      "definitely wrong phrase",
      "--save-invocation-result",
      "--save-invocation-consent",
      SAVE_INVOCATION_CONSENT,
    ],
    { env: { DEMA_HOME: home }, stdin: fixture },
  );
  assert.notEqual(exitCode, 0);
  // Envelope reports failed invocation.
  const envelope = JSON.parse(stdout);
  assert.equal(envelope.invocation_result.invocation_status, "failed");
  assert.match(
    envelope.invocation_result.error_reason,
    /consent_phrase_mismatch/,
  );
  // Invocation file is STILL written (auditability).
  const files = await readdir(join(home, "receipts"));
  const invocationFile = files.find(
    (f) => f.startsWith("invocation-") && f.endsWith(".json"),
  );
  assert.ok(invocationFile, "failed invocation envelope must still be saved");
  // Saved content includes the failure reason.
  const onDisk = JSON.parse(
    await readFile(join(home, "receipts", invocationFile), "utf8"),
  );
  assert.equal(onDisk.invocation_result.invocation_status, "failed");
});

test("no --save-invocation-result flag means no invocation-*.json file is written", async () => {
  const home = await makeDemaHome();
  const { exitCode } = await runCli(placeholderInvokeArgs(), {
    env: { DEMA_HOME: home },
  });
  // Non-zero because placeholder has no selected model.
  assert.notEqual(exitCode, 0);
  // receipts/ may exist (route receipt was saved by --save-receipt), but no
  // invocation-* file should be present.
  if (existsSync(join(home, "receipts"))) {
    const files = await readdir(join(home, "receipts"));
    const invocationFiles = files.filter((f) => f.startsWith("invocation-"));
    assert.equal(
      invocationFiles.length,
      0,
      "no invocation-* file should exist without --save-invocation-result",
    );
  }
});

test("saved invocation envelope preserves 9-key boundary structure unchanged", async () => {
  const home = await makeDemaHome();
  await runCli(
    [
      ...placeholderInvokeArgs(),
      "--save-invocation-result",
      "--save-invocation-consent",
      SAVE_INVOCATION_CONSENT,
    ],
    { env: { DEMA_HOME: home } },
  );
  const files = await readdir(join(home, "receipts"));
  const invocationFile = files.find((f) => f.startsWith("invocation-"));
  const onDisk = JSON.parse(
    await readFile(join(home, "receipts", invocationFile), "utf8"),
  );
  // 9-key envelope boundary.
  const boundaryKeys = Object.keys(onDisk.boundary).sort();
  assert.deepEqual(boundaryKeys, [
    "federation",
    "localhost_only",
    "mint",
    "model_invocation",
    "network_used",
    "remote_provider",
    "runtime",
    "token_economy",
    "urp_networking",
  ]);
  // Placeholder route → no selection → no invocation → all "active" flags false.
  assert.equal(onDisk.boundary.runtime, true); // bridge code ran
  assert.equal(onDisk.boundary.model_invocation, false);
  assert.equal(onDisk.boundary.network_used, false);
  assert.equal(onDisk.boundary.federation, false);
  assert.equal(onDisk.boundary.mint, false);
  assert.equal(onDisk.boundary.token_economy, false);
  assert.equal(onDisk.boundary.urp_networking, false);
  assert.equal(onDisk.boundary.localhost_only, true);
  assert.equal(onDisk.boundary.remote_provider, false);
});

test("re-running the same invocation creates content-addressed files; timestamps make each envelope unique", async () => {
  const home = await makeDemaHome();
  const r1 = await runCli(
    [
      ...placeholderInvokeArgs(),
      "--save-invocation-result",
      "--save-invocation-consent",
      SAVE_INVOCATION_CONSENT,
    ],
    { env: { DEMA_HOME: home } },
  );
  await new Promise((res) => setTimeout(res, 10));
  const r2 = await runCli(
    [
      ...placeholderInvokeArgs(),
      "--save-invocation-result",
      "--save-invocation-consent",
      SAVE_INVOCATION_CONSENT,
    ],
    { env: { DEMA_HOME: home } },
  );
  // Both runs produce envelopes (and both are non-zero due to placeholder).
  assert.notEqual(r1.exitCode, 0);
  assert.notEqual(r2.exitCode, 0);
  const files = await readdir(join(home, "receipts"));
  const invocationFiles = files
    .filter((f) => f.startsWith("invocation-") && f.endsWith(".json"))
    .sort();
  assert.equal(
    invocationFiles.length,
    2,
    `expected 2 distinct invocation files (timestamps differ); got ${invocationFiles.length}`,
  );
  assert.notEqual(invocationFiles[0], invocationFiles[1]);
  // Each filename matches its file's sha256.
  for (const f of invocationFiles) {
    const onDisk = await readFile(join(home, "receipts", f), "utf8");
    const sha = createHash("sha256").update(onDisk).digest("hex");
    assert.equal(f, `invocation-${sha}.json`);
  }
});

test("'--save-invocation-result' without --invoke exits non-zero (no envelope to save)", async () => {
  const home = await makeDemaHome();
  const { stderr, exitCode } = await runCli(
    [
      "model-broker",
      "route",
      "--task",
      "synthesis",
      "--save-receipt",
      "--consent",
      SAVE_RECEIPT_CONSENT,
      "--save-invocation-result",
      "--save-invocation-consent",
      SAVE_INVOCATION_CONSENT,
    ],
    { env: { DEMA_HOME: home } },
  );
  assert.notEqual(exitCode, 0);
  assert.match(stderr, /--save-invocation-result requires --invoke/);
});
