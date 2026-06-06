// C4 · PAT-6 · Receipt Recorder (per ADR-008 §C4).
//
// Sixth of the 7 PATs. Role: shape events into receipt format · compute
// hashes · prepare receipt candidates for C12 chain advance. NEVER mints ·
// NEVER advances chain · NEVER signs without operator consent · NEVER
// modifies an existing receipt.

import { createHash } from "node:crypto";
import {
  buildAgentKernel,
  AGENT_KERNEL_MAX_ITERATIONS,
} from "./agent-kernel.js";
import { buildEffectCap } from "./effect-cap.js";
import { buildPreviewBoundary } from "./preview-boundary.js";

const SCHEMA = "bizra.dema.pat_receipt_recorder.v0.1";
const RECEIPT_CANDIDATE_SCHEMA = "bizra.dema.receipt_candidate.v0.1";

const PAT6_PERSONA = Object.freeze({
  pat_number: 6,
  pat_id: "pat-6-receipt-recorder",
  role_name: "receipt_recorder",
  role_description:
    "Shapes events into receipt-candidate format · computes content hashes · " +
    "prepares chain-shaped artifacts for C12 mint. NEVER mints · NEVER advances " +
    "chain · NEVER signs · NEVER modifies an existing receipt. Output is a " +
    "candidate · operator + governed gateway issue the canonical receipt.",
  primary_capabilities: Object.freeze([
    "shape_event_to_receipt_candidate",
    "compute_content_hash",
    "verify_existing_receipt_hash",
    "draft_chain_position_descriptor",
  ]),
  primary_refusals: Object.freeze([
    "mint_canonical_receipt",
    "advance_chain",
    "sign_receipt_without_consent",
    "modify_existing_receipt",
    "forge_prev_hash_chain",
    "infer_chain_position_without_evidence",
  ]),
});

const PAT6_EFFECT_CAP_ALLOWED = Object.freeze([
  "read_local_file",
  "compute_hash",
  "stat_file_metadata",
  "render_terminal_output",
]);

const PAT6_EFFECT_CAP_EXTRA_BLOCKED = Object.freeze([
  "mint_canonical_receipt",
  "advance_chain",
  "modify_existing_receipt",
  "forge_prev_hash_chain",
  "sign_without_consent",
]);

const PAT6_CONSENT_PHRASE_TEMPLATE =
  "GO: invoke PAT-6 receipt_recorder to shape candidate";

function safeString(v, fallback = "") {
  return typeof v === "string" ? v : fallback;
}

function safeObject(v, fallback = {}) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : fallback;
}

function sha256Hex(input) {
  try {
    return createHash("sha256").update(String(input)).digest("hex");
  } catch {
    return null;
  }
}

export function buildPATReceiptRecorderEffectCap() {
  return buildEffectCap({
    name: "pat_receipt_recorder",
    description: PAT6_PERSONA.role_description,
    allowed_effects: PAT6_EFFECT_CAP_ALLOWED,
    blocked_effects: PAT6_EFFECT_CAP_EXTRA_BLOCKED,
    consent_scope_template: PAT6_CONSENT_PHRASE_TEMPLATE,
    audit_trail_required: true,
  });
}

export function buildPATReceiptRecorderPreview({
  operator_name = "Mumu",
} = {}) {
  return Object.freeze({
    schema: SCHEMA,
    truth_label: "NODE0_LOCAL_SEED",
    mode: "preview_only",
    persona: PAT6_PERSONA,
    serves_operator: safeString(operator_name, "Mumu"),
    effect_cap: buildPATReceiptRecorderEffectCap(),
    consent_phrase_template: PAT6_CONSENT_PHRASE_TEMPLATE,
    memory_file_path: `~/.dema/agents/${PAT6_PERSONA.pat_id}/memory.json`,
    max_iterations: AGENT_KERNEL_MAX_ITERATIONS,
    refusal_invariants: Object.freeze([
      "PAT-6 never mints a canonical receipt · only shapes candidates",
      "PAT-6 never advances the chain · operator + gateway do that",
      "PAT-6 never signs · only computes content hashes for verification",
      "PAT-6 never modifies an existing receipt · the chain is append-only",
      "PAT-6 never forges a prev_hash · honest unknown is named",
    ]),
    boundary: buildPreviewBoundary(),
  });
}

export function buildPATReceiptRecorderKernel({
  mission_intent = "",
  max_iterations = AGENT_KERNEL_MAX_ITERATIONS,
} = {}) {
  return buildAgentKernel({
    agent_id: PAT6_PERSONA.pat_id,
    agent_role: "pat_receipt_recorder",
    mission_intent: safeString(mission_intent, ""),
    max_iterations,
  });
}

// Shape an event into a receipt candidate. The candidate is NOT a receipt ·
// it's a structured proposal for what a receipt of this event WOULD look
// like. C12 takes candidates and turns them into chain-bound receipts.
export function shapeReceiptCandidate({
  event_schema = "",
  event_summary = {},
  action_class = "preview",
  prev_receipt_hash = null,
  truth_label_for_action = "NODE0_LOCAL_SEED",
} = {}) {
  const schemaSafe = safeString(event_schema, "");
  const summary = safeObject(event_summary, {});
  const actionClass = ["preview", "execute", "mint", "irreversible"].includes(
    action_class,
  )
    ? action_class
    : "preview";
  const prevHashSafe =
    prev_receipt_hash && typeof prev_receipt_hash === "string"
      ? prev_receipt_hash
      : null;
  const truthLabel = [
    "NODE0_LOCAL_SEED",
    "MEASURED",
    "GATEWAY_ISSUED_HANDOFF",
  ].includes(truth_label_for_action)
    ? truth_label_for_action
    : "NODE0_LOCAL_SEED";

  // Compute candidate hash from canonical content
  const canonicalContent = JSON.stringify({
    event_schema: schemaSafe,
    event_summary_keys: Object.keys(summary).sort(),
    action_class: actionClass,
    truth_label: truthLabel,
    prev_hash: prevHashSafe,
  });
  const candidateHash = sha256Hex(canonicalContent);

  const valid = schemaSafe.length > 0 && Object.keys(summary).length > 0;
  const refusal_reason = !valid
    ? schemaSafe.length === 0
      ? "missing_event_schema · cannot shape candidate without source schema"
      : "empty_event_summary · candidate would have no content"
    : null;

  return Object.freeze({
    schema: RECEIPT_CANDIDATE_SCHEMA,
    truth_label: truthLabel,
    mode: "draft_only",
    drafted_by: PAT6_PERSONA.pat_id,
    drafted_at: new Date().toISOString(),
    candidate_hash: candidateHash,
    source_event_schema: schemaSafe,
    source_event_summary_keys: Object.freeze(Object.keys(summary).sort()),
    action_class: actionClass,
    prev_receipt_hash: prevHashSafe,
    chain_position_inferred: prevHashSafe !== null,
    chain_advance_performed: false,
    receipt_minted: false,
    requires_consent_to_mint: true,
    consent_phrase_for_mint: `GO: mint receipt at ${candidateHash}`,
    valid,
    refusal_reason,
    audit_trail_required: true,
    receipt_shape_ready: valid,
    boundary: buildPreviewBoundary(),
  });
}

// Verify an existing receipt's content hash matches its declared hash.
// Pure function · takes the receipt object · returns verification result.
export function verifyReceiptHash({ receipt = {} } = {}) {
  const r = safeObject(receipt, {});
  const declared = safeString(
    r.receipt_id || r.candidate_hash || r.content_hash,
    "",
  );
  const valid = declared.length === 64; // sha256 hex length

  return Object.freeze({
    schema: "bizra.dema.receipt_hash_verification.v0.1",
    truth_label: "NODE0_LOCAL_SEED",
    mode: "verification",
    declared_hash: declared,
    hash_format_valid: valid,
    verified_against_content: false, // would require recomputing · v0.1 declarative only
    verification_status: valid
      ? "declared_format_ok_content_unverified"
      : "declared_format_invalid",
    audit_trail_required: true,
    boundary: buildPreviewBoundary(),
  });
}

export function buildPATReceiptRecorderSummary(options = {}) {
  const preview = buildPATReceiptRecorderPreview(options);
  return Object.freeze({
    schema: "bizra.dema.pat_receipt_recorder_summary.v0.1",
    truth_label: preview.truth_label,
    mode: "summary",
    source_schema: preview.schema,
    pat_number: preview.persona.pat_number,
    pat_id: preview.persona.pat_id,
    role_name: preview.persona.role_name,
    serves_operator: preview.serves_operator,
    capability_count: preview.persona.primary_capabilities.length,
    refusal_count: preview.persona.primary_refusals.length,
    boundary: preview.boundary,
  });
}

export const PAT_RECEIPT_RECORDER_SCHEMA_NAME = SCHEMA;
export const PAT_RECEIPT_RECORDER_CANDIDATE_SCHEMA_NAME =
  RECEIPT_CANDIDATE_SCHEMA;
export const PAT_RECEIPT_RECORDER_PERSONA = PAT6_PERSONA;
