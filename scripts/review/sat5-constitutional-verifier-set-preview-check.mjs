#!/usr/bin/env node
// SAT5-CONSTITUTIONAL-VERIFIER-SET-PREVIEW-1A — review gate. Runs the slice proof loop and emits the verdict.

import { pathToFileURL } from "node:url";

import {
  runSat5ConstitutionalVerifierSetPreview,
  SAT5_CONSTITUTIONAL_VERIFIER_SET_PREVIEW_SCHEMA,
  SAT5_CONSTITUTIONAL_VERIFIER_SET_PREVIEW_TRUTH_LABEL,
  SAT5_CONSTITUTIONAL_VERIFIER_SET_PREVIEW_GO_PHRASE,
} from "../../packages/core/src/sat5-constitutional-verifier-set-preview.js";

const JSON_MODE = process.argv.includes("--json");

// Two canonical fixtures: a clean Node0 outcome (all five SAT verifiers PASS ->
// ADMISSIBLE) and a riba-tripping outcome (SAT-3 FAIL -> REJECTED). The gate
// passes only when BOTH the admissible path and the fail-closed path hold. No
// fs, no network: proves the judge CONTRACT, animates no live SAT agent.
const CLEAN_OUTCOME = {
  subject: "node0",
  receipt: { claimed_content_hash: "sha256:abc123", body_hash_rederived: "sha256:abc123" },
  consent: { phrase_present: true, exact_match: true },
  impact: { mint_claim: false, cost_called_value: false, simulated_impact_as_real: false, unverified_impact_claimed: false },
  blast: { blast_radius: "low", reversible: true, backup_present: false },
  doctrine: { truth_label_present: true, boundary_all_false: true, forbidden_claims: [] },
};

export function runSat5ConstitutionalVerifierSetPreviewCheck() {
  const blocked_by = [];
  const clean = runSat5ConstitutionalVerifierSetPreview({ consent: SAT5_CONSTITUTIONAL_VERIFIER_SET_PREVIEW_GO_PHRASE, input: { outcome: CLEAN_OUTCOME } });
  if (!clean.ok) blocked_by.push(...clean.blocked_by.map((c) => `clean:${c}`));
  else if (!clean.judgment.admissible) blocked_by.push("clean_outcome_not_admissible");
  else if (clean.judgment.judges_node0 !== true || clean.judgment.serves_node0 !== false) blocked_by.push("constitutional_stance_wrong");

  const riba = runSat5ConstitutionalVerifierSetPreview({
    consent: SAT5_CONSTITUTIONAL_VERIFIER_SET_PREVIEW_GO_PHRASE,
    input: { outcome: { ...CLEAN_OUTCOME, impact: { ...CLEAN_OUTCOME.impact, mint_claim: true } } },
  });
  if (!riba.ok) blocked_by.push(...riba.blocked_by.map((c) => `riba:${c}`));
  else if (riba.judgment.admissible !== false) blocked_by.push("riba_outcome_wrongly_admissible");
  else if (!riba.judgment.failing_verifiers.includes("SAT-3")) blocked_by.push("sat3_did_not_fail");

  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: SAT5_CONSTITUTIONAL_VERIFIER_SET_PREVIEW_SCHEMA,
    truth_label: SAT5_CONSTITUTIONAL_VERIFIER_SET_PREVIEW_TRUTH_LABEL,
    scenarios: {
      clean: clean.ok ? { admissible: clean.judgment.admissible, content_hash: clean.content_hash } : null,
      riba: riba.ok ? { admissible: riba.judgment.admissible, failing: riba.judgment.failing_verifiers } : null,
    },
    blocked_by: Object.freeze(blocked_by),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runSat5ConstitutionalVerifierSetPreviewCheck();

  if (JSON_MODE) {
    // Strip heavy/non-summary fields here if the envelope carries them.
    const { ...json } = result;
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log("DEMA - SAT5-CONSTITUTIONAL-VERIFIER-SET-PREVIEW-1A");
    console.log(`  schema: ${SAT5_CONSTITUTIONAL_VERIFIER_SET_PREVIEW_SCHEMA}`);
    console.log(`  truth: ${SAT5_CONSTITUTIONAL_VERIFIER_SET_PREVIEW_TRUTH_LABEL}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by || []) console.log(`    ${code}`);
    }
  }

  if (!result.ok) process.exit(1);
}
