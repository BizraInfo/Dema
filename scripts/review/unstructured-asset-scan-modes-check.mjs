#!/usr/bin/env node
// UNSTRUCTURED-ASSET-SCAN-MODES-1A — read-only scan-mode policy verifier.

import {
  runUnstructuredAssetScanModesGate,
  UNSTRUCTURED_ASSET_SCAN_MODES_SCHEMA,
  UNSTRUCTURED_ASSET_SCAN_MODES_TRUTH_LABEL,
  DEFAULT_SCAN_MODE,
} from "../../packages/core/src/unstructured-asset-scan-modes.js";

const JSON_MODE = process.argv.includes("--json");

export function runUnstructuredAssetScanModesGateCheck() {
  return runUnstructuredAssetScanModesGate();
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const result = runUnstructuredAssetScanModesGateCheck();

  if (JSON_MODE) {
    const { policy: _omit, ...json } = result;
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log("DEMA · unstructured asset scan modes (docs-only)");
    console.log(`  schema: ${UNSTRUCTURED_ASSET_SCAN_MODES_SCHEMA}`);
    console.log(`  truth: ${UNSTRUCTURED_ASSET_SCAN_MODES_TRUTH_LABEL}`);
    console.log(`  default_mode: ${DEFAULT_SCAN_MODE}`);
    console.log(`  scan_modes: ${result.scan_mode_count}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.verified.blocked_by) {
        console.log(`    ${code}`);
      }
    }
  }

  if (!result.ok) process.exit(1);
}
