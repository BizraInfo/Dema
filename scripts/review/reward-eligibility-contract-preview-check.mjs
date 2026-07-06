#!/usr/bin/env node
// REWARD-ELIGIBILITY-CONTRACT-PREVIEW-1A — review gate. Runs the slice proof loop and emits the verdict.

import { pathToFileURL } from "node:url";

import {
  runRewardEligibilityContractPreview,
  REWARD_ELIGIBILITY_CONTRACT_PREVIEW_SCHEMA,
  REWARD_ELIGIBILITY_CONTRACT_PREVIEW_TRUTH_LABEL,
  REWARD_ELIGIBILITY_CONTRACT_PREVIEW_GO_PHRASE,
} from "../../packages/core/src/reward-eligibility-contract-preview.js";

const JSON_MODE = process.argv.includes("--json");

// Two canonical deterministic fixtures — the gate passes only when BOTH contract
// behaviors hold: an evidenced monitor-clear repair loop is eligible, and a
// monitor weakened to hide drift is refused. No fs, no network: the gate proves
// the eligibility CONTRACT, nothing is scored, granted, or actuated.
const NO_CLAIMS = {
  mint_claim: false, wallet_claim: false, urp_live_claim: false, federation_claim: false,
  public_safe_claim: false, authority_delta_nonzero: false, cost_called_value: false, simulated_impact_as_real: false,
};

const ELIGIBLE_FIXTURE = {
  outcome: {
    outcome_kind: "monitor_all_clear_after_repair",
    evidence_refs: ["PR#327:af88492", "monitor:all_clear", "gate:npm-test"],
    monitor_state: { critical_count: 0, all_clear: true, weakened_to_hide_drift: false },
    claims: { ...NO_CLAIMS },
  },
};

const HIDES_DRIFT_FIXTURE = {
  outcome: {
    outcome_kind: "monitor_all_clear_after_repair",
    evidence_refs: ["fake-evref"],
    monitor_state: { critical_count: 0, all_clear: true, weakened_to_hide_drift: true },
    claims: { ...NO_CLAIMS },
  },
};

export function runRewardEligibilityContractPreviewCheck() {
  const blocked_by = [];
  const elig = runRewardEligibilityContractPreview({ consent: REWARD_ELIGIBILITY_CONTRACT_PREVIEW_GO_PHRASE, input: ELIGIBLE_FIXTURE });
  if (!elig.ok) blocked_by.push(...elig.blocked_by.map((c) => `eligible:${c}`));
  else if (elig.eligibility.eligible !== true) blocked_by.push("eligible_fixture_not_eligible");

  const hides = runRewardEligibilityContractPreview({ consent: REWARD_ELIGIBILITY_CONTRACT_PREVIEW_GO_PHRASE, input: HIDES_DRIFT_FIXTURE });
  if (!hides.ok) blocked_by.push(...hides.blocked_by.map((c) => `hides:${c}`));
  else if (hides.eligibility.eligible !== false) blocked_by.push("drift_hiding_fixture_wrongly_eligible");
  else if (!hides.eligibility.refusal_codes.includes("monitor_weakened_to_hide_drift")) blocked_by.push("dominant_negative_not_fired");

  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: REWARD_ELIGIBILITY_CONTRACT_PREVIEW_SCHEMA,
    truth_label: REWARD_ELIGIBILITY_CONTRACT_PREVIEW_TRUTH_LABEL,
    scenarios: {
      eligible: elig.ok ? { eligible: elig.eligibility.eligible, content_hash: elig.content_hash } : null,
      drift_hiding: hides.ok ? { eligible: hides.eligibility.eligible, refusal_codes: hides.eligibility.refusal_codes } : null,
    },
    blocked_by: Object.freeze(blocked_by),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runRewardEligibilityContractPreviewCheck();

  if (JSON_MODE) {
    // Strip heavy/non-summary fields here if the envelope carries them.
    const { ...json } = result;
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log("DEMA - REWARD-ELIGIBILITY-CONTRACT-PREVIEW-1A");
    console.log(`  schema: ${REWARD_ELIGIBILITY_CONTRACT_PREVIEW_SCHEMA}`);
    console.log(`  truth: ${REWARD_ELIGIBILITY_CONTRACT_PREVIEW_TRUTH_LABEL}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by || []) console.log(`    ${code}`);
    }
  }

  if (!result.ok) process.exit(1);
}
