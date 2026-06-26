#!/usr/bin/env node
// OPERATOR-BRIDGE-THREAT-MODEL-1A review gate (read-only).

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildOperatorBridgeThreatModelReport,
  verifyOperatorBridgeThreatModelReport,
  OPERATOR_BRIDGE_ADR_REL_PATH,
} from "../../packages/core/src/operator-bridge-threat-model.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");
const JSON_MODE = process.argv.includes("--json");

export function runOperatorBridgeThreatModelCheck({ root = REPO_ROOT } = {}) {
  const adrPath = join(root, OPERATOR_BRIDGE_ADR_REL_PATH);
  const adrExists = existsSync(adrPath);
  const adrText = adrExists ? readFileSync(adrPath, "utf8") : "";
  const report = buildOperatorBridgeThreatModelReport({ adrText, adrExists });
  const verified = verifyOperatorBridgeThreatModelReport(report);
  return Object.freeze({
    ok: report.ok && verified.ok,
    report,
    verified,
  });
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const result = runOperatorBridgeThreatModelCheck();
  if (JSON_MODE) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("DEMA · operator bridge threat model (read-only)");
    console.log(`  bridge env vars: ${result.report.bridge_env_count}`);
    console.log(`  high trust: ${result.report.high_trust_count}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const finding of result.report.findings) {
        console.log(`    ${finding.code}: ${finding.message}`);
      }
    }
  }
  if (!result.ok) process.exit(1);
}
