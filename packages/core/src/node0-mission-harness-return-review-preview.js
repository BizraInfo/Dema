// NODE0-MISSION-HARNESS-RETURN-REVIEW-PREVIEW-1A — Pure preview-only return-review over a
// `dema mission pulse` receipt. It closes the mission loop's read side: given an INJECTED receipt
// (the receipt_artifact_preview a harness run produced), it VERIFIES the receipt's structure +
// invariants, states what was PROVEN and what was NOT proven, and recommends exactly ONE next safe
// action.
//
// Honest boundary on "verify": the harness receipt is a SUMMARY, not the full content-addressed
// harness payload — so this reviewer confirms the receipt's shape, schema, and preview invariants
// (committed_live false, hash format, boundary-consistency) and DECLARES that full cryptographic
// re-derivation of the pulse→composition→genesis chain is not possible from the summary alone. It
// judges NO semantic correctness and reads NO file (the CLI adapter reads the receipt file).
//
// Pure kernel: no fs / network / process / clock / random. createHash is a deterministic digest.

import { createHash } from "node:crypto";
import { NODE0_LOCAL_MISSION_HARNESS_PREVIEW_SCHEMA } from "./node0-local-mission-harness-preview.js";

export const NODE0_MISSION_HARNESS_RETURN_REVIEW_PREVIEW_SCHEMA = "bizra.dema.node0_mission_harness_return_review_preview.v0.1";
export const NODE0_MISSION_HARNESS_RETURN_REVIEW_PREVIEW_TRUTH_LABEL = "NODE0_MISSION_HARNESS_RETURN_REVIEW_PREVIEW_MEASURED_REPO";
export const NODE0_MISSION_HARNESS_RETURN_REVIEW_PREVIEW_GO_PHRASE = "GO: node0 mission harness return review preview";

const CONTENT_HASH_RE = /^sha256:[0-9a-f]{64}$/;

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

function nonEmptyString(v) {
  return typeof v === "string" && v.trim() !== "";
}

export function node0MissionHarnessReturnReviewPreviewBoundary() {
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
  const keys = Object.keys(node0MissionHarnessReturnReviewPreviewBoundary());
  return (
    !!b &&
    typeof b === "object" &&
    !Array.isArray(b) &&
    Object.keys(b).length === keys.length &&
    keys.every((k) => b[k] === false)
  );
}

// Structural + invariant review of an injected harness receipt (receipt_artifact_preview). Returns
// { blocked_by, receipt_ok }. Judges shape/invariants only — never semantic correctness.
export function evaluateReceipt(receipt) {
  const b = [];
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) {
    b.push("missing_receipt");
    return Object.freeze({ blocked_by: Object.freeze(b), receipt_ok: false });
  }
  if (receipt.schema !== NODE0_LOCAL_MISSION_HARNESS_PREVIEW_SCHEMA) b.push("receipt_schema_mismatch");
  if (!nonEmptyString(receipt.mission_id)) b.push("receipt_missing_mission_id");
  if (!receipt.file_ref || typeof receipt.file_ref !== "object") {
    b.push("receipt_missing_file_ref");
  } else if (!CONTENT_HASH_RE.test(receipt.file_ref.content_hash || "")) {
    b.push("receipt_file_ref_bad_content_hash");
  }
  if (!CONTENT_HASH_RE.test(receipt.pulse_content_hash || "")) b.push("receipt_bad_pulse_content_hash");
  if (receipt.committed_live !== false) b.push("receipt_committed_live");
  if (!receipt.dema_report || typeof receipt.dema_report !== "object") b.push("receipt_missing_dema_report");
  return Object.freeze({ blocked_by: Object.freeze([...new Set(b)]), receipt_ok: b.length === 0 });
}

// The single next safe action, derived deterministically from receipt state (never a live action).
function deriveNextSafeAction(receipt, receipt_ok) {
  if (!receipt_ok) return "Repair the receipt per blocked_by, then re-run `dema mission pulse`.";
  if (receipt.pulse_ok === true) {
    return "Loop verified as a PREVIEW — the next safe action is to index this receipt into the local URP shelf; do NOT commit any live world-state.";
  }
  return "The pulse was blocked — re-run `dema mission pulse` with a corrected operator claim/task/boundary.";
}

export function planNode0MissionHarnessReturnReviewPreview({ consent, input } = {}) {
  const blocked_by = [];
  if (consent !== NODE0_MISSION_HARNESS_RETURN_REVIEW_PREVIEW_GO_PHRASE) blocked_by.push("consent_phrase_mismatch");
  if (!input || typeof input !== "object") {
    blocked_by.push("input_not_object");
  } else if (!input.receipt || typeof input.receipt !== "object") {
    blocked_by.push("missing_receipt");
  }
  return Object.freeze({
    schema: NODE0_MISSION_HARNESS_RETURN_REVIEW_PREVIEW_SCHEMA,
    truth_label: NODE0_MISSION_HARNESS_RETURN_REVIEW_PREVIEW_TRUTH_LABEL,
    eligible: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

// Content-addressed return-review verdict. Embeds a compact summary of the reviewed receipt (by
// reference — mission_id + hashes), the proven / not-proven lists, and the single next action.
export function buildNode0MissionHarnessReturnReviewPreviewPayload(input) {
  const receipt = input?.receipt ?? null;
  const evalr = evaluateReceipt(receipt);
  const ok = evalr.receipt_ok;

  const what_was_proven = ok
    ? Object.freeze([
        "One local file was contacted under consent and content-addressed (sha256).",
        "A mission pulse ran and produced a PREVIEW receipt (committed_live false).",
        "The receipt is structurally valid, carries a well-formed pulse content hash, and is boundary-consistent.",
      ])
    : Object.freeze([]);

  const what_was_not_proven = Object.freeze([
    "Semantic correctness of the operator-supplied claim/task/boundary — this reviewer judges shape, not meaning.",
    "Any live world-state change — the receipt is preview-only (committed_live false).",
    "Full cryptographic re-derivation of the pulse→composition→genesis chain — not possible from the receipt SUMMARY alone; it requires the source harness payload.",
    "No model ran, no impact was verified, no reward accrued.",
  ]);

  const body = {
    schema: NODE0_MISSION_HARNESS_RETURN_REVIEW_PREVIEW_SCHEMA,
    truth_label: NODE0_MISSION_HARNESS_RETURN_REVIEW_PREVIEW_TRUTH_LABEL,
    reviewed_receipt_ref: Object.freeze({
      mission_id: receipt?.mission_id ?? null,
      receipt_schema: receipt?.schema ?? null,
      file_content_hash: receipt?.file_ref?.content_hash ?? null,
      pulse_content_hash: receipt?.pulse_content_hash ?? null,
      committed_live: receipt?.committed_live ?? null,
    }),
    receipt_ok: ok,
    what_was_proven,
    what_was_not_proven,
    one_next_safe_action: deriveNextSafeAction(receipt, ok),
    boundary: node0MissionHarnessReturnReviewPreviewBoundary(),
    authority_delta: 0,
    grants_action: false,
    mint_allowed: false,
    blocked_by: evalr.blocked_by,
    what_this_proves:
      "A `dema mission pulse` receipt was independently REVIEWED: its structure, schema, preview invariants (committed_live false, well-formed hashes), and boundary-consistency were checked, and the review states what the receipt proves, what it does not, and exactly one next safe action — deterministically and boundary-false.",
    what_this_does_not_prove:
      "It reads no file (the CLI adapter does), judges NO semantic correctness, re-runs no pulse, and cannot re-derive the full signature chain from the receipt summary. It performs no live action; the recommended next action is a preview recommendation, not an execution.",
  };
  const content_hash = `sha256:${sha256(stableStringify(body))}`;
  return Object.freeze({ ...body, content_hash });
}

export function verifyNode0MissionHarnessReturnReviewPreview(payload) {
  if (!payload || typeof payload !== "object") {
    return Object.freeze({ ok: false, blocked_by: Object.freeze(["packet_not_object"]) });
  }
  const blocked_by = [];
  const { content_hash, ...body } = payload;
  if (content_hash !== `sha256:${sha256(stableStringify(body))}`) blocked_by.push("content_hash_mismatch");
  if (payload.schema !== NODE0_MISSION_HARNESS_RETURN_REVIEW_PREVIEW_SCHEMA) blocked_by.push("schema_mismatch");
  if (payload.truth_label !== NODE0_MISSION_HARNESS_RETURN_REVIEW_PREVIEW_TRUTH_LABEL) blocked_by.push("truth_label_mismatch");
  if (payload.authority_delta !== 0) blocked_by.push("authority_delta_nonzero");
  if (payload.grants_action !== false) blocked_by.push("grants_action_true");
  if (payload.mint_allowed !== false) blocked_by.push("mint_allowed_true");
  if (!boundaryAllFalse(payload.boundary)) blocked_by.push("boundary_not_all_false");
  if (!Array.isArray(payload.what_was_not_proven) || payload.what_was_not_proven.length === 0) {
    blocked_by.push("missing_not_proven");
  }
  if (!nonEmptyString(payload.one_next_safe_action)) blocked_by.push("missing_next_action");
  // Consistency: a receipt_ok review must carry proven items; a not-ok review must not claim proof.
  if (payload.receipt_ok === true && (!Array.isArray(payload.what_was_proven) || payload.what_was_proven.length === 0)) {
    blocked_by.push("ok_without_proof");
  }
  if (payload.receipt_ok === false && Array.isArray(payload.what_was_proven) && payload.what_was_proven.length > 0) {
    blocked_by.push("not_ok_but_claims_proof");
  }
  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: NODE0_MISSION_HARNESS_RETURN_REVIEW_PREVIEW_SCHEMA,
    truth_label: NODE0_MISSION_HARNESS_RETURN_REVIEW_PREVIEW_TRUTH_LABEL,
    receipt_ok: payload.receipt_ok === true,
    blocked_by: Object.freeze([...new Set(blocked_by)]),
  });
}

// A pure example harness receipt (the summary shape a `dema mission pulse --receipt` writes).
export function exampleHarnessReceipt() {
  return {
    schema: NODE0_LOCAL_MISSION_HARNESS_PREVIEW_SCHEMA,
    mission_id: "node0-local-mission-abababab",
    file_ref: {
      path: "docs/BUILDER_SPACE.md",
      size_bytes: 128,
      mtime_iso: "2026-07-07T00:00:00.000Z",
      content_hash: `sha256:${"b".repeat(64)}`,
      content_read_performed: false,
    },
    pulse_ok: true,
    pulse_content_hash: `sha256:${"c".repeat(64)}`,
    dema_report: {
      status: "verified_preview_pulse",
      what_happened: "A supplied mission packet was validated into a receipt-backed world-state delta preview.",
      what_this_proves: "The control loop connected mission, consent, resource composition, verification, receipt, and world-state — as previews.",
      what_this_does_not_prove: "No live runtime, model, ingestion, mint, federation, or public readiness.",
      next_safe_action: "Build the I/O harness only after the pure kernel is merged.",
    },
    generated_at_iso: "2026-07-07T12:00:00.000Z",
    committed_live: false,
  };
}

export function runNode0MissionHarnessReturnReviewPreview({ consent, input } = {}) {
  const plan = planNode0MissionHarnessReturnReviewPreview({ consent, input });
  if (!plan.eligible) {
    return Object.freeze({
      ok: false,
      schema: NODE0_MISSION_HARNESS_RETURN_REVIEW_PREVIEW_SCHEMA,
      truth_label: NODE0_MISSION_HARNESS_RETURN_REVIEW_PREVIEW_TRUTH_LABEL,
      status: "blocked_pending_consent",
      boundary: node0MissionHarnessReturnReviewPreviewBoundary(),
      mint_allowed: false,
      authority_delta: 0,
      grants_action: false,
      blocked_by: plan.blocked_by,
    });
  }

  const payload = buildNode0MissionHarnessReturnReviewPreviewPayload(input);
  const verified = verifyNode0MissionHarnessReturnReviewPreview(payload);
  const blocked_by = [];
  // A blocked receipt does NOT block the review itself — the review's JOB is to report a bad receipt.
  // Only a broken verdict (verify failure) blocks the run.
  if (!verified.ok) blocked_by.push(...verified.blocked_by);

  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: NODE0_MISSION_HARNESS_RETURN_REVIEW_PREVIEW_SCHEMA,
    truth_label: NODE0_MISSION_HARNESS_RETURN_REVIEW_PREVIEW_TRUTH_LABEL,
    status: blocked_by.length === 0 ? "return_review_complete" : "return_review_broken",
    content_hash: payload.content_hash,
    receipt_ok: payload.receipt_ok,
    what_was_proven: payload.what_was_proven,
    what_was_not_proven: payload.what_was_not_proven,
    one_next_safe_action: payload.one_next_safe_action,
    boundary: payload.boundary,
    mint_allowed: false,
    authority_delta: 0,
    grants_action: false,
    what_this_proves: payload.what_this_proves,
    what_this_does_not_prove: payload.what_this_does_not_prove,
    blocked_by: Object.freeze([...new Set(blocked_by)]),
  });
}
