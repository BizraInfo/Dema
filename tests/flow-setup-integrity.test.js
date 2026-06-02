import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

// TRACK 3 · Behavioral-flow harness — lifecycle chain (NOT single commands).
//
// The audit deduction was "behavioral-test thinness": the suite is line-rich
// but most e2e tests run ONE command against a FRESH home. These flows thread a
// SINGLE persistent DEMA_HOME through a command SEQUENCE and assert cumulative
// state — the behavior a real operator experiences.
//
// Flow 1 (this file): first-run/setup → setup-check → witness.

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = join(REPO_ROOT, "apps/cli/src/index.js");
const BASE_ENV = {
  ...process.env,
  NO_COLOR: "1",
  NODE_ENV: "test",
  DEMA_NO_TUI: "1",
};

function run(home, args) {
  const r = spawnSync("node", [CLI, ...args], {
    cwd: REPO_ROOT,
    env: { ...BASE_ENV, DEMA_HOME: home },
    encoding: "utf8",
    timeout: 15000,
  });
  return { stdout: r.stdout || "", stderr: r.stderr || "", status: r.status };
}

function runJson(home, args) {
  return JSON.parse(run(home, args).stdout);
}

function freshHome() {
  return mkdtempSync(join(tmpdir(), "dema-flow-setup-"));
}

describe("flow: setup → setup-check → witness (persistent home)", () => {
  it("initializes a fresh home, verifies INTACT, and emits a valid witness receipt", () => {
    const home = freshHome();
    try {
      // Step 1 — setup creates the local skeleton.
      const setup = runJson(home, ["setup", "--json"]);
      assert.equal(setup.schema, "bizra.dema.setup.v0.1");
      assert.equal(setup.created, true);
      assert.equal(setup.paths.home, home);

      // Step 2 — setup-check confirms integrity on the SAME home.
      const check = runJson(home, ["setup-check", "--json"]);
      assert.equal(check.schema, "bizra.dema.setup_check.v0.1");
      assert.equal(check.verdict, "INTACT");
      assert.equal(check.integrity, "VERIFIED");

      // Step 3 — witness emits a signed Node0 self-witness receipt that
      // attests the constitutional counts (PAT=7, SAT=5) for THIS node.
      const witness = runJson(home, ["witness", "--json"]);
      assert.equal(witness.schema, "bizra.dema.node0_witness_receipt.v0.1");
      assert.equal(witness.truth_label, "LOCAL_OPERATOR_WITNESS");
      assert.equal(witness.attests.node, "Node0");
      assert.equal(witness.attests.pat_count, 7);
      assert.equal(witness.attests.sat_count, 5);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("setup is idempotent: re-running keeps the home INTACT", () => {
    const home = freshHome();
    try {
      runJson(home, ["setup", "--json"]);
      const again = runJson(home, ["setup", "--json"]);
      assert.equal(again.schema, "bizra.dema.setup.v0.1");
      // A second setup must not corrupt the home.
      const check = runJson(home, ["setup-check", "--json"]);
      assert.equal(check.verdict, "INTACT");
      assert.equal(check.integrity, "VERIFIED");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});
