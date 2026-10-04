#!/usr/bin/env node
// NODE0-MINIMUM-SEASON-SAVE-RESUME-1A — review gate. Runs the slice proof loop and emits the verdict.

import { pathToFileURL } from "node:url";

import {
  runNode0MinimumSeasonSaveResume,
  NODE0_MINIMUM_SEASON_SAVE_RESUME_SCHEMA,
  NODE0_MINIMUM_SEASON_SAVE_RESUME_TRUTH_LABEL,
  NODE0_MINIMUM_SEASON_SAVE_RESUME_GO_PHRASE,
} from "../../packages/core/src/node0-minimum-season-save-resume.js";

const JSON_MODE = process.argv.includes("--json");

// Canonical fixture. Deliberately a fully-formed, contract-legal season state:
// the gate proves the whole plan -> build -> verify -> tamper-reject loop, so a
// fixture that only half-validates would let a broken verifier pass. The clock
// is pinned because the gate must be byte-deterministic across runs — the
// semantic hash excludes `saved_at`, but pinning it keeps the fixture honest
// about what a real caller supplies.
export const GATE_FIXTURE = Object.freeze({
  season_id: "gate-fixture",
  mission_id: "NODE0-MINIMUM-SEASON-SAVE-RESUME-1A",
  mission_contract_hash: null,
  mission_phase: "REVIEW_GATE",
  completed_steps: ["kernel implemented", "store implemented"],
  next_safe_action: "QUALIFY_MINIMUM_SEASON_SAVE_RESUME",
  must_not_repeat: ["reopen C4D", "begin Node1"],
  pending_consent: [],
  last_receipt_hash: null,
  repository_commit: "0".repeat(40),
  repository_tree: "0".repeat(40),
  saved_at: "2026-01-01T00:00:00Z",
});

export function runNode0MinimumSeasonSaveResumeCheck() {
  return runNode0MinimumSeasonSaveResume({
    consent: NODE0_MINIMUM_SEASON_SAVE_RESUME_GO_PHRASE,
    input: GATE_FIXTURE,
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runNode0MinimumSeasonSaveResumeCheck();

  if (JSON_MODE) {
    // Strip heavy/non-summary fields here if the envelope carries them.
    const { ...json } = result;
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log("DEMA - NODE0-MINIMUM-SEASON-SAVE-RESUME-1A");
    console.log(`  schema: ${NODE0_MINIMUM_SEASON_SAVE_RESUME_SCHEMA}`);
    console.log(`  truth: ${NODE0_MINIMUM_SEASON_SAVE_RESUME_TRUTH_LABEL}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by || []) console.log(`    ${code}`);
    }
  }

  if (!result.ok) process.exit(1);
}
