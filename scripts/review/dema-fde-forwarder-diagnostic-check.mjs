#!/usr/bin/env node
// DEMA-FDE-FORWARDER-DIAGNOSTIC-1A — review gate. Runs the slice proof loop and emits the verdict.

import { pathToFileURL } from "node:url";

import {
  runDemaFdeForwarderDiagnostic,
  defaultDemaFdeForwarderDiagnosticFixture,
  DEMA_FDE_FORWARDER_DIAGNOSTIC_SCHEMA,
  DEMA_FDE_FORWARDER_DIAGNOSTIC_TRUTH_LABEL,
  DEMA_FDE_FORWARDER_DIAGNOSTIC_GO_PHRASE,
} from "../../packages/core/src/dema-fde-forwarder-diagnostic.js";

const JSON_MODE = process.argv.includes("--json");

export function runDemaFdeForwarderDiagnosticCheck() {
  // Canonical fixture: a real upstream FDE report built by the FDE kernel itself.
  return runDemaFdeForwarderDiagnostic({
    consent: DEMA_FDE_FORWARDER_DIAGNOSTIC_GO_PHRASE,
    input: defaultDemaFdeForwarderDiagnosticFixture(),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runDemaFdeForwarderDiagnosticCheck();

  if (JSON_MODE) {
    // Strip heavy/non-summary fields here if the envelope carries them.
    const { ...json } = result;
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log("DEMA - DEMA-FDE-FORWARDER-DIAGNOSTIC-1A");
    console.log(`  schema: ${DEMA_FDE_FORWARDER_DIAGNOSTIC_SCHEMA}`);
    console.log(`  truth: ${DEMA_FDE_FORWARDER_DIAGNOSTIC_TRUTH_LABEL}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by || []) console.log(`    ${code}`);
    }
  }

  if (!result.ok) process.exit(1);
}
