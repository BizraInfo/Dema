#!/usr/bin/env node
// ABSENCE-STEWARD-QUEUE-1A — review gate. Read-only: in-memory fixture
// derivations (proposal validation) plus source/doc scans. Enforces at gate
// level the invariants the audit found were test-only: forbidden statuses,
// never-executable action classes, consent-is-never-membership, the receipt's
// not-approval/not-execution disclaimer, and the honesty map staying truthful.

import { readFileSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

import {
  validateAbsenceStewardQueueItem,
  absenceStewardQueueBoundary,
  ABSENCE_STEWARD_QUEUE_ITEM_SCHEMA,
  ABSENCE_STEWARD_QUEUE_SCHEMA_TRUTH_LABEL,
  ABSENCE_STEWARD_QUEUE_ALLOWED_STATUSES,
  ABSENCE_STEWARD_QUEUE_FORBIDDEN_ACTION_CLASSES,
} from "../../packages/core/src/absence-steward-queue-schema.js";

const JSON_MODE = process.argv.includes("--json");
const NOW_ISO = "2026-07-04T05:00:00.000Z";

const QUEUE_MODULES = Object.freeze([
  "packages/core/src/absence-steward-queue-schema.js",
  "packages/core/src/absence-steward-queue-verify.js",
  "packages/core/src/absence-steward-queue-receipt.js",
]);

const FORBIDDEN_STATUSES = Object.freeze([
  "EXECUTING",
  "DONE",
  "RUNNING",
  "STARTED",
  "COMPLETED",
  "AUTO_APPROVED",
]);

const FORBIDDEN_ACTION_CLASSES = Object.freeze([
  "AUTO_DEQUEUE",
  "SELF_APPROVAL",
  "EXECUTION_FROM_QUEUE",
  "CONSENT_BY_MEMBERSHIP",
  "MODEL_INVOCATION",
  "NETWORK_CALL",
  "WALLET_OPERATION",
  "TOKEN_MINT",
  "PUBLIC_URP_MUTATION",
]);

const CONSENT_ISH_FIELDS = Object.freeze([
  "consent_granted",
  "consent_by_membership",
  "approved_by_queue",
  "auto_consent",
]);

function stable(v) {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object")
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(",")}}`;
  return JSON.stringify(v);
}

function withHash(body) {
  const { queue_item_hash, ...rest } = body;
  const normalized = {
    ...rest,
    allowed_by_contract: [...new Set(rest.allowed_by_contract)].sort(),
    forbidden_by_contract: [...new Set(rest.forbidden_by_contract)].sort(),
  };
  return {
    ...body,
    queue_item_hash: "sha256:" + createHash("sha256").update(stable(normalized)).digest("hex"),
  };
}

function fixtureItem(overrides = {}) {
  return withHash({
    schema: ABSENCE_STEWARD_QUEUE_ITEM_SCHEMA,
    queue_item_id: "qitem-gate-fixture",
    truth_label: ABSENCE_STEWARD_QUEUE_SCHEMA_TRUTH_LABEL,
    operator_id: "gate",
    node_id: "NODE0",
    contract_id: "away-gate",
    contract_hash: "sha256:" + "a".repeat(64),
    readiness_report_hash: "sha256:" + "b".repeat(64),
    return_review_requirement: true,
    proposed_action_class: "DOCS_ONLY",
    proposed_action_summary: "gate fixture",
    proposed_inputs_summary: "docs",
    required_human_decision: true,
    allowed_by_contract: ["READ_ONLY", "DOCS_ONLY"],
    forbidden_by_contract: ["PUSH_ALLOWED"],
    status: "PROPOSED",
    created_at: "2026-07-04T04:00:00.000Z",
    expires_at: "2026-07-04T12:00:00.000Z",
    boundary: absenceStewardQueueBoundary(),
    ...overrides,
  });
}

function rejects(item) {
  return validateAbsenceStewardQueueItem(item, { now_iso: NOW_ISO }).valid === false;
}

export function runAbsenceStewardQueueCheck() {
  const blocked_by = [];

  // Modules present.
  for (const m of QUEUE_MODULES) {
    if (!existsSync(m)) blocked_by.push(`missing_module:${m}`);
  }

  // Canonical fixture validates (baseline sanity).
  if (validateAbsenceStewardQueueItem(fixtureItem(), { now_iso: NOW_ISO }).valid !== true) {
    blocked_by.push("gate_fixture_does_not_validate");
  }

  // Forbidden statuses are excluded from the allowed set AND rejected live.
  for (const s of FORBIDDEN_STATUSES) {
    if (ABSENCE_STEWARD_QUEUE_ALLOWED_STATUSES.includes(s)) {
      blocked_by.push(`forbidden_status_in_allowed_set:${s}`);
    }
    if (!rejects(fixtureItem({ status: s }))) {
      blocked_by.push(`forbidden_status_not_rejected:${s}`);
    }
  }

  // Never-executable action classes are declared AND rejected live.
  for (const c of FORBIDDEN_ACTION_CLASSES) {
    if (!ABSENCE_STEWARD_QUEUE_FORBIDDEN_ACTION_CLASSES.includes(c)) {
      blocked_by.push(`forbidden_class_not_declared:${c}`);
    }
    if (!rejects(fixtureItem({ proposed_action_class: c }))) {
      blocked_by.push(`forbidden_class_not_rejected:${c}`);
    }
  }

  // Consent-ish fields reject (membership is never consent).
  for (const f of CONSENT_ISH_FIELDS) {
    if (!rejects(fixtureItem({ [f]: true }))) {
      blocked_by.push(`consent_field_not_rejected:${f}`);
    }
  }

  // Vacuous-boundary regression: empty / junk boundary must reject.
  if (!rejects(fixtureItem({ boundary: {} }))) blocked_by.push("empty_boundary_not_rejected");
  if (!rejects(fixtureItem({ boundary: { junk_key: false } }))) {
    blocked_by.push("junk_boundary_not_rejected");
  }

  // Receipt writer: not-approval / not-execution disclaimer + approved/executed false keys.
  const receiptSrc = readFileSync("packages/core/src/absence-steward-queue-receipt.js", "utf8");
  if (!/not approval/i.test(receiptSrc)) blocked_by.push("receipt_missing_not_approval");
  if (!/not execution/i.test(receiptSrc)) blocked_by.push("receipt_missing_not_execution");
  if (!/not queue runtime/i.test(receiptSrc)) blocked_by.push("receipt_missing_not_queue_runtime");
  if (!/approved: false/.test(receiptSrc)) blocked_by.push("receipt_boundary_missing_approved_false");
  if (!/executed: false/.test(receiptSrc)) blocked_by.push("receipt_boundary_missing_executed_false");

  // away CLI: queue draft dispatched, start NOT dispatched.
  const awaySrc = readFileSync("apps/cli/src/commands/away.js", "utf8");
  if (!awaySrc.includes('if (argv[1] === "queue") return cmd_away_queue(argv);')) {
    blocked_by.push("queue_dispatch_missing");
  }
  if (/argv\[1\]\s*===\s*["']start["']/.test(awaySrc)) {
    blocked_by.push("away_start_dispatch_exists");
  }

  // Honesty map: the queue row must NOT deny implementation, and must keep the
  // no-runtime / no-approval / no-execution disclaimers.
  const limits = readFileSync("docs/CURRENT_LIMITS.md", "utf8");
  const queueRow =
    limits.split("\n").find((l) => l.includes("Absence Steward Local Queue")) ?? "";
  if (queueRow === "") blocked_by.push("current_limits_missing_queue_row");
  if (/No implementation/i.test(queueRow)) {
    blocked_by.push("current_limits_still_denies_implementation");
  }
  for (const phrase of ["no runner", "no approval", "no execution", "no runtime"]) {
    if (!queueRow.toLowerCase().includes(phrase)) {
      blocked_by.push(`current_limits_missing_phrase:${phrase}`);
    }
  }

  // TESTING.md carries the queue test rows.
  const testing = readFileSync("docs/TESTING.md", "utf8");
  for (const t of [
    "tests/absence-steward-queue-schema.test.js",
    "tests/absence-steward-queue-verify.test.js",
    "tests/absence-steward-queue-receipt.test.js",
    "tests/away-queue-cli-draft.test.js",
  ]) {
    if (!testing.includes(`\`${t}\``)) blocked_by.push(`testing_missing_row:${t}`);
  }

  return Object.freeze({
    schema: "bizra.dema.review.absence_steward_queue_check.v0.1",
    truth_label: "ABSENCE_STEWARD_QUEUE_GATE_LOCAL_ONLY",
    ok: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
    boundary: Object.freeze({
      queue_started: false,
      queue_runner_started: false,
      scheduler_started: false,
      daemon_started: false,
      task_executed: false,
      model_invoked: false,
      network_used: false,
      wallet_used: false,
      token_minted: false,
      public_urp_touched: false,
      auto_consent: false,
      self_approved: false,
    }),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runAbsenceStewardQueueCheck();

  if (JSON_MODE) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("DEMA - ABSENCE-STEWARD-QUEUE-1A");
    console.log(`  schema: ${result.schema}`);
    console.log(`  truth: ${result.truth_label}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by) console.log(`    ${code}`);
    }
  }

  if (!result.ok) process.exit(1);
}
