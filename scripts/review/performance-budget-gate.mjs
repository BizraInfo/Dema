#!/usr/bin/env node
// DEMA-QUALITY-DELIVERY-SPINE-1A · performance budget gate (local sanity).

import { execFileSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import {
  buildFirstLookHome,
  gatherFirstLookContext,
} from "../../packages/core/src/dema-first-look-home.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");
const CLI = join(REPO_ROOT, "apps", "cli", "src", "index.js");

// Budgets. `cli_boot_latency_ms` is environment-aware: CLI cold-start on shared
// CI runners runs markedly slower than local, and this gate runs AFTER other
// check.mjs steps (under load). Local stays strict (150ms) to catch real boot
// regressions; CI gets honest headroom (250ms) so the gate measures regressions,
// not runner jitter. A genuine 2×+ boot regression still trips even in CI. The
// other budgets carry ample headroom and stay fixed across environments.
export function resolvePerfBudgets(env = process.env) {
  const inCI = env.CI === "true" || env.GITHUB_ACTIONS === "true";
  return Object.freeze({
    first_look_render_ms: 50,
    doctor_gather_ms: 250,
    cli_boot_latency_ms: inCI ? 250 : 150,
    memory_rss_mb: 80,
  });
}

const JSON_MODE = process.argv.includes("--json");

async function measureFirstLookRenderMs() {
  const ctx = await gatherFirstLookContext();
  const t0 = performance.now();
  for (let i = 0; i < 20; i++) buildFirstLookHome(ctx);
  return (performance.now() - t0) / 20;
}

function measureCliBootMs() {
  try {
    execFileSync("node", [CLI, "status", "--json"], {
      stdio: "ignore",
      env: { ...process.env, DEMA_NO_TUI: "1", DEMA_NODE0_ADAPTER: "local" },
      timeout: 5000,
    });
  } catch {
    // warmup discard — cold module graph on CI runners
  }
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const t0 = performance.now();
    try {
      execFileSync("node", [CLI, "status", "--json"], {
        stdio: "ignore",
        env: { ...process.env, DEMA_NO_TUI: "1", DEMA_NODE0_ADAPTER: "local" },
        timeout: 5000,
      });
    } catch {
      // non-zero exit still exercised boot path
    }
    samples.push(performance.now() - t0);
  }
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length / 2)];
}

async function measureDoctorGatherMs() {
  const { createNode0Adapter } = await import(
    "../../packages/node-adapter/src/node0-adapter.js"
  );
  const { statusWithLocalIdentity } = await import(
    "../../apps/cli/src/lib/status-identity.js"
  );
  const adapter = createNode0Adapter();
  const t0 = performance.now();
  await statusWithLocalIdentity(adapter);
  return performance.now() - t0;
}

async function main() {
  const BUDGETS = resolvePerfBudgets();
  const firstLookMs = await measureFirstLookRenderMs();
  const bootMs = measureCliBootMs();
  const doctorMs = await measureDoctorGatherMs();
  const rssMb = process.memoryUsage().rss / (1024 * 1024);

  const breaches = [];
  if (firstLookMs > BUDGETS.first_look_render_ms) {
    breaches.push(`first_look_render_ms=${firstLookMs.toFixed(2)}`);
  }
  if (doctorMs > BUDGETS.doctor_gather_ms) {
    breaches.push(`doctor_gather_ms=${doctorMs.toFixed(2)}`);
  }
  if (bootMs > BUDGETS.cli_boot_latency_ms) {
    breaches.push(`cli_boot_latency_ms=${bootMs.toFixed(2)}`);
  }
  if (rssMb > BUDGETS.memory_rss_mb) {
    breaches.push(`memory_rss_mb=${rssMb.toFixed(2)}`);
  }

  const pass = breaches.length === 0;
  const report = {
    ok: pass,
    budgets: BUDGETS,
    measured: {
      first_look_render_ms: Number(firstLookMs.toFixed(3)),
      doctor_gather_ms: Number(doctorMs.toFixed(3)),
      cli_boot_latency_ms: Number(bootMs.toFixed(3)),
      memory_rss_mb: Number(rssMb.toFixed(3)),
    },
    breaches,
  };

  if (JSON_MODE) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log("DEMA · performance budget gate");
    console.log(
      `  first_look_render_ms: ${report.measured.first_look_render_ms} (<= ${BUDGETS.first_look_render_ms})`,
    );
    console.log(
      `  doctor_gather_ms: ${report.measured.doctor_gather_ms} (<= ${BUDGETS.doctor_gather_ms})`,
    );
    console.log(
      `  cli_boot_latency_ms: ${report.measured.cli_boot_latency_ms} (<= ${BUDGETS.cli_boot_latency_ms})`,
    );
    console.log(
      `  memory_rss_mb: ${report.measured.memory_rss_mb} (<= ${BUDGETS.memory_rss_mb})`,
    );
    console.log(`  result: ${pass ? "PASS" : "FAIL"}`);
  }

  process.exit(pass ? 0 : 1);
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  await main();
}
