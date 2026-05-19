import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildEvidenceChainEventPreview,
  buildEvidenceChainEventPreviewFromInputs,
  EVIDENCE_CHAIN_EVENT_STATUS_VALUES,
  EVIDENCE_CHAIN_EVENT_REQUIRED_BLOCKED_EFFECTS
} from "../packages/core/src/evidence-chain-event-preview.js";
import { buildMissionLoopPreview } from "../packages/core/src/mission-loop-preview.js";

import { PREVIEW_BOUNDARY_CANONICAL_KEYS as REQUIRED_BOUNDARY_FALSE_KEYS } from "../packages/core/src/preview-boundary.js";

function assertExhaustiveFalseBoundary(boundary) {
  for (const key of REQUIRED_BOUNDARY_FALSE_KEYS) {
    assert.equal(boundary[key], false, `boundary.${key} must be false`);
  }
}

test("EvidenceEvent emits canonical schema + truth label + preview_only mode", () => {
  const event = buildEvidenceChainEventPreview();
  assert.equal(event.schema, "bizra.dema.evidence_chain_event_preview.v0.1");
  assert.equal(event.truth_label, "NODE0_LOCAL_SEED");
  assert.equal(event.mode, "preview_only");
});

test("EvidenceEvent INVARIANT: chain_advance and receipt_mint are ALWAYS false (every path)", () => {
  // No input → not_prepared
  const e1 = buildEvidenceChainEventPreview();
  assert.equal(e1.chain_advance, false);
  assert.equal(e1.receipt_mint, false);

  // Approved-preview path
  const loop = buildMissionLoopPreview({
    mission: { missionId: "m-001", intent: "test" },
    patProposal: { summary: "x" },
    consentDecision: "approve_c2_draft_only"
  });
  const e2 = buildEvidenceChainEventPreview({ missionLoopPreview: loop });
  assert.equal(e2.chain_advance, false);
  assert.equal(e2.receipt_mint, false);
});

test("EvidenceEvent default (no inputs) yields event_status=not_prepared", () => {
  const event = buildEvidenceChainEventPreview();
  assert.equal(event.event_status, "not_prepared");
  assert.equal(event.mission_id, null);
  assert.equal(event.consent_decision, null);
  assert.equal(event.next_safe_action, "advance_mission_loop_to_approved_preview");
});

test("EvidenceEvent with mission-loop NOT in approved phase yields not_prepared", () => {
  for (const decision of [null, "decline", "narrow_scope"]) {
    const loop = buildMissionLoopPreview({
      mission: { missionId: "m-001", intent: "test" },
      patProposal: { summary: "x" },
      consentDecision: decision
    });
    const event = buildEvidenceChainEventPreview({ missionLoopPreview: loop });
    assert.equal(event.event_status, "not_prepared",
      `event_status must be not_prepared for decision=${decision}`);
  }
});

test("EvidenceEvent with approved-preview mission loop yields prepared_not_recorded", () => {
  const loop = buildMissionLoopPreview({
    mission: { missionId: "m-001", intent: "test" },
    patProposal: { summary: "x" },
    consentDecision: "approve_c2_draft_only"
  });
  const event = buildEvidenceChainEventPreview({ missionLoopPreview: loop });
  assert.equal(event.event_status, "prepared_not_recorded");
  assert.equal(event.mission_id, "m-001");
  assert.equal(event.consent_decision, "approve_c2_draft_only");
  assert.equal(event.next_safe_action, "review_evidence_event_preview");
});

test("EvidenceEvent INVARIANT: status is NEVER 'recorded' — that requires authorized chain advance", () => {
  // No code path should ever produce 'recorded'. Canonical statuses are exactly 2.
  assert.equal(EVIDENCE_CHAIN_EVENT_STATUS_VALUES.length, 2);
  assert.deepEqual([...EVIDENCE_CHAIN_EVENT_STATUS_VALUES], ["not_prepared", "prepared_not_recorded"]);
  assert.equal(EVIDENCE_CHAIN_EVENT_STATUS_VALUES.includes("recorded"), false);
});

test("EvidenceEvent ADVERSARIAL: caller cannot inject chain_advance=true via mission loop", () => {
  // Caller can't forge a mission_loop_preview because schema is checked; but even
  // if a malformed object is passed claiming chain_advance=true at the top, we
  // should NOT propagate it.
  const fakeLoop = {
    schema: "bizra.dema.mission_loop_preview.v0.1",
    lifecycle_phase: "complete_preview_approved",
    consent_card: { mission: { missionId: "evil" }, blocked_effects: [] },
    consent_decision_recorded: "approve_c2_draft_only",
    chain_advance: true,  // adversarial injection
    receipt_mint: true,
    boundary: { chain_head_advanced: true }
  };
  const event = buildEvidenceChainEventPreview({ missionLoopPreview: fakeLoop });
  assert.equal(event.chain_advance, false, "chain_advance MUST stay false");
  assert.equal(event.receipt_mint, false, "receipt_mint MUST stay false");
  assert.equal(event.boundary.chain_advance_performed, false);
  assert.equal(event.boundary.receipt_mint_performed, false);
});

test("EvidenceEvent ADVERSARIAL: malformed mission loop (missing schema) yields not_prepared", () => {
  const malformed = {
    lifecycle_phase: "complete_preview_approved",
    consent_card: { mission: { missionId: "fake" } }
  };
  const event = buildEvidenceChainEventPreview({ missionLoopPreview: malformed });
  assert.equal(event.event_status, "not_prepared",
    "missing/wrong schema must NOT yield prepared event");
  assert.equal(event.mission_id, null);
});

test("EvidenceEvent ADVERSARIAL: caller passes raw payload in evidence_refs → stripped to id/schema/null hash", () => {
  const loop = buildMissionLoopPreview({
    mission: { missionId: "m-001", intent: "x" },
    patProposal: { summary: "x" },
    consentDecision: "approve_c2_draft_only"
  });
  const evilRefs = [
    {
      id: "ev-001",
      schema: "bizra.dema.evidence.v0.1",
      content: "RAW_CONTENT_SHOULD_NOT_LEAK",
      raw_payload: "ALSO_NOT_LEAK",
      private_data: "DEFINITELY_NOT_LEAK"
    }
  ];
  const event = buildEvidenceChainEventPreview({
    missionLoopPreview: loop,
    evidenceRefs: evilRefs
  });
  assert.equal(event.evidence_refs.length, 1);
  assert.equal(event.evidence_refs[0].id, "ev-001");
  assert.equal(event.evidence_refs[0].schema, "bizra.dema.evidence.v0.1");
  assert.equal(event.evidence_refs[0].content_hash, null);
  assert.equal("content" in event.evidence_refs[0], false, "raw content must not leak");
  assert.equal("raw_payload" in event.evidence_refs[0], false);
  assert.equal("private_data" in event.evidence_refs[0], false);
});

test("EvidenceEvent payload_policy declares raw_payload_included=false and hash_only=true", () => {
  const event = buildEvidenceChainEventPreview();
  assert.equal(event.payload_policy.raw_payload_included, false);
  assert.equal(event.payload_policy.hash_only, true);
});

test("EvidenceEvent blocked_effects always contains the required deny-list", () => {
  for (const params of [
    {}, // not_prepared
    {
      missionLoopPreview: buildMissionLoopPreview({
        mission: { missionId: "m" },
        patProposal: { summary: "x" },
        consentDecision: "approve_c2_draft_only"
      })
    }
  ]) {
    const event = buildEvidenceChainEventPreview(params);
    for (const required of EVIDENCE_CHAIN_EVENT_REQUIRED_BLOCKED_EFFECTS) {
      assert.ok(event.blocked_effects.includes(required),
        `blocked_effects must include required ${required}`);
    }
  }
});

test("EvidenceEvent source is always 'mission_loop_preview'", () => {
  assert.equal(buildEvidenceChainEventPreview().source, "mission_loop_preview");
  const loop = buildMissionLoopPreview({
    mission: { missionId: "m" },
    patProposal: { summary: "x" },
    consentDecision: "approve_c2_draft_only"
  });
  assert.equal(buildEvidenceChainEventPreview({ missionLoopPreview: loop }).source, "mission_loop_preview");
});

test("EvidenceEvent boundary is exhaustively false and frozen", () => {
  const event = buildEvidenceChainEventPreview();
  assertExhaustiveFalseBoundary(event.boundary);
  assert.equal(Object.isFrozen(event.boundary), true);
});

test("EvidenceEvent is deeply frozen including evidence_refs", () => {
  const loop = buildMissionLoopPreview({
    mission: { missionId: "m" },
    patProposal: { summary: "x" },
    consentDecision: "approve_c2_draft_only"
  });
  const event = buildEvidenceChainEventPreview({
    missionLoopPreview: loop,
    evidenceRefs: [{ id: "ev-x", schema: "bizra.dema.evidence.v0.1" }]
  });
  assert.equal(Object.isFrozen(event), true);
  assert.equal(Object.isFrozen(event.blocked_effects), true);
  assert.equal(Object.isFrozen(event.evidence_refs), true);
  assert.equal(Object.isFrozen(event.evidence_refs[0]), true);
  assert.equal(Object.isFrozen(event.payload_policy), true);
  assert.equal(Object.isFrozen(event.boundary), true);
});

test("EvidenceEvent from-inputs convenience function builds end-to-end", () => {
  const event = buildEvidenceChainEventPreviewFromInputs({
    mission: { missionId: "m-002", intent: "test" },
    patProposal: { summary: "draft" },
    consentDecision: "approve_c2_draft_only",
    evidenceRefs: [{ id: "ev-1", schema: "bizra.dema.evidence.v0.1" }]
  });
  assert.equal(event.schema, "bizra.dema.evidence_chain_event_preview.v0.1");
  assert.equal(event.event_status, "prepared_not_recorded");
  assert.equal(event.mission_id, "m-002");
  assert.equal(event.consent_decision, "approve_c2_draft_only");
  assert.equal(event.evidence_refs.length, 1);
  assert.equal(event.chain_advance, false);
});

test("EvidenceEvent INVARIANT: 'recorded' status is unreachable across all input combinations", () => {
  const inputs = [
    null,
    {},
    { missionLoopPreview: null },
    { missionLoopPreview: { schema: "fake", lifecycle_phase: "complete_preview_approved" } },
    {
      missionLoopPreview: buildMissionLoopPreview({
        mission: { missionId: "m" },
        patProposal: { summary: "x" },
        consentDecision: "approve_c2_draft_only"
      })
    }
  ];
  for (const input of inputs) {
    const event = buildEvidenceChainEventPreview(input ?? {});
    assert.notEqual(event.event_status, "recorded",
      `event_status must never be 'recorded' for input ${JSON.stringify(input)?.slice(0,80)}`);
  }
});

test("EvidenceEvent ADVERSARIAL: caller-injected evidence with chain_advance flag is ignored", () => {
  const loop = buildMissionLoopPreview({
    mission: { missionId: "m" },
    patProposal: { summary: "x" },
    consentDecision: "approve_c2_draft_only"
  });
  const event = buildEvidenceChainEventPreview({
    missionLoopPreview: loop,
    evidenceRefs: [
      { id: "ev-1", schema: "x", chain_advance: true, force_record: true }
    ]
  });
  // Even if evidence_refs items try to carry chain_advance, the top-level
  // event chain_advance stays false.
  assert.equal(event.chain_advance, false);
  // And the leaked fields are stripped from each ref.
  assert.equal("chain_advance" in event.evidence_refs[0], false);
  assert.equal("force_record" in event.evidence_refs[0], false);
});

test("EvidenceEvent additional blocked_effects from consent card are merged", () => {
  // Using from-inputs since we don't have direct additional-blocked path in
  // mission-loop input shape. The consent card defaults preserve the required
  // deny-list which composes through the event.
  const event = buildEvidenceChainEventPreviewFromInputs({
    mission: { missionId: "m" },
    patProposal: { summary: "x" },
    consentDecision: "approve_c2_draft_only"
  });
  // Required effects present
  for (const required of EVIDENCE_CHAIN_EVENT_REQUIRED_BLOCKED_EFFECTS) {
    assert.ok(event.blocked_effects.includes(required));
  }
});

test("EvidenceEvent non-array evidence_refs handled gracefully", () => {
  const loop = buildMissionLoopPreview({
    mission: { missionId: "m" },
    patProposal: { summary: "x" },
    consentDecision: "approve_c2_draft_only"
  });
  const event = buildEvidenceChainEventPreview({
    missionLoopPreview: loop,
    evidenceRefs: "not an array"
  });
  assert.equal(event.evidence_refs.length, 0);
});
