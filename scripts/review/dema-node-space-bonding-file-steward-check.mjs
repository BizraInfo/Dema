#!/usr/bin/env node
// DEMA-NODE-SPACE-BONDING-FILE-STEWARD-1A — preview-only file steward verifier.

import {
  runDemaNodeSpaceBondingFileStewardGate,
  DEMA_NODE_SPACE_BONDING_FILE_STEWARD_SCHEMA,
  DEMA_NODE_SPACE_BONDING_FILE_STEWARD_TRUTH_LABEL,
} from "../../packages/core/src/dema-node-space-bonding-file-steward.js";

const JSON_MODE = process.argv.includes("--json");

export function runDemaNodeSpaceBondingFileStewardGateCheck() {
  return runDemaNodeSpaceBondingFileStewardGate();
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const result = runDemaNodeSpaceBondingFileStewardGateCheck();

  if (JSON_MODE) {
    const { report: _omit, ...json } = result;
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log("DEMA · Node Space Bonding File Steward (preview-only)");
    console.log(`  schema: ${DEMA_NODE_SPACE_BONDING_FILE_STEWARD_SCHEMA}`);
    console.log(`  truth: ${DEMA_NODE_SPACE_BONDING_FILE_STEWARD_TRUTH_LABEL}`);
    console.log(`  fixture files: ${result.fixture_file_count}`);
    console.log(`  receipt previews: ${result.receipt_preview_count}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.verified.blocked_by) {
        console.log(`    ${code}`);
      }
    }
  }

  if (!result.ok) process.exit(1);
}
