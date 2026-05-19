// Consent Card Preview — `dema consent-card` first slice.
//
// The consent card is the visible cockpit surface where the operator sees
// exactly what is about to happen, what is allowed, what is blocked, and is
// asked for finger-on-button consent before any effect crosses the boundary.
//
// Truth-safe: emits a deep-frozen, schema-tagged composite of mission,
// PAT proposal, SAT-style verdict, allowed/blocked effects, decision options,
// receipt preview status, and a non-overrideable safety floor.
//
// Adversarial-safe by construction:
//   - REQUIRED_BLOCKED_EFFECTS is a fixed constant; callers can ADD to the
//     blocked list via additionalBlockedEffects but cannot remove any item.
//   - allowedEffects are filtered to strip any item present in
//     REQUIRED_BLOCKED_EFFECTS — runtime/federation/mint cannot be smuggled
//     into the allowed list.
//   - canonical_mint and federation are pinned false regardless of input.
//   - All sub-views are selective (no raw mission intent body; no raw PAT
//     proposal payload; no raw evidence content).
//
// Operating law applied:
//   State tells where you are.
//   Profiles tell who can act.
//   Consent Card tells what is allowed next.

const REQUIRED_BLOCKED_EFFECTS = Object.freeze([
  "runtime_execution",
  "federation_invocation",
  "canonical_minting",
  "node1_connection",
  "node2_connection",
  "raw_data_scan",
  "public_network"
]);

const DECISION_OPTIONS = Object.freeze([
  "approve_c2_draft_only",
  "narrow_scope",
  "decline"
]);

const REQUIRED_BLOCKED_SET = new Set(REQUIRED_BLOCKED_EFFECTS);

import { buildPreviewBoundary } from "./preview-boundary.js";

function buildBoundary() {
  return buildPreviewBoundary();
}

function selectMissionView(mission) {
  if (!mission || typeof mission !== "object") {
    return Object.freeze({
      provided: false,
      missionId: null,
      status: "unset_preview",
      center: "user_mission"
    });
  }
  return Object.freeze({
    provided: true,
    missionId: mission.missionId ?? null,
    status: mission.status ?? "draft_preview",
    center: mission.center ?? "user_mission"
  });
}

function selectPATProposalView(proposal) {
  if (proposal === null || proposal === undefined) {
    return Object.freeze({
      provided: false,
      summary: null,
      step_count: null
    });
  }
  if (typeof proposal === "string") {
    return Object.freeze({
      provided: true,
      summary: proposal.length > 240 ? `${proposal.slice(0, 237)}...` : proposal,
      step_count: null
    });
  }
  return Object.freeze({
    provided: true,
    summary: typeof proposal.summary === "string"
      ? (proposal.summary.length > 240 ? `${proposal.summary.slice(0, 237)}...` : proposal.summary)
      : null,
    step_count: typeof proposal.steps?.length === "number" ? proposal.steps.length : null
  });
}

function selectSATVerdictView(verdict) {
  if (!verdict || typeof verdict !== "object") {
    return Object.freeze({
      status: "policy_preview",
      reason: null,
      authority: "policy_preview_until_shared_urp_runtime_proven"
    });
  }
  return Object.freeze({
    status: "policy_preview",
    reason: typeof verdict.reason === "string" ? verdict.reason : null,
    authority: "policy_preview_until_shared_urp_runtime_proven"
  });
}

function sanitizeAllowedEffects(allowedEffects) {
  if (!Array.isArray(allowedEffects)) {
    return Object.freeze(["draft_preview"]);
  }
  const filtered = [];
  for (const effect of allowedEffects) {
    if (typeof effect !== "string") continue;
    if (REQUIRED_BLOCKED_SET.has(effect)) continue;
    if (!filtered.includes(effect)) filtered.push(effect);
  }
  if (filtered.length === 0) filtered.push("draft_preview");
  return Object.freeze(filtered);
}

function composeBlockedEffects(additional) {
  const merged = [...REQUIRED_BLOCKED_EFFECTS];
  if (Array.isArray(additional)) {
    for (const effect of additional) {
      if (typeof effect !== "string") continue;
      if (!merged.includes(effect)) merged.push(effect);
    }
  }
  return Object.freeze(merged);
}

export function buildConsentCardPreview({
  mission = null,
  patProposal = null,
  satVerdict = null,
  allowedEffects = ["draft_preview"],
  additionalBlockedEffects = []
} = {}) {
  return Object.freeze({
    schema: "bizra.dema.consent_card_preview.v0.1",
    truth_label: "NODE0_LOCAL_SEED",
    mode: "preview_only",
    mission: selectMissionView(mission),
    mission_center: "user_mission",
    pat_proposal: selectPATProposalView(patProposal),
    sat_verdict: selectSATVerdictView(satVerdict),
    allowed_effects: sanitizeAllowedEffects(allowedEffects),
    blocked_effects: composeBlockedEffects(additionalBlockedEffects),
    required_consent: Object.freeze({
      required: true,
      phrase: null,
      phrase_status: "not_yet_generated_preview_only",
      match_rule: "exact_string"
    }),
    receipt_preview: Object.freeze({
      status: "not_minted",
      schema: null
    }),
    decision_options: DECISION_OPTIONS,
    canonical_mint: false,
    human_consent_required: true,
    boundary: buildBoundary()
  });
}

export const CONSENT_CARD_REQUIRED_BLOCKED_EFFECTS = REQUIRED_BLOCKED_EFFECTS;
export const CONSENT_CARD_DECISION_OPTIONS = DECISION_OPTIONS;
