// NODE0-LOCAL-URP-SHELF-INDEX-PREVIEW-1A — Pure preview-only local URP shelf index. It makes the
// write-only mission receipts READABLE: given an INJECTED set of `dema mission pulse` receipts, it
// composes a queryable, content-addressed local shelf catalog (per-receipt: mission id, file + pulse
// hashes, review status, committed_live) plus counts, so an operator can walk up to the shelf and see
// what missions the node holds. It commits NO live world-state, publishes nothing, reads no file
// (the CLI adapter reads the receipts dir), and stays pure.
//
// This is the first "House of Wisdom" shelf: URP_LOCAL_ACTIVE becoming a thing you can ASK, not just
// a thing you WRITE. It shares the return-review's receipt validator (evaluateReceipt) so the shelf
// and the review agree on what a valid receipt is.
//
// Pure kernel: no fs / network / process / clock / random. createHash is a deterministic digest.

import { createHash } from "node:crypto";
import { evaluateReceipt } from "./node0-mission-harness-return-review-preview.js";

export const NODE0_LOCAL_URP_SHELF_INDEX_PREVIEW_SCHEMA = "bizra.dema.node0_local_urp_shelf_index_preview.v0.1";
export const NODE0_LOCAL_URP_SHELF_INDEX_PREVIEW_TRUTH_LABEL = "NODE0_LOCAL_URP_SHELF_INDEX_PREVIEW_MEASURED_REPO";
export const NODE0_LOCAL_URP_SHELF_INDEX_PREVIEW_GO_PHRASE = "GO: node0 local urp shelf index preview";

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

export function node0LocalUrpShelfIndexPreviewBoundary() {
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
  const keys = Object.keys(node0LocalUrpShelfIndexPreviewBoundary());
  return (
    !!b &&
    typeof b === "object" &&
    !Array.isArray(b) &&
    Object.keys(b).length === keys.length &&
    keys.every((k) => b[k] === false)
  );
}

// Compose the shelf entries from injected receipts. Deterministic order (by mission_id then pulse
// hash) so the shelf content-hash is stable. Each entry reuses the return-review receipt validator.
export function composeShelfEntries(receipts) {
  const list = Array.isArray(receipts) ? receipts : [];
  const entries = list.map((receipt) => {
    const r = evaluateReceipt(receipt);
    return {
      mission_id: receipt?.mission_id ?? null,
      file_content_hash: receipt?.file_ref?.content_hash ?? null,
      pulse_content_hash: receipt?.pulse_content_hash ?? null,
      committed_live: receipt?.committed_live ?? null,
      receipt_ok: r.receipt_ok,
    };
  });
  entries.sort((a, b) => {
    const ka = `${a.mission_id ?? ""}|${a.pulse_content_hash ?? ""}`;
    const kb = `${b.mission_id ?? ""}|${b.pulse_content_hash ?? ""}`;
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
  return Object.freeze(entries.map((e) => Object.freeze(e)));
}

export function planNode0LocalUrpShelfIndexPreview({ consent, input } = {}) {
  const blocked_by = [];
  if (consent !== NODE0_LOCAL_URP_SHELF_INDEX_PREVIEW_GO_PHRASE) blocked_by.push("consent_phrase_mismatch");
  if (!input || typeof input !== "object") {
    blocked_by.push("input_not_object");
  } else if (!Array.isArray(input.receipts)) {
    blocked_by.push("receipts_not_array");
  }
  return Object.freeze({
    schema: NODE0_LOCAL_URP_SHELF_INDEX_PREVIEW_SCHEMA,
    truth_label: NODE0_LOCAL_URP_SHELF_INDEX_PREVIEW_TRUTH_LABEL,
    eligible: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

// Content-addressed shelf index. Catalogs every receipt (valid or not — the shelf's job is to SHOW
// what is held), with counts. A receipt claiming committed_live true is a red flag surfaced as a
// live_leak (the shelf itself commits nothing live).
export function buildNode0LocalUrpShelfIndexPreviewPayload(input) {
  const entries = composeShelfEntries(input?.receipts);
  const valid_count = entries.filter((e) => e.receipt_ok === true).length;
  const live_leak_count = entries.filter((e) => e.committed_live === true).length;

  const body = {
    schema: NODE0_LOCAL_URP_SHELF_INDEX_PREVIEW_SCHEMA,
    truth_label: NODE0_LOCAL_URP_SHELF_INDEX_PREVIEW_TRUTH_LABEL,
    entries,
    entry_count: entries.length,
    valid_count,
    invalid_count: entries.length - valid_count,
    live_leak_count,
    all_preview: live_leak_count === 0,
    boundary: node0LocalUrpShelfIndexPreviewBoundary(),
    authority_delta: 0,
    grants_action: false,
    mint_allowed: false,
    what_this_proves:
      "A set of `dema mission pulse` receipts was composed into a deterministic, content-addressed LOCAL shelf catalog: each entry carries the mission id, file + pulse content hashes, and its receipt-review status; the shelf reports valid/invalid/live-leak counts. The write-only receipts are now READABLE as one queryable local view (URP_LOCAL_ACTIVE).",
    what_this_does_not_prove:
      "It reads no file in the kernel (the CLI adapter does, read-only), verifies no semantic content, commits NOTHING to a live world-state, PUBLISHES nothing to any shared/federated URP, mints nothing, and grants no action. A live URP (shared across nodes) remains DESIGNED_NOT_LIVE. The shelf is a local reading view, not a network.",
  };
  const content_hash = `sha256:${sha256(stableStringify(body))}`;
  return Object.freeze({ ...body, content_hash });
}

export function verifyNode0LocalUrpShelfIndexPreview(payload) {
  if (!payload || typeof payload !== "object") {
    return Object.freeze({ ok: false, blocked_by: Object.freeze(["packet_not_object"]) });
  }
  const blocked_by = [];
  const { content_hash, ...body } = payload;
  if (content_hash !== `sha256:${sha256(stableStringify(body))}`) blocked_by.push("content_hash_mismatch");
  if (payload.schema !== NODE0_LOCAL_URP_SHELF_INDEX_PREVIEW_SCHEMA) blocked_by.push("schema_mismatch");
  if (payload.truth_label !== NODE0_LOCAL_URP_SHELF_INDEX_PREVIEW_TRUTH_LABEL) blocked_by.push("truth_label_mismatch");
  if (payload.authority_delta !== 0) blocked_by.push("authority_delta_nonzero");
  if (payload.grants_action !== false) blocked_by.push("grants_action_true");
  if (payload.mint_allowed !== false) blocked_by.push("mint_allowed_true");
  if (!boundaryAllFalse(payload.boundary)) blocked_by.push("boundary_not_all_false");
  // Count consistency — a forged count is rejected by re-derivation from the entries.
  if (!Array.isArray(payload.entries)) {
    blocked_by.push("entries_not_array");
  } else {
    if (payload.entry_count !== payload.entries.length) blocked_by.push("entry_count_mismatch");
    const vc = payload.entries.filter((e) => e && e.receipt_ok === true).length;
    if (payload.valid_count !== vc) blocked_by.push("valid_count_mismatch");
    if (payload.invalid_count !== payload.entries.length - vc) blocked_by.push("invalid_count_mismatch");
    const ll = payload.entries.filter((e) => e && e.committed_live === true).length;
    if (payload.live_leak_count !== ll) blocked_by.push("live_leak_count_mismatch");
    if (payload.all_preview !== (ll === 0)) blocked_by.push("all_preview_mismatch");
  }
  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: NODE0_LOCAL_URP_SHELF_INDEX_PREVIEW_SCHEMA,
    truth_label: NODE0_LOCAL_URP_SHELF_INDEX_PREVIEW_TRUTH_LABEL,
    entry_count: payload.entry_count,
    blocked_by: Object.freeze([...new Set(blocked_by)]),
  });
}

// A pure example set of harness receipts (the summary shape a `dema mission pulse --receipt` writes).
export function exampleShelfReceipts() {
  const mk = (id, h) => ({
    schema: "bizra.dema.node0_local_mission_harness_preview.v0.1",
    mission_id: id,
    file_ref: {
      path: `docs/${id}.md`,
      size_bytes: 64,
      mtime_iso: "2026-07-07T00:00:00.000Z",
      content_hash: `sha256:${h.repeat(64)}`,
      content_read_performed: false,
    },
    pulse_ok: true,
    pulse_content_hash: `sha256:${h.repeat(64)}`,
    dema_report: { status: "verified_preview_pulse", what_happened: "x", what_this_proves: "x", what_this_does_not_prove: "x", next_safe_action: "x" },
    generated_at_iso: "2026-07-07T12:00:00.000Z",
    committed_live: false,
  });
  return [mk("node0-local-mission-aaaaaaaa", "a"), mk("node0-local-mission-bbbbbbbb", "b")];
}

export function runNode0LocalUrpShelfIndexPreview({ consent, input } = {}) {
  const plan = planNode0LocalUrpShelfIndexPreview({ consent, input });
  if (!plan.eligible) {
    return Object.freeze({
      ok: false,
      schema: NODE0_LOCAL_URP_SHELF_INDEX_PREVIEW_SCHEMA,
      truth_label: NODE0_LOCAL_URP_SHELF_INDEX_PREVIEW_TRUTH_LABEL,
      status: "blocked_pending_consent",
      boundary: node0LocalUrpShelfIndexPreviewBoundary(),
      mint_allowed: false,
      authority_delta: 0,
      grants_action: false,
      blocked_by: plan.blocked_by,
    });
  }

  const payload = buildNode0LocalUrpShelfIndexPreviewPayload(input);
  const verified = verifyNode0LocalUrpShelfIndexPreview(payload);
  const blocked_by = [];
  if (!verified.ok) blocked_by.push(...verified.blocked_by);

  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: NODE0_LOCAL_URP_SHELF_INDEX_PREVIEW_SCHEMA,
    truth_label: NODE0_LOCAL_URP_SHELF_INDEX_PREVIEW_TRUTH_LABEL,
    status: blocked_by.length === 0 ? "shelf_index_complete" : "shelf_index_broken",
    content_hash: payload.content_hash,
    entry_count: payload.entry_count,
    valid_count: payload.valid_count,
    invalid_count: payload.invalid_count,
    live_leak_count: payload.live_leak_count,
    all_preview: payload.all_preview,
    entries: payload.entries,
    boundary: payload.boundary,
    mint_allowed: false,
    authority_delta: 0,
    grants_action: false,
    what_this_proves: payload.what_this_proves,
    what_this_does_not_prove: payload.what_this_does_not_prove,
    blocked_by: Object.freeze([...new Set(blocked_by)]),
  });
}
