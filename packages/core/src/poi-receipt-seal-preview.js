// POI-RECEIPT-SEAL-PREVIEW-1A — seal readiness preview for unsigned PoI receipt draft.
//
// Evaluates whether an unsigned draft could proceed to seal/sign after explicit
// typed GO. Lists blockers, consent phrase template, and gates — without
// signing, sealing, chain advance, PoI mint, URP submission, or SAT settlement.

import { createHash } from "node:crypto";

import { buildPreviewBoundary } from "./preview-boundary.js";
import {
  POI_RECEIPT_DRAFT_SCHEMA,
  POI_RECEIPT_DRAFT_TRUTH_LABEL,
} from "./poi-receipt-draft.js";

export const POI_RECEIPT_SEAL_PREVIEW_SCHEMA =
  "bizra.dema.poi_receipt_seal_preview.v0.1";
export const POI_RECEIPT_SEAL_PREVIEW_TRUTH_LABEL =
  "POI_RECEIPT_SEAL_PREVIEW_ONLY";

export const POI_RECEIPT_SEAL_CONSENT_TEMPLATE =
  "GO: seal PoI contribution receipt draft {draft_id}";

const WHAT_THIS_PROVES = Object.freeze([
  "Unsigned receipt drafts can be reviewed for seal readiness before any cryptographic action.",
  "Blockers, consent requirements, and future seal gates are enumerated without performing a seal.",
  "Consent phrase template binds to draft_id for exact-string review under §1.",
]);

const WHAT_THIS_DOES_NOT_PROVE = Object.freeze([
  "No signature, seal, chain head advance, PoI mint, URP submission, upload, or wallet access occurred.",
  "Readiness preview does not gather evidence, compute hashes, or clear pending slots.",
  "A ready-for-consent-review status is not permission to seal — explicit typed GO is still required.",
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

function renderConsentPhrase(draftId) {
  return POI_RECEIPT_SEAL_CONSENT_TEMPLATE.replace("{draft_id}", draftId ?? "");
}

function buildSealBlockers(receipt_draft) {
  const blockers = [];
  const summary = receipt_draft.summary ?? {};
  const pendingSlots = summary.pending_evidence_slots ?? 0;
  const globalActions = summary.global_actions_count ?? 0;
  const included = summary.included_in_draft_count ?? 0;

  if (included === 0) {
    blockers.push("no_strengthenable_resources_in_draft");
  }
  if (pendingSlots > 0) {
    blockers.push(`pending_evidence_slots:${pendingSlots}`);
  }
  if (globalActions > 0) {
    blockers.push(`pending_global_actions:${globalActions}`);
  }

  const consentResources = (receipt_draft.resource_drafts ?? []).filter(
    (d) => d.included_in_unsigned_draft && d.requires_explicit_consent,
  );
  if (consentResources.length > 0) {
    blockers.push(`explicit_consent_required:${consentResources.length}`);
  }

  const satResources = (receipt_draft.resource_drafts ?? []).filter(
    (d) => d.included_in_unsigned_draft && d.requires_sat_review,
  );
  if (satResources.length > 0) {
    blockers.push("sat_independent_review_designed_not_live");
  }

  return freezeDeep([...new Set(blockers)].sort());
}

function buildSealGates(receipt_draft) {
  return freezeDeep([
    Object.freeze({
      gate_id: "evidence_slots_gathered",
      status:
        (receipt_draft.summary?.pending_evidence_slots ?? 0) === 0
          ? "would_pass_if_gathered"
          : "blocked_pending_gather",
      preview_only: true,
    }),
    Object.freeze({
      gate_id: "global_proof_gaps_resolved",
      status:
        (receipt_draft.summary?.global_actions_count ?? 0) === 0
          ? "would_pass_if_resolved"
          : "blocked_pending_resolution",
      preview_only: true,
    }),
    Object.freeze({
      gate_id: "explicit_typed_consent",
      status: "required_before_live_seal",
      preview_only: true,
    }),
    Object.freeze({
      gate_id: "identity_binding",
      status: "DESIGNED_NOT_LIVE",
      preview_only: true,
    }),
    Object.freeze({
      gate_id: "proof_spine_guard",
      status: "DESIGNED_NOT_LIVE",
      preview_only: true,
    }),
  ]);
}

function sealReadinessStatus(blockers) {
  if (blockers.length === 0) {
    return "ready_for_consent_review_only";
  }
  if (
    blockers.some(
      (b) =>
        b.startsWith("pending_evidence_slots") ||
        b === "no_strengthenable_resources_in_draft",
    )
  ) {
    return "blocked_pending_evidence";
  }
  if (blockers.some((b) => b.startsWith("explicit_consent_required"))) {
    return "blocked_pending_consent";
  }
  return "blocked_pending_evidence";
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
    seal_performed: false,
    chain_head_advanced: false,
    economic_action_performed: false,
  });
}

export function buildPoiReceiptSealPreview({
  receipt_draft,
  lookback_years = 3,
  generated_at_iso = "",
} = {}) {
  const draftValid =
    receipt_draft &&
    receipt_draft.schema === POI_RECEIPT_DRAFT_SCHEMA &&
    receipt_draft.truth_label === POI_RECEIPT_DRAFT_TRUTH_LABEL;

  if (!draftValid) {
    return freezeDeep({
      schema: POI_RECEIPT_SEAL_PREVIEW_SCHEMA,
      truth_label: POI_RECEIPT_SEAL_PREVIEW_TRUTH_LABEL,
      valid: false,
      error: "invalid_or_missing_receipt_draft",
      generated_at_iso,
      preview_id: null,
      seal_blockers: Object.freeze([]),
      seal_gates: Object.freeze([]),
      consent_phrase_template: POI_RECEIPT_SEAL_CONSENT_TEMPLATE,
      consent_phrase: null,
      what_this_proves: WHAT_THIS_PROVES,
      what_this_does_not_prove: WHAT_THIS_DOES_NOT_PROVE,
      boundary: buildBoundary(),
    });
  }

  const years = receipt_draft.lookback_years ?? lookback_years;
  const seal_blockers = buildSealBlockers(receipt_draft);
  const seal_gates = buildSealGates(receipt_draft);
  const seal_readiness = sealReadinessStatus(seal_blockers);
  const consent_phrase = renderConsentPhrase(receipt_draft.draft_id);

  const preview_id = `sha256:${sha256(
    stableStringify({
      draft_id: receipt_draft.draft_id,
      seal_readiness,
      blockers: seal_blockers,
      lookback_years: years,
    }),
  )}`;

  return freezeDeep({
    schema: POI_RECEIPT_SEAL_PREVIEW_SCHEMA,
    truth_label: POI_RECEIPT_SEAL_PREVIEW_TRUTH_LABEL,
    valid: receipt_draft.valid === true,
    error: receipt_draft.error ?? null,
    mode: "seal_readiness_preview_only",
    generated_at_iso:
      generated_at_iso || receipt_draft.generated_at_iso || "",
    preview_id,
    lookback_years: years,
    root: receipt_draft.root,
    draft_id: receipt_draft.draft_id,
    draft_hash: receipt_draft.draft_hash,
    seal_readiness,
    seal_performed: false,
    signature_status: "UNSIGNED",
    seal_status: "NOT_SEALED",
    seal_blockers,
    seal_gates,
    consent_phrase_template: POI_RECEIPT_SEAL_CONSENT_TEMPLATE,
    consent_phrase,
    summary: Object.freeze({
      included_resources: receipt_draft.summary?.included_in_draft_count ?? 0,
      pending_evidence_slots: receipt_draft.summary?.pending_evidence_slots ?? 0,
      global_actions_count: receipt_draft.summary?.global_actions_count ?? 0,
      blocker_count: seal_blockers.length,
      may_review_consent_phrase: seal_readiness !== "blocked_pending_evidence",
    }),
    what_this_proves: WHAT_THIS_PROVES,
    what_this_does_not_prove: WHAT_THIS_DOES_NOT_PROVE,
    what_remains_not_proven: freezeDeep([
      "live_signature_or_seal",
      "evidence_slot_payload_gathering",
      "chain_head_advance",
      "poi_receipt_mint",
      "urp_submission_acceptance",
      "sat_settlement_runtime",
    ]),
    next_recommended_consent_step:
      "No seal performed — resolve blockers locally; sealing requires exact consent phrase after §1 review",
    boundary: buildBoundary(receipt_draft.boundary),
  });
}

export function renderPoiReceiptSealPreview(report) {
  if (!report || report.schema !== POI_RECEIPT_SEAL_PREVIEW_SCHEMA) {
    return "Dema contribute receipt-seal-preview: invalid report";
  }
  const summary = report.summary ?? {};
  const lines = [
    "POI RECEIPT SEAL PREVIEW · NOT SEALED",
    `truth: ${report.truth_label}`,
    `draft_id: ${report.draft_id ?? "n/a"}`,
    `readiness: ${report.seal_readiness ?? "unknown"}`,
    `blockers: ${summary.blocker_count ?? 0}`,
    `pending evidence slots: ${summary.pending_evidence_slots ?? 0}`,
    `consent phrase (preview): ${report.consent_phrase ?? "n/a"}`,
    "Boundary: metadata-first · no content · no network · no seal · no sign · no PoI mint · no URP submission",
  ];
  return lines.join("\n");
}
