#!/usr/bin/env node
// CONSENT-BRIDGE-PARITY-1A — read-only consent matrix ↔ bridge registry crosswalk.

import {
  runConsentBridgeParityCheck,
  CONSENT_BRIDGE_PARITY_SCHEMA,
  CONSENT_BRIDGE_PARITY_TRUTH_LABEL,
} from "../../packages/core/src/consent-bridge-parity.js";

const JSON_MODE = process.argv.includes("--json");

export function runConsentBridgeParityGateCheck() {
  return runConsentBridgeParityCheck();
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const result = runConsentBridgeParityGateCheck();

  if (JSON_MODE) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("DEMA · consent bridge parity (read-only)");
    console.log(`  schema: ${CONSENT_BRIDGE_PARITY_SCHEMA}`);
    console.log(`  truth: ${CONSENT_BRIDGE_PARITY_TRUTH_LABEL}`);
    console.log(
      `  external_runtime commands: ${result.report.external_runtime_command_count}`,
    );
    console.log(`  bridge env vars: ${result.report.bridge_env_count}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const finding of result.report.findings) {
        console.log(`    ${finding.code}: ${finding.message}`);
      }
    }
  }

  if (!result.ok) process.exit(1);
}
