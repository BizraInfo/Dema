#!/usr/bin/env node
// NODE0-EVIDENCE-SOURCE-REGISTRY-1A — review gate. Runs the slice proof loop and emits the verdict.

import { pathToFileURL } from "node:url";

import {
  defaultNode0EvidenceSourceRegistryInput,
  runNode0EvidenceSourceRegistry,
  NODE0_EVIDENCE_SOURCE_REGISTRY_SCHEMA,
  NODE0_EVIDENCE_SOURCE_REGISTRY_TRUTH_LABEL,
  NODE0_EVIDENCE_SOURCE_REGISTRY_GO_PHRASE,
} from "../../packages/core/src/node0-evidence-source-registry.js";

const JSON_MODE = process.argv.includes("--json");

export function runNode0EvidenceSourceRegistryCheck() {
  return runNode0EvidenceSourceRegistry({
    consent: NODE0_EVIDENCE_SOURCE_REGISTRY_GO_PHRASE,
    input: defaultNode0EvidenceSourceRegistryInput(),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runNode0EvidenceSourceRegistryCheck();

  if (JSON_MODE) {
    // Strip heavy/non-summary fields here if the envelope carries them.
    const { ...json } = result;
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log("DEMA - NODE0-EVIDENCE-SOURCE-REGISTRY-1A");
    console.log(`  schema: ${NODE0_EVIDENCE_SOURCE_REGISTRY_SCHEMA}`);
    console.log(`  truth: ${NODE0_EVIDENCE_SOURCE_REGISTRY_TRUTH_LABEL}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by || []) console.log(`    ${code}`);
    }
  }

  if (!result.ok) process.exit(1);
}
