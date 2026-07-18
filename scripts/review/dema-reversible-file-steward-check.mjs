#!/usr/bin/env node
// DEMA-REVERSIBLE-FILE-STEWARD-1A — review gate. Runs the slice proof loop and emits the verdict.

import { pathToFileURL } from "node:url";

import {
  runDemaReversibleFileSteward,
  DEMA_REVERSIBLE_FILE_STEWARD_SCHEMA,
  DEMA_REVERSIBLE_FILE_STEWARD_TRUTH_LABEL,
  DEMA_REVERSIBLE_FILE_STEWARD_GO_PHRASE,
} from "../../packages/core/src/dema-reversible-file-steward.js";

const JSON_MODE = process.argv.includes("--json");

export function runDemaReversibleFileStewardCheck() {
  // Canonical fixture: a bounded, clean, fully-reversible two-atom steward job.
  return runDemaReversibleFileSteward({
    consent: DEMA_REVERSIBLE_FILE_STEWARD_GO_PHRASE,
    input: {
      sandbox_root: "sandbox/steward-demo",
      max_atoms: 8,
      atoms: [
        { from: "note.txt", to: "note.SEALED.txt", content_sample: "clean local note - genesis seed" },
        { from: "draft.md", to: "draft.final.md" },
      ],
    },
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runDemaReversibleFileStewardCheck();

  if (JSON_MODE) {
    // Strip heavy/non-summary fields here if the envelope carries them.
    const { ...json } = result;
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log("DEMA - DEMA-REVERSIBLE-FILE-STEWARD-1A");
    console.log(`  schema: ${DEMA_REVERSIBLE_FILE_STEWARD_SCHEMA}`);
    console.log(`  truth: ${DEMA_REVERSIBLE_FILE_STEWARD_TRUTH_LABEL}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by || []) console.log(`    ${code}`);
    }
  }

  if (!result.ok) process.exit(1);
}
