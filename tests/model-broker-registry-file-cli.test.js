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

async function makeDemaHome(opts = {}) {
  const home = await mkdtemp(join(tmpdir(), "dema-registry-cli-"));
  if (opts.withRegistry) {
    await mkdir(join(home, "models"), { recursive: true });
    await writeFile(
      join(home, "models", "registry.json"),
      JSON.stringify(opts.withRegistry),
    );
  }
  return home;
}

const OPERATOR_TEST_DEMA_FACE_ENTRY = {
  id: "operator-test-dema-face",
  provider: "ollama",
  model_name: "operator-test-dema-face",
  role: "dema_face",
  size_class: "32B",
  locality: "local",
  allowed_tasks: ["synthesis"],
  max_concurrency: 1,
  context_limit: 32768,
  status: "active",
};

test("'--use-local-registry' with valid $DEMA_HOME/models/registry.json routes synthesis to operator entry", async () => {
  const home = await makeDemaHome({
    withRegistry: { entries: [OPERATOR_TEST_DEMA_FACE_ENTRY] },
  });
  const { stdout, exitCode } = await runCli(
    ["model-broker", "route", "--task", "synthesis", "--use-local-registry"],
    { env: { DEMA_HOME: home } },
  );
  assert.equal(exitCode, 0, "expected exit 0");
  const receipt = JSON.parse(stdout);
  assert.equal(receipt.schema, "bizra.dema.local_model_route_receipt.v0.1");
  assert.equal(receipt.selected_model_id, "operator-test-dema-face");
  assert.equal(receipt.selected_model_role, "dema_face");
  assert.equal(receipt.selected_model_locality, "local");
});

test("'--use-local-registry' when registry file is missing exits non-zero with helpful stderr", async () => {
  // Create DEMA_HOME but no models/registry.json
  const home = await makeDemaHome();
  const { stdout, stderr, exitCode } = await runCli(
    ["model-broker", "route", "--task", "synthesis", "--use-local-registry"],
    { env: { DEMA_HOME: home } },
  );
  assert.notEqual(exitCode, 0);
  assert.equal(stdout, "");
  assert.match(stderr, /registry file not found/);
  assert.match(stderr, /models\/registry\.json/);
});

test("'--registry-file /abs/path' with valid operator entry routes synthesis correctly", async () => {
  const home = await makeDemaHome();
  const filePath = join(home, "custom-registry.json");
  await writeFile(
    filePath,
    JSON.stringify({ entries: [OPERATOR_TEST_DEMA_FACE_ENTRY] }),
  );
  const { stdout, exitCode } = await runCli([
    "model-broker",
    "route",
    "--task",
    "synthesis",
    "--registry-file",
    filePath,
  ]);
  assert.equal(exitCode, 0);
  const receipt = JSON.parse(stdout);
  assert.equal(receipt.selected_model_id, "operator-test-dema-face");
});

test("'--registry-file relative/path' exits non-zero with 'must be absolute' error", async () => {
  const { stdout, stderr, exitCode } = await runCli([
    "model-broker",
    "route",
    "--task",
    "synthesis",
    "--registry-file",
    "relative/path.json",
  ]);
  assert.notEqual(exitCode, 0);
  assert.equal(stdout, "");
  assert.match(stderr, /must be absolute/);
  assert.match(stderr, /--use-local-registry/);
});

test("'--registry-file /nonexistent.json' exits non-zero with file-not-found error", async () => {
  const { stdout, stderr, exitCode } = await runCli([
    "model-broker",
    "route",
    "--task",
    "synthesis",
    "--registry-file",
    "/tmp/this-file-does-not-exist-12345.json",
  ]);
  assert.notEqual(exitCode, 0);
  assert.equal(stdout, "");
  assert.match(stderr, /registry file not found/);
});

test("'--registry-file <malformed.json>' exits non-zero gracefully", async () => {
  const home = await makeDemaHome();
  const malformedPath = join(home, "malformed.json");
  await writeFile(malformedPath, "{ not valid json :::");
  const { stdout, stderr, exitCode } = await runCli([
    "model-broker",
    "route",
    "--task",
    "synthesis",
    "--registry-file",
    malformedPath,
  ]);
  assert.notEqual(exitCode, 0);
  assert.equal(stdout, "");
  assert.match(stderr, /malformed registry file JSON/);
});

test("'--registry-file <oversized.json>' over 1 MB exits non-zero with size-limit error", async () => {
  const home = await makeDemaHome();
  const oversizedPath = join(home, "oversized.json");
  // Produce > 1 MB of valid JSON. The padding key is ignored by sanitizer if
  // file ever reaches buildRegistryFromConfig — but stat-check should reject
  // first.
  const oversizedContent = JSON.stringify({
    entries: [],
    padding: "x".repeat(1024 * 1024 + 100),
  });
  assert.ok(oversizedContent.length > 1024 * 1024, "fixture must exceed 1 MB");
  await writeFile(oversizedPath, oversizedContent);
  const { stdout, stderr, exitCode } = await runCli([
    "model-broker",
    "route",
    "--task",
    "synthesis",
    "--registry-file",
    oversizedPath,
  ]);
  assert.notEqual(exitCode, 0);
  assert.equal(stdout, "");
  assert.match(stderr, /registry file too large/);
  assert.match(stderr, /1048576/); // 1 MB in bytes appears in error
});

test("multiple registry input flags exit non-zero (3 pair combinations)", async () => {
  // --registry-file + --registry-stdin
  const r1 = await runCli(
    [
      "model-broker",
      "route",
      "--task",
      "synthesis",
      "--registry-file",
      "/tmp/x.json",
      "--registry-stdin",
    ],
    { stdin: "{}" },
  );
  assert.notEqual(r1.exitCode, 0);
  assert.match(r1.stderr, /mutually exclusive/);

  // --use-local-registry + --registry-stdin
  const r2 = await runCli(
    [
      "model-broker",
      "route",
      "--task",
      "synthesis",
      "--use-local-registry",
      "--registry-stdin",
    ],
    { stdin: "{}" },
  );
  assert.notEqual(r2.exitCode, 0);
  assert.match(r2.stderr, /mutually exclusive/);

  // --registry-file + --use-local-registry
  const r3 = await runCli([
    "model-broker",
    "route",
    "--task",
    "synthesis",
    "--registry-file",
    "/tmp/x.json",
    "--use-local-registry",
  ]);
  assert.notEqual(r3.exitCode, 0);
  assert.match(r3.stderr, /mutually exclusive/);
});

test("no registry flag still uses DEFAULT_SAMPLE_REGISTRY (placeholder discipline preserved)", async () => {
  const { stdout, exitCode } = await runCli([
    "model-broker",
    "route",
    "--task",
    "synthesis",
  ]);
  assert.equal(exitCode, 0);
  const receipt = JSON.parse(stdout);
  assert.equal(receipt.selected_model_id, null);
  assert.equal(receipt.reason, "no_acceptable_candidate");
  const placeholder = receipt.rejected_candidates.find(
    (r) => typeof r.model_id === "string" && r.model_id.includes("placeholder"),
  );
  assert.ok(placeholder, "expected at least one placeholder rejection");
  assert.match(placeholder.reason, /source_pending/);
});

test("file-loaded registry still emits receipt boundary with no model_invocation / network / federation / mint / token / urp effects", async () => {
  const home = await makeDemaHome({
    withRegistry: { entries: [OPERATOR_TEST_DEMA_FACE_ENTRY] },
  });
  const { stdout, exitCode } = await runCli(
    ["model-broker", "route", "--task", "synthesis", "--use-local-registry"],
    { env: { DEMA_HOME: home } },
  );
  assert.equal(exitCode, 0);
  const receipt = JSON.parse(stdout);
  assert.equal(receipt.boundary.runtime, false);
  assert.equal(receipt.boundary.model_invocation, false);
  assert.equal(receipt.boundary.network_used, false);
  assert.equal(receipt.boundary.federation, false);
  assert.equal(receipt.boundary.mint, false);
  assert.equal(receipt.boundary.token_economy, false);
  assert.equal(receipt.boundary.urp_networking, false);
  assert.equal(receipt.boundary.prompt_invocation_allowed, false);
});
