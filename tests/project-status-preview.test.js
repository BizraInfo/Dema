import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildProjectStatusPreview,
  PROJECT_STATUS_SCHEMA,
  PROJECT_STATUS_STAKEHOLDER_ROLES,
  PROJECT_STATUS_PRIMARY_REFUSALS,
} from "../packages/core/src/project-status-preview.js";

import { PREVIEW_BOUNDARY_CANONICAL_KEYS } from "../packages/core/src/preview-boundary.js";

function assertCanonicalBoundary(boundary, label) {
  for (const key of PREVIEW_BOUNDARY_CANONICAL_KEYS) {
    assert.equal(
      boundary[key],
      false,
      `${label}.boundary.${key} must be false`,
    );
  }
}

// ─── 16 BASE TESTS ──────────────────────────────────────────────────────────

test("ProjectStatus emits canonical schema + truth label + mode", () => {
  const r = buildProjectStatusPreview();
  assert.equal(r.schema, "bizra.dema.project_status.v0.1");
  assert.equal(r.schema, PROJECT_STATUS_SCHEMA);
  assert.equal(r.truth_label, "NODE0_LOCAL_SEED");
  assert.equal(r.mode, "preview_only");
  assert.equal(r.receipt_shape_ready, true);
});

test("ProjectStatus emits canonical 16-key boundary all false", () => {
  const r = buildProjectStatusPreview();
  assertCanonicalBoundary(r.boundary, "project_status");
});

test("ProjectStatus output is deep-frozen", () => {
  const r = buildProjectStatusPreview({
    stakeholders: [
      { role: "founder", name: "Mumu", node_label: "Node0", status: "active" },
    ],
    risk_register: [
      {
        risk_id: "R1",
        title: "Test risk",
        severity: "low",
        mitigation: "monitor",
      },
    ],
  });
  assert.equal(Object.isFrozen(r), true);
  assert.equal(Object.isFrozen(r.stakeholders), true);
  assert.equal(Object.isFrozen(r.stakeholders[0]), true);
  assert.equal(Object.isFrozen(r.risk_register), true);
  assert.equal(Object.isFrozen(r.risk_register[0]), true);
  assert.equal(Object.isFrozen(r.pmbok_principles), true);
  assert.equal(Object.isFrozen(r.counters), true);
  assert.equal(Object.isFrozen(r.boundary), true);
});

test("ProjectStatus is deterministic given identical inputs", () => {
  const inputs = {
    stakeholders: [
      { role: "founder", name: "M", node_label: "Node0", status: "active" },
    ],
    risk_register: [
      {
        risk_id: "R1",
        title: "T",
        severity: "low",
        mitigation: "M",
        status: "monitored",
      },
    ],
  };
  const a = buildProjectStatusPreview(inputs);
  const b = buildProjectStatusPreview(inputs);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test("PMBOK 7th edition has 12 principles · all surfaced with embodiment + anchor", () => {
  const r = buildProjectStatusPreview();
  assert.equal(r.pmbok_principles.length, 12);
  const ids = r.pmbok_principles.map((p) => p.id);
  for (const principle of [
    "stewardship",
    "team",
    "stakeholders",
    "value",
    "systems_thinking",
    "leadership",
    "tailoring",
    "quality",
    "complexity",
    "risk",
    "adaptability_resilience",
    "change",
  ]) {
    assert.ok(ids.includes(principle), `PMBOK principle missing: ${principle}`);
  }
  for (const p of r.pmbok_principles) {
    assert.ok(typeof p.pmbok_text === "string" && p.pmbok_text.length > 0);
    assert.ok(
      typeof p.bizra_embodiment === "string" && p.bizra_embodiment.length > 0,
    );
    assert.ok(typeof p.anchor === "string" && p.anchor.length > 0);
  }
});

test("Stakeholder role taxonomy includes the 7 canonical concentric-ring roles", () => {
  for (const role of [
    "founder",
    "first_invited",
    "candidate",
    "future_ring_2_cohort",
    "future_ring_3_design_partners",
    "future_ring_4_public",
    "concurrent_claude_session",
  ]) {
    assert.ok(
      PROJECT_STATUS_STAKEHOLDER_ROLES.includes(role),
      `role ${role} must be in taxonomy`,
    );
  }
});

test("primary_refusals surfaces 8-entry PM-applied refusal taxonomy", () => {
  const r = buildProjectStatusPreview();
  assert.equal(r.primary_refusals.length, 8);
  assert.equal(r.primary_refusals, PROJECT_STATUS_PRIMARY_REFUSALS);
  for (const refusal of [
    "refuse_to_claim_progress_without_receipt_evidence",
    "refuse_to_rate_quality_by_self_assessment_alone",
    "refuse_to_skip_a_stakeholder_ring_in_gtm_progression",
    "refuse_to_close_a_risk_without_named_mitigation",
    "refuse_to_advance_phase_without_predecessor_phase_complete",
    "refuse_to_count_features_or_loc_as_units_of_value",
    "refuse_to_publish_status_that_contradicts_receipt_chain",
    "refuse_to_hide_open_typed_gos_from_handoff_state",
  ]) {
    assert.ok(r.primary_refusals.includes(refusal));
  }
});

test("blocked_effects includes federation + receipt_mint + 8 PM-specific blocks", () => {
  const r = buildProjectStatusPreview();
  assert.ok(r.blocked_effects.includes("federation"));
  assert.ok(r.blocked_effects.includes("receipt_mint"));
  assert.ok(r.blocked_effects.includes("claim_progress_without_evidence"));
  assert.ok(
    r.blocked_effects.includes("rate_quality_by_self_reflection_alone"),
  );
  assert.ok(r.blocked_effects.includes("skip_stakeholder_in_ring_progression"));
  assert.ok(r.blocked_effects.includes("close_risk_without_mitigation"));
  assert.ok(r.blocked_effects.includes("hide_pending_typed_gos"));
});

test("Default project block has BIZRA framing + operator + phase", () => {
  const r = buildProjectStatusPreview();
  assert.match(r.project.name, /BIZRA/);
  assert.match(r.project.vision, /sovereign/i);
  assert.equal(r.project.operator_node, "Node0");
  assert.equal(r.project.current_phase, "phase_0_local_sovereign_runtime");
});

test("Value stream unit_of_value is ironclad_proof_forge_receipt (not features/LOC)", () => {
  const r = buildProjectStatusPreview();
  assert.equal(r.value_stream.unit_of_value, "ironclad_proof_forge_receipt");
  assert.match(r.value_stream.refusal_explicit, /NOT.*features.*LOC.*commits/);
});

test("Stakeholder with valid role is preserved", () => {
  const r = buildProjectStatusPreview({
    stakeholders: [
      {
        role: "founder",
        name: "Mumu",
        node_label: "Node0",
        node_ordinal: 0,
        status: "active",
        commitments: ["50% pool oath"],
      },
      {
        role: "first_invited",
        name: "Samy",
        node_label: "Node1",
        node_ordinal: 1,
        status: "ghost_accepted_pending_device_install",
      },
    ],
  });
  assert.equal(r.stakeholders.length, 2);
  assert.equal(r.stakeholders[0].role, "founder");
  assert.equal(r.stakeholders[0].name, "Mumu");
  assert.equal(r.stakeholders[1].name, "Samy");
  assert.equal(r.stakeholders[1].node_ordinal, 1);
});

test("Risk register with mitigation is preserved", () => {
  const r = buildProjectStatusPreview({
    risk_register: [
      {
        risk_id: "R1",
        title: "Push held since CI dispatch incident",
        severity: "medium",
        mitigation: "retry push when workflow worktree clean",
        status: "monitored",
        owner: "Mumu",
      },
    ],
  });
  assert.equal(r.risk_register.length, 1);
  assert.equal(r.risk_register[0].risk_id, "R1");
  assert.equal(r.risk_register[0].severity, "medium");
  assert.equal(r.risk_register[0].status, "monitored");
});

test("Quality posture surfaces 5-gate audit method", () => {
  const r = buildProjectStatusPreview({
    quality_posture: {
      master_craftsmanship_compliance: true,
      five_gate_state: "all_green",
    },
  });
  assert.equal(r.quality_posture.master_craftsmanship_compliance, true);
  assert.equal(r.quality_posture.five_gate_state, "all_green");
  assert.equal(
    r.quality_posture.canonical_boundary_keys,
    PREVIEW_BOUNDARY_CANONICAL_KEYS.length,
  );
  assert.match(r.quality_posture.audit_method, /smoke-boundary/);
});

test("Counters aggregate correctly", () => {
  const r = buildProjectStatusPreview({
    stakeholders: [
      { role: "founder", name: "M", node_label: "Node0", status: "active" },
      {
        role: "first_invited",
        name: "S",
        node_label: "Node1",
        status: "ghost_accepted_pending_device_install",
      },
      {
        role: "candidate",
        name: "V",
        node_label: "Node2",
        status: "not_yet_contacted",
      },
    ],
    risk_register: [
      {
        risk_id: "R1",
        title: "T1",
        severity: "low",
        mitigation: "M1",
        status: "monitored",
      },
      {
        risk_id: "R2",
        title: "T2",
        severity: "medium",
        mitigation: "M2",
        status: "mitigated",
      },
    ],
    open_typed_gos: [
      { phrase: "GO push", scope: "origin/main", halt_gate_class: "publish" },
    ],
  });
  assert.equal(r.counters.stakeholders_total, 3);
  assert.equal(r.counters.stakeholders_active, 2);
  assert.equal(r.counters.risks_total, 2);
  assert.equal(r.counters.risks_open, 1);
  assert.equal(r.counters.open_typed_gos, 1);
  assert.equal(r.counters.pmbok_principles_anchored, 12);
});

test("canon_anchors block cites all 3 structural laws + key ADRs + charter doc", () => {
  const r = buildProjectStatusPreview();
  assert.ok(r.canon_anchors.node_ordinal_law);
  assert.ok(r.canon_anchors.seed_pattern_invariant);
  assert.ok(r.canon_anchors.skill_growth_law);
  assert.ok(r.canon_anchors.adr_005);
  assert.ok(r.canon_anchors.adr_008);
  assert.ok(r.canon_anchors.adr_009_poi);
  assert.ok(r.canon_anchors.project_charter);
  assert.ok(r.canon_anchors.proof_forge_index);
});

test("Empty inputs yield valid status with zero counters", () => {
  const r = buildProjectStatusPreview();
  assert.equal(r.counters.stakeholders_total, 0);
  assert.equal(r.counters.risks_total, 0);
  assert.equal(r.counters.open_typed_gos, 0);
  assert.equal(r.counters.deferred_actions, 0);
});

// ─── 16 ADVERSARIAL TESTS ──────────────────────────────────────────────────

test("ADVERSARIAL: REFUSE to close a risk without named mitigation", () => {
  const r = buildProjectStatusPreview({
    risk_register: [
      {
        risk_id: "R1",
        title: "Sneaky risk",
        severity: "high",
        status: "closed_with_mitigation",
        // mitigation deliberately omitted
      },
    ],
  });
  // Refuse-as-product: status forced back to "open"
  assert.equal(r.risk_register[0].status, "open");
  assert.equal(r.risk_register[0].refused_close_without_mitigation, true);
  assert.equal(r.counters.risks_refused_close_without_mitigation, 1);
});

test("ADVERSARIAL: REFUSE to close a risk when mitigation is empty string", () => {
  const r = buildProjectStatusPreview({
    risk_register: [
      {
        risk_id: "R1",
        title: "T",
        severity: "high",
        mitigation: "",
        status: "mitigated",
      },
    ],
  });
  assert.equal(r.risk_register[0].status, "open");
  assert.equal(r.risk_register[0].refused_close_without_mitigation, true);
});

test("ADVERSARIAL: Unknown stakeholder role coerced to 'unknown' (not silently passed)", () => {
  const r = buildProjectStatusPreview({
    stakeholders: [
      { role: "ceo", name: "X", node_label: "Node0", status: "active" },
    ],
  });
  assert.equal(r.stakeholders[0].role, "unknown");
});

test("ADVERSARIAL: Invalid severity coerced to 'medium' (no silent injection)", () => {
  const r = buildProjectStatusPreview({
    risk_register: [
      {
        risk_id: "R1",
        title: "T",
        severity: "catastrophic_omg",
        mitigation: "M",
        status: "monitored",
      },
    ],
  });
  assert.equal(r.risk_register[0].severity, "medium");
});

test("ADVERSARIAL: Invalid risk status coerced to 'open' (safest default)", () => {
  const r = buildProjectStatusPreview({
    risk_register: [
      {
        risk_id: "R1",
        title: "T",
        severity: "high",
        mitigation: "M",
        status: "totally_fine",
      },
    ],
  });
  assert.equal(r.risk_register[0].status, "open");
});

test("ADVERSARIAL: Stakeholder with no name has node_ordinal still preserved", () => {
  const r = buildProjectStatusPreview({
    stakeholders: [
      { role: "candidate", node_ordinal: 2, status: "not_yet_contacted" },
    ],
  });
  assert.equal(r.stakeholders[0].name, null);
  assert.equal(r.stakeholders[0].node_ordinal, 2);
});

test("ADVERSARIAL: Mutation attempt on returned stakeholders is rejected (frozen)", () => {
  const r = buildProjectStatusPreview({
    stakeholders: [
      { role: "founder", name: "M", node_label: "Node0", status: "active" },
    ],
  });
  try {
    r.stakeholders.push({ role: "founder", name: "FakeFounder" });
  } catch (e) {
    /* expected */
  }
  assert.equal(r.stakeholders.length, 1);
  try {
    r.stakeholders[0].name = "Hacker";
  } catch (e) {
    /* expected */
  }
  assert.equal(r.stakeholders[0].name, "M");
});

test("ADVERSARIAL: Mutation attempt on returned pmbok_principles is rejected", () => {
  const r = buildProjectStatusPreview();
  try {
    r.pmbok_principles.push({ id: "fake_principle" });
  } catch (e) {
    /* expected */
  }
  assert.equal(r.pmbok_principles.length, 12);
});

test("ADVERSARIAL: Non-array stakeholders input coerced to empty array", () => {
  const r = buildProjectStatusPreview({ stakeholders: "not-an-array" });
  assert.equal(r.stakeholders.length, 0);
});

test("ADVERSARIAL: Non-array risk_register input coerced to empty array", () => {
  const r = buildProjectStatusPreview({ risk_register: { not: "an array" } });
  assert.equal(r.risk_register.length, 0);
});

test("ADVERSARIAL: Prototype pollution attempt via project input does not leak", () => {
  const polluted = { name: "X" };
  Object.setPrototypeOf(polluted, { secret_admin_token: "SHOULD_NOT_LEAK" });
  const r = buildProjectStatusPreview({ project: polluted });
  assert.equal("secret_admin_token" in r.project, false);
});

test("ADVERSARIAL: Project name as non-string falls back to BIZRA / Dema default", () => {
  const r = buildProjectStatusPreview({ project: { name: 42 } });
  assert.equal(r.project.name, "BIZRA / Dema");
});

test("ADVERSARIAL: open_typed_gos with non-string scope coerced to null", () => {
  const r = buildProjectStatusPreview({
    open_typed_gos: [
      {
        phrase: "GO push",
        scope: { evil: "object" },
        halt_gate_class: "publish",
      },
    ],
  });
  assert.equal(r.open_typed_gos[0].scope, null);
});

test("ADVERSARIAL: value_stream with non-numeric receipts_total coerced to null", () => {
  const r = buildProjectStatusPreview({
    value_stream: { receipts_total: "twenty-five", spine_surfaces: 12 },
  });
  assert.equal(r.value_stream.receipts_total, null);
  assert.equal(r.value_stream.spine_surfaces, 12);
});

test("ADVERSARIAL: stakeholder with status 'active' counts as active", () => {
  const r = buildProjectStatusPreview({
    stakeholders: [
      { role: "founder", name: "M", node_label: "Node0", status: "active" },
      {
        role: "candidate",
        name: "X",
        node_label: "Node2",
        status: "not_yet_contacted",
      },
    ],
  });
  assert.equal(r.counters.stakeholders_active, 1);
});

test("ADVERSARIAL: Deferred actions non-string entries filtered out", () => {
  const r = buildProjectStatusPreview({
    deferred_actions: ["Send Samy email", 42, null, "Build Node2 ceremony"],
  });
  assert.equal(r.deferred_actions.length, 2);
});
