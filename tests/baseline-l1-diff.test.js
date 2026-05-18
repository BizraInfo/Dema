import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(__dirname, "..", "scripts", "baseline-l1-diff.mjs");

function makeBaseline({ sha, packages_loc, tests_loc, tests_pass, schemas, cli_in_help }) {
  return {
    schema: "bizra.dema.baseline_l1.v0.1",
    truth_label: "NODE0_LOCAL_SEED",
    mode: "snapshot",
    measured_at: "2026-05-18T00:00:00.000Z",
    git: {
      commit_sha: `${sha}0000000000000000000000000000000000000000`.slice(0, 40),
      short_sha: sha,
      branch: "test",
      working_tree_clean: true
    },
    source_state: {
      packages_loc, packages_files: 60,
      tests_loc, tests_files: 60,
      scripts_loc: 1000, scripts_files: 10,
      apps_loc: 500, apps_files: 1,
      schemas_declared_unique: schemas, cli_commands_in_help: cli_in_help
    },
    test_state: { pass: tests_pass, fail: 0, total: tests_pass, completed: true },
    boundary: {},
    notes: []
  };
}

function runDiff(beforePath, afterPath) {
  const stdout = execFileSync("node", [SCRIPT, "--files", beforePath, afterPath], { encoding: "utf8" });
  return JSON.parse(stdout);
}

function withFixtures(fn) {
  const dir = mkdtempSync(join(tmpdir(), "baseline-diff-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("baseline-l1-diff emits canonical schema + truth label + snapshot_diff mode", () => {
  withFixtures((dir) => {
    const a = join(dir, "a.json");
    const b = join(dir, "b.json");
    writeFileSync(a, JSON.stringify(makeBaseline({ sha: "aaa1111", packages_loc: 100, tests_loc: 100, tests_pass: 50, schemas: 5, cli_in_help: 10 })));
    writeFileSync(b, JSON.stringify(makeBaseline({ sha: "bbb2222", packages_loc: 200, tests_loc: 300, tests_pass: 80, schemas: 7, cli_in_help: 12 })));
    const diff = runDiff(a, b);
    assert.equal(diff.schema, "bizra.dema.baseline_l1_diff.v0.1");
    assert.equal(diff.truth_label, "NODE0_LOCAL_SEED");
    assert.equal(diff.mode, "snapshot_diff");
  });
});

test("baseline-l1-diff computes per-metric deltas correctly", () => {
  withFixtures((dir) => {
    const a = join(dir, "a.json");
    const b = join(dir, "b.json");
    writeFileSync(a, JSON.stringify(makeBaseline({ sha: "aaa1111", packages_loc: 100, tests_loc: 100, tests_pass: 50, schemas: 5, cli_in_help: 10 })));
    writeFileSync(b, JSON.stringify(makeBaseline({ sha: "bbb2222", packages_loc: 200, tests_loc: 300, tests_pass: 80, schemas: 7, cli_in_help: 12 })));
    const diff = runDiff(a, b);
    assert.equal(diff.source_state_delta.packages_loc.delta, 100);
    assert.equal(diff.source_state_delta.tests_loc.delta, 200);
    assert.equal(diff.source_state_delta.schemas_declared_unique.delta, 2);
    assert.equal(diff.source_state_delta.cli_commands_in_help.delta, 2);
    assert.equal(diff.test_state_delta.pass.delta, 30);
  });
});

test("baseline-l1-diff captures pair metadata (sha · branch · measured_at)", () => {
  withFixtures((dir) => {
    const a = join(dir, "a.json");
    const b = join(dir, "b.json");
    writeFileSync(a, JSON.stringify(makeBaseline({ sha: "aaa1111", packages_loc: 100, tests_loc: 100, tests_pass: 50, schemas: 5, cli_in_help: 10 })));
    writeFileSync(b, JSON.stringify(makeBaseline({ sha: "bbb2222", packages_loc: 200, tests_loc: 300, tests_pass: 80, schemas: 7, cli_in_help: 12 })));
    const diff = runDiff(a, b);
    assert.equal(diff.pair.before.sha, "aaa1111");
    assert.equal(diff.pair.after.sha, "bbb2222");
    assert.ok(diff.pair.before.branch);
    assert.ok(diff.pair.after.branch);
  });
});

test("verify_before_assert_trend names tests_keep_up_or_outpace_packages when tests grow faster", () => {
  withFixtures((dir) => {
    const a = join(dir, "a.json");
    const b = join(dir, "b.json");
    writeFileSync(a, JSON.stringify(makeBaseline({ sha: "aaa1111", packages_loc: 100, tests_loc: 100, tests_pass: 50, schemas: 5, cli_in_help: 10 })));
    // packages +1.8%, tests +67% (mirrors the real session arc)
    writeFileSync(b, JSON.stringify(makeBaseline({ sha: "bbb2222", packages_loc: 101.8, tests_loc: 167, tests_pass: 80, schemas: 7, cli_in_help: 12 })));
    const diff = runDiff(a, b);
    assert.equal(diff.verify_before_assert_trend, "tests_keep_up_or_outpace_packages");
  });
});

test("verify_before_assert_trend names tests_lag_packages_significantly when packages grow faster", () => {
  withFixtures((dir) => {
    const a = join(dir, "a.json");
    const b = join(dir, "b.json");
    writeFileSync(a, JSON.stringify(makeBaseline({ sha: "aaa1111", packages_loc: 100, tests_loc: 100, tests_pass: 50, schemas: 5, cli_in_help: 10 })));
    // packages +100%, tests +10%
    writeFileSync(b, JSON.stringify(makeBaseline({ sha: "bbb2222", packages_loc: 200, tests_loc: 110, tests_pass: 55, schemas: 7, cli_in_help: 12 })));
    const diff = runDiff(a, b);
    assert.equal(diff.verify_before_assert_trend, "tests_lag_packages_significantly");
  });
});

test("verify_before_assert_trend names shrinking_packages when packages shrink", () => {
  withFixtures((dir) => {
    const a = join(dir, "a.json");
    const b = join(dir, "b.json");
    writeFileSync(a, JSON.stringify(makeBaseline({ sha: "aaa1111", packages_loc: 200, tests_loc: 100, tests_pass: 50, schemas: 5, cli_in_help: 10 })));
    writeFileSync(b, JSON.stringify(makeBaseline({ sha: "bbb2222", packages_loc: 100, tests_loc: 100, tests_pass: 50, schemas: 5, cli_in_help: 10 })));
    const diff = runDiff(a, b);
    assert.equal(diff.verify_before_assert_trend, "shrinking_packages");
  });
});

test("baseline-l1-diff rejects non-baseline_l1.v0.1 inputs", () => {
  withFixtures((dir) => {
    const a = join(dir, "a.json");
    const b = join(dir, "b.json");
    writeFileSync(a, JSON.stringify({ schema: "something.else.v0.1" }));
    writeFileSync(b, JSON.stringify(makeBaseline({ sha: "bbb2222", packages_loc: 100, tests_loc: 100, tests_pass: 50, schemas: 5, cli_in_help: 10 })));
    assert.throws(() => runDiff(a, b), /Command failed/);
  });
});

test("baseline-l1-diff output includes canonical 16-key boundary all-false", () => {
  withFixtures((dir) => {
    const a = join(dir, "a.json");
    const b = join(dir, "b.json");
    writeFileSync(a, JSON.stringify(makeBaseline({ sha: "aaa1111", packages_loc: 100, tests_loc: 100, tests_pass: 50, schemas: 5, cli_in_help: 10 })));
    writeFileSync(b, JSON.stringify(makeBaseline({ sha: "bbb2222", packages_loc: 200, tests_loc: 300, tests_pass: 80, schemas: 7, cli_in_help: 12 })));
    const diff = runDiff(a, b);
    const requiredKeys = [
      "filesystem_write_performed", "network_used", "runtime_execution_performed",
      "model_loaded", "model_invocation_performed", "prompt_executed",
      "external_call_performed", "raw_corpus_scan_performed", "raw_data_included",
      "tool_executed", "chain_advance_performed", "receipt_mint_performed",
      "federation_invoked", "node_connection_performed", "public_network_used",
      "consent_collected"
    ];
    for (const key of requiredKeys) {
      assert.equal(diff.boundary[key], false, `boundary.${key} must be false`);
    }
  });
});

test("growth_percent computes rounded percentage with 0.1 precision", () => {
  withFixtures((dir) => {
    const a = join(dir, "a.json");
    const b = join(dir, "b.json");
    writeFileSync(a, JSON.stringify(makeBaseline({ sha: "aaa1111", packages_loc: 100, tests_loc: 100, tests_pass: 50, schemas: 5, cli_in_help: 10 })));
    writeFileSync(b, JSON.stringify(makeBaseline({ sha: "bbb2222", packages_loc: 110, tests_loc: 100, tests_pass: 50, schemas: 5, cli_in_help: 10 })));
    const diff = runDiff(a, b);
    assert.equal(diff.growth_percent.packages_loc, 10);
  });
});
