#!/usr/bin/env node
// NODE0-GOVERNED-REVERSIBLE-ACTION-PREVIEW-1A - read-only verifier.

import { pathToFileURL } from "node:url";

import {
  runNode0GovernedReversibleActionPreviewGate,
  NODE0_GOVERNED_REVERSIBLE_ACTION_PREVIEW_SCHEMA,
  NODE0_GOVERNED_REVERSIBLE_ACTION_PREVIEW_TRUTH_LABEL,
} from "../../packages/core/src/node0-governed-reversible-action-preview.js";

const JSON_MODE = process.argv.includes("--json");

export function runNode0GovernedReversibleActionPreviewGateCheck() {
  return runNode0GovernedReversibleActionPreviewGate();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runNode0GovernedReversibleActionPreviewGateCheck();

  if (JSON_MODE) {
    const { report: _omit, ...json } = result;
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log("DEMA - Node0 governed reversible action preview");
    console.log(`  schema: ${NODE0_GOVERNED_REVERSIBLE_ACTION_PREVIEW_SCHEMA}`);
    console.log(`  truth: ${NODE0_GOVERNED_REVERSIBLE_ACTION_PREVIEW_TRUTH_LABEL}`);
    console.log(`  input_refined_route: ${result.input_refined_route_id}`);
    console.log(`  action_type: ${result.action_type}`);
    console.log(`  human_go_review: ${result.eligible_for_human_go_review}`);
    console.log(`  execution: ${result.eligible_for_execution}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.verified.blocked_by) {
        console.log(`    ${code}`);
      }
    }
  }

  if (!result.ok) process.exit(1);
}
