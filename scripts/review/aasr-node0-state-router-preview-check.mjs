#!/usr/bin/env node
// AASR-FILE-ACTION-AND-RESOURCE-STATE-ROUTER-PREVIEW-1A — read-only verifier.

import { pathToFileURL } from "node:url";

import {
  runAasrNode0StateRouterPreviewGate,
  AASR_NODE0_STATE_ROUTER_SCHEMA,
  AASR_NODE0_STATE_ROUTER_TRUTH_LABEL,
} from "../../packages/core/src/aasr-node0-state-router-preview.js";

const JSON_MODE = process.argv.includes("--json");

export function runAasrNode0StateRouterPreviewGateCheck() {
  return runAasrNode0StateRouterPreviewGate();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runAasrNode0StateRouterPreviewGateCheck();

  if (JSON_MODE) {
    const { report: _omit, ...json } = result;
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log("DEMA · AASR Node0 state router preview");
    console.log(`  schema: ${AASR_NODE0_STATE_ROUTER_SCHEMA}`);
    console.log(`  truth: ${AASR_NODE0_STATE_ROUTER_TRUTH_LABEL}`);
    console.log(`  routed: ${result.routed_artifact_type}`);
    console.log(`  verdict: ${result.final_router_verdict}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.verified.blocked_by) {
        console.log(`    ${code}`);
      }
    }
  }

  if (!result.ok) process.exit(1);
}
