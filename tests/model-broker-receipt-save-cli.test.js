import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

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
  return mkdtemp(join(tmpdir(), "dema-receipt-save-"));
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

test("'--save-receipt --consent <valid>' writes a file under $DEMA_HOME/receipts/route-<hash>.json", async () => {
  const home = await makeDemaHome();
  const { exitCode } = await runCli(
    [
      "model-broker",
      "route",
      "--task",
      "synthesis",
      "--save-receipt",
      "--consent",
      SAVE_CONSENT,
    ],
    { env: { DEMA_HOME: home } },
  );
  assert.equal(exitCode, 0);
  // Receipts dir created.
  const receiptsDir = join(home, "receipts");
  assert.ok(existsSync(receiptsDir), "receipts dir should exist");
  // Exactly one file written.
  const files = await readdir(receiptsDir);
  const routeFiles = files.filter(
    (f) => f.startsWith("route-") && f.endsWith(".json"),
  );
  assert.equal(
    routeFiles.length,
    1,
    `expected 1 route file; got ${routeFiles.length}: ${files.join(",")}`,
  );
  // Filename is route-<64-hex-chars>.json.
  assert.match(routeFiles[0], /^route-[a-f0-9]{64}\.json$/);
});

test("'--save-receipt' without --consent exits non-zero and names the required phrase", async () => {
  const home = await makeDemaHome();
  const { stderr, exitCode } = await runCli(
    ["model-broker", "route", "--task", "synthesis", "--save-receipt"],
    { env: { DEMA_HOME: home } },
  );
  assert.notEqual(exitCode, 0);
  assert.match(stderr, /requires --consent/);
  assert.match(
    stderr,
    new RegExp(SAVE_CONSENT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  );
  // No file should have been written.
  if (existsSync(join(home, "receipts"))) {
    const files = await readdir(join(home, "receipts"));
    const routeFiles = files.filter((f) => f.startsWith("route-"));
    assert.equal(
      routeFiles.length,
      0,
      "no route file should exist when consent missing",
    );
  }
});

test("'--save-receipt --consent <wrong>' exits non-zero with consent-mismatch error", async () => {
  const home = await makeDemaHome();
  const { stderr, exitCode } = await runCli(
    [
      "model-broker",
      "route",
      "--task",
      "synthesis",
      "--save-receipt",
      "--consent",
      "wrong phrase",
    ],
    { env: { DEMA_HOME: home } },
  );
  assert.notEqual(exitCode, 0);
  assert.match(stderr, /consent phrase mismatch/);
});

test("with valid consent, stdout still emits parseable route receipt JSON", async () => {
  const home = await makeDemaHome();
  const { stdout, exitCode } = await runCli(
    [
      "model-broker",
      "route",
      "--task",
      "synthesis",
      "--save-receipt",
      "--consent",
      SAVE_CONSENT,
    ],
    { env: { DEMA_HOME: home } },
  );
  assert.equal(exitCode, 0);
  const receipt = JSON.parse(stdout);
  assert.equal(receipt.schema, "bizra.dema.local_model_route_receipt.v0.1");
});

test("with valid consent, saved file content matches stdout byte-for-byte", async () => {
  const home = await makeDemaHome();
  const { stdout, exitCode } = await runCli(
    [
      "model-broker",
      "route",
      "--task",
      "synthesis",
      "--save-receipt",
      "--consent",
      SAVE_CONSENT,
    ],
    { env: { DEMA_HOME: home } },
  );
  assert.equal(exitCode, 0);
  const files = await readdir(join(home, "receipts"));
  const routeFile = files.find(
    (f) => f.startsWith("route-") && f.endsWith(".json"),
  );
  assert.ok(routeFile, "expected route file");
  const onDisk = await readFile(join(home, "receipts", routeFile), "utf8");
  assert.equal(onDisk, stdout, "on-disk file must match stdout byte-for-byte");
  // sha256 of content matches the filename hash.
  const expectedSha = createHash("sha256").update(onDisk).digest("hex");
  assert.equal(routeFile, `route-${expectedSha}.json`);
});

test("with valid consent, stderr contains 'saved receipt to:' info line with full path", async () => {
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
    ],
    { env: { DEMA_HOME: home } },
  );
  assert.equal(exitCode, 0);
  assert.match(stderr, /saved receipt to:/);
  assert.match(stderr, new RegExp(home.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("default placeholder registry + --save-receipt persists the null-selection route receipt", async () => {
  const home = await makeDemaHome();
  const { stdout, exitCode } = await runCli(
    [
      "model-broker",
      "route",
      "--task",
      "synthesis",
      "--save-receipt",
      "--consent",
      SAVE_CONSENT,
    ],
    { env: { DEMA_HOME: home } },
  );
  assert.equal(exitCode, 0);
  const receipt = JSON.parse(stdout);
  assert.equal(receipt.selected_model_id, null);
  // File exists and contains the null-selection receipt.
  const files = await readdir(join(home, "receipts"));
  const routeFile = files.find((f) => f.startsWith("route-"));
  const onDisk = JSON.parse(
    await readFile(join(home, "receipts", routeFile), "utf8"),
  );
  assert.equal(onDisk.selected_model_id, null);
  assert.equal(onDisk.reason, "no_acceptable_candidate");
});

test("operator registry file + --save-receipt persists selected-entry route receipt", async () => {
  const home = await makeDemaHome();
  await mkdir(join(home, "models"), { recursive: true });
  await writeFile(
    join(home, "models", "registry.json"),
    JSON.stringify({ entries: [OPERATOR_TEST_DEMA_FACE_ENTRY] }),
  );
  const { stdout, exitCode } = await runCli(
    [
      "model-broker",
      "route",
      "--task",
      "synthesis",
      "--use-local-registry",
      "--registry-consent",
      "GO: load operator model registry",
      "--save-receipt",
      "--consent",
      SAVE_CONSENT,
    ],
    { env: { DEMA_HOME: home } },
  );
  assert.equal(exitCode, 0);
  const stdoutReceipt = JSON.parse(stdout);
  assert.equal(stdoutReceipt.selected_model_id, "operator-test-dema-face");
  const files = await readdir(join(home, "receipts"));
  const routeFile = files.find((f) => f.startsWith("route-"));
  const onDisk = JSON.parse(
    await readFile(join(home, "receipts", routeFile), "utf8"),
  );
  assert.equal(onDisk.selected_model_id, "operator-test-dema-face");
  assert.equal(onDisk.selected_model_role, "dema_face");
});

test("no --save-receipt flag means no receipt file is written", async () => {
  const home = await makeDemaHome();
  const { exitCode } = await runCli(
    ["model-broker", "route", "--task", "synthesis"],
    { env: { DEMA_HOME: home } },
  );
  assert.equal(exitCode, 0);
  // receipts/ dir should NOT have been created or contain route files.
  if (existsSync(join(home, "receipts"))) {
    const files = await readdir(join(home, "receipts"));
    const routeFiles = files.filter((f) => f.startsWith("route-"));
    assert.equal(routeFiles.length, 0);
  }
});

test("saved receipt preserves all zero-effect boundary flags", async () => {
  const home = await makeDemaHome();
  const { exitCode } = await runCli(
    [
      "model-broker",
      "route",
      "--task",
      "synthesis",
      "--save-receipt",
      "--consent",
      SAVE_CONSENT,
    ],
    { env: { DEMA_HOME: home } },
  );
  assert.equal(exitCode, 0);
  const files = await readdir(join(home, "receipts"));
  const routeFile = files.find((f) => f.startsWith("route-"));
  const onDisk = JSON.parse(
    await readFile(join(home, "receipts", routeFile), "utf8"),
  );
  assert.equal(onDisk.boundary.runtime, false);
  assert.equal(onDisk.boundary.model_invocation, false);
  assert.equal(onDisk.boundary.network_used, false);
  assert.equal(onDisk.boundary.federation, false);
  assert.equal(onDisk.boundary.mint, false);
  assert.equal(onDisk.boundary.token_economy, false);
  assert.equal(onDisk.boundary.urp_networking, false);
  assert.equal(onDisk.boundary.prompt_invocation_allowed, false);
});

test("re-running the same command shape creates content-addressed files; timestamps make each receipt unique", async () => {
  const home = await makeDemaHome();
  // Run twice with a small delay so timestamps differ.
  const r1 = await runCli(
    [
      "model-broker",
      "route",
      "--task",
      "synthesis",
      "--save-receipt",
      "--consent",
      SAVE_CONSENT,
    ],
    { env: { DEMA_HOME: home } },
  );
  await new Promise((res) => setTimeout(res, 10));
  const r2 = await runCli(
    [
      "model-broker",
      "route",
      "--task",
      "synthesis",
      "--save-receipt",
      "--consent",
      SAVE_CONSENT,
    ],
    { env: { DEMA_HOME: home } },
  );
  assert.equal(r1.exitCode, 0);
  assert.equal(r2.exitCode, 0);
  // Two route files should exist because timestamps differ between runs.
  const files = await readdir(join(home, "receipts"));
  const routeFiles = files
    .filter((f) => f.startsWith("route-") && f.endsWith(".json"))
    .sort();
  assert.equal(
    routeFiles.length,
    2,
    `expected 2 distinct route files (different timestamps); got ${routeFiles.length}: ${routeFiles.join(",")}`,
  );
  assert.notEqual(routeFiles[0], routeFiles[1]);
  // Each filename matches its file's sha256.
  for (const f of routeFiles) {
    const onDisk = await readFile(join(home, "receipts", f), "utf8");
    const sha = createHash("sha256").update(onDisk).digest("hex");
    assert.equal(f, `route-${sha}.json`);
  }
});
