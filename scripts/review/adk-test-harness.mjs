#!/usr/bin/env node
// BIZRA-ADK-TEST-HARNESS-1A review gate (read-only adversarial suite).

import { runAdkAdversarialSuite } from "../../packages/adk/src/test-harness.js";

const JSON_MODE = process.argv.includes("--json");
const report = runAdkAdversarialSuite();
const pass = report.verdict === "CLEAN";

if (JSON_MODE) {
  console.log(JSON.stringify({ ok: pass, ...report }, null, 2));
} else {
  console.log("DEMA · BIZRA ADK test harness (adversarial, read-only)");
  console.log(`  cases: ${report.case_count}`);
  console.log(`  failed: ${report.failed_count}`);
  console.log(`  verdict: ${report.verdict}`);
  console.log(`  result: ${pass ? "PASS" : "FAIL"}`);
}

process.exit(pass ? 0 : 1);
