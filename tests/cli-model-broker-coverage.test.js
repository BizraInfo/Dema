// In-process coverage for apps/cli/src/commands/model-broker.js refuse paths.
// Spawned dema children do not attribute under --experimental-test-coverage.

import { test } from "node:test";
import assert from "node:assert/strict";
import { cmd_model_broker } from "../apps/cli/src/commands/model-broker.js";

function withExitThrow(t, expectedCode) {
  process.exitCode = 0;
  const signal = new Error("test CLI exit");
  t.mock.method(process, "exit", (code) => {
    assert.equal(code, expectedCode);
    throw signal;
  });
  t.after(() => {
    process.exitCode = 0;
  });
  return signal;
}

function captureStderr(t) {
  const chunks = [];
  t.mock.method(process.stderr, "write", (chunk) => {
    chunks.push(String(chunk));
    return true;
  });
  return chunks;
}

test("model-broker unknown action → usage exit 1", async (t) => {
  const err = captureStderr(t);
  const signal = withExitThrow(t, 1);
  await assert.rejects(
    cmd_model_broker({ argv: ["model-broker", "nope"] }),
    (e) => e === signal,
  );
  assert.match(err.join(""), /unknown action/);
});

test("verify-invocation missing file/--latest → refuse", async (t) => {
  const err = captureStderr(t);
  const signal = withExitThrow(t, 1);
  await assert.rejects(
    cmd_model_broker({ argv: ["model-broker", "verify-invocation"] }),
    (e) => e === signal,
  );
  assert.match(err.join(""), /--invocation-result-file.*--latest/);
});

test("verify-invocation mutually exclusive flags → refuse", async (t) => {
  const err = captureStderr(t);
  const signal = withExitThrow(t, 1);
  await assert.rejects(
    cmd_model_broker({
      argv: [
        "model-broker",
        "verify-invocation",
        "--invocation-result-file",
        "/tmp/x.json",
        "--latest",
      ],
    }),
    (e) => e === signal,
  );
  assert.match(err.join(""), /mutually exclusive/);
});

test("verify-invocation relative path → refuse", async (t) => {
  const err = captureStderr(t);
  const signal = withExitThrow(t, 1);
  await assert.rejects(
    cmd_model_broker({
      argv: [
        "model-broker",
        "verify-invocation",
        "--invocation-result-file",
        "relative.json",
      ],
    }),
    (e) => e === signal,
  );
  assert.match(err.join(""), /must be absolute/);
});

test("route missing task/role → refuse", async (t) => {
  const err = captureStderr(t);
  const signal = withExitThrow(t, 1);
  await assert.rejects(
    cmd_model_broker({ argv: ["model-broker", "route"] }),
    (e) => e === signal,
  );
  assert.match(err.join(""), /--task.*--required-role/);
});

test("route mutually exclusive registry inputs → refuse", async (t) => {
  const err = captureStderr(t);
  const signal = withExitThrow(t, 1);
  await assert.rejects(
    cmd_model_broker({
      argv: [
        "model-broker",
        "route",
        "--task",
        "code",
        "--registry-stdin",
        "--use-local-registry",
      ],
    }),
    (e) => e === signal,
  );
  assert.match(err.join(""), /mutually exclusive/);
});
