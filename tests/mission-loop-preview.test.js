import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildMissionLoopPreview,
  MISSION_LOOP_LIFECYCLE_PHASES
} from "../packages/core/src/mission-loop-preview.js";

const REQUIRED_BOUNDARY_FALSE_KEYS = [
  "filesystem_write_performed",
  "network_used",
  "runtime_execution",
  "local_model_invoked",
  "federation_invoked",
  "canonical_minting",
  "chain_head_advanced",
  "receipt_minted",
  "public_network",
  "raw_data_included"
];

function assertExhaustiveFalseBoundary(boundary) {
  for (const key of REQUIRED_BOUNDARY_FALSE_KEYS) {
    assert.equal(boundary[key], false, `boundary.${key} must be false`);
  }
}

test("MissionLoop emits canonical schema + truth label + HOLD verdict", () => {
  const loop = buildMissionLoopPreview();
  assert.equal(loop.schema, "bizra.dema.mission_loop_preview.v0.1");
  assert.equal(loop.truth_label, "NODE0_LOCAL_SEED");
  assert.equal(loop.mode, "preview_only");
  assert.equal(loop.preview_lifecycle_status, "HOLD");
});

test("MissionLoop default phase with no inputs is 'ready'", () => {
  const loop = buildMissionLoopPreview();
  assert.equal(loop.lifecycle_phase, "ready");
  assert.equal(loop.next_safe_action, "provide_mission_intent");
});

test("MissionLoop transitions to 'needs_pat_proposal' with mission but no proposal", () => {
  const loop = buildMissionLoopPreview({
    mission: { missionId: "m-001", intent: "test intent" }
  });
  assert.equal(loop.lifecycle_phase, "needs_pat_proposal");
  assert.equal(loop.next_safe_action, "draft_pat_proposal_preview");
});

test("MissionLoop transitions to 'awaiting_consent' with mission + proposal but no decision", () => {
  const loop = buildMissionLoopPreview({
    mission: { missionId: "m-001", intent: "test intent" },
    patProposal: { summary: "draft a thing", steps: [1, 2] }
  });
  assert.equal(loop.lifecycle_phase, "awaiting_consent");
  assert.equal(loop.next_safe_action, "review_consent_card");
});

test("MissionLoop transitions to 'complete_preview_declined' on decline", () => {
  const loop = buildMissionLoopPreview({
    mission: { missionId: "m-001", intent: "x" },
    patProposal: { summary: "x" },
    consentDecision: "decline"
  });
  assert.equal(loop.lifecycle_phase, "complete_preview_declined");
  assert.equal(loop.next_safe_action, "decline_recorded_choose_new_mission");
});

test("MissionLoop transitions to 'narrowing_scope' on narrow_scope", () => {
  const loop = buildMissionLoopPreview({
    mission: { missionId: "m-001", intent: "x" },
    patProposal: { summary: "x" },
    consentDecision: "narrow_scope"
  });
  assert.equal(loop.lifecycle_phase, "narrowing_scope");
  assert.equal(loop.next_safe_action, "redraft_pat_proposal_with_narrower_scope");
});

test("MissionLoop transitions to 'complete_preview_approved' on approve_c2_draft_only — but HOLD verdict pinned", () => {
  const loop = buildMissionLoopPreview({
    mission: { missionId: "m-001", intent: "x" },
    patProposal: { summary: "x" },
    consentDecision: "approve_c2_draft_only"
  });
  assert.equal(loop.lifecycle_phase, "complete_preview_approved");
  assert.equal(loop.next_safe_action, "preview_complete_typed_go_required_for_any_execution");
  assert.equal(loop.preview_lifecycle_status, "HOLD",
    "Even on approval, verdict MUST stay HOLD in preview-only mode");
});

test("MissionLoop INVARIANT: preview_lifecycle_status is HOLD across ALL phases", () => {
  for (const decision of [null, "decline", "narrow_scope", "approve_c2_draft_only"]) {
    const loop = buildMissionLoopPreview({
      mission: { missionId: "m-001", intent: "x" },
      patProposal: { summary: "x" },
      consentDecision: decision
    });
    assert.equal(loop.preview_lifecycle_status, "HOLD",
      `verdict must stay HOLD for decision=${decision}`);
  }
});

test("MissionLoop composes the 3 primitives: state_load + profile_foundation + consent_card", () => {
  const loop = buildMissionLoopPreview();
  assert.equal(loop.state_load.schema, "bizra.dema.node0_state.v0.1");
  assert.equal(loop.profile_foundation.schema, "bizra.dema.profile_foundation.v0.1");
  assert.equal(loop.consent_card.schema, "bizra.dema.consent_card_preview.v0.1");
});

test("MissionLoop INVARIANT: local_model_invocation always has routing_allowed=false", () => {
  for (const decision of [null, "decline", "narrow_scope", "approve_c2_draft_only"]) {
    const loop = buildMissionLoopPreview({
      mission: { missionId: "m-001", intent: "x" },
      patProposal: { summary: "x" },
      consentDecision: decision
    });
    assert.equal(loop.local_model_invocation.routing_allowed, false);
    assert.equal(loop.local_model_invocation.invocation_status, "not_executed_preview_only");
    assert.equal(loop.local_model_invocation.output, null);
  }
});

test("MissionLoop INVARIANT: evidence_chain_event.chain_advance=false in all phases", () => {
  for (const decision of [null, "decline", "narrow_scope", "approve_c2_draft_only"]) {
    const loop = buildMissionLoopPreview({
      mission: { missionId: "m-001", intent: "x" },
      patProposal: { summary: "x" },
      consentDecision: decision
    });
    assert.equal(loop.evidence_chain_event.chain_advance, false,
      `chain_advance must be false for decision=${decision}`);
  }
});

test("MissionLoop INVARIANT: receipt_preview.chain_advance=false in all phases", () => {
  for (const decision of [null, "decline", "narrow_scope", "approve_c2_draft_only"]) {
    const loop = buildMissionLoopPreview({
      mission: { missionId: "m-001", intent: "x" },
      patProposal: { summary: "x" },
      consentDecision: decision
    });
    assert.equal(loop.receipt_preview.chain_advance, false);
  }
});

test("MissionLoop evidence_chain_event prepared only on approved completion", () => {
  const incomplete = buildMissionLoopPreview({ mission: { missionId: "m-001" } });
  assert.equal(incomplete.evidence_chain_event.status, "not_prepared");
  assert.equal(incomplete.evidence_chain_event.schema, null);

  const approved = buildMissionLoopPreview({
    mission: { missionId: "m-001", intent: "x" },
    patProposal: { summary: "x" },
    consentDecision: "approve_c2_draft_only"
  });
  assert.equal(approved.evidence_chain_event.status, "prepared_preview_only");
  assert.equal(approved.evidence_chain_event.schema, "bizra.dema.evidence_chain_event.preview.v0.1");
  assert.equal(approved.evidence_chain_event.chain_advance, false);
});

test("MissionLoop receipt_preview prepared only on approved completion", () => {
  const incomplete = buildMissionLoopPreview({ mission: { missionId: "m-001" } });
  assert.equal(incomplete.receipt_preview.status, "not_prepared");

  const approved = buildMissionLoopPreview({
    mission: { missionId: "m-001", intent: "x" },
    patProposal: { summary: "x" },
    consentDecision: "approve_c2_draft_only"
  });
  assert.equal(approved.receipt_preview.status, "prepared_preview_only");
  assert.equal(approved.receipt_preview.schema, "bizra.dema.mission_loop_receipt.preview.v0.1");
  assert.equal(approved.receipt_preview.chain_advance, false);
});

test("MissionLoop ADVERSARIAL: evidence_refs raw payload is stripped via consent-card view", () => {
  const loop = buildMissionLoopPreview({
    mission: { missionId: "m-001", intent: "x" },
    patProposal: { summary: "x" },
    consentDecision: "approve_c2_draft_only",
    evidenceRefs: [
      { id: "ev-001", schema: "bizra.dema.evidence.v0.1",
        content: "RAW_PAYLOAD_THAT_SHOULD_NOT_LEAK",
        secret: "ALSO_NOT_LEAK" }
    ]
  });
  // evidence_chain_event references must be selective {id, schema} only
  assert.equal(loop.evidence_chain_event.referenced_evidence.length, 1);
  assert.equal(loop.evidence_chain_event.referenced_evidence[0].id, "ev-001");
  assert.equal(loop.evidence_chain_event.referenced_evidence[0].schema, "bizra.dema.evidence.v0.1");
  assert.equal("content" in loop.evidence_chain_event.referenced_evidence[0], false);
  assert.equal("secret" in loop.evidence_chain_event.referenced_evidence[0], false);
});

test("MissionLoop ADVERSARIAL: consent card's required blocked effects are preserved through composition", () => {
  const loop = buildMissionLoopPreview({
    mission: { missionId: "m-001", intent: "x" },
    patProposal: { summary: "x" }
  });
  const blocked = loop.consent_card.blocked_effects;
  for (const required of ["runtime_execution", "federation_invocation", "canonical_minting", "public_network"]) {
    assert.ok(blocked.includes(required),
      `consent_card.blocked_effects must include ${required} after composition`);
  }
});

test("MissionLoop ADVERSARIAL: caller cannot inject unknown consent decision", () => {
  // Unknown decision falls through to default (awaiting_consent) — never auto-approve
  const loop = buildMissionLoopPreview({
    mission: { missionId: "m-001", intent: "x" },
    patProposal: { summary: "x" },
    consentDecision: "MAGIC_BYPASS_APPROVE_ALL_EFFECTS"
  });
  assert.equal(loop.lifecycle_phase, "awaiting_consent",
    "unknown consent decisions must NOT shortcut to approved");
  assert.equal(loop.preview_lifecycle_status, "HOLD");
});

test("MissionLoop ADVERSARIAL: mission intent body is stripped from consent_card.mission view", () => {
  const loop = buildMissionLoopPreview({
    mission: {
      missionId: "m-001",
      intent: "SENSITIVE_INTENT_BODY_SHOULD_NOT_LEAK_TO_CONSENT_CARD"
    },
    patProposal: { summary: "x" }
  });
  // ConsentCard's mission view is selective — no raw intent
  assert.equal("intent" in loop.consent_card.mission, false,
    "consent_card.mission view must not echo raw mission intent");
});

test("MissionLoop boundary is exhaustively false and frozen", () => {
  const loop = buildMissionLoopPreview();
  assertExhaustiveFalseBoundary(loop.boundary);
  assert.equal(Object.isFrozen(loop.boundary), true);
});

test("MissionLoop is deeply frozen across all sub-views", () => {
  const loop = buildMissionLoopPreview({
    mission: { missionId: "m-001", intent: "x" },
    patProposal: { summary: "x", steps: [1, 2] },
    consentDecision: "approve_c2_draft_only",
    evidenceRefs: [{ id: "ev-x", schema: "bizra.dema.evidence.v0.1" }]
  });
  assert.equal(Object.isFrozen(loop), true);
  assert.equal(Object.isFrozen(loop.state_load), true);
  assert.equal(Object.isFrozen(loop.profile_foundation), true);
  assert.equal(Object.isFrozen(loop.consent_card), true);
  assert.equal(Object.isFrozen(loop.local_model_invocation), true);
  assert.equal(Object.isFrozen(loop.evidence_chain_event), true);
  assert.equal(Object.isFrozen(loop.evidence_chain_event.referenced_evidence), true);
  assert.equal(Object.isFrozen(loop.receipt_preview), true);
  assert.equal(Object.isFrozen(loop.boundary), true);
});

test("MissionLoop operator override propagates through state and profiles", () => {
  const loop = buildMissionLoopPreview({ operator: "TestPilot" });
  assert.equal(loop.state_load.operator, "TestPilot");
  assert.equal(loop.profile_foundation.user.identity.name, "TestPilot");
});

test("MissionLoop lifecycle phase always one of the canonical 6", () => {
  for (const phase of MISSION_LOOP_LIFECYCLE_PHASES) {
    assert.ok(typeof phase === "string", "canonical phase must be string");
  }
  assert.equal(MISSION_LOOP_LIFECYCLE_PHASES.length, 6);
  // Drift check: every phase derivable
  const phasesObserved = new Set();
  phasesObserved.add(buildMissionLoopPreview().lifecycle_phase);
  phasesObserved.add(buildMissionLoopPreview({ mission: { missionId: "m" } }).lifecycle_phase);
  phasesObserved.add(buildMissionLoopPreview({ mission: { missionId: "m" }, patProposal: { summary: "x" } }).lifecycle_phase);
  phasesObserved.add(buildMissionLoopPreview({ mission: { missionId: "m" }, patProposal: { summary: "x" }, consentDecision: "decline" }).lifecycle_phase);
  phasesObserved.add(buildMissionLoopPreview({ mission: { missionId: "m" }, patProposal: { summary: "x" }, consentDecision: "narrow_scope" }).lifecycle_phase);
  phasesObserved.add(buildMissionLoopPreview({ mission: { missionId: "m" }, patProposal: { summary: "x" }, consentDecision: "approve_c2_draft_only" }).lifecycle_phase);
  assert.equal(phasesObserved.size, 6, "all 6 canonical phases must be reachable");
});

test("MissionLoop composition preserves all embedded boundary booleans (none flipped to true)", () => {
  const loop = buildMissionLoopPreview({
    mission: { missionId: "m-001", intent: "x" },
    patProposal: { summary: "x" },
    consentDecision: "approve_c2_draft_only"
  });
  // state_load boundary
  for (const k of Object.keys(loop.state_load.boundary)) {
    assert.equal(loop.state_load.boundary[k], false, `state_load.boundary.${k} flipped`);
  }
  // profile_foundation boundary
  for (const k of Object.keys(loop.profile_foundation.boundary)) {
    assert.equal(loop.profile_foundation.boundary[k], false, `profile_foundation.boundary.${k} flipped`);
  }
  // consent_card boundary
  for (const k of Object.keys(loop.consent_card.boundary)) {
    assert.equal(loop.consent_card.boundary[k], false, `consent_card.boundary.${k} flipped`);
  }
});
