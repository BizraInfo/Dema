#!/usr/bin/env node
// DEMA-SKILLOPT-EDIT-LEDGER-PREVIEW-1A — review gate. Runs the slice proof loop and emits the verdict.

import { pathToFileURL } from "node:url";

import {
  runDemaSkilloptEditLedgerPreview,
  DEMA_SKILLOPT_EDIT_LEDGER_PREVIEW_SCHEMA,
  DEMA_SKILLOPT_EDIT_LEDGER_PREVIEW_TRUTH_LABEL,
  DEMA_SKILLOPT_EDIT_LEDGER_PREVIEW_GO_PHRASE,
} from "../../packages/core/src/dema-skillopt-edit-ledger-preview.js";

const JSON_MODE = process.argv.includes("--json");

// Canonical accepted-edit attempt: a bounded `replace` edit accepted with cited
// held-out validation refs, zero authority delta, every boundary/consent/honesty
// surface unchanged. This is the shape the ledger proves it can record + re-derive.
const CANONICAL_FIXTURE = {
  skill_id: "skill.dema.example-router",
  skill_version: "v0.3",
  base_skill_hash: `sha256:${"a".repeat(64)}`,
  candidate_skill_hash: `sha256:${"b".repeat(64)}`,
  edit_type: "replace",
  edit_budget: 200,
  training_rollout_refs: ["receipt:rollout-1", "receipt:rollout-2"],
  heldout_validation_refs: ["receipt:heldout-1"],
  score_before: 0.61,
  score_after: 0.72,
  accepted: true,
  rejected_edit_reason: null,
  authority_delta: 0,
  boundary_unchanged: true,
  consent_unchanged: true,
  current_limits_unchanged: true,
};

export function runDemaSkilloptEditLedgerPreviewCheck() {
  return runDemaSkilloptEditLedgerPreview({
    consent: DEMA_SKILLOPT_EDIT_LEDGER_PREVIEW_GO_PHRASE,
    input: CANONICAL_FIXTURE,
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runDemaSkilloptEditLedgerPreviewCheck();

  if (JSON_MODE) {
    // Strip heavy/non-summary fields here if the envelope carries them.
    const { ...json } = result;
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log("DEMA - DEMA-SKILLOPT-EDIT-LEDGER-PREVIEW-1A");
    console.log(`  schema: ${DEMA_SKILLOPT_EDIT_LEDGER_PREVIEW_SCHEMA}`);
    console.log(`  truth: ${DEMA_SKILLOPT_EDIT_LEDGER_PREVIEW_TRUTH_LABEL}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by || []) console.log(`    ${code}`);
    }
  }

  if (!result.ok) process.exit(1);
}
