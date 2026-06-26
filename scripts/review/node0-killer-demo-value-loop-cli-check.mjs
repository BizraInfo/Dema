#!/usr/bin/env node
// NODE0-KILLER-DEMO-VALUE-LOOP-CLI-1A — hermetic fail-closed review gate.

import { pathToFileURL } from "node:url";
import {
  runNode0KillerDemoValueLoopCli,
  NODE0_KILLER_DEMO_VALUE_LOOP_CLI_SCHEMA,
  NODE0_KILLER_DEMO_VALUE_LOOP_CLI_TRUTH_LABEL,
} from "../../packages/core/src/node0-killer-demo-value-loop-cli.js";

const JSON_MODE = process.argv.includes("--json");

export function runNode0KillerDemoValueLoopCliCheck() {
  return runNode0KillerDemoValueLoopCli();
}

if (pathToFileURL(process.argv[1]).href === import.meta.url) {
  const result = runNode0KillerDemoValueLoopCliCheck();

  if (JSON_MODE) {
    const { envelope: _omit, ...json } = result;
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log("DEMA · Node0 killer demo value loop CLI check (preview-only)");
    console.log(`  schema: ${NODE0_KILLER_DEMO_VALUE_LOOP_CLI_SCHEMA}`);
    console.log(`  truth: ${NODE0_KILLER_DEMO_VALUE_LOOP_CLI_TRUTH_LABEL}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.verified.blocked_by) {
        console.log(`    ${code}`);
      }
    }
  }

  if (!result.ok) process.exit(1);
}
