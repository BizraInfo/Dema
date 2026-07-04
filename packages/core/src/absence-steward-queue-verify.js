// ABSENCE-STEWARD-QUEUE-VERIFY-1A — body-bound verifier for Absence Steward
// queue items (docs/02-architecture/ABSENCE_STEWARD_LOCAL_QUEUE_v0_1.md ·
// sibling of absence-steward-queue-schema.js).
//
// Schema says: the proposal has a valid shape.
// Verify says: the proposal was not laundered.
// Neither says: approved. Neither says: executed.
//
// The verifier re-derives the WHOLE validation from the raw queue item and
// diffs the entire normalized body + hash against the provided
// validation_result — never a field subset. It stores no queue, approves
// nothing, executes nothing.
//
// Pure kernel: no fs / network / process / clock / random. Act-time is
// injected via options.now_iso (passed through to the schema validator).

import {
  ABSENCE_STEWARD_QUEUE_VALIDATION_RESULT_SCHEMA,
  ABSENCE_STEWARD_QUEUE_SCHEMA_TRUTH_LABEL,
  validateAbsenceStewardQueueItem,
} from "./absence-steward-queue-schema.js";

export const ABSENCE_STEWARD_QUEUE_VERIFY_RESULT_SCHEMA =
  "bizra.dema.absence_steward.queue_item.verify_result.v0.1";
export const ABSENCE_STEWARD_QUEUE_VERIFY_TRUTH_LABEL =
  "ABSENCE_STEWARD_QUEUE_VERIFY_ONLY";

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
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

export function absenceStewardQueueVerifyBoundary() {
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

export function verifyAbsenceStewardQueueItem(input, options = {}) {
  const blocked_by = [];
  const warnings = [];

  const queue_item = isPlainObject(input) ? input.queue_item : undefined;
  const validation_result = isPlainObject(input) ? input.validation_result : undefined;

  if (!isPlainObject(queue_item)) blocked_by.push("queue_item_missing");
  if (!isPlainObject(validation_result)) blocked_by.push("validation_result_missing");
  if (blocked_by.length > 0) {
    return buildResult({ queue_item: null, blocked_by, warnings });
  }

  // The provided verdict must claim validity with the right provenance.
  const claimsValid = validation_result.valid === true;
  if (!claimsValid) blocked_by.push("validation_not_valid");
  if (validation_result.schema !== ABSENCE_STEWARD_QUEUE_VALIDATION_RESULT_SCHEMA) {
    blocked_by.push("validation_schema_invalid");
  }
  if (validation_result.truth_label !== ABSENCE_STEWARD_QUEUE_SCHEMA_TRUTH_LABEL) {
    blocked_by.push("validation_truth_label_invalid");
  }
  if (!isPlainObject(validation_result.normalized_item)) {
    blocked_by.push("validation_normalized_item_missing");
  }
  if (!isNonEmptyString(validation_result.item_hash)) {
    blocked_by.push("validation_item_hash_missing");
  }
  const validationBoundaryClean =
    isPlainObject(validation_result.boundary) &&
    Object.values(validation_result.boundary).every((flag) => flag === false);
  if (!validationBoundaryClean) blocked_by.push("validation_boundary_not_all_false");

  // Re-derive the whole validation from the raw item — disk truth first.
  const internal = validateAbsenceStewardQueueItem(queue_item, {
    now_iso: options?.now_iso,
  });
  if (!internal.valid) {
    blocked_by.push("queue_item_invalid");
    for (const code of internal.blocked_by) blocked_by.push(`schema:${code}`);
    // A verdict claiming valid over an item that re-validates invalid is a
    // forged verdict — laundering by definition.
    if (claimsValid) blocked_by.push("launder_attempt_detected");
    return buildResult({ queue_item, blocked_by, warnings });
  }

  let launder = false;
  if (internal.item_hash !== queue_item.queue_item_hash) {
    blocked_by.push("queue_item_hash_mismatch");
    launder = true;
  }
  if (
    isNonEmptyString(validation_result.item_hash) &&
    internal.item_hash !== validation_result.item_hash
  ) {
    blocked_by.push("validation_item_hash_mismatch");
    launder = true;
  }
  if (
    isPlainObject(validation_result.normalized_item) &&
    stableStringify(validation_result.normalized_item) !==
      stableStringify(internal.normalized_item)
  ) {
    blocked_by.push("normalized_item_mismatch");
    launder = true;
  }
  if (launder && claimsValid) blocked_by.push("launder_attempt_detected");

  return buildResult({
    queue_item,
    blocked_by,
    warnings,
    rederived_item_hash: internal.item_hash,
    validation_item_hash: isNonEmptyString(validation_result.item_hash)
      ? validation_result.item_hash
      : null,
  });
}

function buildResult({
  queue_item,
  blocked_by,
  warnings,
  rederived_item_hash = null,
  validation_item_hash = null,
}) {
  const valid = blocked_by.length === 0;
  return Object.freeze({
    valid,
    schema: ABSENCE_STEWARD_QUEUE_VERIFY_RESULT_SCHEMA,
    truth_label: ABSENCE_STEWARD_QUEUE_VERIFY_TRUTH_LABEL,
    queue_item_id: isNonEmptyString(queue_item?.queue_item_id)
      ? queue_item.queue_item_id
      : null,
    queue_item_hash: isNonEmptyString(queue_item?.queue_item_hash)
      ? queue_item.queue_item_hash
      : null,
    rederived_item_hash,
    validation_item_hash,
    blocked_by: Object.freeze([...blocked_by]),
    warnings: Object.freeze([...warnings]),
    boundary: absenceStewardQueueVerifyBoundary(),
  });
}
