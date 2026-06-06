// EvidenceChain Event Preview — `dema evidence-event` first slice.
//
// Analogical model: a flight data recorder draft. It describes what *would*
// be filed in the official record if a typed GO authorized chain advance.
// The event is *prepared*, never *recorded*. The chain head does not move.
// Receipts are not minted. The function is pure and deterministic.
//
// This module is the proof-instrumentation layer between the mission loop
// (lifecycle) and the future runtime (chain advance + canonical mint). It
// closes the gap that would otherwise let model output enter the loop
// without structured evidence.
//
// Composition input: a mission_loop_preview snapshot (from mission-loop-
// preview.js). Output: a schema-tagged, deep-frozen, boundary-pinned event
// preview whose status is one of:
//   - "not_prepared"            mission loop is not in approved-preview phase
//   - "prepared_not_recorded"   approved-preview reached; event structure
//                               exists but is NOT on chain
// The status "recorded" is intentionally absent from this module — that
// state only emerges from authorized chain advance, which is out of scope
// for any preview.
//
// Operating law applied: Evidence before model output.

import { buildMissionLoopPreview } from "./mission-loop-preview.js";
import { buildPreviewBoundary } from "./preview-boundary.js";

const EVENT_STATUS_VALUES = Object.freeze([
  "not_prepared",
  "prepared_not_recorded",
]);

const REQUIRED_BLOCKED_EFFECTS = Object.freeze([
  "runtime_execution",
  "federation_invocation",
  "canonical_minting",
  "node1_connection",
  "node2_connection",
  "raw_data_scan",
  "public_network",
]);

function buildBoundary() {
  return buildPreviewBoundary();
}

function isApprovedPreview(missionLoopPreview) {
  if (!missionLoopPreview || typeof missionLoopPreview !== "object")
    return false;
  if (missionLoopPreview.schema !== "bizra.dema.mission_loop_preview.v0.1")
    return false;
  return missionLoopPreview.lifecycle_phase === "complete_preview_approved";
}

function selectEvidenceRefs(refs) {
  if (!Array.isArray(refs)) return Object.freeze([]);
  return Object.freeze(
    refs.map((ref) =>
      Object.freeze({
        id: ref?.id ?? null,
        schema: ref?.schema ?? null,
        content_hash: null,
      }),
    ),
  );
}

function buildNotPreparedEvent() {
  return Object.freeze({
    schema: "bizra.dema.evidence_chain_event_preview.v0.1",
    truth_label: "NODE0_LOCAL_SEED",
    mode: "preview_only",
    event_status: "not_prepared",
    source: "mission_loop_preview",
    mission_id: null,
    consent_decision: null,
    blocked_effects: REQUIRED_BLOCKED_EFFECTS,
    payload_policy: Object.freeze({
      raw_payload_included: false,
      hash_only: true,
    }),
    evidence_refs: Object.freeze([]),
    chain_advance: false,
    receipt_mint: false,
    next_safe_action: "advance_mission_loop_to_approved_preview",
    boundary: buildBoundary(),
  });
}

export function buildEvidenceChainEventPreview({
  missionLoopPreview = null,
  evidenceRefs = [],
} = {}) {
  if (!isApprovedPreview(missionLoopPreview)) {
    return buildNotPreparedEvent();
  }

  const consentCard = missionLoopPreview.consent_card;
  const missionId = consentCard?.mission?.missionId ?? null;
  const consentDecision = missionLoopPreview.consent_decision_recorded ?? null;

  // Compose blocked_effects = union(REQUIRED, consent_card.blocked_effects)
  const merged = [...REQUIRED_BLOCKED_EFFECTS];
  if (Array.isArray(consentCard?.blocked_effects)) {
    for (const effect of consentCard.blocked_effects) {
      if (typeof effect === "string" && !merged.includes(effect)) {
        merged.push(effect);
      }
    }
  }

  return Object.freeze({
    schema: "bizra.dema.evidence_chain_event_preview.v0.1",
    truth_label: "NODE0_LOCAL_SEED",
    mode: "preview_only",
    event_status: "prepared_not_recorded",
    source: "mission_loop_preview",
    mission_id: missionId,
    consent_decision: consentDecision,
    blocked_effects: Object.freeze(merged),
    payload_policy: Object.freeze({
      raw_payload_included: false,
      hash_only: true,
    }),
    evidence_refs: selectEvidenceRefs(evidenceRefs),
    chain_advance: false,
    receipt_mint: false,
    next_safe_action: "review_evidence_event_preview",
    boundary: buildBoundary(),
  });
}

// Convenience: build the event directly from mission inputs (no caller-
// supplied snapshot). Used by `dema evidence-event` CLI to demonstrate
// the typical flow.
export function buildEvidenceChainEventPreviewFromInputs(inputs = {}) {
  const loop = buildMissionLoopPreview({
    operator: inputs.operator,
    mission: inputs.mission,
    patProposal: inputs.patProposal,
    satVerdictReason: inputs.satVerdictReason,
    consentDecision: inputs.consentDecision,
    evidenceRefs: inputs.evidenceRefs,
  });
  return buildEvidenceChainEventPreview({
    missionLoopPreview: loop,
    evidenceRefs: inputs.evidenceRefs ?? [],
  });
}

export const EVIDENCE_CHAIN_EVENT_STATUS_VALUES = EVENT_STATUS_VALUES;
export const EVIDENCE_CHAIN_EVENT_REQUIRED_BLOCKED_EFFECTS =
  REQUIRED_BLOCKED_EFFECTS;
