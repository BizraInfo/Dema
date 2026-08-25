#!/usr/bin/env node
// POT-CLAIM-SCOPE-0A — review gate. Runs the slice proof loop and emits the verdict.

import { pathToFileURL } from "node:url";

import {
  runPotClaimScope,
  POT_CLAIM_SCOPE_SCHEMA,
  POT_CLAIM_SCOPE_TRUTH_LABEL,
  POT_CLAIM_SCOPE_GO_PHRASE,
} from "../../packages/core/src/pot-claim-scope.js";

const JSON_MODE = process.argv.includes("--json");
const digest = (hex) => `sha256:${hex.repeat(64).slice(0, 64)}`;
const binding = digest("a");
const evidence = digest("b");
const freshness = Object.freeze({
  observed_at: "2026-08-23T17:59:00Z",
  max_age_ms: 120000,
});

function rail(status = "PASS", extra = {}) {
  return {
    status,
    evidence_digest: evidence,
    causal_binding_digest: binding,
    ...extra,
  };
}

export function runPotClaimScopeCheck() {
  // Static fixture only: it proves the pure evaluator's COMPONENT path, not
  // that this source tree, environment, or any external evidence is live.
  return runPotClaimScope({
    consent: POT_CLAIM_SCOPE_GO_PHRASE,
    input: {
      evaluation: { evaluation_at: "2026-08-23T18:00:00Z" },
      claim: {
        scope: "COMPONENT",
        identity: {
          component_id: "pot-claim-scope",
          component_version: "0.1",
          source_digest: digest("c"),
          evaluation_digest: digest("d"),
          environment_identity: "static-review-fixture",
          causal_binding_digest: binding,
        },
        rails: {
          formal_contract: rail(),
          integrity_binding: rail(),
          empirical_observation: rail("PASS", freshness),
          economic_value: rail("NOT_APPLICABLE"),
        },
        recovery: { required: false, status: "NOT_APPLICABLE" },
        verification: { contradictions: [] },
        promotion: { requested: "COMPONENT_VERIFIED" },
      },
    },
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runPotClaimScopeCheck();

  if (JSON_MODE) {
    // Strip heavy/non-summary fields here if the envelope carries them.
    const { ...json } = result;
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log("DEMA - POT-CLAIM-SCOPE-0A");
    console.log(`  schema: ${POT_CLAIM_SCOPE_SCHEMA}`);
    console.log(`  truth: ${POT_CLAIM_SCOPE_TRUTH_LABEL}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by || []) console.log(`    ${code}`);
    }
  }

  if (!result.ok) process.exit(1);
}
