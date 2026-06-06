// dema first-run + --version regression tests.
// Locks the 5-step composed entry command + CLI version flag contract.

import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import {
  FIRST_RUN_SCHEMA,
  FIRST_RUN_STEPS,
  buildFirstRunPlan,
  formatFirstRunPlan,
  summarizeFirstRunOutcome,
} from "../packages/core/src/first-run.js";

const execFileAsync = promisify(execFile);
const indexPath = fileURLToPath(
  new URL("../apps/cli/src/index.js", import.meta.url),
);
const pkgPath = fileURLToPath(new URL("../package.json", import.meta.url));

async function readVersion() {
  const raw = await readFile(pkgPath, "utf8");
  return JSON.parse(raw).version;
}

test("FIRST_RUN_SCHEMA matches v0.1", () => {
  assert.equal(FIRST_RUN_SCHEMA, "bizra.dema.first_run.v0.1");
});

test("FIRST_RUN_STEPS is the canonical 5-step plan in order", () => {
  assert.equal(FIRST_RUN_STEPS.length, 5);
  assert.deepEqual(
    FIRST_RUN_STEPS.map((s) => s.id),
    ["welcome", "setup", "status", "doctor", "next"],
  );
  // Each step is frozen and carries label + command + description.
  for (const step of FIRST_RUN_STEPS) {
    assert.ok(Object.isFrozen(step));
    assert.ok(step.label && typeof step.label === "string");
    assert.ok(step.command && typeof step.command === "string");
    assert.ok(step.description && typeof step.description === "string");
  }
});

test("buildFirstRunPlan default mode = EXECUTE, boundary flags setup write", () => {
  const plan = buildFirstRunPlan();
  assert.equal(plan.mode, "EXECUTE");
  assert.equal(plan.boundary.read_only, false);
  assert.equal(plan.boundary.filesystem_write_performed_by_setup, true);
});

test("buildFirstRunPlan --dry-run mode = DRY_RUN, boundary is read-only", () => {
  const plan = buildFirstRunPlan({ dry_run: true });
  assert.equal(plan.mode, "DRY_RUN");
  assert.equal(plan.boundary.read_only, true);
  assert.equal(plan.boundary.filesystem_write_performed_by_setup, false);
});

test("boundary always denies network, mint, external_send, urp_runtime", () => {
  for (const dry of [false, true]) {
    const plan = buildFirstRunPlan({ dry_run: dry });
    assert.equal(plan.boundary.network, false);
    assert.equal(plan.boundary.mint, false);
    assert.equal(plan.boundary.external_send, false);
    assert.equal(plan.boundary.urp_runtime, false);
  }
});

test("formatFirstRunPlan renders all 5 steps + boundary lines", () => {
  const text = formatFirstRunPlan(buildFirstRunPlan());
  assert.match(text, /DEMA · first-run plan/);
  assert.match(text, /Welcome/);
  assert.match(text, /Setup/);
  assert.match(text, /Status/);
  assert.match(text, /Doctor/);
  assert.match(text, /Next safe action/);
  assert.match(text, /Boundary:/);
  assert.match(text, /network:\s+false/);
});

test("summarizeFirstRunOutcome — all predicates ok → ok=true, suggests journey preview", () => {
  const outcome = summarizeFirstRunOutcome({
    status: { ready: true },
    predicates: [
      { key: "activationGate", status: "ok" },
      { key: "daemonStatus", status: "ok" },
    ],
  });
  assert.equal(outcome.ok, true);
  assert.match(outcome.suggested_next, /dema journey/);
});

test("summarizeFirstRunOutcome — failing predicate → ok=false, points at doctor", () => {
  const outcome = summarizeFirstRunOutcome({
    status: { ready: false },
    predicates: [
      { key: "ready", status: "fail" },
      { key: "activationGate", status: "ok" },
    ],
  });
  assert.equal(outcome.ok, false);
  assert.deepEqual(outcome.failed_predicates, ["ready"]);
  assert.match(outcome.suggested_next, /dema doctor/);
});

test("`dema --version` prints the package.json version", async () => {
  const expected = await readVersion();
  const { stdout } = await execFileAsync("node", [indexPath, "--version"], {
    encoding: "utf8",
    env: { ...process.env, DEMA_NO_TUI: "1", NODE_ENV: "test" },
  });
  assert.match(stdout, new RegExp(`dema ${expected.replace(/\./g, "\\.")}`));
});

test("`dema -v` prints the package.json version (short flag)", async () => {
  const expected = await readVersion();
  const { stdout } = await execFileAsync("node", [indexPath, "-v"], {
    encoding: "utf8",
    env: { ...process.env, DEMA_NO_TUI: "1", NODE_ENV: "test" },
  });
  assert.match(stdout, new RegExp(`dema ${expected.replace(/\./g, "\\.")}`));
});

test("`dema --version --json` emits machine-parseable envelope", async () => {
  const expected = await readVersion();
  const { stdout } = await execFileAsync(
    "node",
    [indexPath, "--version", "--json"],
    {
      encoding: "utf8",
      env: { ...process.env, DEMA_NO_TUI: "1", NODE_ENV: "test" },
    },
  );
  const parsed = JSON.parse(stdout);
  assert.equal(parsed.schema, "bizra.dema.cli_version.v0.1");
  assert.equal(parsed.name, "dema");
  assert.equal(parsed.version, expected);
});

test("`dema first-run --dry-run --json` runs without mutating DEMA_HOME", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "dema-first-run-dry-"));
  try {
    const { stdout, stderr } = await execFileAsync(
      "node",
      [indexPath, "first-run", "--dry-run", "--json", "--no-color"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          DEMA_HOME: tmp,
          DEMA_NO_TUI: "1",
          NODE_ENV: "test",
        },
      },
    );
    // stdout is JSON; stderr is the human header.
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.plan.schema, FIRST_RUN_SCHEMA);
    assert.equal(parsed.plan.mode, "DRY_RUN");
    assert.equal(parsed.plan.boundary.read_only, true);
    assert.match(stderr, /==> 1\. Welcome/);
    assert.match(stderr, /\[dry-run\]/);
    assert.match(stderr, /==> 3\. Status/);
    assert.match(stderr, /==> 4\. Doctor/);
    assert.match(stderr, /==> 5\. Next safe action/);
    // Verify NO file under tmp (dry run must not write).
    await assert.rejects(stat(join(tmp, "profile.json")));
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test("`dema first-run --json` (execute mode) creates ~/.dema/profile.json idempotently", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "dema-first-run-exec-"));
  try {
    const { stdout } = await execFileAsync(
      "node",
      [indexPath, "first-run", "--json", "--no-color"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          DEMA_HOME: tmp,
          DEMA_NO_TUI: "1",
          NODE_ENV: "test",
        },
      },
    );
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.plan.mode, "EXECUTE");
    assert.equal(
      parsed.plan.boundary.filesystem_write_performed_by_setup,
      true,
    );
    // profile.json must exist after first-run execute.
    const profile = JSON.parse(
      await readFile(join(tmp, "profile.json"), "utf8"),
    );
    assert.equal(profile.schema, "bizra.dema.profile.v0.1");
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test("`dema first-run --json --plan-only` emits plan envelope only (no side effects)", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "dema-first-run-plan-only-"));
  try {
    const { stdout } = await execFileAsync(
      "node",
      [indexPath, "first-run", "--json", "--plan-only", "--no-color"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          DEMA_HOME: tmp,
          DEMA_NO_TUI: "1",
          NODE_ENV: "test",
        },
      },
    );
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.schema, FIRST_RUN_SCHEMA);
    assert.equal(parsed.steps.length, 5);
    // No profile.json must exist after --plan-only.
    await assert.rejects(stat(join(tmp, "profile.json")));
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test("Plan envelope is deep-frozen", () => {
  const plan = buildFirstRunPlan();
  assert.ok(Object.isFrozen(plan));
  assert.ok(Object.isFrozen(plan.steps));
  assert.ok(Object.isFrozen(plan.boundary));
});
