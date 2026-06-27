#!/usr/bin/env node
// PAT-SAT-BLACKBOARD-DRY-RUN-1A — hermetic fail-closed review gate.

import { pathToFileURL } from "node:url";
import {
  buildPatSatBlackboardDryRun,
  verifyPatSatBlackboardDryRun,
  PAT_SAT_BLACKBOARD_DRY_RUN_SCHEMA,
  PAT_SAT_BLACKBOARD_DRY_RUN_TRUTH_LABEL,
} from "../../packages/core/src/pat-sat-blackboard-dry-run.js";

const JSON_MODE = process.argv.includes("--json");

export const HERMETIC_BLACKBOARD_SEED = Object.freeze({
  pain: "slow local triage",
  goal: "ship a preview slice",
});

export function runPatSatBlackboardDryRunCheck() {
  const blocked = [];

  const report = buildPatSatBlackboardDryRun(HERMETIC_BLACKBOARD_SEED);
  const verified = verifyPatSatBlackboardDryRun(report);
  const frozenVerified = Object.freeze({
    ...verified,
    blocked_by: Object.freeze([...verified.blocked_by]),
  });

  if (!frozenVerified.ok) blocked.push(...frozenVerified.blocked_by);
  if (report.final_state !== "QUIESCENT_CONSENT_READY") {
    blocked.push("hermetic_final_state_not_quiescent");
  }
  // 8 mirrors the fixed PAT/SAT source list in pat-sat-blackboard-dry-run.js.
  if (report.board.length !== 8) {
    blocked.push("hermetic_board_length_not_8");
  }

  const incomplete = buildPatSatBlackboardDryRun({ pain: "", goal: "x" });
  if (incomplete.final_state !== "BLOCKED_INTERVIEW_INCOMPLETE") {
    blocked.push("incomplete_seed_not_blocked");
  }

  const tampered = structuredClone(report);
  tampered.final_state = "FAKE_LIVE_EXECUTED";
  const tamperedVerified = verifyPatSatBlackboardDryRun(tampered);
  if (tamperedVerified.ok) {
    blocked.push("tampered_envelope_not_rejected");
  }

  return Object.freeze({
    ok: blocked.length === 0,
    schema: PAT_SAT_BLACKBOARD_DRY_RUN_SCHEMA,
    truth_label: PAT_SAT_BLACKBOARD_DRY_RUN_TRUTH_LABEL,
    final_state: report.final_state,
    board_length: report.board.length,
    verified: frozenVerified,
    blocked_by: Object.freeze(blocked),
  });
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const result = runPatSatBlackboardDryRunCheck();

  if (JSON_MODE) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("DEMA · PAT/SAT blackboard dry-run check (hermetic)");
    console.log(`  schema: ${PAT_SAT_BLACKBOARD_DRY_RUN_SCHEMA}`);
    console.log(`  truth: ${PAT_SAT_BLACKBOARD_DRY_RUN_TRUTH_LABEL}`);
    console.log(`  final_state: ${result.final_state}`);
    console.log(`  board_length: ${result.board_length}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    for (const code of result.blocked_by) {
      console.log(`    ${code}`);
    }
  }

  if (!result.ok) process.exit(1);
}
