#!/usr/bin/env node
// DEMA-FDE-DUAL-DIAGNOSTIC-1A - read-only dual failure diagnosis verifier.

import { pathToFileURL } from "node:url";

import {
  runDemaFdeDualDiagnosticGate,
  DEMA_FDE_DUAL_DIAGNOSTIC_SCHEMA,
  DEMA_FDE_DUAL_DIAGNOSTIC_TRUTH_LABEL,
} from "../../packages/core/src/dema-fde-dual-diagnostic.js";

const JSON_MODE = process.argv.includes("--json");

export function runDemaFdeDualDiagnosticGateCheck() {
  return runDemaFdeDualDiagnosticGate();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runDemaFdeDualDiagnosticGateCheck();

  if (JSON_MODE) {
    const { report: _omit, ...json } = result;
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log("DEMA - FDE dual diagnostic");
    console.log(`  schema: ${DEMA_FDE_DUAL_DIAGNOSTIC_SCHEMA}`);
    console.log(`  truth: ${DEMA_FDE_DUAL_DIAGNOSTIC_TRUTH_LABEL}`);
    console.log(`  failure_class: ${result.failure_class}`);
    console.log(`  measured_status: ${result.measured_status}`);
    console.log(`  inward_confidence: ${result.inward_confidence}`);
    console.log(`  outward_confidence: ${result.outward_confidence}`);
    console.log(`  regression_test_required: ${result.regression_test_required}`);
    console.log(`  field_validation_required: ${result.field_validation_required}`);
    console.log(`  eligible_for_autopatch: ${result.eligible_for_autopatch}`);
    console.log(`  diagnostic_hash: ${result.diagnostic_hash}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.verified.blocked_by) {
        console.log(`    ${code}`);
      }
    }
  }

  if (!result.ok) process.exit(1);
}
