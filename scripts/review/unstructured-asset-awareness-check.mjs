#!/usr/bin/env node
// UNSTRUCTURED-ASSET-AWARENESS-GATE-1A — read-only unstructured asset verifier.

import {
  runUnstructuredAssetAwarenessGate,
  UNSTRUCTURED_ASSET_AWARENESS_SCHEMA,
  UNSTRUCTURED_ASSET_AWARENESS_TRUTH_LABEL,
  UNSTRUCTURED_FIXTURE_RECORDS,
} from "../../packages/core/src/unstructured-asset-awareness.js";

const JSON_MODE = process.argv.includes("--json");

export function runUnstructuredAssetAwarenessCheck() {
  return runUnstructuredAssetAwarenessGate();
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const result = runUnstructuredAssetAwarenessCheck();

  if (JSON_MODE) {
    const { report: _omit, ...json } = result;
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log("DEMA · unstructured asset awareness (docs-only)");
    console.log(`  schema: ${UNSTRUCTURED_ASSET_AWARENESS_SCHEMA}`);
    console.log(`  truth: ${UNSTRUCTURED_ASSET_AWARENESS_TRUTH_LABEL}`);
    console.log(`  fixture assets: ${UNSTRUCTURED_FIXTURE_RECORDS.length}`);
    console.log(`  classified: ${result.classified_count}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.verified.blocked_by) {
        console.log(`    ${code}`);
      }
    }
  }

  if (!result.ok) process.exit(1);
}
