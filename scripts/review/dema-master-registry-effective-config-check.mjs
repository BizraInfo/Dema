#!/usr/bin/env node
// DEMA-MASTER-REGISTRY-EFFECTIVE-CONFIG-1A — pure review gate, no provider call.

import { pathToFileURL } from "node:url";

import {
  DEMA_MASTER_REGISTRY_EFFECTIVE_CONFIG_SCHEMA,
  DEMA_MASTER_REGISTRY_EFFECTIVE_CONFIG_TRUTH_LABEL,
  runDemaMasterRegistryEffectiveConfig,
} from "../../packages/core/src/dema-master-registry-effective-config.js";

const JSON_MODE = process.argv.includes("--json");
const REVISION_HASH = `sha256:${"a".repeat(64)}`;

function canonicalInput() {
  return {
    desired: {
      schema: "bizra.dema.master_registry.desired.v0.1",
      revision: { id: "mr-001", content_hash: REVISION_HASH },
      policy: { fallback: "DISABLED", locality: "LOCAL_ONLY" },
      bindings: [
        {
          id: "llamacpp-gemma4-12b",
          capability_class: "INFERENCE_PROVIDER",
          model_id: "gemma4-12b",
          admission_state: "ACTIVE",
          qualification_state: "QUALIFIED",
          roles: ["DEMA_FACE"],
          locality: "LOOPBACK",
          authority_class: "PROPOSAL_ONLY",
        },
      ],
      routes: [
        {
          role: "DEMA_FACE",
          primary_binding_id: "llamacpp-gemma4-12b",
          fallback: "DISABLED",
        },
      ],
    },
    observed: {
      schema: "bizra.dema.master_registry.observation.v0.1",
      mr_revision: { id: "mr-001", content_hash: REVISION_HASH },
      freshness_state: "FRESH",
      bindings: [
        {
          binding_id: "llamacpp-gemma4-12b",
          model_id: "gemma4-12b",
          observation_state: "VERIFIED",
          runtime_state: "READY",
        },
      ],
    },
    request: {
      role: "DEMA_FACE",
      locality: "LOOPBACK",
      authority_class: "PROPOSAL_ONLY",
    },
  };
}

export function runDemaMasterRegistryEffectiveConfigCheck() {
  return runDemaMasterRegistryEffectiveConfig({ input: canonicalInput() });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runDemaMasterRegistryEffectiveConfigCheck();

  if (JSON_MODE) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("DEMA - DEMA-MASTER-REGISTRY-EFFECTIVE-CONFIG-1A");
    console.log(`  schema: ${DEMA_MASTER_REGISTRY_EFFECTIVE_CONFIG_SCHEMA}`);
    console.log(`  truth: ${DEMA_MASTER_REGISTRY_EFFECTIVE_CONFIG_TRUTH_LABEL}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by || []) console.log(`    ${code}`);
    }
  }

  if (!result.ok) process.exit(1);
}
