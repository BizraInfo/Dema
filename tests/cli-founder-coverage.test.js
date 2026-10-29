// In-process coverage for apps/cli/src/commands/founder.js refuse paths.
// Spawned dema children do not attribute under --experimental-test-coverage.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cmd_founder,
  runFounderImpactScope,
  runFounderImpactVerify,
} from "../apps/cli/src/commands/founder.js";

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

test("dema founder without impact action → usage exit 1", async (t) => {
  const err = [];
  t.mock.method(console, "error", (line) => err.push(String(line)));
  const signal = withExitThrow(t, 1);
  await assert.rejects(cmd_founder({ argv: ["founder"] }), (e) => e === signal);
  assert.match(err.join("\n"), /founder impact/);
});

test("dema founder impact scope missing manifest --json → refuse", async (t) => {
  const out = [];
  t.mock.method(console, "log", (line) => out.push(String(line)));
  const signal = withExitThrow(t, 1);
  await assert.rejects(
    cmd_founder({ argv: ["founder", "impact", "scope", "--json"] }),
    (e) => e === signal,
  );
  const body = JSON.parse(out[0]);
  assert.equal(body.ok, false);
  assert.equal(body.error, "missing_manifest_argument");
});

test("runFounderImpactScope missing path → missing_manifest_argument", async () => {
  const out = await runFounderImpactScope({});
  assert.equal(out.ok, false);
  assert.equal(out.error, "missing_manifest_argument");
});

test("dema founder impact run missing manifest --json → refuse", async (t) => {
  const out = [];
  t.mock.method(console, "log", (line) => out.push(String(line)));
  const signal = withExitThrow(t, 1);
  await assert.rejects(
    cmd_founder({ argv: ["founder", "impact", "run", "--json"] }),
    (e) => e === signal,
  );
  const body = JSON.parse(out[0]);
  assert.equal(body.ok, false);
  assert.equal(body.error, "missing_manifest_argument");
});

test("dema founder impact verify missing receipt --json → refuse", async (t) => {
  const out = [];
  t.mock.method(console, "log", (line) => out.push(String(line)));
  const signal = withExitThrow(t, 1);
  await assert.rejects(
    cmd_founder({ argv: ["founder", "impact", "verify", "--json"] }),
    (e) => e === signal,
  );
  const body = JSON.parse(out[0]);
  assert.equal(body.ok, false);
  assert.ok(typeof body.error === "string");
});

test("runFounderImpactVerify absent path → error", async () => {
  const out = await runFounderImpactVerify({
    receiptPath: "/tmp/dema-founder-receipt-absent-no-such.json",
  });
  assert.equal(out.ok, false);
  assert.ok(typeof out.error === "string");
});
