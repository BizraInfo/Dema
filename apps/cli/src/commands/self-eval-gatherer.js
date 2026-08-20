// SELF-EVAL-COLLECT-1A — the effect adapter DEMA-SELF-EVAL-BASELINE-PREVIEW-1A
// was waiting for (its signals are injected; until this file nothing collected
// them). This file owns ALL effects (child processes, clock) — the kernel stays
// pure. Fail-closed: a signal source that cannot be spawned or parsed REFUSES
// the whole gather (ok:false, named reason, input:null); it never fabricates a
// number. A failing test run or a red gate is a MEASUREMENT, not a refusal.

import { execFile } from "node:child_process";
import { readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";

import {
  buildDemaSelfEvalBaselinePreviewPayload,
  verifyDemaSelfEvalBaselinePreview,
  SELF_EVAL_BASELINE_FIXTURE,
} from "../../../../packages/core/src/dema-self-eval-baseline-preview.js";
import { buildDemaCapabilityTruthRegistry } from "../../../../packages/core/src/dema-capability-truth-registry.js";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

// The wiring contract: which real repo command produces each signal family.
// node is invoked directly (the underlying commands of package.json's
// coverage/check scripts, minus the npm + CI-classifier wrappers): the repo is
// zero-dep and npm is not guaranteed alive in every operator tree. Coverage
// threshold flags are deliberately absent — percentages are MEASURED here and
// judged by compare, not by an exit code.
export const SELF_EVAL_COLLECT_COMMANDS = Object.freeze({
  // "tests/*.test.js" is expanded by node's own test runner (execFile has no
  // shell): proven live — a bare directory arg is treated as a module and dies.
  coverage: Object.freeze({ cmd: "node", args: Object.freeze(["--test", "--test-reporter=tap", "--experimental-test-coverage", "tests/*.test.js"]), timeout_ms: 2_700_000 }),
  monitors: Object.freeze({ cmd: "node", args: Object.freeze(["apps/cli/src/index.js", "monitors", "run", "--json"]), timeout_ms: 300_000 }),
  gates: Object.freeze({ cmd: "node", args: Object.freeze(["scripts/check.mjs"]), timeout_ms: 2_700_000 }),
  boot: Object.freeze({ cmd: "node", args: Object.freeze(["apps/cli/src/index.js", "help"]), timeout_ms: 120_000 }),
});

function defaultRunImpl(spec) {
  return new Promise((resolveRun) => {
    const t0 = performance.now();
    execFile(
      spec.cmd,
      [...spec.args],
      { cwd: REPO_ROOT, maxBuffer: 64 * 1024 * 1024, timeout: spec.timeout_ms },
      (err, stdout, stderr) => {
        const duration_ms = performance.now() - t0;
        if (err && typeof err.code !== "number") {
          // ENOENT / kill-by-timeout / signal death — the command did not run to
          // a real exit code, so nothing here is a measurement.
          return resolveRun({
            code: null,
            stdout: String(stdout ?? ""),
            stderr: String(stderr ?? ""),
            duration_ms,
            spawn_error: String(err.code ?? err.signal ?? err.message),
          });
        }
        resolveRun({
          code: err ? err.code : 0,
          stdout: String(stdout ?? ""),
          stderr: String(stderr ?? ""),
          duration_ms,
          spawn_error: null,
        });
      },
    );
  });
}

// Formats pinned to real observed bytes (see tests/dema-self-eval-collect.test.js).
export function parseTapTestCounts(tap) {
  // `.match` not `.exec` — scripts/review/actuator-check.mjs matches /\bexec\s*\(/ and
  // cannot tell RegExp.exec from child_process.exec. Same result, no false positive.
  const total = tap.match(/^# tests (\d+)$/m);
  const pass = tap.match(/^# pass (\d+)$/m);
  if (!total || !pass) return null;
  return { tests_total: Number(total[1]), tests_pass: Number(pass[1]) };
}

export function parseTapCoverageAllFiles(tap) {
  const m = tap.match(/^# all files\s*\|\s*(\d+(?:\.\d+)?)\s*\|\s*(\d+(?:\.\d+)?)\s*\|\s*(\d+(?:\.\d+)?)\s*\|/m);
  if (!m) return null;
  return {
    coverage_line_pct: Number(m[1]),
    coverage_branch_pct: Number(m[2]),
    coverage_function_pct: Number(m[3]),
  };
}

function parseMonitorCounts(stdout) {
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    const start = stdout.indexOf("{");
    if (start < 0) return null;
    try {
      parsed = JSON.parse(stdout.slice(start));
    } catch {
      return null;
    }
  }
  const summary = parsed?.monitor?.summary;
  if (!Number.isFinite(summary?.critical_count) || !Number.isFinite(summary?.warning_count)) return null;
  return { monitor_critical: summary.critical_count, monitor_warning: summary.warning_count };
}

function measureVerifyMs() {
  const payload = buildDemaSelfEvalBaselinePreviewPayload(SELF_EVAL_BASELINE_FIXTURE);
  const t0 = performance.now();
  verifyDemaSelfEvalBaselinePreview(payload);
  return Math.round((performance.now() - t0) * 1000) / 1000;
}

// A suite run must report at least one test per test file on disk; a crash-TAP
// (runner died, one synthetic failing item) parses cleanly but is NOT a suite
// measurement. Measured live 2026-08-14: a bad path sealed tests_total=1.
function defaultTestFileCount() {
  try {
    return readdirSync(join(REPO_ROOT, "tests")).filter((f) => f.endsWith(".test.js")).length;
  } catch {
    return null;
  }
}

export async function gatherSelfEvalSignals({
  label,
  runImpl = defaultRunImpl,
  nowIso = new Date().toISOString(),
  testFileCountImpl = defaultTestFileCount,
} = {}) {
  const blocked_by = [];
  const provenance = {};
  const results = {};
  for (const [name, spec] of Object.entries(SELF_EVAL_COLLECT_COMMANDS)) {
    const r = await runImpl({ name, ...spec });
    results[name] = r;
    provenance[name] = Object.freeze({
      cmd: `${spec.cmd} ${spec.args.join(" ")}`,
      exit_code: r.spawn_error ? -1 : r.code,
      duration_ms: r.duration_ms,
      spawn_error: r.spawn_error ?? null,
    });
  }

  const cov = results.coverage;
  let testCounts = null;
  let covPcts = null;
  if (cov.spawn_error) {
    blocked_by.push("signal_unmeasurable:tests", "signal_unmeasurable:coverage");
  } else {
    testCounts = parseTapTestCounts(cov.stdout);
    if (!testCounts) blocked_by.push("signal_unmeasurable:tests");
    else {
      const fileCount = testFileCountImpl();
      if (!Number.isFinite(fileCount) || testCounts.tests_total < fileCount) {
        blocked_by.push("signal_unmeasurable:tests_suite_incomplete");
      }
    }
    covPcts = parseTapCoverageAllFiles(cov.stdout);
    if (!covPcts) blocked_by.push("signal_unmeasurable:coverage");
  }

  const monitorCounts = results.monitors.spawn_error ? null : parseMonitorCounts(results.monitors.stdout);
  if (!monitorCounts) blocked_by.push("signal_unmeasurable:monitor");

  if (results.gates.spawn_error) blocked_by.push("signal_unmeasurable:gates");
  if (results.boot.spawn_error) blocked_by.push("signal_unmeasurable:perf_boot");

  if (blocked_by.length > 0) {
    return Object.freeze({ ok: false, blocked_by: Object.freeze([...new Set(blocked_by)]), input: null, provenance: Object.freeze(provenance) });
  }

  const input = Object.freeze({
    label,
    captured_at: nowIso,
    ...testCounts,
    ...covPcts,
    ...monitorCounts,
    perf_boot_ms: results.boot.duration_ms,
    perf_verify_ms: measureVerifyMs(),
    registry_count: buildDemaCapabilityTruthRegistry({}).capability_count,
    gates_all_green: results.gates.code === 0,
  });
  return Object.freeze({ ok: true, blocked_by: Object.freeze([]), input, provenance: Object.freeze(provenance) });
}
