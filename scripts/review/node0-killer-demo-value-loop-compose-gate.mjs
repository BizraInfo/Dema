#!/usr/bin/env node
// NODE0-KILLER-DEMO-VALUE-LOOP-COMPOSE-GATE-1A — read-only killer-demo compose verifier.

import {
  runNode0KillerDemoValueLoopComposeGate,
  NODE0_KILLER_DEMO_VALUE_LOOP_COMPOSE_GATE_SCHEMA,
  NODE0_KILLER_DEMO_VALUE_LOOP_COMPOSE_GATE_TRUTH_LABEL,
} from "../../packages/core/src/node0-killer-demo-value-loop-compose-gate.js";

const JSON_MODE = process.argv.includes("--json");

export function runNode0KillerDemoValueLoopComposeGateCheck() {
  return runNode0KillerDemoValueLoopComposeGate();
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const result = runNode0KillerDemoValueLoopComposeGateCheck();

  if (JSON_MODE) {
    const { composed: _omit, ...json } = result;
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log("DEMA · Node0 killer-demo value loop compose gate (docs-only)");
    console.log(`  schema: ${NODE0_KILLER_DEMO_VALUE_LOOP_COMPOSE_GATE_SCHEMA}`);
    console.log(`  truth: ${NODE0_KILLER_DEMO_VALUE_LOOP_COMPOSE_GATE_TRUTH_LABEL}`);
    console.log(`  value loop steps: ${result.value_loop_step_count}`);
    console.log(
      `  summary: assets=${result.value_loop_summary?.unstructured_asset_count} devices=${result.value_loop_summary?.device_count} ontology_nodes=${result.value_loop_summary?.ontology_node_count}`,
    );
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.verified.blocked_by) {
        console.log(`    ${code}`);
      }
    }
  }

  if (!result.ok) process.exit(1);
}
