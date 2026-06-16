import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { SEED_LOOP_PREVIEW_SCHEMA } from "../packages/core/src/seed-loop-preview.js";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const CLI = join(REPO_ROOT, "apps/cli/src/index.js");

function freshHome() {
  return mkdtempSync(join(tmpdir(), "dema-seedcli-"));
}

function runCLI(args, home) {
  return execFileSync("node", [CLI, ...args], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      NO_COLOR: "1",
      NODE_ENV: "test",
      DEMA_NO_TUI: "1",
      DEMA_HOME: home,
    },
    timeout: 15000,
  }).toString();
}

test("dema seed --json emits the schema-tagged frozen loop envelope", () => {
  const env = JSON.parse(runCLI(["seed", "--json"], freshHome()));
  assert.equal(env.schema, SEED_LOOP_PREVIEW_SCHEMA);
  assert.equal(env.mode, "preview_only");
  assert.ok(["ADVANCE", "HOLD", "REFUSED"].includes(env.posture));
  assert.equal(env.stages.length, 6);
  for (const [k, v] of Object.entries(env.boundary)) {
    assert.equal(v, false, `boundary.${k} must be false`);
  }
});

test("dema seed --summary emits compact human text mentioning the loop posture", () => {
  const out = runCLI(["seed", "--summary"], freshHome());
  assert.ok(!out.trim().startsWith("{"), "summary is human text");
  assert.ok(/ADVANCE|HOLD|REFUSED/.test(out), "summary surfaces the posture");
});

test("dema seed (default) labels the loop as illustrative/example and shows the stages", () => {
  const out = runCLI(["seed"], freshHome());
  assert.ok(!out.trim().startsWith("{"), "default is human text");
  assert.ok(
    /example/i.test(out),
    "default marks the loop as example/illustrative",
  );
  assert.ok(
    /assumption/i.test(out) && /consent/i.test(out),
    "shows the loop stages",
  );
});

test("dema seed writes nothing to DEMA_HOME", () => {
  const home = freshHome();
  const before = readdirSync(home).sort();
  runCLI(["seed", "--json"], home);
  const after = readdirSync(home).sort();
  assert.deepEqual(after, before);
  assert.deepEqual(after, []);
});
