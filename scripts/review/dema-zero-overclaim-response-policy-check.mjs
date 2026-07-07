#!/usr/bin/env node
// DEMA-ZERO-OVERCLAIM-RESPONSE-POLICY-1A — review gate. Runs the policy proof loop.

import { pathToFileURL } from "node:url";

import {
  runDemaZeroOverclaimPolicy,
  DEMA_ZERO_OVERCLAIM_POLICY_SCHEMA,
  DEMA_ZERO_OVERCLAIM_POLICY_TRUTH_LABEL,
  DEMA_ZERO_OVERCLAIM_POLICY_GO_PHRASE,
} from "../../packages/core/src/dema-zero-overclaim-response-policy.js";

export function runDemaZeroOverclaimPolicyCheck() {
  // Canonical fixture: an honestly-labeled response (verified fact + inference) → cleared_to_respond.
  return runDemaZeroOverclaimPolicy({
    consent: DEMA_ZERO_OVERCLAIM_POLICY_GO_PHRASE,
    input: {
      answer_claims: [
        {
          text: "The IHSAN floor constant is 0.95.",
          claim_type: "fact",
          evidence_refs: ["core/integration/constants.py"],
          source_quality: "primary",
          asserted_label: "VERIFIED",
        },
        {
          text: "The two sources are likely kept in sync by the cross-lang gate.",
          claim_type: "inference",
          evidence_refs: ["scripts/review/cross-lang-sync-check"],
          asserted_label: "INFERRED",
        },
      ],
    },
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runDemaZeroOverclaimPolicyCheck();
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("DEMA - DEMA-ZERO-OVERCLAIM-RESPONSE-POLICY-1A");
    console.log(`  schema: ${DEMA_ZERO_OVERCLAIM_POLICY_SCHEMA}`);
    console.log(`  truth:  ${DEMA_ZERO_OVERCLAIM_POLICY_TRUTH_LABEL}`);
    console.log(`  policy_status: ${result.policy_status ?? "n/a"}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    for (const code of result.blocked_by) console.log(`    ${code}`);
  }
  if (!result.ok) process.exit(1);
}
