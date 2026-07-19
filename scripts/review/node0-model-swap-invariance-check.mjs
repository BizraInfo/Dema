#!/usr/bin/env node
// NODE0-MODEL-SWAP-INVARIANCE-1A — review gate. Runs the slice proof loop and emits the verdict.

import { pathToFileURL } from "node:url";

import {
  runNode0ModelSwapInvariance,
  NODE0_MODEL_SWAP_INVARIANCE_SCHEMA,
  NODE0_MODEL_SWAP_INVARIANCE_TRUTH_LABEL,
  NODE0_MODEL_SWAP_INVARIANCE_GO_PHRASE,
} from "../../packages/core/src/node0-model-swap-invariance.js";

const JSON_MODE = process.argv.includes("--json");

export function runNode0ModelSwapInvarianceCheck() {
  // Canonical fixture: two different models produce the SAME good output (accepted,
  // interchangeable), and a third — deliberately the "trusted" fleet model — produces
  // a contract-violating output that is rejected. The verdict is contract-derived,
  // model identity has no authority, and all invariance flags hold.
  return runNode0ModelSwapInvariance({
    consent: NODE0_MODEL_SWAP_INVARIANCE_GO_PHRASE,
    input: {
      task: {
        task_id: "gate-fixture-001",
        acceptance_contract: {
          required_output_keys: ["answer", "evidence_ref"],
          forbidden_substrings: ["world's first", "guaranteed"],
          expected: { answer: "42" },
        },
      },
      candidates: [
        { model_id: "whiterabbitneo-v3:7b", output: { answer: "42", evidence_ref: "receipt:aa" } },
        { model_id: "deepseek-r1:8b", output: { answer: "42", evidence_ref: "receipt:aa" } },
        { model_id: "trusted-but-wrong", output: { answer: "42", evidence_ref: "r", note: "guaranteed" } },
      ],
    },
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runNode0ModelSwapInvarianceCheck();

  if (JSON_MODE) {
    // Strip heavy/non-summary fields here if the envelope carries them.
    const { ...json } = result;
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log("DEMA - NODE0-MODEL-SWAP-INVARIANCE-1A");
    console.log(`  schema: ${NODE0_MODEL_SWAP_INVARIANCE_SCHEMA}`);
    console.log(`  truth: ${NODE0_MODEL_SWAP_INVARIANCE_TRUTH_LABEL}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by || []) console.log(`    ${code}`);
    }
  }

  if (!result.ok) process.exit(1);
}
