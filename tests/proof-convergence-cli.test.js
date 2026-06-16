import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const CLI = join(REPO_ROOT, "apps/cli/src/index.js");
const SCHEMA = "bizra.dema.proof_convergence_preview.v0.1";

function freshHome() {
  return mkdtempSync(join(tmpdir(), "dema-pconvcli-"));
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

test("dema proof-convergence --json emits the schema-tagged frozen verdict", () => {
  const env = JSON.parse(
    runCLI(["proof", "convergence", "--json"], freshHome()),
  );
  assert.equal(env.schema, SCHEMA);
  assert.equal(env.mode, "preview_only");
  assert.ok(env.summary.total > 0, "grades a non-empty example claim set");
  assert.equal(
    env.summary.total,
    env.summary.converged + env.summary.partial + env.summary.declared,
    "bands partition the claims",
  );
  for (const [k, v] of Object.entries(env.boundary)) {
    assert.equal(v, false, `boundary.${k} must be false`);
  }
});

test("dema proof-convergence --summary emits compact human text, not JSON", () => {
  const out = runCLI(["proof", "convergence", "--summary"], freshHome());
  assert.ok(!out.trim().startsWith("{"), "summary is human text");
  assert.ok(/converg/i.test(out), "summary mentions convergence");
});

test("dema proof-convergence (default) labels the claims as illustrative/example", () => {
  const out = runCLI(["proof", "convergence"], freshHome());
  assert.ok(!out.trim().startsWith("{"), "default is human text");
  assert.ok(
    /example/i.test(out),
    "default output marks the claims as example/illustrative",
  );
});

test("dema proof-convergence writes nothing to DEMA_HOME", () => {
  const home = freshHome();
  const before = readdirSync(home).sort();
  runCLI(["proof", "convergence", "--json"], home);
  const after = readdirSync(home).sort();
  assert.deepEqual(after, before);
  assert.deepEqual(after, []);
});
