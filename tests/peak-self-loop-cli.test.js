import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const CLI = join(REPO_ROOT, "apps/cli/src/index.js");
const SCHEMA = "bizra.dema.peak_self_loop_preview.v0.1";

function freshHome() {
  return mkdtempSync(join(tmpdir(), "dema-pslcli-"));
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

test("dema peak-self-loop --json emits schema-tagged frozen preview", () => {
  const env = JSON.parse(runCLI(["peak-self-loop", "--json"], freshHome()));
  assert.equal(env.schema, SCHEMA);
  assert.equal(env.mode, "preview_only");
  assert.ok(env.snr_framework.score >= 0);
  assert.ok(env.proactive_self.harness.active_gates.length >= 1);
  for (const [k, v] of Object.entries(env.boundary)) {
    assert.equal(v, false, `boundary.${k} must be false`);
  }
});

test("dema realm proof-studio --json routes to peak self-loop preview", () => {
  const env = JSON.parse(
    runCLI(["realm", "proof-studio", "--json"], freshHome()),
  );
  assert.equal(env.schema, SCHEMA);
  assert.equal(env.autonomous_rsi.not_autonomous_runtime, true);
});

test("dema realm go 5 --json dispatches to proof studio", () => {
  const env = JSON.parse(runCLI(["realm", "go", "5", "--json"], freshHome()));
  assert.equal(env.schema, SCHEMA);
});

test("dema peak-self-loop writes nothing to DEMA_HOME", () => {
  const home = freshHome();
  const before = readdirSync(home).sort();
  runCLI(["peak-self-loop", "--json"], home);
  const after = readdirSync(home).sort();
  assert.deepEqual(after, before);
  assert.deepEqual(after, []);
});
