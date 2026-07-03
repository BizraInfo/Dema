#!/usr/bin/env node
// ABSENCE-STEWARD-RETURN-REVIEW-1A — review gate. Read-only: in-memory fixture
// derivations plus source/doc scans. Verifies the review reports and refuses —
// and can never claim work occurred.

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { compileAwayContractIntent } from "../../packages/core/src/away-contract-compiler.js";
import {
  ABSENCE_STEWARD_RETURN_REVIEW_SCHEMA,
  ABSENCE_STEWARD_RETURN_REVIEW_TRUTH_LABEL,
  ABSENCE_STEWARD_RETURN_REVIEW_FIRST_LINE,
  NO_RECEIPT_STATEMENT,
  NOT_LIVE_STATEMENT,
  NOTHING_EXECUTED_STATEMENT,
  deriveAbsenceStewardReturnReview,
} from "../../packages/core/src/absence-steward-return-review.js";

const JSON_MODE = process.argv.includes("--json");

const LEFT_ISO = "2026-07-04T03:00:00.000Z";
const RETURNED_ISO = "2026-07-04T09:00:00.000Z";
const FIXTURE_INTENT = Object.freeze({
  operator_id: "gate-fixture-operator",
  node_id: "NODE0",
  mission_scope: "docs-only: return-review gate fixture",
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

function boundaryAllFalse(review) {
  return Object.values(review.boundary).every((flag) => flag === false);
}

export function runAbsenceStewardReturnReviewCheck() {
  const blocked_by = [];

  if (
    ABSENCE_STEWARD_RETURN_REVIEW_SCHEMA !==
    "bizra.dema.absence_steward.return_review.v0.1"
  ) {
    blocked_by.push("gate_schema_constant_unexpected");
  }
  if (
    ABSENCE_STEWARD_RETURN_REVIEW_TRUTH_LABEL !==
    "ABSENCE_STEWARD_RETURN_REVIEW_REPORT_ONLY"
  ) {
    blocked_by.push("gate_truth_label_unexpected");
  }
  if (!ABSENCE_STEWARD_RETURN_REVIEW_FIRST_LINE.startsWith("Nothing is hidden.")) {
    blocked_by.push("gate_first_line_unexpected");
  }
  if (!NO_RECEIPT_STATEMENT.startsWith("NO_RECEIPT")) {
    blocked_by.push("gate_no_receipt_statement_unexpected");
  }
  if (!NOT_LIVE_STATEMENT.startsWith("NOT_LIVE")) {
    blocked_by.push("gate_not_live_statement_unexpected");
  }
  if (!NOTHING_EXECUTED_STATEMENT.startsWith("Nothing executed.")) {
    blocked_by.push("gate_nothing_executed_statement_unexpected");
  }

  const none = deriveAbsenceStewardReturnReview({
    left_at_iso: LEFT_ISO,
    returned_at_iso: RETURNED_ISO,
  });
  if (none.final_verdict !== "NO_ABSENCE_RECORDED" || !boundaryAllFalse(none)) {
    blocked_by.push("gate_no_absence_path_failed");
  }

  const inverted = deriveAbsenceStewardReturnReview({
    left_at_iso: RETURNED_ISO,
    returned_at_iso: LEFT_ISO,
  });
  if (inverted.final_verdict !== "REVIEW_BLOCKED") {
    blocked_by.push("gate_inverted_window_not_blocked");
  }

  const compiled = compileAwayContractIntent(FIXTURE_INTENT, { now_iso: LEFT_ISO });
  if (!compiled.compiled) blocked_by.push("gate_fixture_compile_failed");

  if (compiled.compiled) {
    // Verified pair without a receipt must block, naming the missing receipt.
    const noReceipt = deriveAbsenceStewardReturnReview({
      contract: compiled.contract,
      validation_result: compiled.validation_result,
      left_at_iso: LEFT_ISO,
      returned_at_iso: RETURNED_ISO,
    });
    if (
      noReceipt.final_verdict !== "REVIEW_BLOCKED" ||
      noReceipt.receipts_missing.length === 0 ||
      !boundaryAllFalse(noReceipt)
    ) {
      blocked_by.push("gate_missing_receipt_not_blocked");
    }
    if (noReceipt.executed_summary !== NOTHING_EXECUTED_STATEMENT) {
      blocked_by.push("gate_executed_summary_drifted");
    }

    const laundered = deriveAbsenceStewardReturnReview({
      contract: { ...compiled.contract, mission_scope: "docs-only PLUS push everything" },
      validation_result: compiled.validation_result,
      left_at_iso: LEFT_ISO,
      returned_at_iso: RETURNED_ISO,
    });
    if (laundered.final_verdict !== "REVIEW_BLOCKED" || laundered.refused_events.length === 0) {
      blocked_by.push("gate_launder_probe_not_blocked");
    }
  }

  // Source scans (read-only): the kernel may never derive completion, and the
  // CLI may never dispatch start.
  const kernelSource = readFileSync(
    "packages/core/src/absence-steward-return-review.js",
    "utf8",
  );
  if (kernelSource.includes("WORK_COMPLETE")) {
    blocked_by.push("gate_work_complete_in_vocabulary");
  }
  if (/verdict:\s*["']REVIEW_COMPLETE|verdict:\s*["']RETURN_REVIEW_REQUIRED/.test(kernelSource)) {
    blocked_by.push("gate_complete_verdict_derivable");
  }

  const awayCli = readFileSync("apps/cli/src/commands/away.js", "utf8");
  if (/argv\[1\]\s*===\s*["']start["']/.test(awayCli)) {
    blocked_by.push("gate_away_start_dispatch_exists");
  }
  if (!awayCli.includes('if (argv[1] === "review") return cmd_away_review(argv);')) {
    blocked_by.push("gate_review_dispatch_missing");
  }

  const limits = readFileSync("docs/CURRENT_LIMITS.md", "utf8");
  if (!limits.includes("Absence Steward Return Review")) {
    blocked_by.push("gate_current_limits_missing_return_review");
  }
  if (!/no queue|not a queue|no local queue|NOT a queue/i.test(limits)) {
    blocked_by.push("gate_current_limits_missing_no_queue_language");
  }

  const architecture = readFileSync("docs/ARCHITECTURE.md", "utf8");
  if (!architecture.includes("`dema away review`")) {
    blocked_by.push("gate_architecture_missing_review_row");
  }

  return Object.freeze({
    schema: "bizra.dema.review.absence_steward_return_review_check.v0.1",
    truth_label: "ABSENCE_STEWARD_RETURN_REVIEW_GATE_LOCAL_ONLY",
    ok: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
    boundary: Object.freeze({
      steward_started: false,
      daemon_started: false,
      scheduler_started: false,
      task_executed: false,
      model_invoked: false,
      network_used: false,
      wallet_used: false,
      token_minted: false,
      public_urp_touched: false,
      auto_consent: false,
    }),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runAbsenceStewardReturnReviewCheck();

  if (JSON_MODE) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("DEMA - ABSENCE-STEWARD-RETURN-REVIEW-1A");
    console.log(`  schema: ${result.schema}`);
    console.log(`  truth: ${result.truth_label}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by) console.log(`    ${code}`);
    }
  }

  if (!result.ok) process.exit(1);
}
