import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const CLI = join(REPO_ROOT, "apps/cli/src/index.js");
const BOOTSTRAP_MODE_SCHEMA = "bizra.dema.bootstrap_mode.v0.1";

function freshHome() {
  return mkdtempSync(join(tmpdir(), "dema-bootcli-"));
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

test("dema bootstrap --json emits the schema-tagged frozen preview envelope", () => {
  const env = JSON.parse(runCLI(["bootstrap", "--json"], freshHome()));
  assert.equal(env.schema, BOOTSTRAP_MODE_SCHEMA);
  assert.equal(env.mode, "ephemeral_preview");
  assert.equal(env.model_status, "MODEL_UNKNOWN");
  assert.equal(env.stages.length, 7);
  for (const [key, value] of Object.entries(env.boundary)) {
    assert.equal(value, false, `boundary.${key} must be false`);
  }
});

test("dema bootstrap --summary emits compact preview/session-ready human text", () => {
  const out = runCLI(["bootstrap", "--summary"], freshHome());
  assert.ok(
    !out.trim().startsWith("{"),
    "summary must be human text, not JSON",
  );
  assert.ok(
    out.includes("session ready"),
    "summary surfaces the next-safe message",
  );
  for (const forbidden of ["node is born", "verified", "proof exists"]) {
    assert.ok(!out.includes(forbidden), `must not assert "${forbidden}"`);
  }
});

test("dema bootstrap (default) emits human text and exits 0", () => {
  const out = runCLI(["bootstrap"], freshHome());
  assert.ok(!out.trim().startsWith("{"), "default mode is human text");
  assert.ok(
    out.includes("Bootstrap Mode"),
    "default output identifies Bootstrap Mode",
  );
  assert.ok(
    out.includes("session ready"),
    "default output ends with next-safe message",
  );
});

test("dema bootstrap writes nothing to DEMA_HOME", () => {
  const home = freshHome();
  const before = readdirSync(home).sort();
  runCLI(["bootstrap", "--json"], home);
  const after = readdirSync(home).sort();
  assert.deepEqual(after, before, "DEMA_HOME must be untouched");
  assert.deepEqual(after, [], "fresh DEMA_HOME stays empty");
});
