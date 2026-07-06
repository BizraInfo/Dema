#!/usr/bin/env node
// CAPABILITY-BLAST-RADIUS-1A — review gate. Runs the slice proof loop and emits the verdict.

import { pathToFileURL } from "node:url";

import {
  runCapabilityBlastRadius,
  CAPABILITY_BLAST_RADIUS_SCHEMA,
  CAPABILITY_BLAST_RADIUS_TRUTH_LABEL,
  CAPABILITY_BLAST_RADIUS_GO_PHRASE,
} from "../../packages/core/src/capability-blast-radius.js";

const JSON_MODE = process.argv.includes("--json");

// Canonical deterministic fixture spanning the decision matrix: read-only,
// reversible remote mutation, irreversible delete, identity binding. No fs,
// no network — the gate proves the classification CONTRACT, not any live act.
const FLAGS_NONE = Object.freeze({
  mutates_local_files: false,
  mutates_remote_state: false,
  deletes_data: false,
  publishes_external: false,
  binds_identity: false,
  writes_receipt: false,
  network_used: false,
});

const GATE_FIXTURE_INPUT = {
  actions: [
    { action: "dema receipts (read/list)", flags: { ...FLAGS_NONE }, recovery: "not_applicable" },
    { action: "gh pr merge --merge", flags: { ...FLAGS_NONE, mutates_remote_state: true }, recovery: "git_revert" },
    { action: "rm untracked file", flags: { ...FLAGS_NONE, mutates_local_files: true, deletes_data: true }, recovery: "none" },
    { action: "generate signing key", flags: { ...FLAGS_NONE, binds_identity: true }, recovery: "none" },
  ],
};

export function runCapabilityBlastRadiusCheck() {
  return runCapabilityBlastRadius({ consent: CAPABILITY_BLAST_RADIUS_GO_PHRASE, input: GATE_FIXTURE_INPUT });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runCapabilityBlastRadiusCheck();

  if (JSON_MODE) {
    // Strip heavy/non-summary fields here if the envelope carries them.
    const { ...json } = result;
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log("DEMA - CAPABILITY-BLAST-RADIUS-1A");
    console.log(`  schema: ${CAPABILITY_BLAST_RADIUS_SCHEMA}`);
    console.log(`  truth: ${CAPABILITY_BLAST_RADIUS_TRUTH_LABEL}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by || []) console.log(`    ${code}`);
    }
  }

  if (!result.ok) process.exit(1);
}
