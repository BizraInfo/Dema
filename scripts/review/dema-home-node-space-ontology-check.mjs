#!/usr/bin/env node
// DEMA-HOME-NODE-SPACE-ONTOLOGY-1A — read-only Node Space ontology verifier.

import {
  runDemaHomeNodeSpaceOntologyGate,
  DEMA_HOME_NODE_SPACE_ONTOLOGY_SCHEMA,
  DEMA_HOME_NODE_SPACE_ONTOLOGY_TRUTH_LABEL,
  ONTOLOGY_NODE_IDS,
} from "../../packages/core/src/dema-home-node-space-ontology.js";

const JSON_MODE = process.argv.includes("--json");

export function runDemaHomeNodeSpaceOntologyGateCheck() {
  return runDemaHomeNodeSpaceOntologyGate();
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const result = runDemaHomeNodeSpaceOntologyGateCheck();

  if (JSON_MODE) {
    const { ontology: _omit, ...json } = result;
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log("DEMA · Dema Home Node Space ontology (docs-only)");
    console.log(`  schema: ${DEMA_HOME_NODE_SPACE_ONTOLOGY_SCHEMA}`);
    console.log(`  truth: ${DEMA_HOME_NODE_SPACE_ONTOLOGY_TRUTH_LABEL}`);
    console.log(`  ontology nodes: ${ONTOLOGY_NODE_IDS.length}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.verified.blocked_by) {
        console.log(`    ${code}`);
      }
    }
  }

  if (!result.ok) process.exit(1);
}
