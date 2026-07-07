// NODE0-RECEIPT-SHELF-COMPACTION-STATE-PREVIEW-1A — Pure preview-only receipt-shelf compaction.
//
// The Dema-native answer to "compact the memory": compact VERIFIED RECEIPT STATE, not raw prose.
// Given a local URP shelf (the #347 index), it re-verifies the shelf and compacts it into a
// hash-bound mission state that RETAINS only verified signals (mission ids, file/pulse hashes, review
// status, counts) and EXPLICITLY declares what was DROPPED (raw file content, unverified semantic
// claims, model-generated meaning), what can no longer be claimed, and exactly ONE next safe action.
//
// This is the Ihsān micro-compliance gate: a compaction is only trustworthy if it can answer — what
// did I keep, what did I drop, what can I no longer claim, what is the one safe next step. It NEVER
// silently drops an obligation.
//
// Honest limit: the shelf is content-addressed, not signature-backed, so this layer's launder-
// resistance is content-addressing only — it re-verifies the shelf's internal consistency but cannot
// re-derive the original genesis signature chain from hash summaries. Declared, not hidden.
//
// Pure kernel: no fs / network / process / clock / random. No RL, no model. createHash is deterministic.

import { createHash } from "node:crypto";
import {
  verifyNode0LocalUrpShelfIndexPreview,
  NODE0_LOCAL_URP_SHELF_INDEX_PREVIEW_SCHEMA,
} from "./node0-local-urp-shelf-index-preview.js";

export const NODE0_RECEIPT_SHELF_COMPACTION_STATE_PREVIEW_SCHEMA = "bizra.dema.node0_receipt_shelf_compaction_state_preview.v0.1";
export const NODE0_RECEIPT_SHELF_COMPACTION_STATE_PREVIEW_TRUTH_LABEL = "NODE0_RECEIPT_SHELF_COMPACTION_STATE_PREVIEW_MEASURED_REPO";
export const NODE0_RECEIPT_SHELF_COMPACTION_STATE_PREVIEW_GO_PHRASE = "GO: node0 receipt shelf compaction state preview";

// The verified signals a compaction KEEPS from the shelf. Fixed + declared.
export const RETAINED_SIGNALS = Object.freeze([
  "mission_id",
  "file_content_hash",
  "pulse_content_hash",
  "receipt_ok",
  "committed_live",
  "valid_count",
  "invalid_count",
  "live_leak_count",
  "boundary",
]);

// What a compaction NEVER retains — the honest dropped-list. Fixed + declared.
export const DROPPED_CONTENT = Object.freeze([
  "raw file content",
  "unverified semantic claims",
  "model-generated meaning",
  "natural-language summaries",
]);

// What can no longer be claimed once compacted — because these were never on the shelf to begin with.
export const NO_LONGER_CLAIMABLE = Object.freeze([
  "the semantic meaning of any mission (only its hashes + status are held)",
  "any live real-world impact (nothing was committed live)",
  "the raw content of any indexed file",
  "any model-inferred conclusion",
]);

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

export function node0ReceiptShelfCompactionStatePreviewBoundary() {
  return Object.freeze({
    execution_allowed: false,
    daemon_started: false,
    network_used: false,
    token_minted: false,
    wallet_accessed: false,
    live_execution_performed: false,
    file_mutation_performed: false,
    model_invocation_performed: false,
  });
}

function boundaryAllFalse(b) {
  const keys = Object.keys(node0ReceiptShelfCompactionStatePreviewBoundary());
  return (
    !!b &&
    typeof b === "object" &&
    !Array.isArray(b) &&
    Object.keys(b).length === keys.length &&
    keys.every((k) => b[k] === false)
  );
}

// The single next safe action, derived deterministically from the shelf state.
function deriveNextSafeAction(shelf, shelf_ok) {
  if (!shelf_ok) return "The source shelf did not verify — rebuild it with `dema mission shelf`, then re-compact.";
  if ((shelf.live_leak_count ?? 0) > 0) {
    return `${shelf.live_leak_count} receipt(s) claim committed_live — quarantine/review them before this compacted state is trusted; do NOT act on a live-leak.`;
  }
  if ((shelf.valid_count ?? 0) === 0) {
    return "The shelf holds no valid receipts — run `dema mission pulse` to create mission memory first.";
  }
  return `Compacted preview memory of ${shelf.valid_count} verified receipt(s) is ready; the next safe action is to review or act on them locally — no live world-state commit.`;
}

export function planNode0ReceiptShelfCompactionStatePreview({ consent, input } = {}) {
  const blocked_by = [];
  if (consent !== NODE0_RECEIPT_SHELF_COMPACTION_STATE_PREVIEW_GO_PHRASE) blocked_by.push("consent_phrase_mismatch");
  if (!input || typeof input !== "object") {
    blocked_by.push("input_not_object");
  } else if (!input.shelf || typeof input.shelf !== "object") {
    blocked_by.push("missing_shelf");
  }
  return Object.freeze({
    schema: NODE0_RECEIPT_SHELF_COMPACTION_STATE_PREVIEW_SCHEMA,
    truth_label: NODE0_RECEIPT_SHELF_COMPACTION_STATE_PREVIEW_TRUTH_LABEL,
    eligible: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

// Content-addressed compacted mission state. Embeds the whole source shelf (re-verified at verify
// time — the launder chain compaction → shelf → receipt hashes). Counts are re-derived from the shelf.
export function buildNode0ReceiptShelfCompactionStatePreviewPayload(input) {
  const shelf = input?.shelf ?? null;
  const sv = verifyNode0LocalUrpShelfIndexPreview(shelf);
  const blocked_by = [];
  if (!sv.ok) {
    blocked_by.push("shelf_invalid");
    for (const c of sv.blocked_by || []) blocked_by.push(`shelf:${c}`);
  }
  if (shelf?.schema !== NODE0_LOCAL_URP_SHELF_INDEX_PREVIEW_SCHEMA) blocked_by.push("shelf_schema_mismatch");
  const shelf_ok = sv.ok && shelf?.schema === NODE0_LOCAL_URP_SHELF_INDEX_PREVIEW_SCHEMA;

  const body = {
    schema: NODE0_RECEIPT_SHELF_COMPACTION_STATE_PREVIEW_SCHEMA,
    truth_label: NODE0_RECEIPT_SHELF_COMPACTION_STATE_PREVIEW_TRUTH_LABEL,
    source_shelf: shelf,
    source_shelf_content_hash: shelf?.content_hash ?? null,
    shelf_ok,
    source_receipt_count: shelf?.entry_count ?? 0,
    valid_receipt_count: shelf?.valid_count ?? 0,
    invalid_receipt_count: shelf?.invalid_count ?? 0,
    live_leak_count: shelf?.live_leak_count ?? 0,
    all_preview: shelf?.all_preview ?? true,
    retained_signals: RETAINED_SIGNALS,
    dropped_content: DROPPED_CONTENT,
    what_can_no_longer_be_claimed: NO_LONGER_CLAIMABLE,
    one_next_safe_action: deriveNextSafeAction(shelf ?? {}, shelf_ok),
    boundary: node0ReceiptShelfCompactionStatePreviewBoundary(),
    authority_delta: 0,
    grants_action: false,
    mint_allowed: false,
    committed_live: false,
    blocked_by: Object.freeze([...new Set(blocked_by)]),
    what_this_proves:
      "A verified local URP receipt shelf was compacted into a deterministic, hash-bound mission state that keeps ONLY verified signals (mission ids, file/pulse hashes, review status, counts) and EXPLICITLY declares what was dropped (raw content, unverified semantic claims, model-generated meaning), what can no longer be claimed, and exactly one next safe action. The Ihsān gate — keep / drop / no-longer-claim / next-action — is answered in full; no obligation is silently dropped.",
    what_this_does_not_prove:
      "It runs no RL, invokes no model, reads no file, and commits nothing live. It compacts PROOF, not meaning — it can never recover the dropped raw content or semantics (by design). Its launder-resistance is content-addressing only: it re-verifies the shelf's internal consistency but cannot re-derive the original genesis signature chain from hash summaries. It publishes nothing to any shared/federated URP; live URP remains DESIGNED_NOT_LIVE.",
  };
  const content_hash = `sha256:${sha256(stableStringify(body))}`;
  return Object.freeze({ ...body, content_hash });
}

export function verifyNode0ReceiptShelfCompactionStatePreview(payload) {
  if (!payload || typeof payload !== "object") {
    return Object.freeze({ ok: false, blocked_by: Object.freeze(["packet_not_object"]) });
  }
  const blocked_by = [];
  const { content_hash, ...body } = payload;
  if (content_hash !== `sha256:${sha256(stableStringify(body))}`) blocked_by.push("content_hash_mismatch");
  if (payload.schema !== NODE0_RECEIPT_SHELF_COMPACTION_STATE_PREVIEW_SCHEMA) blocked_by.push("schema_mismatch");
  if (payload.truth_label !== NODE0_RECEIPT_SHELF_COMPACTION_STATE_PREVIEW_TRUTH_LABEL) blocked_by.push("truth_label_mismatch");
  if (payload.authority_delta !== 0) blocked_by.push("authority_delta_nonzero");
  if (payload.grants_action !== false) blocked_by.push("grants_action_true");
  if (payload.mint_allowed !== false) blocked_by.push("mint_allowed_true");
  if (payload.committed_live !== false) blocked_by.push("committed_live_true");
  if (!boundaryAllFalse(payload.boundary)) blocked_by.push("boundary_not_all_false");
  // Ihsān gate: the dropped-list + no-longer-claimable + next-action must all be present.
  if (!Array.isArray(payload.dropped_content) || payload.dropped_content.length === 0) blocked_by.push("missing_dropped_list");
  if (!Array.isArray(payload.what_can_no_longer_be_claimed) || payload.what_can_no_longer_be_claimed.length === 0) blocked_by.push("missing_no_longer_claimable");
  if (!Array.isArray(payload.retained_signals) || payload.retained_signals.length === 0) blocked_by.push("missing_retained_signals");
  if (typeof payload.one_next_safe_action !== "string" || payload.one_next_safe_action.trim() === "") blocked_by.push("missing_next_action");
  // Launder chain: re-verify the embedded shelf and re-derive every compacted count from it.
  const sv = verifyNode0LocalUrpShelfIndexPreview(payload.source_shelf);
  if (payload.shelf_ok === true && !sv.ok) blocked_by.push("shelf_anchor_invalid");
  const s = payload.source_shelf;
  if (s && typeof s === "object") {
    if (payload.source_receipt_count !== (s.entry_count ?? 0)) blocked_by.push("source_count_mismatch");
    if (payload.valid_receipt_count !== (s.valid_count ?? 0)) blocked_by.push("valid_count_mismatch");
    if (payload.invalid_receipt_count !== (s.invalid_count ?? 0)) blocked_by.push("invalid_count_mismatch");
    if (payload.live_leak_count !== (s.live_leak_count ?? 0)) blocked_by.push("live_leak_count_mismatch");
    if (payload.source_shelf_content_hash !== (s.content_hash ?? null)) blocked_by.push("shelf_hash_ref_mismatch");
  }
  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: NODE0_RECEIPT_SHELF_COMPACTION_STATE_PREVIEW_SCHEMA,
    truth_label: NODE0_RECEIPT_SHELF_COMPACTION_STATE_PREVIEW_TRUTH_LABEL,
    shelf_ok: payload.shelf_ok === true,
    blocked_by: Object.freeze([...new Set(blocked_by)]),
  });
}

export function runNode0ReceiptShelfCompactionStatePreview({ consent, input } = {}) {
  const plan = planNode0ReceiptShelfCompactionStatePreview({ consent, input });
  if (!plan.eligible) {
    return Object.freeze({
      ok: false,
      schema: NODE0_RECEIPT_SHELF_COMPACTION_STATE_PREVIEW_SCHEMA,
      truth_label: NODE0_RECEIPT_SHELF_COMPACTION_STATE_PREVIEW_TRUTH_LABEL,
      status: "blocked_pending_consent",
      boundary: node0ReceiptShelfCompactionStatePreviewBoundary(),
      mint_allowed: false,
      authority_delta: 0,
      grants_action: false,
      blocked_by: plan.blocked_by,
    });
  }

  const payload = buildNode0ReceiptShelfCompactionStatePreviewPayload(input);
  const verified = verifyNode0ReceiptShelfCompactionStatePreview(payload);
  const blocked_by = [];
  // A bad SHELF is reported (shelf_ok false) but does not break the compaction run — the compaction's
  // job is to report the state honestly. Only a broken VERDICT (verify failure) blocks the run.
  if (!verified.ok) blocked_by.push(...verified.blocked_by);

  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: NODE0_RECEIPT_SHELF_COMPACTION_STATE_PREVIEW_SCHEMA,
    truth_label: NODE0_RECEIPT_SHELF_COMPACTION_STATE_PREVIEW_TRUTH_LABEL,
    status: blocked_by.length === 0 ? "compaction_state_complete" : "compaction_state_broken",
    content_hash: payload.content_hash,
    shelf_ok: payload.shelf_ok,
    source_receipt_count: payload.source_receipt_count,
    valid_receipt_count: payload.valid_receipt_count,
    invalid_receipt_count: payload.invalid_receipt_count,
    live_leak_count: payload.live_leak_count,
    retained_signals: payload.retained_signals,
    dropped_content: payload.dropped_content,
    what_can_no_longer_be_claimed: payload.what_can_no_longer_be_claimed,
    one_next_safe_action: payload.one_next_safe_action,
    boundary: payload.boundary,
    mint_allowed: false,
    authority_delta: 0,
    grants_action: false,
    committed_live: false,
    what_this_proves: payload.what_this_proves,
    what_this_does_not_prove: payload.what_this_does_not_prove,
    blocked_by: Object.freeze([...new Set(blocked_by)]),
  });
}
