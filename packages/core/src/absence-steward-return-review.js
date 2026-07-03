// ABSENCE-STEWARD-RETURN-REVIEW-CHECK-1A — deterministic post-absence review
// derivation (docs/02-architecture/ABSENCE_STEWARD_RETURN_REVIEW_v0_1.md).
//
// The steward's first duty on the human's return is not to show what it did —
// it is to prove what it did not do. This kernel derives the review report
// from the Away Contract trio plus a DECLARED absence window (left_at_iso /
// returned_at_iso — never the wall clock). Readiness is re-derived at both
// window edges through the readiness kernel (two-clock doctrine inherited).
//
// v0.1 can only emit: NO_ABSENCE_RECORDED · REVIEW_BLOCKED ·
// READY_BUT_NOT_STARTED · EXPIRED_BEFORE_START. The COMPLETE verdicts and
// RETURN_REVIEW_REQUIRED belong to future runtime slices and are unreachable
// here — WORK_COMPLETE is not even in the vocabulary. Every claim cites a
// receipt or says NO_RECEIPT; no runtime exists, and the report says so.
//
// Pure kernel: no fs / network / process / clock / random.

import { deriveAbsenceStewardReadiness } from "./absence-steward-readiness.js";

export const ABSENCE_STEWARD_RETURN_REVIEW_SCHEMA =
  "bizra.dema.absence_steward.return_review.v0.1";
export const ABSENCE_STEWARD_RETURN_REVIEW_TRUTH_LABEL =
  "ABSENCE_STEWARD_RETURN_REVIEW_REPORT_ONLY";

export const ABSENCE_STEWARD_RETURN_REVIEW_FIRST_LINE =
  "Nothing is hidden. Every claim below is either receipt-backed or marked NO_RECEIPT.";
export const NO_RECEIPT_STATEMENT = "NO_RECEIPT — cannot claim.";
export const NOT_LIVE_STATEMENT = "NOT_LIVE — no steward runtime exists.";
export const NOTHING_EXECUTED_STATEMENT =
  "Nothing executed. I can only report readiness and receipts.";

// v0.1-reachable verdicts only. COMPLETE/REQUIRED verdicts are defined in the
// spec but belong to future runtime slices; they must not be derivable here.
export const ABSENCE_STEWARD_RETURN_REVIEW_V01_VERDICTS = Object.freeze([
  "NO_ABSENCE_RECORDED",
  "REVIEW_BLOCKED",
  "READY_BUT_NOT_STARTED",
  "EXPIRED_BEFORE_START",
]);

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// Spec §5 boundary object — all ten keys, all false, on every path.
function returnReviewBoundary() {
  return Object.freeze({
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
  });
}

export function deriveAbsenceStewardReturnReview(input = {}) {
  const refused_events = [];
  const { contract, validation_result, receipt } = input;

  const leftMs = isNonEmptyString(input.left_at_iso)
    ? Date.parse(input.left_at_iso)
    : NaN;
  const returnedMs = isNonEmptyString(input.returned_at_iso)
    ? Date.parse(input.returned_at_iso)
    : NaN;
  if (Number.isNaN(leftMs)) refused_events.push("left_at_iso_required");
  if (Number.isNaN(returnedMs)) refused_events.push("returned_at_iso_required");
  if (!Number.isNaN(leftMs) && !Number.isNaN(returnedMs) && returnedMs <= leftMs) {
    refused_events.push("absence_window_invalid");
  }
  if (refused_events.length > 0) {
    return buildReview({ input, verdict: "REVIEW_BLOCKED", refused_events });
  }

  if (!isPlainObject(contract) && !isPlainObject(receipt)) {
    return buildReview({ input, verdict: "NO_ABSENCE_RECORDED", refused_events });
  }

  const before = deriveAbsenceStewardReadiness({
    contract,
    validation_result,
    receipt,
    now_iso: input.left_at_iso,
  });
  const after = deriveAbsenceStewardReadiness({
    contract,
    validation_result,
    receipt,
    now_iso: input.returned_at_iso,
  });

  if (before.state === "REFUSED" || after.state === "REFUSED") {
    for (const code of new Set([...before.blocked_by, ...after.blocked_by])) {
      refused_events.push(code);
    }
    return buildReview({ input, verdict: "REVIEW_BLOCKED", refused_events, before, after });
  }

  // review_required_on_return demands a receipt to review against; a bare
  // verified pair cannot anchor an honest absence review.
  if (!isPlainObject(receipt)) {
    return buildReview({
      input,
      verdict: "REVIEW_BLOCKED",
      refused_events,
      before,
      after,
      receipts_missing: [
        `away-contract receipt for ${contract?.contract_id ?? "unknown contract"}`,
      ],
    });
  }

  if (after.state === "EXPIRED") {
    return buildReview({ input, verdict: "EXPIRED_BEFORE_START", refused_events, before, after });
  }

  return buildReview({ input, verdict: "READY_BUT_NOT_STARTED", refused_events, before, after });
}

function buildReview({
  input,
  verdict,
  refused_events,
  before = null,
  after = null,
  receipts_missing = [],
}) {
  const contract = isPlainObject(input.contract) ? input.contract : null;
  const receipt = isPlainObject(input.receipt) ? input.receipt : null;
  const expired = verdict === "EXPIRED_BEFORE_START" && contract?.contract_id;

  return Object.freeze({
    schema: ABSENCE_STEWARD_RETURN_REVIEW_SCHEMA,
    truth_label: ABSENCE_STEWARD_RETURN_REVIEW_TRUTH_LABEL,
    first_line: ABSENCE_STEWARD_RETURN_REVIEW_FIRST_LINE,
    operator_id: contract?.operator_id ?? null,
    node_id: contract?.node_id ?? null,
    contract_id: contract?.contract_id ?? null,
    contract_hash: after?.contract_hash ?? before?.contract_hash ?? null,
    absence_window: Object.freeze({
      left_at_iso: input.left_at_iso ?? null,
      returned_at_iso: input.returned_at_iso ?? null,
    }),
    readiness_state_before_absence: before?.state ?? null,
    readiness_state_after_absence: after?.state ?? null,
    allowed_actions_declared: Object.freeze([...(contract?.allowed_actions ?? [])]),
    forbidden_actions_declared: Object.freeze([...(contract?.forbidden_actions ?? [])]),
    refused_events: Object.freeze([...refused_events]),
    expired_items: Object.freeze(expired ? [contract.contract_id] : []),
    pending_human_decisions: Object.freeze([]),
    receipts_seen: Object.freeze(
      isNonEmptyString(receipt?.receipt_hash) ? [receipt.receipt_hash] : [],
    ),
    receipts_missing: Object.freeze([...receipts_missing]),
    anomalies: Object.freeze([]),
    // Spec §7: no runtime exists, so no event claim is possible — each event
    // field carries the refusal statement, never an empty "all clear".
    model_invocations: NO_RECEIPT_STATEMENT,
    network_events: NO_RECEIPT_STATEMENT,
    wallet_events: NO_RECEIPT_STATEMENT,
    token_events: NO_RECEIPT_STATEMENT,
    executed_summary: NOTHING_EXECUTED_STATEMENT,
    runtime_statement: NOT_LIVE_STATEMENT,
    boundary: returnReviewBoundary(),
    final_verdict: verdict,
  });
}
