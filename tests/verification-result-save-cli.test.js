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
const SAVE_VERIFICATION_CONSENT =
  "GO: save local model invocation verification";

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

// A second fixture that triggers a non_compliant verdict by violating an
// invariant the verifier checks. boundary_federation_false expects
// boundary.federation === false; flipping it to true forces non_compliant.
function nonCompliantEnvelope() {
  const env = compliantEnvelope();
  env.boundary.federation = true;
  return env;
}

async function makeDemaHomeWithEnvelope(
  envelope,
  { filename = "invocation-deadbeefcafebabe.json" } = {},
) {
  const home = await mkdtemp(join(tmpdir(), "dema-verify-save-"));
  await mkdir(join(home, "receipts"), { recursive: true });
  const path = join(home, "receipts", filename);
  await writeFile(path, JSON.stringify(envelope) + "\n");
  return { home, path };
}

// 1. --save-verification-result with valid consent writes
//    $DEMA_HOME/receipts/verification-<64hex>.json
test("'--save-verification-result' with valid consent writes file under $DEMA_HOME/receipts/verification-<hash>.json", async () => {
  const { home, path } = await makeDemaHomeWithEnvelope(compliantEnvelope());
  const { exitCode } = await runCli(
    [
      "model-broker",
      "verify-invocation",
      "--invocation-result-file",
      path,
      "--save-verification-result",
      "--save-verification-consent",
      SAVE_VERIFICATION_CONSENT,
    ],
    { env: { DEMA_HOME: home } },
  );
  assert.equal(exitCode, 0);
  const files = await readdir(join(home, "receipts"));
  const verificationFiles = files.filter(
    (f) => f.startsWith("verification-") && f.endsWith(".json"),
  );
  assert.equal(
    verificationFiles.length,
    1,
    `expected 1 verification file; got ${verificationFiles.length}: ${files.join(",")}`,
  );
  assert.match(verificationFiles[0], /^verification-[a-f0-9]{64}\.json$/);
});

// 2. Missing --save-verification-consent exits non-zero and names required phrase.
test("'--save-verification-result' without --save-verification-consent exits non-zero and names required phrase", async () => {
  const { home, path } = await makeDemaHomeWithEnvelope(compliantEnvelope());
  const { stderr, exitCode } = await runCli(
    [
      "model-broker",
      "verify-invocation",
      "--invocation-result-file",
      path,
      "--save-verification-result",
    ],
    { env: { DEMA_HOME: home } },
  );
  assert.notEqual(exitCode, 0);
  assert.match(stderr, /requires --save-verification-consent/);
  assert.match(stderr, /GO: save local model invocation verification/);
});

// 3. Wrong --save-verification-consent exits non-zero with consent mismatch.
test("'--save-verification-result' with wrong consent exits non-zero with consent_mismatch", async () => {
  const { home, path } = await makeDemaHomeWithEnvelope(compliantEnvelope());
  const { stderr, exitCode } = await runCli(
    [
      "model-broker",
      "verify-invocation",
      "--invocation-result-file",
      path,
      "--save-verification-result",
      "--save-verification-consent",
      "wrong phrase",
    ],
    { env: { DEMA_HOME: home } },
  );
  assert.notEqual(exitCode, 0);
  assert.match(stderr, /consent phrase mismatch/);
});

// 4. Valid consent: stdout still emits parseable verification envelope JSON.
test("with valid consent, stdout still emits parseable verification envelope JSON (unchanged behavior)", async () => {
  const { home, path } = await makeDemaHomeWithEnvelope(compliantEnvelope());
  const { stdout } = await runCli(
    [
      "model-broker",
      "verify-invocation",
      "--invocation-result-file",
      path,
      "--save-verification-result",
      "--save-verification-consent",
      SAVE_VERIFICATION_CONSENT,
    ],
    { env: { DEMA_HOME: home } },
  );
  const verification = JSON.parse(stdout);
  assert.equal(
    verification.schema,
    "bizra.dema.local_model_routed_invocation_verification.v0.1",
  );
  assert.equal(verification.verdict, "compliant");
});

// 5. Valid consent: saved file content matches stdout byte-for-byte, including
//    sha256 filename verification.
test("with valid consent, saved verification file matches stdout byte-for-byte", async () => {
  const { home, path } = await makeDemaHomeWithEnvelope(compliantEnvelope());
  const { stdout } = await runCli(
    [
      "model-broker",
      "verify-invocation",
      "--invocation-result-file",
      path,
      "--save-verification-result",
      "--save-verification-consent",
      SAVE_VERIFICATION_CONSENT,
    ],
    { env: { DEMA_HOME: home } },
  );
  const files = await readdir(join(home, "receipts"));
  const verificationFile = files.find(
    (f) => f.startsWith("verification-") && f.endsWith(".json"),
  );
  assert.ok(verificationFile, "expected verification file");
  const onDisk = await readFile(
    join(home, "receipts", verificationFile),
    "utf8",
  );
  assert.equal(onDisk, stdout, "on-disk file must match stdout byte-for-byte");
  // Verify content-addressed filename: sha256 of bytes = the hash in the filename.
  const expectedSha = createHash("sha256").update(onDisk).digest("hex");
  assert.equal(verificationFile, `verification-${expectedSha}.json`);
});

// 6. Valid consent: stderr contains 'saved verification result to:' info line.
test("with valid consent, stderr contains 'saved verification result to:' info line", async () => {
  const { home, path } = await makeDemaHomeWithEnvelope(compliantEnvelope());
  const { stderr } = await runCli(
    [
      "model-broker",
      "verify-invocation",
      "--invocation-result-file",
      path,
      "--save-verification-result",
      "--save-verification-consent",
      SAVE_VERIFICATION_CONSENT,
    ],
    { env: { DEMA_HOME: home } },
  );
  assert.match(stderr, /saved verification result to:/);
  assert.match(stderr, new RegExp(home.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

// 7. Non_compliant verification envelope is still saved (auditability for both
//    success and failure).
test("non_compliant verification envelope is STILL saved (auditability for both verdicts)", async () => {
  const { home, path } = await makeDemaHomeWithEnvelope(nonCompliantEnvelope());
  const { stdout, exitCode } = await runCli(
    [
      "model-broker",
      "verify-invocation",
      "--invocation-result-file",
      path,
      "--save-verification-result",
      "--save-verification-consent",
      SAVE_VERIFICATION_CONSENT,
    ],
    { env: { DEMA_HOME: home } },
  );
  // non_compliant verdict → non-zero exit (per existing verify-invocation contract).
  assert.notEqual(exitCode, 0);
  const verification = JSON.parse(stdout);
  assert.equal(verification.verdict, "non_compliant");
  // Verification file is STILL written (auditability).
  const files = await readdir(join(home, "receipts"));
  const verificationFile = files.find(
    (f) => f.startsWith("verification-") && f.endsWith(".json"),
  );
  assert.ok(
    verificationFile,
    "non_compliant verification envelope must still be saved",
  );
  const onDisk = JSON.parse(
    await readFile(join(home, "receipts", verificationFile), "utf8"),
  );
  assert.equal(onDisk.verdict, "non_compliant");
});

// 8. No --save-verification-result means no verification-*.json file is written.
test("no --save-verification-result flag means no verification-*.json file is written", async () => {
  const { home, path } = await makeDemaHomeWithEnvelope(compliantEnvelope());
  const { exitCode } = await runCli(
    ["model-broker", "verify-invocation", "--invocation-result-file", path],
    { env: { DEMA_HOME: home } },
  );
  assert.equal(exitCode, 0);
  // receipts/ contains the source invocation-*.json, but no verification-* file.
  if (existsSync(join(home, "receipts"))) {
    const files = await readdir(join(home, "receipts"));
    const verificationFiles = files.filter((f) =>
      f.startsWith("verification-"),
    );
    assert.equal(
      verificationFiles.length,
      0,
      "no verification-* file should exist without --save-verification-result",
    );
  }
});

// 9. --save-verification-result outside verify-invocation exits non-zero with
//    helpful stderr.
test("'--save-verification-result' on 'route' action exits non-zero (only valid for verify-invocation)", async () => {
  const home = await mkdtemp(join(tmpdir(), "dema-verify-save-outside-"));
  const { stderr, exitCode } = await runCli(
    [
      "model-broker",
      "route",
      "--task",
      "synthesis",
      "--save-verification-result",
      "--save-verification-consent",
      SAVE_VERIFICATION_CONSENT,
    ],
    { env: { DEMA_HOME: home } },
  );
  assert.notEqual(exitCode, 0);
  assert.match(
    stderr,
    /--save-verification-result is only valid for the 'verify-invocation' action/,
  );
});

// 10. Re-running same verify-invocation produces two distinct verification
//     files if verified_at timestamps differ.
test("re-running verify-invocation creates content-addressed files; timestamps make each verification unique", async () => {
  const { home, path } = await makeDemaHomeWithEnvelope(compliantEnvelope());
  const r1 = await runCli(
    [
      "model-broker",
      "verify-invocation",
      "--invocation-result-file",
      path,
      "--save-verification-result",
      "--save-verification-consent",
      SAVE_VERIFICATION_CONSENT,
    ],
    { env: { DEMA_HOME: home } },
  );
  // Small sleep so verified_at ISO timestamp differs.
  await new Promise((res) => setTimeout(res, 20));
  const r2 = await runCli(
    [
      "model-broker",
      "verify-invocation",
      "--invocation-result-file",
      path,
      "--save-verification-result",
      "--save-verification-consent",
      SAVE_VERIFICATION_CONSENT,
    ],
    { env: { DEMA_HOME: home } },
  );
  assert.equal(r1.exitCode, 0);
  assert.equal(r2.exitCode, 0);
  const files = await readdir(join(home, "receipts"));
  const verificationFiles = files
    .filter((f) => f.startsWith("verification-") && f.endsWith(".json"))
    .sort();
  assert.equal(
    verificationFiles.length,
    2,
    `expected 2 distinct verification files (verified_at timestamps differ); got ${verificationFiles.length}`,
  );
  assert.notEqual(verificationFiles[0], verificationFiles[1]);
  // Each filename matches its file's sha256.
  for (const f of verificationFiles) {
    const onDisk = await readFile(join(home, "receipts", f), "utf8");
    const sha = createHash("sha256").update(onDisk).digest("hex");
    assert.equal(f, `verification-${sha}.json`);
  }
});

// Bonus invariant (mirrors invocation-result-save-cli test #7): --latest source
// path also supports saving.
test("--latest source path also supports --save-verification-result", async () => {
  const { home } = await makeDemaHomeWithEnvelope(compliantEnvelope());
  const { exitCode } = await runCli(
    [
      "model-broker",
      "verify-invocation",
      "--latest",
      "--save-verification-result",
      "--save-verification-consent",
      SAVE_VERIFICATION_CONSENT,
    ],
    { env: { DEMA_HOME: home } },
  );
  assert.equal(exitCode, 0);
  const files = await readdir(join(home, "receipts"));
  const verificationFiles = files.filter(
    (f) => f.startsWith("verification-") && f.endsWith(".json"),
  );
  assert.equal(verificationFiles.length, 1);
});
