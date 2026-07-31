import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { cmd_model_broker } from "../apps/cli/src/commands/model-broker.js";

class ExitSignal extends Error {
  constructor(code) {
    super(`process.exit(${code})`);
    this.code = code;
  }
}

async function runModelBroker(argv, { env = {} } = {}) {
  const originalExit = process.exit;
  const originalExitCode = process.exitCode;
  const originalStdoutWrite = process.stdout.write;
  const originalStderrWrite = process.stderr.write;
  const originalEnv = {};
  let stdout = "";
  let stderr = "";
  let exitCode = 0;

  for (const key of Object.keys(env)) originalEnv[key] = process.env[key];
  process.exitCode = undefined;
  Object.assign(process.env, env);
  process.exit = (code = 0) => {
    throw new ExitSignal(code);
  };
  process.stdout.write = (chunk, _encoding, callback) => {
    stdout += String(chunk);
    if (typeof callback === "function") callback();
    return true;
  };
  process.stderr.write = (chunk, _encoding, callback) => {
    stderr += String(chunk);
    if (typeof callback === "function") callback();
    return true;
  };

  try {
    await cmd_model_broker({ argv });
    exitCode = process.exitCode ?? 0;
  } catch (err) {
    if (!(err instanceof ExitSignal)) throw err;
    exitCode = err.code;
  } finally {
    process.exit = originalExit;
    process.exitCode = originalExitCode;
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
    for (const key of Object.keys(env)) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  }

  return { stdout, stderr, exitCode };
}

test("model-broker rejects unknown and underspecified actions in process", async () => {
  const unknown = await runModelBroker(["model-broker", "unknown"]);
  assert.equal(unknown.exitCode, 1);
  assert.match(unknown.stderr, /unknown action/);

  const missingTask = await runModelBroker(["model-broker", "route"]);
  assert.equal(missingTask.exitCode, 1);
  assert.match(missingTask.stderr, /--task <kind> or --required-role/);
});

test("model-broker route rejects invalid flag combinations before effects", async () => {
  const saveVerification = await runModelBroker([
    "model-broker",
    "route",
    "--task",
    "synthesis",
    "--save-verification-result",
  ]);
  assert.equal(saveVerification.exitCode, 1);
  assert.match(saveVerification.stderr, /only valid for the 'verify-invocation'/);

  const registryModes = await runModelBroker([
    "model-broker",
    "route",
    "--task",
    "synthesis",
    "--registry-stdin",
    "--use-local-registry",
  ]);
  assert.equal(registryModes.exitCode, 1);
  assert.match(registryModes.stderr, /mutually exclusive/);

  const relativeRegistry = await runModelBroker([
    "model-broker",
    "route",
    "--task",
    "synthesis",
    "--registry-file",
    "relative.json",
  ]);
  assert.equal(relativeRegistry.exitCode, 1);
  assert.match(relativeRegistry.stderr, /path must be absolute/);
});

test("model-broker route reports local registry file failures and route success", async () => {
  const consent = ["--registry-consent", "GO: load operator model registry"];
  const home = await mkdtemp(join(tmpdir(), "dema-model-broker-inprocess-"));
  const missingRegistry = await runModelBroker(
    [
      "model-broker",
      "route",
      "--task",
      "synthesis",
      "--use-local-registry",
      ...consent,
    ],
    { env: { DEMA_HOME: home } },
  );
  assert.equal(missingRegistry.exitCode, 1);
  assert.match(missingRegistry.stderr, /registry file not found/);

  await mkdir(join(home, "models"), { recursive: true });
  await writeFile(join(home, "models", "registry.json"), "{\"entries\":[]}\n");
  const success = await runModelBroker(
    [
      "model-broker",
      "route",
      "--task",
      "synthesis",
      "--use-local-registry",
      ...consent,
    ],
    { env: { DEMA_HOME: home } },
  );
  assert.equal(success.exitCode, 0);
  assert.equal(JSON.parse(success.stdout).schema, "bizra.dema.local_model_route_receipt.v0.1");
});

test("model-broker verify-invocation validates file selection arguments", async () => {
  const missingTarget = await runModelBroker([
    "model-broker",
    "verify-invocation",
  ]);
  assert.equal(missingTarget.exitCode, 1);
  assert.match(missingTarget.stderr, /one of --invocation-result-file/);

  const mutuallyExclusive = await runModelBroker([
    "model-broker",
    "verify-invocation",
    "--invocation-result-file",
    "/tmp/invocation.json",
    "--latest",
  ]);
  assert.equal(mutuallyExclusive.exitCode, 1);
  assert.match(mutuallyExclusive.stderr, /mutually exclusive/);

  const relativePath = await runModelBroker([
    "model-broker",
    "verify-invocation",
    "--invocation-result-file",
    "relative.json",
  ]);
  assert.equal(relativePath.exitCode, 1);
  assert.match(relativePath.stderr, /path must be absolute/);
});
