#!/usr/bin/env node
// ABSENCE-STEWARD-READINESS-1A — review gate. Read-only: derives readiness
// states from in-memory fixtures (no receipt write, no DEMA_HOME touch) and
// source/doc scans. Verifies readiness stays a report — never a grant.

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { compileAwayContractIntent } from "../../packages/core/src/away-contract-compiler.js";
import {
  ABSENCE_STEWARD_READINESS_SCHEMA,
  ABSENCE_STEWARD_READINESS_TRUTH_LABEL,
  deriveAbsenceStewardReadiness,
} from "../../packages/core/src/absence-steward-readiness.js";

const JSON_MODE = process.argv.includes("--json");

const NOW_ISO = "2026-07-04T03:00:00.000Z";
const FIXTURE_INTENT = Object.freeze({
  operator_id: "gate-fixture-operator",
  node_id: "NODE0",
  mission_scope: "docs-only: absence-steward readiness gate fixture",
  allowed_actions: ["READ_ONLY", "DOCS_ONLY"],
  forbidden_actions: ["PUSH_ALLOWED", "MODEL_ALLOWED", "NETWORK_ALLOWED"],
  data_scope: "repo:docs/**",
  model_policy: "forbidden",
  tool_policy: "npm test only",
  commit_policy: "none",
  push_policy: "forbidden",
  network_policy: "forbidden",
  mobile_escalation_policy: "LEVEL_1_SUMMARY_ONLY",
  risk_ceiling: 1,
  expires_at: "2026-07-04T12:00:00.000Z",
  stop_conditions: ["test failure"],
  receipt_required: true,
  review_required_on_return: true,
});

function stewardStartedFalse(report) {
  return (
    report.boundary.steward_started === false &&
    Object.values(report.boundary).every((flag) => flag === false)
  );
}

export function runAbsenceStewardReadinessCheck() {
  const blocked_by = [];

  if (ABSENCE_STEWARD_READINESS_SCHEMA !== "bizra.dema.absence_steward.readiness_preview.v0.1") {
    blocked_by.push("gate_schema_constant_unexpected");
  }
  if (ABSENCE_STEWARD_READINESS_TRUTH_LABEL !== "ABSENCE_STEWARD_READINESS_PREVIEW_ONLY") {
    blocked_by.push("gate_truth_label_unexpected");
  }

  const none = deriveAbsenceStewardReadiness({ now_iso: NOW_ISO });
  if (none.state !== "NOT_CONFIGURED" || !stewardStartedFalse(none)) {
    blocked_by.push("gate_not_configured_path_failed");
  }

  const compiled = compileAwayContractIntent(FIXTURE_INTENT, { now_iso: NOW_ISO });
  if (!compiled.compiled) blocked_by.push("gate_fixture_compile_failed");

  const verified = compiled.compiled
    ? deriveAbsenceStewardReadiness({
        contract: compiled.contract,
        validation_result: compiled.validation_result,
        now_iso: NOW_ISO,
      })
    : null;
  if (verified?.state !== "CONTRACT_VERIFIED" || !stewardStartedFalse(verified)) {
    blocked_by.push("gate_contract_verified_path_failed");
  }
  if (verified?.ready !== false) {
    blocked_by.push("gate_unreceipted_pair_must_not_be_ready");
  }

  if (compiled.compiled) {
    const laundered = deriveAbsenceStewardReadiness({
      contract: { ...compiled.contract, mission_scope: "docs-only PLUS push everything" },
      validation_result: compiled.validation_result,
      now_iso: NOW_ISO,
    });
    if (laundered.state !== "REFUSED" || laundered.blocked_by.length === 0) {
      blocked_by.push("gate_launder_probe_not_refused");
    }
  }

  // Source/doc scans (read-only).
  const awayCli = readFileSync("apps/cli/src/commands/away.js", "utf8");
  if (/argv\[1\]\s*===\s*["']start["']/.test(awayCli)) {
    blocked_by.push("gate_away_start_dispatch_exists");
  }
  if (!awayCli.includes('if (argv[1] === "preview") return cmd_away_preview(argv);')) {
    blocked_by.push("gate_preview_dispatch_missing");
  }

  const limits = readFileSync("docs/CURRENT_LIMITS.md", "utf8");
  if (!limits.includes("Absence Steward")) {
    blocked_by.push("gate_current_limits_missing_absence_rows");
  }
  if (!/no `dema away start`|no dema away start|not `dema away start`/i.test(limits)) {
    blocked_by.push("gate_current_limits_missing_no_start_language");
  }

  const architecture = readFileSync("docs/ARCHITECTURE.md", "utf8");
  if (!architecture.includes("`dema away preview`")) {
    blocked_by.push("gate_architecture_missing_preview_row");
  }

  return Object.freeze({
    schema: "bizra.dema.review.absence_steward_readiness_check.v0.1",
    truth_label: "ABSENCE_STEWARD_READINESS_GATE_LOCAL_ONLY",
    ok: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
    boundary: Object.freeze({
      steward_started: false,
      execution_attempted: false,
      contract_started: false,
      receipt_written: false,
      model_invocation: false,
      network: false,
      token_mint: false,
      activation: false,
      daemon_started: false,
    }),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runAbsenceStewardReadinessCheck();

  if (JSON_MODE) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("DEMA - ABSENCE-STEWARD-READINESS-1A");
    console.log(`  schema: ${result.schema}`);
    console.log(`  truth: ${result.truth_label}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by) console.log(`    ${code}`);
    }
  }

  if (!result.ok) process.exit(1);
}
