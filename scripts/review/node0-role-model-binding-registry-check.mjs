#!/usr/bin/env node
// NODE0-ROLE-MODEL-BINDING-REGISTRY-1A — review gate. Runs the slice proof loop and emits the verdict.

import { pathToFileURL } from "node:url";

import {
  runNode0RoleModelBindingRegistry,
  NODE0_ROLE_MODEL_BINDING_REGISTRY_SCHEMA,
  NODE0_ROLE_MODEL_BINDING_REGISTRY_TRUTH_LABEL,
  NODE0_ROLE_MODEL_BINDING_REGISTRY_GO_PHRASE,
} from "../../packages/core/src/node0-role-model-binding-registry.js";

const JSON_MODE = process.argv.includes("--json");

export function runNode0RoleModelBindingRegistryCheck() {
  // Canonical fixture: a SAT judge binding whose evidence hash is the REAL
  // measured judge-C0 artifact (deepseek eval report). Deterministic; SHADOW.
  // No acceptance_policy is supplied ON PURPOSE: no operator-ratified
  // role-and-lane acceptance policy exists yet, so the honest canonical
  // decision is REQUIRES_HUMAN (acceptance_policy_missing) — the loop still
  // proves plan → build → verify → tamper-reject end to end.
  const input = {
    mode: "SHADOW",
    as_of_iso: "2026-07-15T00:00:00Z",
    max_age_days: 30,
    role_contract: {
      schema: "bizra.node0.agent_role_contract.v0.1",
      role_id: "sat-boundary-judge",
      team: "SAT",
      serves: "system",
      base_class: { family: "deepseek", size_class: "3-4B" },
      adapter_ref: null,
      spawn_limit: 5,
      authority: {
        mint_allowed: false,
        egress_allowed: false,
        corpus_write_allowed: false,
        spawn_widens_authority: false,
      },
      truth_label: "DESIGNED_NOT_LIVE",
    },
    lane: "short_sat_judgment",
    records: [
      {
        schema: "bizra.node0.role_capability_record.v0.1",
        record_id: "fixture-deepseek-judge",
        role_id: "sat-boundary-judge",
        lane: "short_sat_judgment",
        model_id: "deepseek-r1:7b",
        backend_id: "ollama-0.20.5",
        family: "deepseek",
        evidence: {
          source_path: "/data/bizra/agents/judge-c1/eval-report.deepseek-r1_7b.json",
          sha256: "9c1a4125b687a854e1f3c4b78fe0face6d5f9b8f2924cc87e721f6a616f00e2b",
          measured_at_iso: "2026-07-14T08:07:00Z",
          metric: "heldout_agreement_pct",
          value: 29.73,
          evaluation_id: "judge-c0-74-heldout-v1",
        },
        limitations: ["lane_1_only", "74_item_heldout"],
        resource_envelope: { vram_gb_est: 4.7, ram_gb_est: 2 },
        privacy_class: "LOCAL_ONLY",
        consent_ref: NODE0_ROLE_MODEL_BINDING_REGISTRY_GO_PHRASE,
        verification_state: "MEASURED_LOCAL",
        superseded_by: null,
        contradicted_by: [],
      },
    ],
    budget: { vram_gb_max: 14, ram_gb_max: 96 },
    pat_bound_families: ["gemma"],
  };
  return runNode0RoleModelBindingRegistry({ consent: NODE0_ROLE_MODEL_BINDING_REGISTRY_GO_PHRASE, input });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runNode0RoleModelBindingRegistryCheck();

  if (JSON_MODE) {
    // Strip heavy/non-summary fields here if the envelope carries them.
    const { ...json } = result;
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log("DEMA - NODE0-ROLE-MODEL-BINDING-REGISTRY-1A");
    console.log(`  schema: ${NODE0_ROLE_MODEL_BINDING_REGISTRY_SCHEMA}`);
    console.log(`  truth: ${NODE0_ROLE_MODEL_BINDING_REGISTRY_TRUTH_LABEL}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by || []) console.log(`    ${code}`);
    }
  }

  if (!result.ok) process.exit(1);
}
