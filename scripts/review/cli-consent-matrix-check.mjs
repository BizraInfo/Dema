#!/usr/bin/env node
// CONSENT-MATRIX-COVERAGE-1A review gate (read-only).

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { COMMAND_TABLE } from "../../apps/cli/src/index.js";
import {
  buildCliConsentMatrixReport,
  verifyCliConsentMatrixReport,
} from "../../packages/core/src/cli-consent-matrix.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");
const JSON_MODE = process.argv.includes("--json");

export function runCliConsentMatrixCheck({ root = REPO_ROOT } = {}) {
  const report = buildCliConsentMatrixReport({
    commandSurface: Object.keys(COMMAND_TABLE),
    testFileExists: (rel) => existsSync(join(root, rel)),
  });
  const verified = verifyCliConsentMatrixReport(report);
  return Object.freeze({
    ok: report.ok && verified.ok,
    report,
    verified,
  });
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const result = runCliConsentMatrixCheck();
  if (JSON_MODE) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("DEMA · CLI consent matrix (read-only)");
    console.log(`  commands: ${result.report.summary.total_commands}`);
    console.log(`  mutating: ${result.report.summary.mutating_commands}`);
    console.log(
      `  high_sensitivity: ${result.report.summary.high_sensitivity_commands}`,
    );
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const cmd of result.report.missing_commands) {
        console.log(`    missing matrix row: ${cmd}`);
      }
      for (const cmd of result.report.orphan_commands) {
        console.log(`    orphan matrix row: ${cmd}`);
      }
      for (const finding of result.report.findings) {
        console.log(
          `    ${finding.command}: ${finding.code}${finding.detail ? ` (${finding.detail})` : ""}`,
        );
      }
    }
  }
  process.exit(result.ok ? 0 : 1);
}
