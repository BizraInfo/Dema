// PERF-MEASURE-1A · Performance measurement collector.
//
// The PERF-1A baseline kernel and PERF-1B regression guard are PURE — they take
// caller-supplied metrics and "do NOT sample, fingerprint host, or read process
// metrics" (see perf-baseline.js header). This module is the measurement layer
// those kernels assume: it samples real, keyless hot-path latency + process
// metrics, builds the PERF_0 measurement_context, and emits a frozen,
// schema-tagged `bizra.dema.perf_measurement.v0.1` artifact with PER-METRIC
// PROVENANCE.
//
// Claim discipline (PERF_0 §22: "if it cannot be measured, it cannot be called
// optimization"): a metric is labeled MEASURED only when genuinely sampled here.
// Not-yet-live surfaces (economy token/poi settlement, GPU, mission/consent
// subsystems that require keys, full test-suite runtime) are labeled NOT_LIVE
// and carried as 0 — never a fabricated positive number. toBaselineMetrics()
// bridges to the PERF-1A kernel (which requires all 14 metrics) WITHOUT
// overclaiming the not-live ones.
//
// REUSES (no duplication):
// - sha256, stableStringify   packages/consent/src/consent-common.js
// - REQUIRED_METRICS          packages/perf/src/perf-baseline.js (canonical 14)
//
// No network. No keys. No consent. No CLI. Pure + bounded.

import os from "node:os";
import { performance } from "node:perf_hooks";
import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import { REQUIRED_METRICS } from "./perf-baseline.js";

export const PERF_MEASUREMENT_SCHEMA = "bizra.dema.perf_measurement.v0.1";

// Metrics this in-process, keyless collector genuinely samples. Everything else
// in REQUIRED_METRICS is NOT_LIVE here (sampled by the bench script via
// subprocess, or by future PERF-1C wiring of the mission/consent subsystems).
const MEASURED_METRICS = Object.freeze([
  "verification_latency_ms",
  "memory_rss_mb",
  "cpu_utilization_pct",
]);

function percentile(sortedAsc, p) {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(
    sortedAsc.length - 1,
    Math.max(0, Math.ceil((p / 100) * sortedAsc.length) - 1),
  );
  return sortedAsc[idx];
}

// Generic micro-benchmark: warmup (JIT) then `iterations` timed runs of `fn`
// (sync or async). Returns frozen latency stats in milliseconds.
export async function bench(
  label,
  fn,
  { warmupRuns = 5, iterations = 100 } = {},
) {
  if (typeof fn !== "function") {
    throw new TypeError("bench: fn must be a function");
  }
  if (!Number.isInteger(iterations) || iterations < 1) {
    throw new RangeError("bench: iterations must be a positive integer");
  }
  if (!Number.isInteger(warmupRuns) || warmupRuns < 0) {
    throw new RangeError("bench: warmupRuns must be a non-negative integer");
  }
  for (let i = 0; i < warmupRuns; i++) {
    await fn();
  }
  const samples = new Array(iterations);
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    await fn();
    samples[i] = performance.now() - t0;
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = samples.reduce((a, b) => a + b, 0);
  return Object.freeze({
    label,
    iterations,
    warmup_runs: warmupRuns,
    min_ms: sorted[0],
    p50_ms: percentile(sorted, 50),
    p95_ms: percentile(sorted, 95),
    max_ms: sorted[sorted.length - 1],
    mean_ms: sum / iterations,
  });
}

// Point-in-time process resource snapshot (keyless, always measurable).
export function measureProcessSnapshot() {
  const mem = process.memoryUsage();
  const cpu = process.cpuUsage();
  return Object.freeze({
    memory_rss_mb: mem.rss / 1e6,
    heap_used_mb: mem.heapUsed / 1e6,
    cpu_user_ms: cpu.user / 1000,
    cpu_system_ms: cpu.system / 1000,
  });
}

// PERF_0 §3.1 measurement_context. host_fingerprint + env_hash are deterministic
// digests so two runs on the same host/env produce the same identifiers.
export function buildMeasurementContext({ demaHome = "", runCount = 1 } = {}) {
  const cpus = os.cpus() || [];
  const host_fingerprint = sha256(
    stableStringify({
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      cpu_model: cpus[0] ? cpus[0].model : "unknown",
      cpu_count: cpus.length,
    }),
  );
  const env_hash = sha256(
    stableStringify({
      dema_home: String(demaHome),
      env_flags: {
        NO_COLOR: process.env.NO_COLOR ?? null,
        TERM: process.env.TERM ?? null,
        NODE_ENV: process.env.NODE_ENV ?? null,
        DEMA_NO_TUI: process.env.DEMA_NO_TUI ?? null,
      },
    }),
  );
  return Object.freeze({
    host_fingerprint,
    node_version: process.version,
    run_count: runCount,
    env_hash,
  });
}

// Sample the live, keyless metrics and assemble a measurement artifact with
// per-metric provenance. MEASURED metrics carry real values; NOT_LIVE metrics
// are carried as 0 and labeled, never fabricated.
export async function measurePerf({
  demaHome = "",
  runCount = 30,
  createdAtIso,
} = {}) {
  const cpuStart = process.cpuUsage();
  const wallStart = performance.now();

  // MEASURED: verification primitive — sha256(stableStringify(payload)) is the
  // core of every receipt/proof verification path in the repo.
  const payload = {
    schema: "probe",
    n: 1,
    items: [1, 2, 3],
    nested: { a: "x" },
  };
  const verify = await bench(
    "verification_sha256_roundtrip",
    () => sha256(stableStringify(payload)),
    { warmupRuns: 10, iterations: Math.max(20, runCount) },
  );

  const wallElapsedMs = performance.now() - wallStart;
  const cpuDelta = process.cpuUsage(cpuStart);
  const cpuMs = (cpuDelta.user + cpuDelta.system) / 1000;
  const cpuPct = wallElapsedMs > 0 ? (cpuMs / wallElapsedMs) * 100 : 0;

  const snap = measureProcessSnapshot();

  const measured = {
    verification_latency_ms: verify.p95_ms,
    memory_rss_mb: snap.memory_rss_mb,
    cpu_utilization_pct: cpuPct >= 0 ? cpuPct : 0,
  };

  const metrics = {};
  const provenance = {};
  for (const name of REQUIRED_METRICS) {
    if (MEASURED_METRICS.includes(name) && name in measured) {
      metrics[name] = measured[name];
      provenance[name] = "MEASURED";
    } else {
      metrics[name] = 0;
      provenance[name] = "NOT_LIVE";
    }
  }

  return Object.freeze({
    schema: PERF_MEASUREMENT_SCHEMA,
    measured_at_iso: createdAtIso || new Date().toISOString(),
    measurement_context: buildMeasurementContext({ demaHome, runCount }),
    metrics: Object.freeze(metrics),
    provenance: Object.freeze(provenance),
    benchmarks: Object.freeze([verify]),
  });
}

// Bridge to the PERF-1A baseline kernel, which requires all 14 metrics as finite
// numbers. NOT_LIVE metrics arrive as 0; the companion measurement artifact's
// provenance map is the honest record of which were truly measured.
export function toBaselineMetrics(measurement) {
  if (!measurement || typeof measurement !== "object" || !measurement.metrics) {
    throw new TypeError("toBaselineMetrics: measurement.metrics required");
  }
  const out = {};
  for (const name of REQUIRED_METRICS) {
    const v = measurement.metrics[name];
    out[name] = typeof v === "number" && Number.isFinite(v) ? v : 0;
  }
  return Object.freeze(out);
}
