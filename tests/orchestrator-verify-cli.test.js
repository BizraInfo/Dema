import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { buildPreviewBoundary } from "../packages/core/src/preview-boundary.js";

const cliPath = fileURLToPath(
  new URL("../apps/cli/src/index.js", import.meta.url),
);

function runCli(args, { env = {}, timeout = 30000 } = {}) {
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
        maxBuffer: 16 * 1024 * 1024,
      },
      (err, stdout, stderr) => {
        if (err && err.killed) {
          reject(
            new Error(
              `Process timed out. stdout=${stdout.slice(0, 500)} stderr=${stderr.slice(0, 500)}`,
            ),
          );
          return;
        }
        resolve({ stdout, stderr, exitCode: err?.code ?? 0 });
      },
    );
  });
}

// Canonical-boundary artifact = passes SAT-1 (the only SAT that runs without
// extra inputs). We write it to a file shaped like a saved invocation
// envelope so that --invocation-file / --latest can read it.
function canonicalArtifact() {
  return {
    schema: "bizra.dema.test_artifact.v0.1",
    boundary: { ...buildPreviewBoundary() },
  };
}

// Non-canonical artifact: flip one boundary key true → SAT-1 fails.
function nonCanonicalArtifact() {
  const base = canonicalArtifact();
  base.boundary.runtime_execution_performed = true;
  return base;
}

async function makeHomeWithEnvelope(
  envelope,
  { filename = "invocation-deadbeef.json" } = {},
) {
  const home = await mkdtemp(join(tmpdir(), "dema-orchestrator-cli-"));
  await mkdir(join(home, "receipts"), { recursive: true });
  const p = join(home, "receipts", filename);
  await writeFile(p, JSON.stringify(envelope) + "\n");
  return { home, path: p };
}

// 1. --invocation-file <abs> happy path → pipeline schema + passed=true + exit 0
test("--invocation-file <abs> with canonical artifact → pipeline_verified + exit 0", async () => {
  const { path } = await makeHomeWithEnvelope(canonicalArtifact());
  const { stdout, exitCode } = await runCli([
    "orchestrator",
    "verify",
    "--invocation-file",
    path,
  ]);
  assert.equal(exitCode, 0);
  const env = JSON.parse(stdout);
  assert.equal(
    env.schema,
    "bizra.dema.orchestrator_verification_pipeline.v0.1",
  );
  assert.equal(env.passed, true);
  assert.equal(env.overall_verdict, "pipeline_verified");
  assert.ok(env.sats_run.includes("sat-1-boundary-verifier"));
});

// 2. Relative --invocation-file → non-zero + 'must be absolute'
test("relative --invocation-file exits non-zero with 'must be absolute'", async () => {
  const { stderr, exitCode } = await runCli([
    "orchestrator",
    "verify",
    "--invocation-file",
    "relative/path.json",
  ]);
  assert.notEqual(exitCode, 0);
  assert.match(stderr, /must be absolute/);
});

// 3. Nonexistent file → non-zero + 'envelope file not found'
test("nonexistent --invocation-file exits non-zero with 'envelope file not found'", async () => {
  const { stderr, exitCode } = await runCli([
    "orchestrator",
    "verify",
    "--invocation-file",
    "/tmp/dema-orch-nonexistent-zzz-12345.json",
  ]);
  assert.notEqual(exitCode, 0);
  assert.match(stderr, /envelope file not found/);
});

// 4. Malformed JSON → non-zero + 'malformed envelope JSON'
test("malformed JSON exits non-zero with 'malformed envelope JSON'", async () => {
  const home = await mkdtemp(join(tmpdir(), "dema-orch-bad-"));
  await mkdir(join(home, "receipts"), { recursive: true });
  const p = join(home, "receipts", "invocation-bad.json");
  await writeFile(p, "{ not valid json :::");
  const { stderr, exitCode } = await runCli([
    "orchestrator",
    "verify",
    "--invocation-file",
    p,
  ]);
  assert.notEqual(exitCode, 0);
  assert.match(stderr, /malformed envelope JSON/);
});

// 5. --latest reads newest invocation-*.json
test("--latest reads newest invocation-*.json from $DEMA_HOME/receipts/", async () => {
  const { home } = await makeHomeWithEnvelope(canonicalArtifact(), {
    filename: "invocation-aaa.json",
  });
  // Add a second envelope with later mtime
  const second = canonicalArtifact();
  second.schema = "bizra.dema.test_artifact_two.v0.1";
  const p2 = join(home, "receipts", "invocation-bbb.json");
  await new Promise((res) => setTimeout(res, 20));
  await writeFile(p2, JSON.stringify(second) + "\n");
  const { stdout, exitCode } = await runCli(
    ["orchestrator", "verify", "--latest"],
    { env: { DEMA_HOME: home } },
  );
  assert.equal(exitCode, 0);
  const env = JSON.parse(stdout);
  assert.equal(
    env.schema,
    "bizra.dema.orchestrator_verification_pipeline.v0.1",
  );
  // source path should reference one of the two written files
  assert.match(env.source.path, /invocation-[a-z]+\.json$/);
});

// 6. --latest with no invocation files → non-zero
test("--latest with no invocation files exits non-zero", async () => {
  const home = await mkdtemp(join(tmpdir(), "dema-orch-empty-"));
  await mkdir(join(home, "receipts"), { recursive: true });
  const { stderr, exitCode } = await runCli(
    ["orchestrator", "verify", "--latest"],
    { env: { DEMA_HOME: home } },
  );
  assert.notEqual(exitCode, 0);
  assert.match(stderr, /no invocation-\*\.json files found/);
});

// 7. --invocation-file + --latest together → non-zero (mutually exclusive)
test("--invocation-file + --latest together exits non-zero (mutually exclusive)", async () => {
  const { path } = await makeHomeWithEnvelope(canonicalArtifact());
  const { stderr, exitCode } = await runCli([
    "orchestrator",
    "verify",
    "--invocation-file",
    path,
    "--latest",
  ]);
  assert.notEqual(exitCode, 0);
  assert.match(stderr, /mutually exclusive/);
});

// 8. Crafted non-passed pipeline (flip a boundary key) → non-zero + passed=false
test("non-canonical artifact (one boundary key flipped) exits non-zero with passed=false", async () => {
  const { path } = await makeHomeWithEnvelope(nonCanonicalArtifact());
  const { stdout, exitCode } = await runCli([
    "orchestrator",
    "verify",
    "--invocation-file",
    path,
  ]);
  assert.notEqual(exitCode, 0);
  const env = JSON.parse(stdout);
  assert.equal(env.passed, false);
  assert.equal(env.overall_verdict, "pipeline_violated");
  assert.ok(env.sats_failed.includes("sat-1-boundary-verifier"));
});

// 9. sats_run array + per-SAT verdict are present
test("pipeline envelope includes sats_run array + per_sat_verdicts map", async () => {
  const { path } = await makeHomeWithEnvelope(canonicalArtifact());
  const { stdout } = await runCli([
    "orchestrator",
    "verify",
    "--invocation-file",
    path,
  ]);
  const env = JSON.parse(stdout);
  assert.ok(Array.isArray(env.sats_run));
  assert.ok(env.sats_run.length >= 1);
  assert.equal(typeof env.per_sat_verdicts, "object");
  assert.ok(env.per_sat_verdicts["sat-1-boundary-verifier"]);
  // Q8: source linkage preserved
  assert.equal(typeof env.source.path, "string");
  assert.match(env.source.source_invocation_result_hash, /^[a-f0-9]{64}$/);
});

// 10. --pretty emits indented JSON
test("--pretty emits indented JSON", async () => {
  const { path } = await makeHomeWithEnvelope(canonicalArtifact());
  const { stdout } = await runCli([
    "orchestrator",
    "verify",
    "--invocation-file",
    path,
    "--pretty",
  ]);
  // Pretty output has at least one newline inside braces (not just the trailing one)
  const lines = stdout.split("\n");
  assert.ok(
    lines.length > 3,
    `expected multi-line pretty output; got ${lines.length} lines`,
  );
  // First non-empty line should be `{`
  assert.equal(lines[0].trim(), "{");
});

// 11. Missing subcommand → Usage stderr + non-zero
test("missing 'verify' subcommand prints Usage and exits non-zero", async () => {
  const { stderr, exitCode } = await runCli(["orchestrator"]);
  assert.notEqual(exitCode, 0);
  assert.match(stderr, /Usage: dema orchestrator verify/);
});

// 12. Neither --invocation-file nor --latest → non-zero
test("neither --invocation-file nor --latest exits non-zero", async () => {
  const { stderr, exitCode } = await runCli(["orchestrator", "verify"]);
  assert.notEqual(exitCode, 0);
  assert.match(
    stderr,
    /one of --invocation-file <abs-path> or --latest is required/,
  );
});
