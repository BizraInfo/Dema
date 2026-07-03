// ABSENCE-STEWARD-QUEUE-SCHEMA-1A — fail-closed shape validator for Absence
// Steward queue items (docs/02-architecture/ABSENCE_STEWARD_LOCAL_QUEUE_v0_1.md).
//
// Queue item means: proposed. Queue membership means: not consent. Approval
// means: a future human decision. Execution means: not in this track yet.
//
// The validator validates proposal SHAPE only. It stores no queue, approves
// nothing, executes nothing, schedules nothing. Execution-flavored statuses
// (EXECUTING, DONE, RUNNING, STARTED, COMPLETED, AUTO_APPROVED) are rejected;
// never-executable action classes are rejected even when merely proposed; any
// consent-ish field on an item is rejected — being queued can never be, or
// become, consent.
//
// Pure kernel: no fs / network / process / clock / random. Act-time is
// injected via options.now_iso; expiry honesty is enforced both ways (an
// expired item must say so; an unexpired item may not claim expiry).

import { createHash } from "node:crypto";

export const ABSENCE_STEWARD_QUEUE_ITEM_SCHEMA =
  "bizra.dema.absence_steward.queue_item.v0.1";
export const ABSENCE_STEWARD_QUEUE_VALIDATION_RESULT_SCHEMA =
  "bizra.dema.absence_steward.queue_item.validation_result.v0.1";
export const ABSENCE_STEWARD_QUEUE_SCHEMA_TRUTH_LABEL =
  "ABSENCE_STEWARD_QUEUE_SCHEMA_DESIGNED_NOT_LIVE";

export const ABSENCE_STEWARD_QUEUE_ALLOWED_STATUSES = Object.freeze([
  "PROPOSED",
  "HUMAN_APPROVED",
  "HUMAN_REJECTED",
  "WITHDRAWN",
  "EXPIRED_WITH_CONTRACT",
]);

// Execution-flavored statuses that may never validate — the design withholds
// them exactly as return review withheld its completion verdict.
const FORBIDDEN_STATUSES = Object.freeze([
  "EXECUTING",
  "DONE",
  "RUNNING",
  "STARTED",
  "COMPLETED",
  "AUTO_APPROVED",
]);

export const ABSENCE_STEWARD_QUEUE_FORBIDDEN_ACTION_CLASSES = Object.freeze([
  "EXECUTE_TASK",
  "START_RUNTIME",
  "START_DAEMON",
  "START_SCHEDULER",
  "RUN_QUEUE",
  "AUTO_DEQUEUE",
  "SELF_APPROVAL",
  "EXECUTION_FROM_QUEUE",
  "CONSENT_BY_MEMBERSHIP",
  "NETWORK_CALL",
  "WALLET_OPERATION",
  "TOKEN_MINT",
  "PUBLIC_URP_MUTATION",
  "MODEL_INVOCATION",
]);

// Top-level fields that would smuggle consent into membership.
const FORBIDDEN_CONSENT_FIELDS = Object.freeze([
  "consent_granted",
  "consent_by_membership",
  "approved_by_queue",
  "auto_consent",
]);

const REQUIRED_FIELDS = Object.freeze([
  "schema",
  "queue_item_id",
  "queue_item_hash",
  "truth_label",
  "operator_id",
  "node_id",
  "contract_id",
  "contract_hash",
  "readiness_report_hash",
  "return_review_requirement",
  "proposed_action_class",
  "proposed_action_summary",
  "proposed_inputs_summary",
  "required_human_decision",
  "allowed_by_contract",
  "forbidden_by_contract",
  "status",
  "created_at",
  "expires_at",
  "boundary",
]);

const SAFE_QUEUE_ITEM_ID = /^[a-z0-9][a-z0-9_-]{0,127}$/;

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function absenceStewardQueueBoundary() {
  return Object.freeze({
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
  });
}

export function validateAbsenceStewardQueueItem(item, options = {}) {
  const blocked_by = [];
  const warnings = [];

  const nowMs = isNonEmptyString(options?.now_iso) ? Date.parse(options.now_iso) : NaN;
  if (Number.isNaN(nowMs)) blocked_by.push("now_iso_required");

  if (!isPlainObject(item)) {
    blocked_by.push("item_not_object");
    return buildResult({ blocked_by, warnings });
  }

  for (const field of REQUIRED_FIELDS) {
    if (!(field in item) || item[field] === undefined) {
      blocked_by.push(`${field}_required`);
    }
  }
  if (blocked_by.some((code) => code.endsWith("_required") && code !== "now_iso_required")) {
    return buildResult({ blocked_by, warnings });
  }

  if (item.schema !== ABSENCE_STEWARD_QUEUE_ITEM_SCHEMA) blocked_by.push("schema_mismatch");
  if (item.truth_label !== ABSENCE_STEWARD_QUEUE_SCHEMA_TRUTH_LABEL) {
    blocked_by.push("truth_label_mismatch");
  }
  if (!isNonEmptyString(item.queue_item_id) || !SAFE_QUEUE_ITEM_ID.test(item.queue_item_id)) {
    blocked_by.push("queue_item_id_unsafe");
  }
  for (const field of ["operator_id", "node_id", "contract_id", "contract_hash", "readiness_report_hash", "proposed_action_class", "proposed_action_summary", "proposed_inputs_summary"]) {
    if (!isNonEmptyString(item[field])) blocked_by.push(`${field}_missing`);
  }
  if (item.return_review_requirement !== true) {
    blocked_by.push("return_review_requirement_must_be_true");
  }
  if (item.required_human_decision !== true) {
    blocked_by.push("required_human_decision_must_be_true");
  }

  if (!ABSENCE_STEWARD_QUEUE_ALLOWED_STATUSES.includes(item.status) || FORBIDDEN_STATUSES.includes(item.status)) {
    blocked_by.push("status_not_allowed");
  }

  for (const field of FORBIDDEN_CONSENT_FIELDS) {
    if (field in item) blocked_by.push("consent_field_forbidden");
  }

  if (ABSENCE_STEWARD_QUEUE_FORBIDDEN_ACTION_CLASSES.includes(item.proposed_action_class)) {
    blocked_by.push("action_class_never_executable");
  }

  if (!isStringArray(item.allowed_by_contract)) blocked_by.push("allowed_by_contract_not_array");
  if (!isStringArray(item.forbidden_by_contract)) blocked_by.push("forbidden_by_contract_not_array");
  if (
    isStringArray(item.forbidden_by_contract) &&
    item.forbidden_by_contract.includes(item.proposed_action_class)
  ) {
    blocked_by.push("action_class_forbidden_by_contract");
  }

  const createdMs = Date.parse(item.created_at ?? "");
  const expiresMs = Date.parse(item.expires_at ?? "");
  if (Number.isNaN(createdMs)) blocked_by.push("created_at_invalid");
  if (Number.isNaN(expiresMs)) blocked_by.push("expires_at_invalid");
  if (!Number.isNaN(createdMs) && !Number.isNaN(expiresMs) && expiresMs <= createdMs) {
    blocked_by.push("expires_not_after_created");
  }
  // Expiry honesty, both directions: an expired item must say so; an
  // unexpired item may not claim expiry.
  if (!Number.isNaN(nowMs) && !Number.isNaN(expiresMs)) {
    if (nowMs > expiresMs && item.status !== "EXPIRED_WITH_CONTRACT") {
      blocked_by.push("expired_item_must_carry_expired_status");
    }
    if (nowMs <= expiresMs && item.status === "EXPIRED_WITH_CONTRACT") {
      blocked_by.push("expired_status_before_expiry");
    }
  }

  const boundaryClean =
    isPlainObject(item.boundary) &&
    Object.values(item.boundary).every((flag) => flag === false);
  if (!boundaryClean) blocked_by.push("boundary_not_all_false");

  // Self-excluding hash over the normalized body.
  let normalized_item = null;
  let item_hash = null;
  if (
    isStringArray(item.allowed_by_contract) &&
    isStringArray(item.forbidden_by_contract) &&
    isNonEmptyString(item.queue_item_hash)
  ) {
    const { queue_item_hash, ...body } = item;
    normalized_item = {
      ...body,
      allowed_by_contract: Object.freeze([...new Set(body.allowed_by_contract)].sort()),
      forbidden_by_contract: Object.freeze([...new Set(body.forbidden_by_contract)].sort()),
    };
    item_hash = `sha256:${sha256(stableStringify(normalized_item))}`;
    if (item_hash !== item.queue_item_hash) blocked_by.push("queue_item_hash_mismatch");
  } else if (!isNonEmptyString(item.queue_item_hash)) {
    blocked_by.push("queue_item_hash_missing");
  }

  const valid = blocked_by.length === 0;
  return buildResult({
    blocked_by,
    warnings,
    normalized_item: valid ? Object.freeze(normalized_item) : null,
    item_hash: valid ? item_hash : null,
  });
}

function buildResult({ blocked_by, warnings, normalized_item = null, item_hash = null }) {
  const valid = blocked_by.length === 0;
  return Object.freeze({
    valid,
    schema: ABSENCE_STEWARD_QUEUE_VALIDATION_RESULT_SCHEMA,
    truth_label: ABSENCE_STEWARD_QUEUE_SCHEMA_TRUTH_LABEL,
    normalized_item,
    item_hash,
    blocked_by: Object.freeze([...blocked_by]),
    warnings: Object.freeze([...warnings]),
    boundary: absenceStewardQueueBoundary(),
  });
}
