import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const cliPath = fileURLToPath(
  new URL("../apps/cli/src/index.js", import.meta.url),
);

function runCli(args, { env = {}, timeout = 10000 } = {}) {
  return new Promise((resolve, reject) => {
    execFile(
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
  });
}

async function makeDemaHomeWithEnvelope(envelope) {
  const home = await mkdtemp(join(tmpdir(), "dema-verify-cli-"));
  await mkdir(join(home, "receipts"), { recursive: true });
  // Filename can be any invocation-*.json shape; sha256 not required for tests
  // because the verifier reads content, not the filename.
  const path = join(home, "receipts", "invocation-deadbeefcafebabe.json");
  await writeFile(path, JSON.stringify(envelope) + "\n");
  return { home, path };
}

function compliantEnvelope() {
  return {
    schema: "bizra.dema.local_model_routed_invocation_result.v0.1",
    route_receipt: {
      schema: "bizra.dema.local_model_route_receipt.v0.1",
      timestamp: "2026-05-21T13:00:00.000Z",
      task_kind: "synthesis",
      selected_model_id: "llama3.1:8b",
      selected_model_role: "dema_face",
      selected_model_locality: "local",
    },
    selected_model_id: "llama3.1:8b",
    invocation_result: {
      invocation_status: "completed",
      error_reason: null,
      model_invoked: "llama3.1:8b",
      response_length_chars: 11,
      response_text_preview: "hello world",
    },
    boundary: {
      runtime: true,
      model_invocation: true,
      network_used: true,
      localhost_only: true,
      remote_provider: false,
      federation: false,
      mint: false,
      token_economy: false,
      urp_networking: false,
    },
    warnings: [],
  };
}

test("--invocation-result-file <abs> with compliant envelope → verdict=compliant + exit 0", async () => {
  const { path } = await makeDemaHomeWithEnvelope(compliantEnvelope());
  const { stdout, exitCode } = await runCli([
    "model-broker",
    "verify-invocation",
    "--invocation-result-file",
    path,
  ]);
  assert.equal(exitCode, 0);
  const verification = JSON.parse(stdout);
  assert.equal(
    verification.schema,
    "bizra.dema.local_model_routed_invocation_verification.v0.1",
  );
  assert.equal(verification.verdict, "compliant");
  assert.equal(verification.source.kind, "file");
  assert.equal(verification.source.path, path);
});

test("--invocation-result-file with relative path → non-zero exit + 'must be absolute' stderr", async () => {
  const { stderr, exitCode } = await runCli([
    "model-broker",
    "verify-invocation",
    "--invocation-result-file",
    "relative/path.json",
  ]);
  assert.notEqual(exitCode, 0);
  assert.match(stderr, /must be absolute/);
});

test("--invocation-result-file with nonexistent file → non-zero exit + 'envelope file not found' stderr", async () => {
  const { stderr, exitCode } = await runCli([
    "model-broker",
    "verify-invocation",
    "--invocation-result-file",
    "/tmp/dema-verify-nonexistent-12345.json",
  ]);
  assert.notEqual(exitCode, 0);
  assert.match(stderr, /envelope file not found/);
});

test("--invocation-result-file with malformed JSON → non-zero exit + 'malformed envelope JSON' stderr", async () => {
  const home = await mkdtemp(join(tmpdir(), "dema-verify-malformed-"));
  await mkdir(join(home, "receipts"), { recursive: true });
  const path = join(home, "receipts", "invocation-bad.json");
  await writeFile(path, "{ not valid json :::");
  const { stderr, exitCode } = await runCli([
    "model-broker",
    "verify-invocation",
    "--invocation-result-file",
    path,
  ]);
  assert.notEqual(exitCode, 0);
  assert.match(stderr, /malformed envelope JSON/);
});

test("--latest with invocation-*.json present → reads newest", async () => {
  const { home } = await makeDemaHomeWithEnvelope(compliantEnvelope());
  // Add a second envelope with different content (and slightly later mtime).
  const env2 = compliantEnvelope();
  env2.route_receipt.task_kind = "claim_review";
  const path2 = join(home, "receipts", "invocation-feedfacefeedfacefeed.json");
  await new Promise((res) => setTimeout(res, 20));
  await writeFile(path2, JSON.stringify(env2) + "\n");
  const { stdout, exitCode } = await runCli(
    ["model-broker", "verify-invocation", "--latest"],
    { env: { DEMA_HOME: home } },
  );
  assert.equal(exitCode, 0);
  const verification = JSON.parse(stdout);
  assert.equal(verification.source.kind, "latest");
  // The path should be one of the two written files.
  assert.match(verification.source.path, /invocation-[a-z0-9]+\.json$/);
});

test("--latest with no invocation files → non-zero exit", async () => {
  const home = await mkdtemp(join(tmpdir(), "dema-verify-empty-"));
  await mkdir(join(home, "receipts"), { recursive: true });
  const { stderr, exitCode } = await runCli(
    ["model-broker", "verify-invocation", "--latest"],
    { env: { DEMA_HOME: home } },
  );
  assert.notEqual(exitCode, 0);
  assert.match(stderr, /no invocation-\*\.json files found/);
});

test("--invocation-result-file AND --latest together → non-zero exit (mutually exclusive)", async () => {
  const { path } = await makeDemaHomeWithEnvelope(compliantEnvelope());
  const { stderr, exitCode } = await runCli([
    "model-broker",
    "verify-invocation",
    "--invocation-result-file",
    path,
    "--latest",
  ]);
  assert.notEqual(exitCode, 0);
  assert.match(stderr, /mutually exclusive/);
});
