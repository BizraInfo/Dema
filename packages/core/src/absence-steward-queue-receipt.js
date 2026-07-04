// ABSENCE-STEWARD-QUEUE-RECEIPT-1A — consent-gated receipt writer for
// validated + verified queue PROPOSALS
// (docs/02-architecture/ABSENCE_STEWARD_LOCAL_QUEUE_v0_1.md · fourth rung of
// the queue ladder: schema proves shape, verify proves no laundering, receipt
// proves human consent to RECORD).
//
// The receipt approves nothing and executes nothing. It records that a human
// explicitly consented to REMEMBER a proposal — approval stays a separate
// future human decision, and execution is not in this track at all.
//
// Persistence I/O by design: one atomic write+rename under the resolved home
// (options.dem_home > input.dem_home > DEMA_HOME > ~/.dema — always disclosed
// as resolved_dema_home on every path, matching the away-receipt disclosure
// discipline). Every reject fires before any mkdir. created_at comes from the
// injected now_iso — the writer never reads the clock.

import { mkdir, writeFile, rename, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

import { validateAbsenceStewardQueueItem } from "./absence-steward-queue-schema.js";
import { verifyAbsenceStewardQueueItem } from "./absence-steward-queue-verify.js";

export const ABSENCE_STEWARD_QUEUE_RECEIPT_SCHEMA =
  "bizra.dema.absence_steward.queue_item.receipt.v0.1";
export const ABSENCE_STEWARD_QUEUE_RECEIPT_WRITE_RESULT_SCHEMA =
  "bizra.dema.absence_steward.queue_item.receipt_write_result.v0.1";
export const ABSENCE_STEWARD_QUEUE_RECEIPT_TRUTH_LABEL =
  "ABSENCE_STEWARD_QUEUE_RECEIPT_WRITE_ONLY";

const WHAT_THIS_PROVES =
  "Proposal receipt only: a shape-valid, launder-checked queue proposal was recorded under exact human consent.";
const WHAT_THIS_DOES_NOT_PROVE =
  "Not approval. Not execution. Not queue runtime. Not consent to execute. Not hidden work. Recording a proposal never moves it.";

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

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function absenceStewardQueueReceiptBoundary(receipt_written = false) {
  return Object.freeze({
    receipt_written,
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
    approved: false,
    executed: false,
  });
}

export function expectedAbsenceStewardQueueReceiptConsent(queue_item, verify_result) {
  if (
    !isPlainObject(queue_item) ||
    !isPlainObject(verify_result) ||
    verify_result.valid !== true ||
    !isNonEmptyString(queue_item.queue_item_id) ||
    !isNonEmptyString(verify_result.queue_item_hash) ||
    !/^sha256:[a-f0-9]{64}$/.test(verify_result.queue_item_hash)
  ) {
    throw new Error(
      "expectedAbsenceStewardQueueReceiptConsent requires a queue_item and a valid verify_result with queue_item_hash.",
    );
  }
  const hash12 = verify_result.queue_item_hash.slice("sha256:".length, "sha256:".length + 12);
  return `GO: write absence-steward queue receipt ${queue_item.queue_item_id} ${hash12}`;
}

export async function writeAbsenceStewardQueueReceipt(input, options = {}) {
  const blocked_by = [];

  const resolved_dema_home =
    (isNonEmptyString(options?.dem_home) && options.dem_home) ||
    (isPlainObject(input) && isNonEmptyString(input.dem_home) && input.dem_home) ||
    process.env.DEMA_HOME ||
    join(homedir(), ".dema");

  const now_iso = options?.now_iso;
  if (!isNonEmptyString(now_iso)) blocked_by.push("now_iso_missing");

  if (!isPlainObject(input)) {
    blocked_by.push("input_not_object");
    return buildResult({ blocked_by, resolved_dema_home });
  }

  const { queue_item, validation_result, verify_result, consent } = input;
  if (!isPlainObject(queue_item)) blocked_by.push("queue_item_missing");
  if (!isPlainObject(validation_result)) blocked_by.push("validation_result_missing");
  if (!isPlainObject(verify_result)) blocked_by.push("verify_result_missing");
  if (blocked_by.length > 0) {
    return buildResult({ blocked_by, resolved_dema_home });
  }

  // Re-derive the whole verification from raw inputs — disk truth first.
  const internal = verifyAbsenceStewardQueueItem(
    { queue_item, validation_result },
    { now_iso },
  );
  if (!internal.valid) {
    blocked_by.push("internal_verify_failed");
    for (const code of internal.blocked_by) blocked_by.push(`verify:${code}`);
    return buildResult({ blocked_by, resolved_dema_home });
  }

  // The provided verify_result must match the re-derived binding.
  if (verify_result.valid !== true) blocked_by.push("verify_result_not_valid");
  if (verify_result.queue_item_hash !== internal.queue_item_hash) {
    blocked_by.push("verify_result_hash_mismatch");
  }
  if (validation_result.item_hash !== internal.validation_item_hash) {
    blocked_by.push("validation_item_hash_mismatch");
  }
  if (blocked_by.length > 0) {
    return buildResult({ blocked_by, resolved_dema_home });
  }

  const expected_consent = expectedAbsenceStewardQueueReceiptConsent(queue_item, internal);
  if (!isNonEmptyString(consent)) {
    blocked_by.push("consent_missing");
  } else if (consent !== expected_consent) {
    blocked_by.push("consent_mismatch");
  }
  if (blocked_by.length > 0) {
    return buildResult({ blocked_by, resolved_dema_home, expected_consent });
  }

  const hash12 = internal.queue_item_hash.slice(7, 19);
  const receiptsDir = join(resolved_dema_home, "absence-steward", "queue", "receipts");
  const receipt_path = join(receiptsDir, `${queue_item.queue_item_id}-${hash12}.json`);

  const exists = await stat(receipt_path).then(
    () => true,
    () => false,
  );
  if (exists) {
    blocked_by.push("receipt_already_exists");
    return buildResult({ blocked_by, resolved_dema_home, expected_consent });
  }

  const body = {
    schema: ABSENCE_STEWARD_QUEUE_RECEIPT_SCHEMA,
    truth_label: ABSENCE_STEWARD_QUEUE_RECEIPT_TRUTH_LABEL,
    queue_item_id: queue_item.queue_item_id,
    queue_item_hash: internal.queue_item_hash,
    validation_schema: validation_result.schema,
    verify_schema: internal.schema,
    verification_truth_label: internal.truth_label,
    created_at: now_iso,
    operator_id: queue_item.operator_id,
    node_id: queue_item.node_id,
    contract_id: queue_item.contract_id,
    contract_hash: queue_item.contract_hash,
    readiness_report_hash: queue_item.readiness_report_hash,
    status: queue_item.status,
    proposed_action_class: queue_item.proposed_action_class,
    proposed_action_summary: queue_item.proposed_action_summary,
    required_human_decision: queue_item.required_human_decision,
    allowed_by_contract: [...queue_item.allowed_by_contract],
    forbidden_by_contract: [...queue_item.forbidden_by_contract],
    consent_phrase: expected_consent,
    what_this_proves: WHAT_THIS_PROVES,
    what_this_does_not_prove: WHAT_THIS_DOES_NOT_PROVE,
    boundary: absenceStewardQueueReceiptBoundary(true),
  };
  const receipt_hash = `sha256:${sha256(stableStringify(body))}`;
  const receipt = { ...body, receipt_hash };

  await mkdir(receiptsDir, { recursive: true });
  const tmpPath = `${receipt_path}.tmp`;
  await writeFile(tmpPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  await rename(tmpPath, receipt_path);

  return buildResult({
    blocked_by,
    resolved_dema_home,
    expected_consent,
    written: true,
    receipt_path,
    receipt,
  });
}

function buildResult({
  blocked_by,
  resolved_dema_home,
  expected_consent = null,
  written = false,
  receipt_path = null,
  receipt = null,
}) {
  return Object.freeze({
    written,
    schema: ABSENCE_STEWARD_QUEUE_RECEIPT_WRITE_RESULT_SCHEMA,
    truth_label: ABSENCE_STEWARD_QUEUE_RECEIPT_TRUTH_LABEL,
    receipt_path,
    resolved_dema_home,
    expected_consent,
    receipt,
    blocked_by: Object.freeze([...blocked_by]),
    boundary: absenceStewardQueueReceiptBoundary(written),
  });
}
