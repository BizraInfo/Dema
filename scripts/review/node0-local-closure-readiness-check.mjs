#!/usr/bin/env node
// NODE0-LOCAL-CLOSURE-READINESS-1A — review gate. Runs the slice proof loop and emits the verdict.

import { pathToFileURL } from "node:url";

import {
  runNode0LocalClosureReadiness,
  defaultNode0LocalClosureReadinessInput,
  NODE0_LOCAL_CLOSURE_READINESS_SCHEMA,
  NODE0_LOCAL_CLOSURE_READINESS_TRUTH_LABEL,
  NODE0_LOCAL_CLOSURE_READINESS_GO_PHRASE,
} from "../../packages/core/src/node0-local-closure-readiness.js";

const JSON_MODE = process.argv.includes("--json");

export function runNode0LocalClosureReadinessCheck() {
  return runNode0LocalClosureReadiness({
    consent: NODE0_LOCAL_CLOSURE_READINESS_GO_PHRASE,
    input: defaultNode0LocalClosureReadinessInput(),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runNode0LocalClosureReadinessCheck();

  if (JSON_MODE) {
    // Strip heavy/non-summary fields here if the envelope carries them.
    const { ...json } = result;
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log("DEMA - NODE0-LOCAL-CLOSURE-READINESS-1A");
    console.log(`  schema: ${NODE0_LOCAL_CLOSURE_READINESS_SCHEMA}`);
    console.log(`  truth: ${NODE0_LOCAL_CLOSURE_READINESS_TRUTH_LABEL}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by || []) console.log(`    ${code}`);
    }
  }

  if (!result.ok) process.exit(1);
}
