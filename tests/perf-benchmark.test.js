import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  PERF_MEASUREMENT_SCHEMA,
  bench,
  measureProcessSnapshot,
  buildMeasurementContext,
  measurePerf,
  toBaselineMetrics,
} from "../packages/perf/src/perf-benchmark.js";
import { REQUIRED_METRICS } from "../packages/perf/src/perf-baseline.js";
import { resolveAPlusCeilings } from "../packages/perf/src/perf-ceilings.js";

// PERF-MEASURE-1A · measurement collector tests.
//
// Discipline: NO absolute wall-clock threshold assertions (those flake under
// JIT warmup / CI load — see redos-timing flakiness lesson). We assert only
// STRUCTURE and INVARIANTS (finite, non-negative, ordering p50≤p95≤max, key
// presence, provenance labels, determinism of context, frozen outputs).

const HEX64 = /^[0-9a-f]{64}$/;
const PERF_BENCH_SCRIPT = fileURLToPath(
  new URL("../scripts/perf-bench.mjs", import.meta.url),
);
const PERF_BENCH_SOURCE = readFileSync(PERF_BENCH_SCRIPT, "utf8");

test("PERF_MEASUREMENT_SCHEMA is the versioned schema id", () => {
  assert.equal(PERF_MEASUREMENT_SCHEMA, "bizra.dema.perf_measurement.v0.1");
});

test("resolveAPlusCeilings: local stays strict 150ms boot, verification 1ms, frozen", () => {
  const c = resolveAPlusCeilings({});
  assert.equal(c.dema_boot_latency_ms, 150);
  assert.equal(c.verification_latency_ms, 1);
  assert.ok(Object.isFrozen(c));
});

test("resolveAPlusCeilings: CI gets boot headroom (250ms), verification unchanged", () => {
  assert.equal(resolveAPlusCeilings({ CI: "true" }).dema_boot_latency_ms, 250);
  assert.equal(
    resolveAPlusCeilings({ GITHUB_ACTIONS: "true" }).dema_boot_latency_ms,
    250,
  );
  assert.equal(resolveAPlusCeilings({ CI: "true" }).verification_latency_ms, 1);
});

test("resolveAPlusCeilings: CI headroom stays far below a gross 2x+ regression (no masking)", () => {
  const ci = resolveAPlusCeilings({ CI: "true" }).dema_boot_latency_ms;
  assert.ok(ci < 600, "CI ceiling must still flag a genuine 2x+ boot regression");
  assert.ok(ci <= 250, "CI headroom must not balloon");
});

test("perf-bench CLI boot probe is bounded and isolated from live gateway/model env", () => {
  assert.doesNotMatch(
    PERF_BENCH_SOURCE,
    /env:\s*\{\s*\.{3}process\.env,\s*DEMA_NO_TUI:\s*"1"\s*\}/,
    "boot probe must not inherit every ambient gateway/model env var",
  );
  assert.doesNotMatch(
    PERF_BENCH_SOURCE,
    /,\s*bench\s*,/,
    "perf-bench CLI must not import unused benchmark helpers",
  );
  assert.match(
    PERF_BENCH_SOURCE,
    /timeout:\s*BOOT_PROBE_TIMEOUT_MS/,
    "boot probe subprocess must have an explicit timeout",
  );
  assert.match(
    PERF_BENCH_SOURCE,
    /DEMA_NODE0_ADAPTER:\s*"local"/,
    "boot probe must force the local adapter unless the gate intentionally opts in",
  );
  for (const envName of [
    "DEMA_GATEWAY_URL",
    "DEMA_NODE0_STATUS_COMMAND",
    "DEMA_OLLAMA_URL",
    "DEMA_LM_STUDIO_URL",
    "OLLAMA_HOST",
    "LM_STUDIO_URL",
  ]) {
    assert.match(
      PERF_BENCH_SOURCE,
      new RegExp(`delete sanitized\\.${envName}`),
      `${envName} must be removed from the perf gate subprocess env`,
    );
  }
});

test("bench returns frozen stats with p50 <= p95 <= max and min <= p50", async () => {
  const r = await bench("noop", () => 1 + 1, { warmupRuns: 3, iterations: 50 });
  assert.ok(Object.isFrozen(r), "bench result must be frozen");
  for (const k of [
    "label",
    "iterations",
    "warmup_runs",
    "min_ms",
    "p50_ms",
    "p95_ms",
    "max_ms",
    "mean_ms",
  ]) {
    assert.ok(k in r, `missing stat: ${k}`);
  }
  assert.equal(r.label, "noop");
  assert.equal(r.iterations, 50);
  assert.equal(r.warmup_runs, 3);
  for (const k of ["min_ms", "p50_ms", "p95_ms", "max_ms", "mean_ms"]) {
    assert.ok(Number.isFinite(r[k]) && r[k] >= 0, `${k} must be finite >= 0`);
  }
  assert.ok(r.min_ms <= r.p50_ms, "min <= p50");
  assert.ok(r.p50_ms <= r.p95_ms, "p50 <= p95");
  assert.ok(r.p95_ms <= r.max_ms, "p95 <= max");
});

test("bench actually invokes the function `iterations` times", async () => {
  let calls = 0;
  await bench("counter", () => calls++, { warmupRuns: 5, iterations: 20 });
  // warmup runs also call the fn: 5 + 20.
  assert.equal(calls, 25);
});

test("bench supports async functions", async () => {
  const r = await bench("async", async () => await Promise.resolve(7), {
    warmupRuns: 1,
    iterations: 10,
  });
  assert.equal(r.iterations, 10);
  assert.ok(Number.isFinite(r.p95_ms));
});

test("bench fails closed on invalid input", async () => {
  await assert.rejects(() => bench("bad", "not-a-fn", { iterations: 5 }));
  await assert.rejects(() => bench("bad", () => 1, { iterations: 0 }));
  await assert.rejects(() => bench("bad", () => 1, { iterations: -3 }));
});

test("measureProcessSnapshot returns finite, non-negative process metrics", () => {
  const s = measureProcessSnapshot();
  assert.ok(Object.isFrozen(s));
  for (const k of [
    "memory_rss_mb",
    "heap_used_mb",
    "cpu_user_ms",
    "cpu_system_ms",
  ]) {
    assert.ok(k in s, `missing ${k}`);
    assert.ok(Number.isFinite(s[k]) && s[k] >= 0, `${k} finite >= 0`);
  }
});

test("buildMeasurementContext matches the PERF_0 spec shape", () => {
  const ctx = buildMeasurementContext({
    demaHome: "/tmp/example-dema",
    runCount: 7,
  });
  assert.ok(Object.isFrozen(ctx));
  assert.match(ctx.host_fingerprint, HEX64);
  assert.equal(ctx.node_version, process.version);
  assert.equal(ctx.run_count, 7);
  assert.match(ctx.env_hash, HEX64);
});

test("buildMeasurementContext host_fingerprint is deterministic per host", () => {
  const a = buildMeasurementContext({ demaHome: "/tmp/x", runCount: 1 });
  const b = buildMeasurementContext({ demaHome: "/tmp/x", runCount: 1 });
  assert.equal(a.host_fingerprint, b.host_fingerprint);
  assert.equal(a.env_hash, b.env_hash);
});

test("measurePerf returns measured metrics + per-metric provenance, frozen", async () => {
  const m = await measurePerf({ demaHome: "/tmp/x", runCount: 3 });
  assert.ok(Object.isFrozen(m));
  assert.equal(m.schema, PERF_MEASUREMENT_SCHEMA);
  assert.ok(
    typeof m.measured_at_iso === "string" && m.measured_at_iso.length > 0,
  );
  assert.ok(Object.isFrozen(m.measurement_context));
  assert.ok(Object.isFrozen(m.metrics));
  assert.ok(Object.isFrozen(m.provenance));
  // Every metric carries a provenance label, no metric is unlabeled.
  for (const key of Object.keys(m.metrics)) {
    assert.ok(
      ["MEASURED", "NOT_LIVE"].includes(m.provenance[key]),
      `metric ${key} must be labeled MEASURED|NOT_LIVE, got ${m.provenance[key]}`,
    );
  }
  // At least the keyless process metrics are genuinely MEASURED (no overclaim
  // elsewhere — not-live economy/gpu surfaces are labeled NOT_LIVE).
  assert.equal(m.provenance.memory_rss_mb, "MEASURED");
  assert.equal(m.provenance.cpu_utilization_pct, "MEASURED");
});

test("toBaselineMetrics produces all 14 PERF-1A required metrics as finite numbers", async () => {
  const m = await measurePerf({ demaHome: "/tmp/x", runCount: 3 });
  const baselineMetrics = toBaselineMetrics(m);
  assert.ok(Object.isFrozen(baselineMetrics));
  for (const name of REQUIRED_METRICS) {
    assert.ok(name in baselineMetrics, `missing required metric ${name}`);
    assert.ok(
      typeof baselineMetrics[name] === "number" &&
        Number.isFinite(baselineMetrics[name]),
      `${name} must be a finite number for the PERF-1A kernel`,
    );
  }
});

test("toBaselineMetrics marks not-live metrics as 0 (no fabricated measurement)", async () => {
  const m = await measurePerf({ demaHome: "/tmp/x", runCount: 3 });
  const baselineMetrics = toBaselineMetrics(m);
  // Economy is DESIGNED_NOT_LIVE — these MUST be 0 + labeled NOT_LIVE, never
  // a fabricated positive latency.
  for (const notLive of ["token_settlement_time_ms", "poi_scoring_time_ms"]) {
    assert.equal(m.provenance[notLive], "NOT_LIVE");
    assert.equal(baselineMetrics[notLive], 0);
  }
});
