#!/usr/bin/env node
// CONTRIBUTION-LADDER-COMPOSE-GATE-1A — read-only ladder compose verifier.

import {
  runContributionLadderComposeGate,
  CONTRIBUTION_LADDER_COMPOSE_GATE_SCHEMA,
  CONTRIBUTION_LADDER_COMPOSE_GATE_TRUTH_LABEL,
} from "../../packages/core/src/contribution-ladder-compose-gate.js";

const JSON_MODE = process.argv.includes("--json");

export function runContributionLadderComposeGateCheck() {
  return runContributionLadderComposeGate();
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const result = runContributionLadderComposeGateCheck();

  if (JSON_MODE) {
    const { composed: _omit, ...json } = result;
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log("DEMA · contribution ladder compose gate (docs-only)");
    console.log(`  schema: ${CONTRIBUTION_LADDER_COMPOSE_GATE_SCHEMA}`);
    console.log(`  truth: ${CONTRIBUTION_LADDER_COMPOSE_GATE_TRUTH_LABEL}`);
    console.log(`  ladder steps: ${result.ladder_step_count}`);
    console.log(`  receipt plans: ${result.resource_receipt_plan_count}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.verified.blocked_by) {
        console.log(`    ${code}`);
      }
    }
  }

  if (!result.ok) process.exit(1);
}
