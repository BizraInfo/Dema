// Mission Loop Preview — `dema mission-loop` first slice.
//
// Analogical model: a flight plan flown in a simulator. The pilot files the
// plan (intent), the planning computer drafts the route (PAT proposal), the
// tower previews permission (SAT-style verdict), the pilot acknowledges
// restrictions (consent card), the simulator runs the route (local model
// invocation — placeholder, never executed in preview), the instruments log
// the simulated flight (EvidenceChain event preview), the flight log is
// archived (receipt preview), and the tower issues the next direction
// (next_safe_action). No actual aircraft moves.
//
// This module is PURE COMPOSITION: it imports the three existing primitives
// (state, profiles, consent-card) and packs them with three new lifecycle
// fields (local_model_invocation, evidence_chain_event, receipt_preview)
// into a single snapshot view of the entire local mission lifecycle.
//
// preview_lifecycle_status is pinned to "HOLD" regardless of inputs. The
// consent decision changes lifecycle_phase and next_safe_action but never
// unlocks execution. Actual execution would require typed-GO + chain
// advance, both of which remain entirely outside this preview.

import { buildNode0StatePreview } from "./state.js";
import { buildProfileFoundationPreview } from "./profiles.js";
import { buildConsentCardPreview } from "./consent-card-preview.js";
import { buildPreviewBoundary } from "./preview-boundary.js";

const LIFECYCLE_PHASES = Object.freeze([
  "ready",
  "needs_pat_proposal",
  "awaiting_consent",
  "narrowing_scope",
  "complete_preview_declined",
  "complete_preview_approved"
]);

function deriveLifecyclePhase({ mission, patProposal, consentDecision }) {
  const hasIntent = Boolean(mission?.intent || mission?.missionId);
  if (!hasIntent) return "ready";
  const hasProposal = patProposal !== null && patProposal !== undefined;
  if (!hasProposal) return "needs_pat_proposal";
  if (consentDecision === "decline") return "complete_preview_declined";
  if (consentDecision === "narrow_scope") return "narrowing_scope";
  if (consentDecision === "approve_c2_draft_only") return "complete_preview_approved";
  return "awaiting_consent";
}

function deriveNextSafeAction(phase) {
  switch (phase) {
    case "ready": return "provide_mission_intent";
    case "needs_pat_proposal": return "draft_pat_proposal_preview";
    case "awaiting_consent": return "review_consent_card";
    case "narrowing_scope": return "redraft_pat_proposal_with_narrower_scope";
    case "complete_preview_declined": return "decline_recorded_choose_new_mission";
    case "complete_preview_approved": return "preview_complete_typed_go_required_for_any_execution";
    default: return "hold";
  }
}

function buildLocalModelInvocationView(phase) {
  return Object.freeze({
    role: "bounded_supporting_resource",
    invocation_status: "not_executed_preview_only",
    routing_allowed: false,
    output: null,
    output_truth_label: null,
    output_schema: null,
    output_invocation_recorded_in: phase === "complete_preview_approved"
      ? "would_be_evidence_chain_event_if_typed_go"
      : "not_applicable"
  });
}

function buildEvidenceChainEventView(phase, evidenceRefs) {
  if (phase !== "complete_preview_approved") {
    return Object.freeze({
      event_id: null,
      event_type: null,
      schema: null,
      chain_advance: false,
      status: "not_prepared",
      referenced_evidence: Object.freeze([])
    });
  }
  const safeRefs = Array.isArray(evidenceRefs)
    ? evidenceRefs.map((ref) => Object.freeze({
        id: ref?.id ?? null,
        schema: ref?.schema ?? null
      }))
    : [];
  return Object.freeze({
    event_id: null,
    event_type: "mission_loop_preview_complete",
    schema: "bizra.dema.evidence_chain_event.preview.v0.1",
    chain_advance: false,
    status: "prepared_preview_only",
    referenced_evidence: Object.freeze(safeRefs)
  });
}

function buildReceiptPreviewView(phase) {
  if (phase !== "complete_preview_approved") {
    return Object.freeze({
      status: "not_prepared",
      schema: null,
      chain_advance: false,
      receipt_id: null
    });
  }
  return Object.freeze({
    status: "prepared_preview_only",
    schema: "bizra.dema.mission_loop_receipt.preview.v0.1",
    chain_advance: false,
    receipt_id: null
  });
}

function buildBoundary() {
  return buildPreviewBoundary();
}

export function buildMissionLoopPreview({
  operator = "MoMo",
  mission = null,
  patProposal = null,
  satVerdictReason = null,
  consentDecision = null,
  evidenceRefs = []
} = {}) {
  const phase = deriveLifecyclePhase({ mission, patProposal, consentDecision });
  const stateLoad = buildNode0StatePreview({ operator });
  const profileFoundation = buildProfileFoundationPreview({
    operator,
    missionId: mission?.missionId ?? null,
    intent: mission?.intent ?? null,
    evidenceRefs
  });
  const consentCard = buildConsentCardPreview({
    mission,
    patProposal,
    satVerdict: satVerdictReason ? { reason: satVerdictReason } : null,
    allowedEffects: ["draft_preview"]
  });

  return Object.freeze({
    schema: "bizra.dema.mission_loop_preview.v0.1",
    truth_label: "NODE0_LOCAL_SEED",
    mode: "preview_only",
    preview_lifecycle_status: "HOLD",
    lifecycle_phase: phase,
    state_load: stateLoad,
    profile_foundation: profileFoundation,
    consent_card: consentCard,
    local_model_invocation: buildLocalModelInvocationView(phase),
    evidence_chain_event: buildEvidenceChainEventView(phase, evidenceRefs),
    receipt_preview: buildReceiptPreviewView(phase),
    next_safe_action: deriveNextSafeAction(phase),
    consent_decision_recorded: consentDecision ?? null,
    boundary: buildBoundary()
  });
}

export const MISSION_LOOP_LIFECYCLE_PHASES = LIFECYCLE_PHASES;
