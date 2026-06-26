#!/usr/bin/env node
// NODE0-PROOF-OF-TRUTH-CONTROL-PLANE-1B — hermetic fail-closed review gate.

import { pathToFileURL } from "node:url";
import {
  runNode0ProofOfTruthControlPlane,
  HERMETIC_CONTROL_PLANE_FIXTURE,
  NODE0_PROOF_OF_TRUTH_CONTROL_PLANE_SCHEMA,
  NODE0_PROOF_OF_TRUTH_CONTROL_PLANE_TRUTH_LABEL,
} from "../../packages/core/src/node0-proof-of-truth-control-plane.js";

const JSON_MODE = process.argv.includes("--json");

export function runNode0ProofOfTruthControlPlaneCheck() {
  return runNode0ProofOfTruthControlPlane({ ...HERMETIC_CONTROL_PLANE_FIXTURE });
}

if (pathToFileURL(process.argv[1]).href === import.meta.url) {
  const result = runNode0ProofOfTruthControlPlaneCheck();

  if (JSON_MODE) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("DEMA · Node0 proof-of-truth control plane check (hermetic)");
    console.log(`  schema: ${NODE0_PROOF_OF_TRUTH_CONTROL_PLANE_SCHEMA}`);
    console.log(`  truth: ${NODE0_PROOF_OF_TRUTH_CONTROL_PLANE_TRUTH_LABEL}`);
    console.log(`  release_verdict: ${result.ledger.release_verdict}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.verified.blocked_by) {
        console.log(`    ${code}`);
      }
    }
  }

  if (!result.ok) process.exit(1);
}
