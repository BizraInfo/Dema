// POI-RECEIPT-DRAFT-1A — unsigned PoI receipt draft preview from eligibility plan.
//
// Structures receipt-plan proof requirements into a local unsigned draft body
// with per-resource evidence slots and global evidence actions. No signing,
// sealing, chain advance, PoI mint, URP submission, upload, or SAT settlement.

import { createHash } from "node:crypto";

import { buildPreviewBoundary } from "./preview-boundary.js";
import {
  POI_RECEIPT_ELIGIBILITY_PLAN_SCHEMA,
  POI_RECEIPT_ELIGIBILITY_PLAN_TRUTH_LABEL,
} from "./poi-receipt-eligibility-plan.js";

export const POI_RECEIPT_DRAFT_SCHEMA = "bizra.dema.poi_receipt_draft.v0.1";
export const POI_RECEIPT_DRAFT_TRUTH_LABEL =
  "POI_RECEIPT_DRAFT_UNSIGNED_PREVIEW_ONLY";

const ARTIFACT_SLOT_NOTES = Object.freeze({
  metadata_boundary_receipt:
    "Attach metadata-only scan boundary receipt when available",
  pat_action_receipt: "Attach PAT action receipt after governed runtime issues",
  content_hash_attestation:
    "Content hash attestation requires explicit consent and content read",
  git_time_span_evidence: "Git span evidence from local repository metadata",
  canon_witness_marker: "Canon witness marker path presence only",
  hardware_benchmark_summary:
    "Hardware benchmark summary not computed in this preview pass",
  sat_independent_review: "SAT independent review remains DESIGNED_NOT_LIVE",
  explicit_typed_consent_record:
    "Exact-string typed GO required before any seal or submission",
});

const WHAT_THIS_PROVES = Object.freeze([
  "Receipt-plan requirements can be structured into an unsigned local draft before any signing or settlement.",
  "Per-resource evidence slots and global proof-gap actions are enumerated without reading file content.",
  "Draft identity is content-addressed over the unsigned body for local review and diffing.",
]);

const WHAT_THIS_DOES_NOT_PROVE = Object.freeze([
  "No signature, seal, chain head advance, PoI mint, URP submission, upload, or wallet access occurred.",
  "Evidence slot payloads are placeholders — not gathered, hashed, or attested in this pass.",
  "Unsigned draft is advisory structure only; not acceptance, not legal or financial advice.",
]);

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
}

function freezeDeep(value) {
  if (!value || typeof value !== "object") return value;
  Object.freeze(value);
  for (const v of Object.values(value)) freezeDeep(v);
  return value;
}

function buildEvidenceSlot(artifactType) {
  return Object.freeze({
    artifact_type: artifactType,
    status: "pending_local_gather",
    payload_ref: null,
    payload_hash: null,
    required_before_seal: true,
    note: ARTIFACT_SLOT_NOTES[artifactType] ?? "Evidence not gathered in preview",
    preview_only: true,
  });
}

function buildResourceDraft(planEntry) {
  if (planEntry.blocked) {
    return Object.freeze({
      resource_id: planEntry.resource_id,
      top_level: planEntry.top_level,
      blocked: true,
      included_in_unsigned_draft: false,
      evidence_slots: Object.freeze([]),
      strengthens_eligibility_to_preview: "none",
      preview_only: true,
    });
  }

  const evidence_slots = freezeDeep(
    (planEntry.proof_artifacts_required ?? []).map(buildEvidenceSlot),
  );

  return Object.freeze({
    resource_id: planEntry.resource_id,
    top_level: planEntry.top_level,
    contribution_class: planEntry.contribution_class,
    shareability_level: planEntry.shareability_level,
    blocked: false,
    included_in_unsigned_draft: evidence_slots.length > 0,
    current_eligibility_band: planEntry.current_eligibility_band,
    strengthens_eligibility_to_preview:
      planEntry.strengthens_eligibility_to_preview,
    requires_explicit_consent: planEntry.requires_explicit_consent === true,
    requires_sat_review: planEntry.requires_sat_review === true,
    evidence_slots,
    preview_only: true,
  });
}

function buildGlobalEvidenceActions(globalProofGaps) {
  return freezeDeep(
    (globalProofGaps ?? []).map((gap) =>
      Object.freeze({
        action_id: `gap:${gap}`,
        gap,
        status: "pending_local_resolution",
        required_before_seal: true,
        preview_only: true,
      }),
    ),
  );
}

function buildUnsignedBody({
  receipt_plan,
  resource_drafts,
  global_evidence_actions,
  lookback_years,
}) {
  return Object.freeze({
    draft_kind: "poi_contribution_receipt_unsigned",
    receipt_plan_report_id: receipt_plan.report_id,
    receipt_plan_schema: receipt_plan.schema,
    lookback_years,
    root: receipt_plan.root,
    resource_drafts,
    global_evidence_actions,
    sat_verification_plan: receipt_plan.sat_verification_plan,
    signature_status: "UNSIGNED",
    seal_status: "NOT_SEALED",
    preview_only: true,
  });
}

function buildBoundary(extra = {}) {
  return freezeDeep({
    ...buildPreviewBoundary(),
    ...extra,
    file_content_read: false,
    network_used: false,
    scanned_root_mutated: false,
    filesystem_write_performed: false,
    token_minted: false,
    wallet_accessed: false,
    urp_submission_performed: false,
    upload_performed: false,
    poi_receipt_minted: false,
    sat_settlement_performed: false,
    signature_emitted: false,
    chain_head_advanced: false,
    economic_action_performed: false,
  });
}

export function buildPoiReceiptDraft({
  receipt_plan,
  lookback_years = 3,
  generated_at_iso = "",
} = {}) {
  const planValid =
    receipt_plan &&
    receipt_plan.schema === POI_RECEIPT_ELIGIBILITY_PLAN_SCHEMA &&
    receipt_plan.truth_label === POI_RECEIPT_ELIGIBILITY_PLAN_TRUTH_LABEL;

  if (!planValid) {
    return freezeDeep({
      schema: POI_RECEIPT_DRAFT_SCHEMA,
      truth_label: POI_RECEIPT_DRAFT_TRUTH_LABEL,
      valid: false,
      error: "invalid_or_missing_receipt_plan",
      generated_at_iso,
      unsigned_body: null,
      draft_id: null,
      draft_hash: null,
      resource_drafts: Object.freeze([]),
      global_evidence_actions: Object.freeze([]),
      what_this_proves: WHAT_THIS_PROVES,
      what_this_does_not_prove: WHAT_THIS_DOES_NOT_PROVE,
      boundary: buildBoundary(),
    });
  }

  const years = receipt_plan.lookback_years ?? lookback_years;
  const resource_drafts = freezeDeep(
    (receipt_plan.resource_receipt_plans ?? [])
      .map(buildResourceDraft)
      .sort((a, b) => a.top_level.localeCompare(b.top_level)),
  );
  const global_evidence_actions = buildGlobalEvidenceActions(
    receipt_plan.global_proof_gaps,
  );

  const unsigned_body = buildUnsignedBody({
    receipt_plan,
    resource_drafts,
    global_evidence_actions,
    lookback_years: years,
  });

  const draft_hash = sha256(stableStringify(unsigned_body));
  const draft_id = `sha256:${draft_hash}`;

  const included = resource_drafts.filter((d) => d.included_in_unsigned_draft);

  return freezeDeep({
    schema: POI_RECEIPT_DRAFT_SCHEMA,
    truth_label: POI_RECEIPT_DRAFT_TRUTH_LABEL,
    valid: receipt_plan.valid === true,
    error: receipt_plan.error ?? null,
    mode: "unsigned_local_structure_only",
    generated_at_iso:
      generated_at_iso || receipt_plan.generated_at_iso || "",
    draft_id,
    draft_hash,
    lookback_years: years,
    root: receipt_plan.root,
    receipt_plan_report_id: receipt_plan.report_id,
    unsigned_body,
    resource_drafts,
    global_evidence_actions,
    summary: Object.freeze({
      total_resources: resource_drafts.length,
      included_in_draft_count: included.length,
      blocked_excluded_count: resource_drafts.filter((d) => d.blocked).length,
      pending_evidence_slots: included.reduce(
        (n, d) => n + d.evidence_slots.length,
        0,
      ),
      global_actions_count: global_evidence_actions.length,
      signature_status: "UNSIGNED",
      seal_status: "NOT_SEALED",
    }),
    what_this_proves: WHAT_THIS_PROVES,
    what_this_does_not_prove: WHAT_THIS_DOES_NOT_PROVE,
    what_remains_not_proven: freezeDeep([
      "signature_or_seal",
      "live_poi_receipt_mint_and_chain",
      "evidence_slot_payload_gathering",
      "sat_settlement_runtime",
      "urp_submission_acceptance",
    ]),
    next_recommended_consent_step:
      "Run dema contribute receipt-seal-preview after unsigned draft review",
    boundary: buildBoundary(receipt_plan.boundary),
  });
}

export function renderPoiReceiptDraft(report) {
  if (!report || report.schema !== POI_RECEIPT_DRAFT_SCHEMA) {
    return "Dema contribute receipt-draft: invalid report";
  }
  const summary = report.summary ?? {};
  const lines = [
    "POI RECEIPT DRAFT · UNSIGNED · PREVIEW ONLY",
    `truth: ${report.truth_label}`,
    `draft_id: ${report.draft_id ?? "n/a"}`,
    `root: ${report.root?.display ?? "unknown"}`,
    `resources in draft: ${summary.included_in_draft_count ?? 0} · blocked excluded: ${summary.blocked_excluded_count ?? 0}`,
    `pending evidence slots: ${summary.pending_evidence_slots ?? 0} · global actions: ${summary.global_actions_count ?? 0}`,
    `signature: ${summary.signature_status ?? "UNSIGNED"} · seal: ${summary.seal_status ?? "NOT_SEALED"}`,
    "Boundary: metadata-first · no content · no network · no sign · no PoI mint · no URP submission · no wallet",
  ];
  return lines.join("\n");
}
