#!/usr/bin/env node
// APR-NODE0-ROUTE-REFINERY-PREVIEW-1A - read-only verifier.

import { pathToFileURL } from "node:url";

import {
  runAprNode0RouteRefineryPreviewGate,
  APR_NODE0_ROUTE_REFINERY_SCHEMA,
  APR_NODE0_ROUTE_REFINERY_TRUTH_LABEL,
} from "../../packages/core/src/apr-node0-route-refinery-preview.js";

const JSON_MODE = process.argv.includes("--json");

export function runAprNode0RouteRefineryPreviewGateCheck() {
  return runAprNode0RouteRefineryPreviewGate();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runAprNode0RouteRefineryPreviewGateCheck();

  if (JSON_MODE) {
    const { report: _omit, ...json } = result;
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log("DEMA - APR Node0 route refinery preview");
    console.log(`  schema: ${APR_NODE0_ROUTE_REFINERY_SCHEMA}`);
    console.log(`  truth: ${APR_NODE0_ROUTE_REFINERY_TRUTH_LABEL}`);
    console.log(`  input_route: ${result.input_route_id}`);
    console.log(`  quality: ${result.route_quality_score}`);
    console.log(`  next: ${result.safe_next_action_recommendation}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.verified.blocked_by) {
        console.log(`    ${code}`);
      }
    }
  }

  if (!result.ok) process.exit(1);
}
