#!/usr/bin/env node
// DEMA-CAPABILITY-TRUTH-REGISTRY-1A - read-only repository truth-map verifier.

import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";

import {
  runDemaCapabilityTruthRegistryGate,
  DEMA_CAPABILITY_TRUTH_REGISTRY_SCHEMA,
  DEMA_CAPABILITY_TRUTH_REGISTRY_TRUTH_LABEL,
} from "../../packages/core/src/dema-capability-truth-registry.js";

const JSON_MODE = process.argv.includes("--json");

export function runDemaCapabilityTruthRegistryGateCheck() {
  return runDemaCapabilityTruthRegistryGate({ pathExists: existsSync });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runDemaCapabilityTruthRegistryGateCheck();

  if (JSON_MODE) {
    const { registry: _omit, ...json } = result;
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log("DEMA - Capability truth registry");
    console.log(`  schema: ${DEMA_CAPABILITY_TRUTH_REGISTRY_SCHEMA}`);
    console.log(`  truth: ${DEMA_CAPABILITY_TRUTH_REGISTRY_TRUTH_LABEL}`);
    console.log(`  capabilities: ${result.capability_count}`);
    console.log(`  measured_repo: ${result.measured_repo_count}`);
    console.log(`  blocked_live_surfaces: ${result.blocked_live_surface_count}`);
    console.log(`  registry_hash: ${result.registry_hash}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.verified.blocked_by) {
        console.log(`    ${code}`);
      }
    }
  }

  if (!result.ok) process.exit(1);
}
