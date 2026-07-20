#!/usr/bin/env node
// DEMA-MISSION-CONTRACT-1A — review gate. Runs the slice proof loop and emits the verdict.

import { pathToFileURL } from "node:url";

import {
  runDemaMissionContract,
  DEMA_MISSION_CONTRACT_SCHEMA,
  DEMA_MISSION_CONTRACT_TRUTH_LABEL,
  DEMA_MISSION_CONTRACT_GO_PHRASE,
} from "../../packages/core/src/dema-mission-contract.js";

const JSON_MODE = process.argv.includes("--json");

// Canonical fixture: the thesis §14 bounded local code-repair mission, expressed
// as a contract. Shared with the mirrored test so gate and test prove the same bytes.
export function demaMissionContractFixture() {
  return {
    purpose: "Repair one bounded local code defect under external verification.",
    scope: "One repository, one defect, one branch; no remote writes.",
    acceptance_criteria: [
      "Focused test for the defect passes",
      "Full repo gate suite stays green",
    ],
    prohibited_outcomes: ["remote_write", "network_use", "scope_widening"],
    authority_ceiling: "propose_only",
    iteration_budget: 3,
    completion_conditions: ["All acceptance criteria verified externally"],
    escalation_rule: "halt_and_ask_operator",
    created_at_iso: "2026-07-20T00:00:00Z",
  };
}

export function runDemaMissionContractCheck() {
  return runDemaMissionContract({
    consent: DEMA_MISSION_CONTRACT_GO_PHRASE,
    input: demaMissionContractFixture(),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runDemaMissionContractCheck();

  if (JSON_MODE) {
    // Strip heavy/non-summary fields here if the envelope carries them.
    const { ...json } = result;
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log("DEMA - DEMA-MISSION-CONTRACT-1A");
    console.log(`  schema: ${DEMA_MISSION_CONTRACT_SCHEMA}`);
    console.log(`  truth: ${DEMA_MISSION_CONTRACT_TRUTH_LABEL}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by || []) console.log(`    ${code}`);
    }
  }

  if (!result.ok) process.exit(1);
}
