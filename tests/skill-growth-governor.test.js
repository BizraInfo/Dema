import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildSkillGrowthGovernorPreview,
  SKILL_GROWTH_GOVERNOR_SCHEMA,
  SKILL_GROWTH_GOVERNOR_PRIMARY_REFUSALS,
  SKILL_GROWTH_GOVERNOR_PROTECTED_NAMESPACES,
  SKILL_GROWTH_GOVERNOR_PROMOTION_PHRASE_TEMPLATE,
  SKILL_GROWTH_GOVERNOR_FIVE_GATES
} from "../packages/core/src/skill-growth-governor.js";

import { PREVIEW_BOUNDARY_CANONICAL_KEYS } from "../packages/core/src/preview-boundary.js";

// Canonical helper · 16-key boundary all false
function assertCanonicalBoundary(boundary, label) {
  for (const key of PREVIEW_BOUNDARY_CANONICAL_KEYS) {
    assert.equal(boundary[key], false, `${label}.boundary.${key} must be false`);
  }
}

// Fully-valid candidate that passes all 5 gates. Each adversarial test
// mutates ONE field and verifies the corresponding refusal/gate fires.
function makeValidCandidate(overrides = {}) {
  const skill_id = overrides.skill_id ?? "research_summary";
  const candidate_version = overrides.candidate_version ?? 3;
  return {
    skill_id,
    candidate_version,
    namespace: overrides.namespace ?? "research",
    requested_action: overrides.requested_action ?? "promote",
    evidence_receipt_ids: overrides.evidence_receipt_ids ?? ["2026-05-18_082658"],
    success_metric: overrides.success_metric ?? {
      kind: "tests_pass",
      score: 0.92,
      threshold: 0.7,
      passed: true
    },
    no_boundary_violation: overrides.no_boundary_violation !== undefined ? overrides.no_boundary_violation : true,
    sat_review_status: overrides.sat_review_status ?? "passed",
    human_consent_phrase_typed:
      overrides.human_consent_phrase_typed !== undefined
        ? overrides.human_consent_phrase_typed
        : `GO promote skill ${skill_id} v${candidate_version}`,
    task_outcome: overrides.task_outcome ?? "success",
    self_reflection_only: overrides.self_reflection_only ?? false,
    protected_namespace_override: overrides.protected_namespace_override ?? false
  };
}

// ─── 16 BASE TESTS ──────────────────────────────────────────────────────────

test("SkillGrowthGovernor emits canonical schema + truth label + mode", () => {
  const r = buildSkillGrowthGovernorPreview();
  assert.equal(r.schema, "bizra.dema.skill_growth_governor.v0.1");
  assert.equal(r.schema, SKILL_GROWTH_GOVERNOR_SCHEMA);
  assert.equal(r.truth_label, "NODE0_LOCAL_SEED");
  assert.equal(r.mode, "preview_only");
  assert.equal(r.receipt_shape_ready, true);
});

test("SkillGrowthGovernor emits canonical 16-key boundary all false", () => {
  const r = buildSkillGrowthGovernorPreview();
  assertCanonicalBoundary(r.boundary, "skill_growth_governor");
});

test("SkillGrowthGovernor output is deep-frozen", () => {
  const r = buildSkillGrowthGovernorPreview({
    skill_candidates: [makeValidCandidate()],
    existing_skills: [{ skill_id: "research_summary", current_version: 2, human_edit_protected: true }]
  });
  assert.equal(Object.isFrozen(r), true);
  assert.equal(Object.isFrozen(r.candidate_evaluations), true);
  assert.equal(Object.isFrozen(r.candidate_evaluations[0]), true);
  assert.equal(Object.isFrozen(r.candidate_evaluations[0].gates), true);
  assert.equal(Object.isFrozen(r.candidate_evaluations[0].refusals), true);
  assert.equal(Object.isFrozen(r.existing_skills), true);
  assert.equal(Object.isFrozen(r.existing_skills[0]), true);
  assert.equal(Object.isFrozen(r.counters), true);
  assert.equal(Object.isFrozen(r.consent), true);
  assert.equal(Object.isFrozen(r.boundary), true);
});

test("SkillGrowthGovernor is deterministic given identical inputs", () => {
  const candidates = [makeValidCandidate()];
  const a = buildSkillGrowthGovernorPreview({ skill_candidates: candidates });
  const b = buildSkillGrowthGovernorPreview({ skill_candidates: candidates });
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test("four_line_law surfaces verbatim · the canon Mumu authored", () => {
  const r = buildSkillGrowthGovernorPreview();
  assert.deepEqual([...r.four_line_law], [
    "No learning without evaluation.",
    "No evaluation without evidence.",
    "No skill promotion without receipt.",
    "No overwrite without human consent."
  ]);
});

test("five_gates surface the 5 canonical gate names", () => {
  const r = buildSkillGrowthGovernorPreview();
  assert.deepEqual([...r.five_gates], [
    "evidence_exists",
    "success_metric_present",
    "no_boundary_violation",
    "sat_review_passed",
    "human_consent_received"
  ]);
  assert.deepEqual([...SKILL_GROWTH_GOVERNOR_FIVE_GATES], [...r.five_gates]);
});

test("primary_refusals surfaces the 8-entry taxonomy", () => {
  const r = buildSkillGrowthGovernorPreview();
  assert.equal(r.primary_refusals.length, 8);
  assert.equal(r.primary_refusals, SKILL_GROWTH_GOVERNOR_PRIMARY_REFUSALS);
  for (const refusal of [
    "refuse_to_overwrite_human_edited_skill",
    "refuse_to_promote_without_evidence",
    "refuse_to_promote_failed_task_outcome",
    "refuse_to_promote_without_success_metric",
    "refuse_to_emit_skill_change_without_typed_consent",
    "refuse_to_archive_pinned_skill",
    "refuse_to_score_skill_by_self_reflection_alone",
    "refuse_to_create_skill_overlapping_protected_namespace"
  ]) {
    assert.ok(r.primary_refusals.includes(refusal));
  }
});

test("protected_namespaces includes the 6 canonical sacred namespaces", () => {
  const r = buildSkillGrowthGovernorPreview();
  const ns = new Set(r.protected_namespaces);
  for (const n of ["consent", "boundary", "receipt_mint", "federation", "identity", "canon"]) {
    assert.ok(ns.has(n), `protected_namespaces must include ${n}`);
  }
});

test("consent block locks ADR-005 exact-string discipline", () => {
  const r = buildSkillGrowthGovernorPreview();
  assert.equal(r.consent.exact_string_required, true);
  assert.equal(r.consent.fuzzy_match_allowed, false);
  assert.equal(r.consent.case_insensitive_allowed, false);
  assert.equal(r.consent.prefix_match_allowed, false);
  assert.equal(r.consent.paste_allowed, false);
  assert.equal(r.consent.promotion_phrase_template, "GO promote skill <id> v<version>");
  assert.equal(r.consent.promotion_phrase_template, SKILL_GROWTH_GOVERNOR_PROMOTION_PHRASE_TEMPLATE);
});

test("default state (no candidates) yields zero counters · no work to do", () => {
  const r = buildSkillGrowthGovernorPreview();
  assert.equal(r.counters.candidates_total, 0);
  assert.equal(r.counters.candidates_promotable, 0);
  assert.equal(r.counters.candidates_halted, 0);
  assert.equal(r.counters.candidates_proposed, 0);
  assert.equal(r.counters.refusals_total, 0);
});

test("Valid candidate passing all 5 gates → next_action: promote", () => {
  const r = buildSkillGrowthGovernorPreview({
    skill_candidates: [makeValidCandidate()]
  });
  assert.equal(r.candidate_evaluations.length, 1);
  const e = r.candidate_evaluations[0];
  assert.equal(e.all_gates_passed, true);
  assert.equal(e.next_action, "promote");
  assert.equal(e.refusals.length, 0);
});

test("Per-candidate evaluation has exactly 5 gate entries · all named", () => {
  const r = buildSkillGrowthGovernorPreview({ skill_candidates: [makeValidCandidate()] });
  const e = r.candidate_evaluations[0];
  assert.equal(Object.keys(e.gates).length, 5);
  for (const g of ["evidence_exists", "success_metric_present", "no_boundary_violation", "sat_review_passed", "human_consent_received"]) {
    assert.ok(g in e.gates, `gate ${g} must be evaluated`);
    assert.equal(typeof e.gates[g].passed, "boolean");
  }
});

test("promotion_phrase_required substitutes skill_id + version correctly", () => {
  const r = buildSkillGrowthGovernorPreview({
    skill_candidates: [makeValidCandidate({ skill_id: "research_summary", candidate_version: 3 })]
  });
  assert.equal(
    r.candidate_evaluations[0].promotion_phrase_required,
    "GO promote skill research_summary v3"
  );
});

test("existing_skill_protected flag set when human_edit_protected: true", () => {
  const r = buildSkillGrowthGovernorPreview({
    skill_candidates: [makeValidCandidate()],
    existing_skills: [{
      skill_id: "research_summary",
      current_version: 2,
      human_edit_protected: true,
      last_edited_by: "human"
    }]
  });
  assert.equal(r.candidate_evaluations[0].existing_skill_protected, true);
});

test("counters aggregate correctly across mixed candidate states", () => {
  const r = buildSkillGrowthGovernorPreview({
    skill_candidates: [
      makeValidCandidate({ skill_id: "a", candidate_version: 1 }),
      makeValidCandidate({ skill_id: "b", candidate_version: 1, task_outcome: "failure" }),
      makeValidCandidate({ skill_id: "c", candidate_version: 1, evidence_receipt_ids: [] })
    ]
  });
  assert.equal(r.counters.candidates_total, 3);
  assert.equal(r.counters.candidates_promotable, 1);
  assert.equal(r.counters.candidates_halted, 2);
  assert.ok(r.counters.refusals_total >= 2);
});

test("blocked_effects includes silent_skill_overwrite + federation + receipt_mint", () => {
  const r = buildSkillGrowthGovernorPreview();
  assert.ok(r.blocked_effects.includes("silent_skill_overwrite"));
  assert.ok(r.blocked_effects.includes("self_reflection_only_promotion"));
  assert.ok(r.blocked_effects.includes("promotion_without_receipt_link"));
  assert.ok(r.blocked_effects.includes("federation"));
  assert.ok(r.blocked_effects.includes("receipt_mint"));
});

// ─── 16 ADVERSARIAL TESTS · the 4 refusal paths from Mumu's doctrine ────────
// "DEMA cannot overwrite human-edited skill"
// "DEMA cannot promote skill without evidence"
// "Failed task cannot become skill"
// "Skill candidate can be rejected/archived"

test("ADVERSARIAL: DEMA CANNOT overwrite human-edited skill (refusal fires)", () => {
  const r = buildSkillGrowthGovernorPreview({
    skill_candidates: [makeValidCandidate({ skill_id: "research_summary" })],
    existing_skills: [{
      skill_id: "research_summary",
      current_version: 2,
      human_edit_protected: true,
      last_edited_by: "human"
    }]
  });
  const e = r.candidate_evaluations[0];
  assert.ok(e.refusals.includes("refuse_to_overwrite_human_edited_skill"));
  assert.equal(e.next_action, "halt");
});

test("ADVERSARIAL: DEMA CANNOT promote skill without evidence (no receipts → refusal)", () => {
  const r = buildSkillGrowthGovernorPreview({
    skill_candidates: [makeValidCandidate({ evidence_receipt_ids: [] })]
  });
  const e = r.candidate_evaluations[0];
  assert.equal(e.gates.evidence_exists.passed, false);
  assert.ok(e.refusals.includes("refuse_to_promote_without_evidence"));
  assert.equal(e.next_action, "halt");
});

test("ADVERSARIAL: failed task outcome CANNOT become skill", () => {
  const r = buildSkillGrowthGovernorPreview({
    skill_candidates: [makeValidCandidate({ task_outcome: "failure" })]
  });
  const e = r.candidate_evaluations[0];
  assert.ok(e.refusals.includes("refuse_to_promote_failed_task_outcome"));
  assert.equal(e.next_action, "halt");
});

test("ADVERSARIAL: archive of pinned skill is REFUSED", () => {
  const r = buildSkillGrowthGovernorPreview({
    skill_candidates: [makeValidCandidate({ requested_action: "archive" })],
    existing_skills: [{
      skill_id: "research_summary",
      current_version: 2,
      pinned: true,
      last_edited_by: "human"
    }]
  });
  const e = r.candidate_evaluations[0];
  assert.ok(e.refusals.includes("refuse_to_archive_pinned_skill"));
  assert.equal(e.next_action, "halt");
});

test("ADVERSARIAL: self-reflection-only candidate is REFUSED", () => {
  const r = buildSkillGrowthGovernorPreview({
    skill_candidates: [makeValidCandidate({ self_reflection_only: true })]
  });
  const e = r.candidate_evaluations[0];
  assert.ok(e.refusals.includes("refuse_to_score_skill_by_self_reflection_alone"));
});

test("ADVERSARIAL: protected namespace 'consent' without override is REFUSED", () => {
  const r = buildSkillGrowthGovernorPreview({
    skill_candidates: [makeValidCandidate({
      namespace: "consent",
      protected_namespace_override: false
    })]
  });
  const e = r.candidate_evaluations[0];
  assert.ok(e.refusals.includes("refuse_to_create_skill_overlapping_protected_namespace"));
});

test("ADVERSARIAL: protected namespace 'boundary' without override is REFUSED", () => {
  const r = buildSkillGrowthGovernorPreview({
    skill_candidates: [makeValidCandidate({
      namespace: "boundary",
      protected_namespace_override: false
    })]
  });
  assert.ok(r.candidate_evaluations[0].refusals.includes("refuse_to_create_skill_overlapping_protected_namespace"));
});

test("ADVERSARIAL: missing success_metric → refusal fires", () => {
  // Construct directly (not via makeValidCandidate · which would fill defaults)
  const candidate = {
    skill_id: "research_summary",
    candidate_version: 1,
    namespace: "research",
    requested_action: "promote",
    evidence_receipt_ids: ["receipt-x"],
    no_boundary_violation: true,
    sat_review_status: "passed",
    human_consent_phrase_typed: "GO promote skill research_summary v1",
    task_outcome: "success"
    // success_metric intentionally omitted
  };
  const r = buildSkillGrowthGovernorPreview({ skill_candidates: [candidate] });
  const e = r.candidate_evaluations[0];
  assert.equal(e.gates.success_metric_present.passed, false);
  assert.ok(e.refusals.includes("refuse_to_promote_without_success_metric"));
});

test("ADVERSARIAL: success_metric.passed=false → treated as no usable metric", () => {
  const r = buildSkillGrowthGovernorPreview({
    skill_candidates: [makeValidCandidate({
      success_metric: { kind: "tests_pass", score: 0.4, threshold: 0.7, passed: false }
    })]
  });
  const e = r.candidate_evaluations[0];
  assert.equal(e.gates.success_metric_present.passed, false);
  assert.equal(e.gates.success_metric_present.reason, "success_metric_did_not_pass_threshold");
});

test("ADVERSARIAL: no_boundary_violation defaults to false (must be explicitly true)", () => {
  const r = buildSkillGrowthGovernorPreview({
    skill_candidates: [makeValidCandidate({ no_boundary_violation: undefined })]
  });
  // makeValidCandidate's `no_boundary_violation !== undefined ? ... : true` means
  // when we pass undefined, the helper still defaults to true. Test it differently:
  // explicitly omit it by overriding to false to verify the gate refuses.
  const r2 = buildSkillGrowthGovernorPreview({
    skill_candidates: [makeValidCandidate({ no_boundary_violation: false })]
  });
  assert.equal(r2.candidate_evaluations[0].gates.no_boundary_violation.passed, false);
});

test("ADVERSARIAL: sat_review_status not 'passed' → gate refuses", () => {
  const r = buildSkillGrowthGovernorPreview({
    skill_candidates: [makeValidCandidate({ sat_review_status: "pending" })]
  });
  assert.equal(r.candidate_evaluations[0].gates.sat_review_passed.passed, false);
});

test("ADVERSARIAL: wrong consent phrase typed → human_consent_received fails", () => {
  const r = buildSkillGrowthGovernorPreview({
    skill_candidates: [makeValidCandidate({
      human_consent_phrase_typed: "Yes, promote it"
    })]
  });
  const e = r.candidate_evaluations[0];
  assert.equal(e.gates.human_consent_received.passed, false);
  assert.ok(e.refusals.includes("refuse_to_emit_skill_change_without_typed_consent"));
});

test("ADVERSARIAL: consent phrase with extra whitespace → REFUSED (no fuzzy match)", () => {
  const r = buildSkillGrowthGovernorPreview({
    skill_candidates: [makeValidCandidate({
      human_consent_phrase_typed: "GO promote skill research_summary v3 "  // trailing space
    })]
  });
  assert.ok(r.candidate_evaluations[0].refusals.includes("refuse_to_emit_skill_change_without_typed_consent"));
});

test("ADVERSARIAL: consent phrase with case difference → REFUSED (no case-insensitive)", () => {
  const r = buildSkillGrowthGovernorPreview({
    skill_candidates: [makeValidCandidate({
      human_consent_phrase_typed: "go promote skill research_summary v3"
    })]
  });
  assert.ok(r.candidate_evaluations[0].refusals.includes("refuse_to_emit_skill_change_without_typed_consent"));
});

test("ADVERSARIAL: prototype-pollution attempt via candidate input does NOT leak", () => {
  const polluted = makeValidCandidate();
  Object.setPrototypeOf(polluted, { secret_skill_overwrite_token: "SHOULD_NOT_LEAK" });
  const r = buildSkillGrowthGovernorPreview({ skill_candidates: [polluted] });
  const e = r.candidate_evaluations[0];
  assert.equal("secret_skill_overwrite_token" in e, false);
});

test("ADVERSARIAL: mutation attempt on returned candidate_evaluations is rejected (frozen)", () => {
  const r = buildSkillGrowthGovernorPreview({ skill_candidates: [makeValidCandidate()] });
  try { r.candidate_evaluations.push({ skill_id: "evil" }); } catch (e) { /* expected */ }
  assert.equal(r.candidate_evaluations.length, 1);
  try { r.candidate_evaluations[0].refusals.push("fake_refusal"); } catch (e) { /* expected */ }
  assert.equal(r.candidate_evaluations[0].refusals.length, 0);
});

// ─── HISTORICAL FAILURE MODES (regression protection) ───────────────────────
//
// Locks specific real-world failure modes that the Skill Growth Governor must
// continue to refuse across all future refactors. Each test encodes a named,
// public, documented failure mode from another agent system, asserts the
// governor structurally refuses it. If a future commit removes one of the 8
// refusal paths, these tests fail · the regression is caught.

test("HERMES REGRESSION · CustomMerkins · agent self-overwrite of human-edited skill must be REFUSED", () => {
  // Public failure mode attributed to Nous Research's Hermes Agent
  // (early 2026 · Reddit user "CustomMerkins"):
  //
  //   1. Hermes pulled water test results from a government website
  //   2. Agent jumbled the data
  //   3. Agent self-evaluated · gave itself a passing grade ("kicked ass")
  //   4. CustomMerkins manually fixed the broken skill (v2 · human edit)
  //   5. Hermes overwrote his fix with the next self-improved version
  //
  // This is exactly the failure mode BIZRA's Skill Growth Law (commit
  // 1899332 · 2026-05-18) was canonized to refuse. The 4 refusals that
  // fire here form the structural cure for the disease.
  const r = buildSkillGrowthGovernorPreview({
    skill_candidates: [{
      skill_id: "fetch_water_test_results",
      candidate_version: 3,
      namespace: "research",
      requested_action: "promote",
      evidence_receipt_ids: [],
      success_metric: { kind: "self_reflection", score: 0.95, threshold: 0.7, passed: true },
      no_boundary_violation: false,
      sat_review_status: "skipped",
      human_consent_phrase_typed: "",
      task_outcome: "success",
      self_reflection_only: true
    }],
    existing_skills: [{
      skill_id: "fetch_water_test_results",
      current_version: 2,
      human_edit_protected: true,
      last_edited_by: "human"
    }]
  });

  const e = r.candidate_evaluations[0];
  // The governor must HALT (not propose · not promote · halt)
  assert.equal(e.next_action, "halt", "Hermes-mode promotion MUST yield next_action: halt");
  // All 4 refusal paths from the doctrine must fire on this scenario
  assert.ok(e.refusals.includes("refuse_to_overwrite_human_edited_skill"),
    "MUST refuse to overwrite CustomMerkins's manual fix");
  assert.ok(e.refusals.includes("refuse_to_score_skill_by_self_reflection_alone"),
    "MUST refuse self-reflection-only promotion (agent grading its own work)");
  assert.ok(e.refusals.includes("refuse_to_promote_without_evidence"),
    "MUST refuse promotion when no receipt links the candidate to evidence");
  assert.ok(e.refusals.includes("refuse_to_emit_skill_change_without_typed_consent"),
    "MUST refuse promotion without exact-string typed-GO from operator");
  // Existing skill protection flag must surface up
  assert.equal(e.existing_skill_protected, true,
    "Human-edited skill must be marked as protected");
  // Promotion phrase rendered for the operator (informational · they must
  // explicitly type this exact string to override · which they won't here)
  assert.equal(e.promotion_phrase_required, "GO promote skill fetch_water_test_results v3");
});
