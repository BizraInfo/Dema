import test from "node:test";
import assert from "node:assert/strict";

import {
  gatherSelfEvalSignals,
  SELF_EVAL_COLLECT_COMMANDS,
} from "../apps/cli/src/commands/self-eval-gatherer.js";
import {
  runDemaSelfEvalBaselinePreview,
  DEMA_SELF_EVAL_BASELINE_PREVIEW_GO_PHRASE,
} from "../packages/core/src/dema-self-eval-baseline-preview.js";

// Formats below are pinned to REAL observed bytes from this repo
// (node --test --test-reporter=tap --experimental-test-coverage · dema monitors run --json).
const TAP_GREEN = [
  "TAP version 13",
  "# tests 16",
  "# suites 0",
  "# pass 16",
  "# fail 0",
  "# cancelled 0",
  "# skipped 0",
  "# todo 0",
  "# duration_ms 51.985419",
  "# start of coverage report",
  "# file                                         | line % | branch % | funcs % | uncovered lines",
  "# all files                                    |  19.21 |    87.97 |   75.71 |",
  "# end of coverage report",
  "",
].join("\n");
const TAP_RED = TAP_GREEN.replace("# tests 16", "# tests 10")
  .replace("# pass 16", "# pass 8")
  .replace("# fail 0", "# fail 2");
const MONITORS_JSON = JSON.stringify({
  monitor: { summary: { critical_count: 0, warning_count: 2 } },
});

const ranNames = () => [];
function fakeRun(map, ran = []) {
  return async (spec) => {
    ran.push(spec.name);
    return (
      map[spec.name] ?? { code: 0, stdout: "", stderr: "", duration_ms: 1, spawn_error: null }
    );
  };
}
const HAPPY = Object.freeze({
  coverage: { code: 0, stdout: TAP_GREEN, stderr: "", duration_ms: 60000, spawn_error: null },
  monitors: { code: 0, stdout: MONITORS_JSON, stderr: "", duration_ms: 900, spawn_error: null },
  gates: { code: 0, stdout: "", stderr: "", duration_ms: 30000, spawn_error: null },
  boot: { code: 0, stdout: "usage", stderr: "", duration_ms: 88, spawn_error: null },
});
const NOW = "2026-08-14T00:00:00.000Z";

test("collects a kernel-eligible baseline input from real-format command outputs", async () => {
  const out = await gatherSelfEvalSignals({ label: "t1", runImpl: fakeRun(HAPPY), nowIso: NOW, testFileCountImpl: () => 3 });
  assert.equal(out.ok, true);
  assert.deepEqual([...out.blocked_by], []);
  assert.equal(out.input.label, "t1");
  assert.equal(out.input.captured_at, NOW);
  assert.equal(out.input.tests_pass, 16);
  assert.equal(out.input.tests_total, 16);
  assert.equal(out.input.coverage_line_pct, 19.21);
  assert.equal(out.input.coverage_branch_pct, 87.97);
  assert.equal(out.input.coverage_function_pct, 75.71);
  assert.equal(out.input.monitor_critical, 0);
  assert.equal(out.input.monitor_warning, 2);
  assert.equal(out.input.gates_all_green, true);
  assert.equal(out.input.perf_boot_ms, 88);
  assert.ok(Number.isFinite(out.input.perf_verify_ms) && out.input.perf_verify_ms >= 0);
  assert.ok(Number.isFinite(out.input.registry_count) && out.input.registry_count > 0);
  // The wiring proof: the pure kernel accepts what the adapter measured.
  const run = runDemaSelfEvalBaselinePreview({
    consent: DEMA_SELF_EVAL_BASELINE_PREVIEW_GO_PHRASE,
    input: out.input,
  });
  assert.equal(run.ok, true);
  assert.match(run.baseline_hash, /^sha256:[0-9a-f]{64}$/);
});

test("an unspawnable coverage command refuses — it never fabricates a number", async () => {
  const out = await gatherSelfEvalSignals({
    label: "t2",
    runImpl: fakeRun({
      ...HAPPY,
      coverage: { code: null, stdout: "", stderr: "", duration_ms: 0, spawn_error: "ENOENT" },
    }),
    nowIso: NOW,
  });
  assert.equal(out.ok, false);
  assert.equal(out.input, null);
  assert.ok(out.blocked_by.includes("signal_unmeasurable:tests"));
});

test("failing tests and red gates are measurements, not refusals", async () => {
  const out = await gatherSelfEvalSignals({
    label: "t3",
    testFileCountImpl: () => 3,
    runImpl: fakeRun({
      ...HAPPY,
      coverage: { code: 1, stdout: TAP_RED, stderr: "", duration_ms: 50000, spawn_error: null },
      gates: { code: 1, stdout: "", stderr: "gate red", duration_ms: 20000, spawn_error: null },
    }),
    nowIso: NOW,
  });
  assert.equal(out.ok, true);
  assert.equal(out.input.tests_pass, 8);
  assert.equal(out.input.tests_total, 10);
  assert.equal(out.input.gates_all_green, false);
});

test("unparseable monitors output refuses", async () => {
  const out = await gatherSelfEvalSignals({
    label: "t4",
    testFileCountImpl: () => 3,
    runImpl: fakeRun({
      ...HAPPY,
      monitors: { code: 0, stdout: "not json", stderr: "", duration_ms: 5, spawn_error: null },
    }),
    nowIso: NOW,
  });
  assert.equal(out.ok, false);
  assert.equal(out.input, null);
  assert.ok(out.blocked_by.includes("signal_unmeasurable:monitor"));
});

test("a TAP report without the all-files coverage row refuses", async () => {
  const noCov = TAP_GREEN.split("\n").filter((l) => !l.startsWith("# all files")).join("\n");
  const out = await gatherSelfEvalSignals({
    label: "t5",
    testFileCountImpl: () => 3,
    runImpl: fakeRun({
      ...HAPPY,
      coverage: { code: 0, stdout: noCov, stderr: "", duration_ms: 100, spawn_error: null },
    }),
    nowIso: NOW,
  });
  assert.equal(out.ok, false);
  assert.ok(out.blocked_by.includes("signal_unmeasurable:coverage"));
});

test("provenance records each real command and exit so the chain is auditable", async () => {
  const ran = ranNames();
  const out = await gatherSelfEvalSignals({ label: "t6", runImpl: fakeRun(HAPPY, ran), nowIso: NOW, testFileCountImpl: () => 3 });
  assert.equal(out.ok, true);
  for (const name of ["coverage", "monitors", "gates", "boot"]) {
    assert.ok(ran.includes(name), `ran ${name}`);
    assert.equal(typeof out.provenance[name].cmd, "string");
    assert.ok(out.provenance[name].cmd.length > 0);
    assert.ok(Number.isFinite(out.provenance[name].exit_code));
    assert.ok(Number.isFinite(out.provenance[name].duration_ms));
  }
  // The declared command table is the wiring contract, not prose.
  assert.deepEqual(Object.keys(SELF_EVAL_COLLECT_COMMANDS).sort(), ["boot", "coverage", "gates", "monitors"]);
});

test("a run reporting fewer tests than there are test files refuses — a crash-TAP is not a suite measurement", async () => {
  const out = await gatherSelfEvalSignals({
    label: "t7",
    runImpl: fakeRun(HAPPY),
    nowIso: NOW,
    testFileCountImpl: () => 20, // TAP says 16 tests — impossible for 20 files
  });
  assert.equal(out.ok, false);
  assert.equal(out.input, null);
  assert.ok(out.blocked_by.includes("signal_unmeasurable:tests_suite_incomplete"));
});
