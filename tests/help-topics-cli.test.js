import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(new URL("../apps/cli/src/index.js", import.meta.url));

test("dema help (no args) → stdout contains 'Available topics:' + at least 5 topic names", async () => {
  const { stdout } = await execFileAsync("node", [cliPath, "help"]);
  assert.match(stdout, /Available topics:/);
  const topicNames = ["orientation", "readiness", "preview", "evidence", "spine", "tasks"];
  let found = 0;
  for (const name of topicNames) {
    if (stdout.includes(name)) found++;
  }
  assert.ok(found >= 5, `Expected ≥5 topic names, found ${found}`);
});

test("dema help readiness → stdout contains 'dema status' and 'dema doctor'", async () => {
  const { stdout } = await execFileAsync("node", [cliPath, "help", "readiness"]);
  assert.match(stdout, /dema status/);
  assert.match(stdout, /dema doctor/);
});

test("dema help status → stdout contains 'dema status' (syntax line)", async () => {
  const { stdout } = await execFileAsync("node", [cliPath, "help", "status"]);
  assert.match(stdout, /dema status/);
  assert.match(stdout, /Boundary:/);
});

test("dema help --all → stdout contains full HELP text (≥80 lines)", async () => {
  const { stdout } = await execFileAsync("node", [cliPath, "help", "--all"]);
  const lines = stdout.split("\n");
  assert.ok(lines.length >= 80, `Expected ≥80 lines in full help, got ${lines.length}`);
  assert.match(stdout, /Dema CLI/);
  assert.match(stdout, /Orientation:/);
  assert.match(stdout, /Spine preview surfaces/);
});

test("dema help xyz → stdout contains unknown-topic message", async () => {
  const { stdout } = await execFileAsync("node", [cliPath, "help", "xyz"]);
  assert.match(stdout, /I don't have a topic or command named/);
  assert.match(stdout, /xyz/);
});
