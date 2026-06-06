import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildPATMissionScribePreview,
  buildPATMissionScribeSummary,
  buildPATMissionScribeEffectCap,
  buildPATMissionScribeKernel,
  draftMissionProposal,
  PAT_MISSION_SCRIBE_SCHEMA_NAME,
  PAT_MISSION_SCRIBE_PROPOSAL_SCHEMA_NAME,
  PAT_MISSION_SCRIBE_CONSENT_PHRASE_TEMPLATE,
  PAT_MISSION_SCRIBE_PERSONA,
} from "../packages/core/src/pat-mission-scribe.js";
import { isCanonicalBoundary } from "../packages/core/src/preview-boundary.js";
import { AGENT_STATES } from "../packages/core/src/agent-kernel.js";

// =========================================================================
// PERSONA + PREVIEW TESTS (5)
// =========================================================================

test("PAT-1 preview emits canonical schema + truth label + preview_only mode", () => {
  const p = buildPATMissionScribePreview();
  assert.equal(p.schema, PAT_MISSION_SCRIBE_SCHEMA_NAME);
  assert.equal(p.schema, "bizra.dema.pat_mission_scribe.v0.1");
  assert.equal(p.truth_label, "NODE0_LOCAL_SEED");
  assert.equal(p.mode, "preview_only");
});

test("PAT-1 boundary is canonical 16-key all-false frozen", () => {
  const p = buildPATMissionScribePreview();
  assert.ok(isCanonicalBoundary(p.boundary));
});

test("PAT-1 persona declares pat_number=1 and pat_id='pat-1-mission-scribe'", () => {
  const p = buildPATMissionScribePreview();
  assert.equal(p.persona.pat_number, 1);
  assert.equal(p.persona.pat_id, "pat-1-mission-scribe");
  assert.equal(p.persona.role_name, "mission_scribe");
});

test("PAT-1 declares 4 primary capabilities + 6 primary refusals", () => {
  const p = buildPATMissionScribePreview();
  assert.equal(p.persona.primary_capabilities.length, 4);
  assert.ok(p.persona.primary_capabilities.includes("intent_capture"));
  assert.ok(p.persona.primary_capabilities.includes("proposal_drafting"));
  assert.equal(p.persona.primary_refusals.length, 6);
  assert.ok(p.persona.primary_refusals.includes("execute_runtime"));
  assert.ok(p.persona.primary_refusals.includes("mint_receipts"));
});

test("PAT-1 is deep-frozen · cannot be tampered post-build", () => {
  const p = buildPATMissionScribePreview();
  assert.ok(Object.isFrozen(p));
  assert.ok(Object.isFrozen(p.persona));
  assert.ok(Object.isFrozen(p.persona.primary_capabilities));
  assert.ok(Object.isFrozen(p.refusal_invariants));
  assert.ok(Object.isFrozen(p.boundary));
});

// =========================================================================
// EFFECTCAP TESTS (3)
// =========================================================================

test("PAT-1 EffectCap is valid · name = 'pat_mission_scribe' · consent_template matches", () => {
  const cap = buildPATMissionScribeEffectCap();
  assert.equal(cap.valid, true);
  assert.equal(cap.name, "pat_mission_scribe");
  assert.equal(
    cap.consent_scope_template,
    PAT_MISSION_SCRIBE_CONSENT_PHRASE_TEMPLATE,
  );
});

test("PAT-1 EffectCap blocks consent-related effects explicitly", () => {
  const cap = buildPATMissionScribeEffectCap();
  assert.ok(
    cap.blocked_effects.includes("approve_consent_on_behalf_of_operator"),
  );
  assert.ok(cap.blocked_effects.includes("fuzzy_match_consent_phrase"));
  assert.ok(cap.blocked_effects.includes("auto_approve_proposal"));
  // Plus all 8 ALWAYS_BLOCKED
  assert.ok(cap.blocked_effects.includes("execute_arbitrary_shell"));
  assert.ok(cap.blocked_effects.includes("advance_chain"));
});

test("PAT-1 EffectCap audit_trail_required=true · cannot be silenced", () => {
  const cap = buildPATMissionScribeEffectCap();
  assert.equal(cap.audit_trail_required, true);
});

// =========================================================================
// KERNEL INTEGRATION TESTS (3)
// =========================================================================

test("PAT-1 kernel pre-configured with correct agent_id and role", () => {
  const k = buildPATMissionScribeKernel({ mission_intent: "test intent" });
  assert.equal(k.agent_id, "pat-1-mission-scribe");
  assert.equal(k.agent_role, "pat_mission_scribe");
  assert.equal(k.mission_intent, "test intent");
  assert.equal(k.current_state, AGENT_STATES.INIT);
  assert.equal(k.valid, true);
});

test("PAT-1 kernel emits canonical schema + memory_file_path scoped to agent", () => {
  const k = buildPATMissionScribeKernel();
  assert.equal(k.schema, "bizra.dema.agent_kernel.v0.1");
  assert.equal(
    k.memory_file_path,
    "~/.dema/agents/pat-1-mission-scribe/memory.json",
  );
});

test("PAT-1 kernel respects custom max_iterations within bounds", () => {
  const k = buildPATMissionScribeKernel({
    mission_intent: "x",
    max_iterations: 50,
  });
  assert.equal(k.max_iterations, 50);
});

// =========================================================================
// DRAFT PROPOSAL TESTS (5)
// =========================================================================

test("draftMissionProposal with valid intent produces a valid frozen proposal", () => {
  const p = draftMissionProposal({
    operator_intent: "review my today.json and tell me what changed",
  });
  assert.equal(p.schema, PAT_MISSION_SCRIBE_PROPOSAL_SCHEMA_NAME);
  assert.equal(p.schema, "bizra.dema.mission_proposal.v0.1");
  assert.equal(p.truth_label, "NODE0_LOCAL_SEED");
  assert.equal(p.mode, "draft_only");
  assert.equal(p.valid, true);
  assert.equal(p.refusal_reason, null);
  assert.equal(p.drafted_by, "pat-1-mission-scribe");
  assert.ok(Object.isFrozen(p));
  assert.ok(isCanonicalBoundary(p.boundary));
});

test("draftMissionProposal preserves operator intent verbatim", () => {
  const intent =
    "compile a list of my recent commits with their boundary discipline status";
  const p = draftMissionProposal({ operator_intent: intent });
  assert.equal(p.operator_intent_verbatim, intent);
  assert.equal(p.intent_length_chars, intent.length);
});

test("draftMissionProposal normalizes scope to first 8 words", () => {
  const intent = "do thing one two three four five six seven eight nine ten";
  const p = draftMissionProposal({ operator_intent: intent });
  const normalizedWords = p.normalized_scope.split(/\s+/);
  assert.ok(normalizedWords.length <= 8);
  assert.equal(p.normalized_scope, "do thing one two three four five six");
});

test("draftMissionProposal authors a consent phrase matching the normalized scope", () => {
  const p = draftMissionProposal({
    operator_intent: "audit my recent commits for canon compliance",
  });
  assert.match(p.proposal_consent_phrase, /^GO: act on proposal /);
  assert.match(p.proposal_consent_phrase, /audit my recent commits/);
  assert.equal(p.requires_typed_go, true);
});

test("draftMissionProposal valid=true requires intent + allowed + blocked all non-empty", () => {
  const p = draftMissionProposal({
    operator_intent: "test",
    suggested_allowed_effects: ["render_terminal_output"],
    always_blocked_effects: ["execute_runtime"],
  });
  assert.equal(p.valid, true);
  assert.equal(p.receipt_shape_ready, true);
});

// =========================================================================
// REFUSAL TESTS (3)
// =========================================================================

test("draftMissionProposal refuses empty intent · explicit refusal_reason", () => {
  const p = draftMissionProposal({ operator_intent: "" });
  assert.equal(p.valid, false);
  assert.match(p.refusal_reason, /empty_intent/);
  assert.equal(p.receipt_shape_ready, false);
});

test("draftMissionProposal refuses empty allowed_effects", () => {
  const p = draftMissionProposal({
    operator_intent: "test",
    suggested_allowed_effects: [],
  });
  assert.equal(p.valid, false);
  assert.match(p.refusal_reason, /no_allowed_effects/);
});

test("draftMissionProposal refuses empty blocked_effects", () => {
  const p = draftMissionProposal({
    operator_intent: "test",
    suggested_allowed_effects: ["render_terminal_output"],
    always_blocked_effects: [],
  });
  assert.equal(p.valid, false);
  assert.match(p.refusal_reason, /no_blocked_effects/);
});

// =========================================================================
// ADVERSARIAL INPUT TESTS (4)
// =========================================================================

test("Adversarial · non-string operator_intent coerced to empty · refused", () => {
  const p = draftMissionProposal({ operator_intent: { malicious: "object" } });
  assert.equal(p.valid, false);
  assert.equal(p.operator_intent_verbatim, "");
});

test("Adversarial · non-array allowed_effects defaults to empty · refused", () => {
  const p = draftMissionProposal({
    operator_intent: "test",
    suggested_allowed_effects: "not-an-array",
  });
  assert.equal(p.valid, false);
  assert.match(p.refusal_reason, /no_allowed_effects/);
});

test("Adversarial · non-string entries in allowed_effects are filtered", () => {
  const p = draftMissionProposal({
    operator_intent: "test",
    suggested_allowed_effects: [
      "valid_effect",
      () => "malicious",
      Symbol("evil"),
      42,
      "another_valid",
    ],
  });
  assert.deepEqual(
    [...p.suggested_allowed_effects],
    ["valid_effect", "another_valid"],
  );
});

test("Adversarial · duplicate allowed/blocked effects deduped", () => {
  const p = draftMissionProposal({
    operator_intent: "test",
    suggested_allowed_effects: ["a", "a", "b", "a"],
    always_blocked_effects: ["x", "x", "y"],
  });
  assert.equal(p.suggested_allowed_effects.length, 2);
  assert.equal(p.always_blocked_effects.length, 2);
});

// =========================================================================
// SUMMARY + EXPORTS (3)
// =========================================================================

test("Summary emits suffix-tagged schema + preserves load-bearing fields", () => {
  const s = buildPATMissionScribeSummary({ operator_name: "TestOp" });
  assert.equal(s.schema, "bizra.dema.pat_mission_scribe_summary.v0.1");
  assert.equal(s.truth_label, "NODE0_LOCAL_SEED");
  assert.equal(s.mode, "summary");
  assert.equal(s.source_schema, PAT_MISSION_SCRIBE_SCHEMA_NAME);
  assert.equal(s.pat_number, 1);
  assert.equal(s.serves_operator, "TestOp");
  assert.equal(s.capability_count, 4);
  assert.equal(s.refusal_count, 6);
  assert.ok(isCanonicalBoundary(s.boundary));
});

test("Summary fits within line budget pretty-printed", () => {
  const s = buildPATMissionScribeSummary();
  const lines = JSON.stringify(s, null, 2).split("\n").length;
  assert.ok(lines <= 40, `summary must be <= 40 lines, got ${lines}`);
});

test("Exports + canonical persona constants are frozen and stable", () => {
  assert.equal(typeof PAT_MISSION_SCRIBE_SCHEMA_NAME, "string");
  assert.equal(typeof PAT_MISSION_SCRIBE_PROPOSAL_SCHEMA_NAME, "string");
  assert.equal(typeof PAT_MISSION_SCRIBE_CONSENT_PHRASE_TEMPLATE, "string");
  assert.ok(Object.isFrozen(PAT_MISSION_SCRIBE_PERSONA));
  assert.equal(PAT_MISSION_SCRIBE_PERSONA.pat_number, 1);
  assert.ok(Object.isFrozen(PAT_MISSION_SCRIBE_PERSONA.primary_capabilities));
  assert.ok(Object.isFrozen(PAT_MISSION_SCRIBE_PERSONA.primary_refusals));
});
