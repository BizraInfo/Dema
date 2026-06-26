#!/usr/bin/env node
// NODE0-KILLER-DEMO-VALUE-LOOP-PROOF-CONVERGENCE-1A — hermetic fail-closed review gate.

import { pathToFileURL } from "node:url";
import {
  runNode0KillerDemoValueLoopProofConvergence,
  NODE0_KILLER_DEMO_VALUE_LOOP_PROOF_CONVERGENCE_SCHEMA,
  NODE0_KILLER_DEMO_VALUE_LOOP_PROOF_CONVERGENCE_TRUTH_LABEL,
} from "../../packages/core/src/node0-killer-demo-value-loop-proof-convergence.js";

const JSON_MODE = process.argv.includes("--json");

export function runNode0KillerDemoValueLoopProofConvergenceCheck() {
  return runNode0KillerDemoValueLoopProofConvergence();
}

if (pathToFileURL(process.argv[1]).href === import.meta.url) {
  const result = runNode0KillerDemoValueLoopProofConvergenceCheck();

  if (JSON_MODE) {
    const { composed: _omit, ...json } = result;
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log("DEMA · Node0 killer demo proof convergence check (preview-only)");
    console.log(`  schema: ${NODE0_KILLER_DEMO_VALUE_LOOP_PROOF_CONVERGENCE_SCHEMA}`);
    console.log(`  truth: ${NODE0_KILLER_DEMO_VALUE_LOOP_PROOF_CONVERGENCE_TRUTH_LABEL}`);
    console.log(`  compose_status: ${result.compose_status}`);
    console.log(
      `  convergence: ${result.convergence_summary?.converged ?? 0}/${result.convergence_summary?.total ?? 0}`,
    );
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.verified.blocked_by) {
        console.log(`    ${code}`);
      }
    }
  }

  if (!result.ok) process.exit(1);
}
