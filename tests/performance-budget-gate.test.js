// PERF-BUDGET-CI-HEADROOM-1A · tests for the env-aware budget resolver.
//
// The perf gate runs (measure + exit) only behind a main-guard, so importing
// `resolvePerfBudgets` here has no side effects. Local stays strict; CI gets
// honest cold-start headroom so the gate measures regressions, not runner jitter.

import test from "node:test";
import assert from "node:assert/strict";

import { resolvePerfBudgets } from "../scripts/review/performance-budget-gate.mjs";

test("local (no CI env) keeps the strict 150ms boot budget", () => {
  assert.equal(resolvePerfBudgets({}).cli_boot_latency_ms, 150);
});

test("CI=true grants boot headroom (250ms)", () => {
  assert.equal(resolvePerfBudgets({ CI: "true" }).cli_boot_latency_ms, 250);
});

test("GITHUB_ACTIONS=true also grants headroom", () => {
  assert.equal(
    resolvePerfBudgets({ GITHUB_ACTIONS: "true" }).cli_boot_latency_ms,
    250,
  );
});

test("non-boot budgets are stable across environments", () => {
  for (const env of [{}, { CI: "true" }, { GITHUB_ACTIONS: "true" }]) {
    const b = resolvePerfBudgets(env);
    assert.equal(b.first_look_render_ms, 50);
    assert.equal(b.doctor_gather_ms, 250);
    assert.equal(b.memory_rss_mb, 80);
  }
});

test("CI headroom still trips a gross (2x+) boot regression", () => {
  // 250ms ceiling: a ~150ms-local boot doubling to 300ms+ in CI still fails.
  assert.ok(resolvePerfBudgets({ CI: "true" }).cli_boot_latency_ms < 300);
});

test("budgets object is frozen", () => {
  assert.ok(Object.isFrozen(resolvePerfBudgets({})));
});
