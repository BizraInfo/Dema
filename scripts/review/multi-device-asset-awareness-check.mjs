#!/usr/bin/env node
// MULTI-DEVICE-ASSET-AWARENESS-1A — read-only device constellation verifier.

import {
  runMultiDeviceAssetAwarenessGate,
  MULTI_DEVICE_ASSET_AWARENESS_SCHEMA,
  MULTI_DEVICE_ASSET_AWARENESS_TRUTH_LABEL,
  DEFAULT_SCAN_MODE,
} from "../../packages/core/src/multi-device-asset-awareness.js";

const JSON_MODE = process.argv.includes("--json");

export function runMultiDeviceAssetAwarenessGateCheck() {
  return runMultiDeviceAssetAwarenessGate();
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const result = runMultiDeviceAssetAwarenessGateCheck();

  if (JSON_MODE) {
    const { report: _omit, ...json } = result;
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log("DEMA · multi-device asset awareness (docs-only)");
    console.log(`  schema: ${MULTI_DEVICE_ASSET_AWARENESS_SCHEMA}`);
    console.log(`  truth: ${MULTI_DEVICE_ASSET_AWARENESS_TRUTH_LABEL}`);
    console.log(`  default_scan_mode: ${DEFAULT_SCAN_MODE}`);
    console.log(`  devices: ${result.device_count}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.verified.blocked_by) {
        console.log(`    ${code}`);
      }
    }
  }

  if (!result.ok) process.exit(1);
}
