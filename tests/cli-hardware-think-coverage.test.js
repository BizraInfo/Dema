// In-process coverage for apps/cli hardware + think command surfaces.
// Spawned `node bin/dema …` children are invisible to --experimental-test-coverage
// (same lesson as RECEIPTS-VERIFY-REJECT-COVERAGE-1A).

import { test } from "node:test";
import assert from "node:assert/strict";
import { cmd_hardware } from "../apps/cli/src/commands/hardware.js";
import { cmd_think } from "../apps/cli/src/commands/think.js";

function withExitThrow(t, expectedCode) {
  // Prior cmd_* paths set process.exitCode before process.exit; clear so
  // later success paths do not inherit a sticky nonzero code.
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

test("dema hardware without profile → usage exit 1", async (t) => {
  const errLines = [];
  t.mock.method(console, "error", (line) => errLines.push(String(line)));
  const signal = withExitThrow(t, 1);
  await assert.rejects(cmd_hardware({ argv: ["hardware"] }), (e) => e === signal);
  assert.match(errLines.join("\n"), /node bin\/dema hardware profile/);
});

test("dema hardware profile --json → valid profile envelope", async (t) => {
  process.exitCode = 0;
  t.after(() => {
    process.exitCode = 0;
  });
  const out = [];
  t.mock.method(console, "log", (line) => out.push(String(line)));
  await cmd_hardware({ argv: ["hardware", "profile", "--json"] });
  const profile = JSON.parse(out.join(""));
  assert.equal(profile.valid, true);
  assert.ok(typeof profile.truth_label === "string");
  assert.ok(profile.observations);
  assert.ok(profile.capacity_classes);
});

test("dema hardware profile (human) → prints tier and rules", async (t) => {
  const out = [];
  t.mock.method(console, "log", (line) => out.push(String(line)));
  await cmd_hardware({ argv: ["hardware", "profile"] });
  const text = out.join("\n");
  assert.match(text, /Node0 hardware profile/);
  assert.match(text, /tier:/);
  assert.match(text, /rules/);
});

test("dema think --dry-run --json without query → exit 1", async (t) => {
  const out = [];
  t.mock.method(console, "log", (line) => out.push(String(line)));
  const signal = withExitThrow(t, 1);
  await assert.rejects(
    cmd_think({ argv: ["think", "--dry-run", "--json"] }),
    (e) => e === signal,
  );
  const body = JSON.parse(out[0]);
  assert.equal(body.schema, "bizra.dema.think_dry_run.v0.1");
  assert.match(body.error, /Missing query/);
});

test("dema think dry-run + consent together → exit 1", async (t) => {
  const out = [];
  t.mock.method(console, "log", (line) => out.push(String(line)));
  const signal = withExitThrow(t, 1);
  await assert.rejects(
    cmd_think({
      argv: ["think", "q", "--dry-run", "--consent", "RUN LOCAL THINK", "--json"],
    }),
    (e) => e === signal,
  );
  const body = JSON.parse(out[0]);
  assert.match(body.error, /Cannot use both/);
});

test("dema think without dry-run or consent → exit 1", async (t) => {
  const out = [];
  t.mock.method(console, "log", (line) => out.push(String(line)));
  const signal = withExitThrow(t, 1);
  await assert.rejects(
    cmd_think({ argv: ["think", "hello", "--json"] }),
    (e) => e === signal,
  );
  const body = JSON.parse(out[0]);
  assert.equal(body.schema, "bizra.dema.think_live.v0.1");
  assert.match(body.error, /Specify --dry-run or --consent/);
});

test("dema think query --dry-run --json → dry-run envelope", async (t) => {
  const out = [];
  t.mock.method(console, "log", (line) => out.push(String(line)));
  const signal = withExitThrow(t, 0);
  await assert.rejects(
    cmd_think({ argv: ["think", "coverage probe", "--dry-run", "--json"] }),
    (e) => e === signal,
  );
  const body = JSON.parse(out[0]);
  assert.equal(body.schema, "bizra.dema.think_dry_run.v0.1");
  assert.ok(!body.error, body.error);
});

test("dema think query --dry-run (human) → formatted text", async (t) => {
  const out = [];
  t.mock.method(console, "log", (line) => out.push(String(line)));
  const signal = withExitThrow(t, 0);
  await assert.rejects(
    cmd_think({ argv: ["think", "coverage probe", "--dry-run"] }),
    (e) => e === signal,
  );
  assert.ok(out.join("\n").length > 0);
});
