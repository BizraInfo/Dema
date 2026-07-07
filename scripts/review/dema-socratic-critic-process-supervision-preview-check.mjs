#!/usr/bin/env node
// DEMA-SOCRATIC-CRITIC-PROCESS-SUPERVISION-PREVIEW-1A — review gate. Runs the critic proof loop.

import { pathToFileURL } from "node:url";

import {
  runDemaSocraticCriticPreview,
  DEMA_SOCRATIC_CRITIC_PREVIEW_SCHEMA,
  DEMA_SOCRATIC_CRITIC_PREVIEW_TRUTH_LABEL,
  DEMA_SOCRATIC_CRITIC_PREVIEW_GO_PHRASE,
} from "../../packages/core/src/dema-socratic-critic-process-supervision-preview.js";

export function runDemaSocraticCriticPreviewCheck() {
  // Canonical fixture: a well-formed hypothesis that survives interrogation → ready_for_sat.
  return runDemaSocraticCriticPreview({
    consent: DEMA_SOCRATIC_CRITIC_PREVIEW_GO_PHRASE,
    input: {
      claim: "The IHSAN floor constant equals 0.95 across the Python and Rust sources.",
      causal_path: [
        { from: "constants.py IHSAN_FLOOR", to: "0.95" },
        { from: "rust canonical source", to: "0.95" },
      ],
      constraints: [
        { id: "cross_lang_sync", satisfied: true },
        { id: "no_overclaim", satisfied: true },
      ],
      evidence_refs: ["core/integration/constants.py", "rust/src/constants.rs"],
      certainty: "high",
      falsifier: "Either source reads a value other than 0.95.",
    },
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runDemaSocraticCriticPreviewCheck();
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("DEMA - DEMA-SOCRATIC-CRITIC-PROCESS-SUPERVISION-PREVIEW-1A");
    console.log(`  schema: ${DEMA_SOCRATIC_CRITIC_PREVIEW_SCHEMA}`);
    console.log(`  truth:  ${DEMA_SOCRATIC_CRITIC_PREVIEW_TRUTH_LABEL}`);
    console.log(`  critic_status: ${result.critic_status ?? "n/a"}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    for (const code of result.blocked_by) console.log(`    ${code}`);
  }
  if (!result.ok) process.exit(1);
}
