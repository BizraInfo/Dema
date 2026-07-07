#!/usr/bin/env node
// URP-SUPPLY-SIDE-RESOURCE-REWARD-CONTRACT-PREVIEW-1A — review gate. Runs the contract proof loop.

import { pathToFileURL } from "node:url";

import {
  runUrpSupplyRewardPreview,
  URP_SUPPLY_REWARD_PREVIEW_SCHEMA,
  URP_SUPPLY_REWARD_PREVIEW_TRUTH_LABEL,
  URP_SUPPLY_REWARD_PREVIEW_GO_PHRASE,
} from "../../packages/core/src/urp-supply-side-resource-reward-contract-preview.js";

export function runUrpSupplyRewardPreviewCheck() {
  // Canonical fixture: a consented, measured, low-value compute offer with no impact claim →
  // reward_preview_allowed (base supply/availability/usage reward eligible, no impact dividend).
  return runUrpSupplyRewardPreview({
    consent: URP_SUPPLY_REWARD_PREVIEW_GO_PHRASE,
    input: {
      resource_class: "compute",
      offered_capacity: 8,
      consent_scope: "node0:self",
      availability_window: "2026-07-07/2026-07-08",
      measured_uptime: 0.99,
      served_units: 42,
      quality_score: 0.95,
      failure_count: 0,
      policy_violation_count: 0,
    },
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runUrpSupplyRewardPreviewCheck();
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("URP - URP-SUPPLY-SIDE-RESOURCE-REWARD-CONTRACT-PREVIEW-1A");
    console.log(`  schema: ${URP_SUPPLY_REWARD_PREVIEW_SCHEMA}`);
    console.log(`  truth:  ${URP_SUPPLY_REWARD_PREVIEW_TRUTH_LABEL}`);
    console.log(`  reward_status: ${result.reward_status ?? "n/a"}`);
    console.log(`  mint_allowed: ${result.mint_allowed}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    for (const code of result.blocked_by) console.log(`    ${code}`);
  }
  if (!result.ok) process.exit(1);
}
