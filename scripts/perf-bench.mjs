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
  PERF_MEASUREMENT_SCHEMA,
} from "../packages/perf/src/perf-benchmark.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const CLI = join(REPO_ROOT, "apps", "cli", "src", "index.js");
const BOOT_PROBE_TIMEOUT_MS = 5000;

function buildBootProbeEnv(env = process.env) {
  const sanitized = {
    ...env,
    DEMA_NO_TUI: "1",
    DEMA_NODE0_ADAPTER: "local",
  };
  delete sanitized.DEMA_GATEWAY_URL;
  delete sanitized.DEMA_NODE0_STATUS_COMMAND;
  delete sanitized.DEMA_OLLAMA_URL;
  delete sanitized.DEMA_LM_STUDIO_URL;
  delete sanitized.OLLAMA_HOST;
  delete sanitized.LM_STUDIO_URL;
  return sanitized;
}

// A+ performance ceilings (ms) for world-class local-first delivery.
// These are tight but achievable for the current implementation.
// Breach = not A+ performance. Aligned with DELIVERY_BLUEPRINT Level 5.
const A_PLUS_CEILINGS = Object.freeze({
  verification_latency_ms: 1, // sub-ms for canonical sha256
  dema_boot_latency_ms: 150, // fast CLI cold start for A+ UX
});

// Fallback generous for sanity (used if not --a-plus).
const SANITY_CEILINGS = Object.freeze({
  verification_latency_ms: 5,
  dema_boot_latency_ms: 5000,
});

function measureBootLatency({ runs = 5 } = {}) {
  const samples = [];
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    try {
      execFileSync("node", [CLI, "status", "--json"], {
        stdio: "ignore",
        env: buildBootProbeEnv(),
        timeout: BOOT_PROBE_TIMEOUT_MS,
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

  const isAPlus = process.argv.includes("--a-plus");
  const ceilings = isAPlus ? A_PLUS_CEILINGS : SANITY_CEILINGS;
  const gateKind = isAPlus ? "a_plus_performance" : "regression_sanity_not_slo";

  const report = {
    schema: PERF_MEASUREMENT_SCHEMA,
    measured_at_iso: measurement.measured_at_iso,
    measurement_context: measurement.measurement_context,
    metrics,
    provenance,
    benchmarks: measurement.benchmarks,
    gate: {
      ceilings_ms: ceilings,
      kind: gateKind,
      mode: isAPlus ? "A+" : "sanity",
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

  // Gate: use A+ ceilings when --a-plus, else sanity.
  const breaches = [];
  for (const [metric, ceiling] of Object.entries(ceilings)) {
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
      `  gate:          ${report.gate.ok ? `OK (within ${report.gate.mode} ceilings)` : "BREACH"}`,
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
