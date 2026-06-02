#!/usr/bin/env node
// PERF-MEASURE-1A · runnable performance benchmark + regression-sanity gate.
//
// Produces a `bizra.dema.perf_measurement.v0.1` artifact on stdout (JSON) and
// exits non-zero only if a hot path breaches a GENEROUS regression-sanity
// ceiling. These ceilings are NOT SLOs — they catch gross regressions (orders
// of magnitude), not micro-fluctuations, so the gate does not flake under CI
// load or JIT warmup. Tight SLOs would require a signed baseline (PERF-1A) and
// a deterministic comparison rule (PERF-1B) — out of scope for this gate.
//
// Adds the subprocess boot-latency measurement that the in-process collector
// (measurePerf) honestly marks NOT_LIVE: here we spawn the real CLI and time it.
//
// Boundary: read-only audit of perf. No network. No keys. No consent. No mint.
// Temporary subprocesses only; no operator state mutated.

import { execFileSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  measurePerf,
  bench,
  PERF_MEASUREMENT_SCHEMA,
} from "../packages/perf/src/perf-benchmark.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const CLI = join(REPO_ROOT, "apps", "cli", "src", "index.js");

// Generous regression-sanity ceilings (ms). Breach = gross regression.
const CEILINGS = Object.freeze({
  verification_latency_ms: 5, // sha256 roundtrip is sub-millisecond
  dema_boot_latency_ms: 5000, // node cold start + status render
});

function measureBootLatency({ runs = 5 } = {}) {
  const samples = [];
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    try {
      execFileSync("node", [CLI, "status", "--json"], {
        stdio: "ignore",
        env: { ...process.env, DEMA_NO_TUI: "1" },
      });
    } catch {
      // status may exit non-zero on a not-ready node; the spawn+run still
      // measured the boot path, which is what we want.
    }
    samples.push(performance.now() - t0);
  }
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length / 2)]; // p50
}

async function main() {
  const wantJson = process.argv.includes("--json");

  const measurement = await measurePerf({
    demaHome: process.env.DEMA_HOME || "",
    runCount: 50,
  });

  // Subprocess boot latency — the genuinely-measured value for a metric the
  // in-process collector marks NOT_LIVE.
  const bootP50 = measureBootLatency({ runs: 5 });

  const metrics = {
    ...measurement.metrics,
    dema_boot_latency_ms: bootP50,
  };
  const provenance = {
    ...measurement.provenance,
    dema_boot_latency_ms: "MEASURED",
  };

  const report = {
    schema: PERF_MEASUREMENT_SCHEMA,
    measured_at_iso: measurement.measured_at_iso,
    measurement_context: measurement.measurement_context,
    metrics,
    provenance,
    benchmarks: measurement.benchmarks,
    gate: {
      ceilings_ms: CEILINGS,
      kind: "regression_sanity_not_slo",
    },
    boundary: {
      read_only_audit: true,
      network_used: false,
      private_key_loaded: false,
      consent_required: false,
      receipt_minted: false,
      operator_dema_home_mutated: false,
    },
  };

  // Gate: generous ceilings only.
  const breaches = [];
  for (const [metric, ceiling] of Object.entries(CEILINGS)) {
    const v = metrics[metric];
    if (typeof v === "number" && Number.isFinite(v) && v > ceiling) {
      breaches.push(`${metric}=${v.toFixed(3)}ms > ${ceiling}ms`);
    }
  }
  report.gate.breaches = breaches;
  report.gate.ok = breaches.length === 0;

  if (wantJson) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  } else {
    const measuredKeys = Object.keys(provenance).filter(
      (k) => provenance[k] === "MEASURED",
    );
    console.log("DEMA · Performance Measurement (PERF-MEASURE-1A)");
    console.log(`  schema:        ${report.schema}`);
    console.log(`  node:          ${report.measurement_context.node_version}`);
    console.log(`  measured:      ${measuredKeys.join(", ")}`);
    for (const k of measuredKeys) {
      console.log(`    ${k.padEnd(28)} ${Number(metrics[k]).toFixed(3)}`);
    }
    console.log(
      `  gate:          ${report.gate.ok ? "OK (within sanity ceilings)" : "BREACH"}`,
    );
    for (const b of breaches) console.log(`    ! ${b}`);
    console.log("  boundary:      read-only · no network · no keys · no mint");
  }

  if (!report.gate.ok) process.exitCode = 1;
}

main().catch((err) => {
  console.error("perf-bench error:", err?.message ?? err);
  process.exit(1);
});
