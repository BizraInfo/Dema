import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

import { buildPreviewBoundary } from "../packages/core/src/preview-boundary.js";

const cliPath = fileURLToPath(new URL("../apps/cli/src/index.js", import.meta.url));
const SAVE_PIPELINE_CONSENT = "GO: save local orchestrator pipeline result";

function runCli(args, { env = {}, timeout = 30000 } = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      "node",
      [cliPath, ...args],
      {
        env: { ...process.env, DEMA_BANNER_INTERACTIVE: "0", NODE_ENV: "test", ...env },
        timeout,
        maxBuffer: 16 * 1024 * 1024
      },
      (err, stdout, stderr) => {
        if (err && err.killed) {
          reject(new Error(`Process timed out. stdout=${stdout.slice(0,500)} stderr=${stderr.slice(0,500)}`));
          return;
        }
        resolve({ stdout, stderr, exitCode: err?.code ?? 0 });
      }
    );
  });
}

function canonicalArtifact() {
  return {
    schema: "bizra.dema.test_artifact.v0.1",
    boundary: { ...buildPreviewBoundary() }
  };
}

function nonCanonicalArtifact() {
  const a = canonicalArtifact();
  a.boundary.runtime_execution_performed = true;
  return a;
}

async function makeHomeWithEnvelope(envelope, { filename = "invocation-deadbeef.json" } = {}) {
  const home = await mkdtemp(join(tmpdir(), "dema-pipeline-save-cli-"));
  await mkdir(join(home, "receipts"), { recursive: true });
  const p = join(home, "receipts", filename);
  await writeFile(p, JSON.stringify(envelope) + "\n");
  return { home, path: p };
}

// 1. --save-pipeline-result with valid consent writes pipeline-<64hex>.json
test("'--save-pipeline-result' with valid consent writes file under $DEMA_HOME/receipts/pipeline-<hash>.json", async () => {
  const { home, path } = await makeHomeWithEnvelope(canonicalArtifact());
  const { exitCode } = await runCli(
    [
      "orchestrator", "verify",
      "--invocation-file", path,
      "--save-pipeline-result",
      "--save-pipeline-consent", SAVE_PIPELINE_CONSENT
    ],
    { env: { DEMA_HOME: home } }
  );
  assert.equal(exitCode, 0);
  const files = await readdir(join(home, "receipts"));
  const pipelineFiles = files.filter((f) => f.startsWith("pipeline-") && f.endsWith(".json"));
  assert.equal(pipelineFiles.length, 1, `expected 1 pipeline file; got ${pipelineFiles.length}: ${files.join(",")}`);
  assert.match(pipelineFiles[0], /^pipeline-[a-f0-9]{64}\.json$/);
});

// 2. Missing --save-pipeline-consent exits non-zero + names required phrase
test("'--save-pipeline-result' without consent exits non-zero and names required phrase", async () => {
  const { home, path } = await makeHomeWithEnvelope(canonicalArtifact());
  const { stderr, exitCode } = await runCli(
    ["orchestrator", "verify", "--invocation-file", path, "--save-pipeline-result"],
    { env: { DEMA_HOME: home } }
  );
  assert.notEqual(exitCode, 0);
  assert.match(stderr, /requires --save-pipeline-consent/);
  assert.match(stderr, /GO: save local orchestrator pipeline result/);
});

// 3. Wrong consent → non-zero with consent mismatch
test("'--save-pipeline-result' with wrong consent exits non-zero with consent mismatch", async () => {
  const { home, path } = await makeHomeWithEnvelope(canonicalArtifact());
  const { stderr, exitCode } = await runCli(
    [
      "orchestrator", "verify",
      "--invocation-file", path,
      "--save-pipeline-result",
      "--save-pipeline-consent", "wrong phrase"
    ],
    { env: { DEMA_HOME: home } }
  );
  assert.notEqual(exitCode, 0);
  assert.match(stderr, /consent phrase mismatch/);
});

// 4. Saved file matches stdout byte-for-byte
test("saved file matches stdout byte-for-byte", async () => {
  const { home, path } = await makeHomeWithEnvelope(canonicalArtifact());
  const { stdout } = await runCli(
    [
      "orchestrator", "verify",
      "--invocation-file", path,
      "--save-pipeline-result",
      "--save-pipeline-consent", SAVE_PIPELINE_CONSENT
    ],
    { env: { DEMA_HOME: home } }
  );
  const files = await readdir(join(home, "receipts"));
  const pipelineFile = files.find((f) => f.startsWith("pipeline-") && f.endsWith(".json"));
  assert.ok(pipelineFile);
  const onDisk = await readFile(join(home, "receipts", pipelineFile), "utf8");
  assert.equal(onDisk, stdout, "on-disk file must match stdout byte-for-byte");
});

// 5. sha256 filename matches exact stdout bytes
test("sha256 filename matches exact stdout bytes", async () => {
  const { home, path } = await makeHomeWithEnvelope(canonicalArtifact());
  const { stdout } = await runCli(
    [
      "orchestrator", "verify",
      "--invocation-file", path,
      "--save-pipeline-result",
      "--save-pipeline-consent", SAVE_PIPELINE_CONSENT
    ],
    { env: { DEMA_HOME: home } }
  );
  const files = await readdir(join(home, "receipts"));
  const pipelineFile = files.find((f) => f.startsWith("pipeline-") && f.endsWith(".json"));
  const expectedSha = createHash("sha256").update(stdout).digest("hex");
  assert.equal(pipelineFile, `pipeline-${expectedSha}.json`);
});

// 6. stderr contains 'saved pipeline result to:'
test("stderr contains 'saved pipeline result to:' info line", async () => {
  const { home, path } = await makeHomeWithEnvelope(canonicalArtifact());
  const { stderr } = await runCli(
    [
      "orchestrator", "verify",
      "--invocation-file", path,
      "--save-pipeline-result",
      "--save-pipeline-consent", SAVE_PIPELINE_CONSENT
    ],
    { env: { DEMA_HOME: home } }
  );
  assert.match(stderr, /saved pipeline result to:/);
  assert.match(stderr, new RegExp(home.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

// 7. Non-passed pipeline envelope is still saved
test("non-passed pipeline envelope is STILL saved (auditability for failures)", async () => {
  const { home, path } = await makeHomeWithEnvelope(nonCanonicalArtifact());
  const { stdout, exitCode } = await runCli(
    [
      "orchestrator", "verify",
      "--invocation-file", path,
      "--save-pipeline-result",
      "--save-pipeline-consent", SAVE_PIPELINE_CONSENT
    ],
    { env: { DEMA_HOME: home } }
  );
  assert.notEqual(exitCode, 0);
  const env = JSON.parse(stdout);
  assert.equal(env.passed, false);
  const files = await readdir(join(home, "receipts"));
  const pipelineFile = files.find((f) => f.startsWith("pipeline-") && f.endsWith(".json"));
  assert.ok(pipelineFile, "non-passed envelope must still be saved");
  const onDisk = JSON.parse(await readFile(join(home, "receipts", pipelineFile), "utf8"));
  assert.equal(onDisk.passed, false);
});

// 8. No --save-pipeline-result → no pipeline-*.json written
test("no --save-pipeline-result means no pipeline-*.json file is written", async () => {
  const { home, path } = await makeHomeWithEnvelope(canonicalArtifact());
  const { exitCode } = await runCli(
    ["orchestrator", "verify", "--invocation-file", path],
    { env: { DEMA_HOME: home } }
  );
  assert.equal(exitCode, 0);
  if (existsSync(join(home, "receipts"))) {
    const files = await readdir(join(home, "receipts"));
    const pipelineFiles = files.filter((f) => f.startsWith("pipeline-"));
    assert.equal(pipelineFiles.length, 0, "no pipeline-* file should exist without --save-pipeline-result");
  }
});

// 9. --latest source supports saving
test("--latest source mode also supports --save-pipeline-result", async () => {
  const { home } = await makeHomeWithEnvelope(canonicalArtifact());
  const { exitCode } = await runCli(
    [
      "orchestrator", "verify",
      "--latest",
      "--save-pipeline-result",
      "--save-pipeline-consent", SAVE_PIPELINE_CONSENT
    ],
    { env: { DEMA_HOME: home } }
  );
  assert.equal(exitCode, 0);
  const files = await readdir(join(home, "receipts"));
  const pipelineFiles = files.filter((f) => f.startsWith("pipeline-") && f.endsWith(".json"));
  assert.equal(pipelineFiles.length, 1);
});

// 10. --invocation-file source supports saving (also covered above; explicit)
test("--invocation-file source mode supports --save-pipeline-result", async () => {
  const { home, path } = await makeHomeWithEnvelope(canonicalArtifact());
  const { exitCode } = await runCli(
    [
      "orchestrator", "verify",
      "--invocation-file", path,
      "--save-pipeline-result",
      "--save-pipeline-consent", SAVE_PIPELINE_CONSENT
    ],
    { env: { DEMA_HOME: home } }
  );
  assert.equal(exitCode, 0);
  const files = await readdir(join(home, "receipts"));
  assert.ok(files.some((f) => f.startsWith("pipeline-") && f.endsWith(".json")));
});

// 11. --pretty save preserves byte-for-byte pretty JSON
test("--pretty save preserves byte-for-byte pretty JSON", async () => {
  const { home, path } = await makeHomeWithEnvelope(canonicalArtifact());
  const { stdout, exitCode } = await runCli(
    [
      "orchestrator", "verify",
      "--invocation-file", path,
      "--pretty",
      "--save-pipeline-result",
      "--save-pipeline-consent", SAVE_PIPELINE_CONSENT
    ],
    { env: { DEMA_HOME: home } }
  );
  assert.equal(exitCode, 0);
  // Pretty output is multi-line
  assert.ok(stdout.split("\n").length > 3);
  const files = await readdir(join(home, "receipts"));
  const pipelineFile = files.find((f) => f.startsWith("pipeline-") && f.endsWith(".json"));
  const onDisk = await readFile(join(home, "receipts", pipelineFile), "utf8");
  assert.equal(onDisk, stdout, "pretty on-disk must match pretty stdout byte-for-byte");
});

// 12. Re-running the same scan produces 2 distinct files (verified_at /
//     scanned_at fields in per_sat_verdicts ensure each run is unique).
test("re-running verify produces 2 distinct pipeline files (per-SAT verified_at differs)", async () => {
  const { home, path } = await makeHomeWithEnvelope(canonicalArtifact());
  const r1 = await runCli(
    [
      "orchestrator", "verify",
      "--invocation-file", path,
      "--save-pipeline-result",
      "--save-pipeline-consent", SAVE_PIPELINE_CONSENT
    ],
    { env: { DEMA_HOME: home } }
  );
  await new Promise((res) => setTimeout(res, 20));
  const r2 = await runCli(
    [
      "orchestrator", "verify",
      "--invocation-file", path,
      "--save-pipeline-result",
      "--save-pipeline-consent", SAVE_PIPELINE_CONSENT
    ],
    { env: { DEMA_HOME: home } }
  );
  assert.equal(r1.exitCode, 0);
  assert.equal(r2.exitCode, 0);
  const files = await readdir(join(home, "receipts"));
  const pipelineFiles = files.filter((f) => f.startsWith("pipeline-") && f.endsWith(".json")).sort();
  assert.equal(pipelineFiles.length, 2, `expected 2 distinct files; got ${pipelineFiles.length}`);
  assert.notEqual(pipelineFiles[0], pipelineFiles[1]);
});
