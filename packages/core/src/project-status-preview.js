// Project Status Preview — v0.1
//
// PMBOK 7th-edition-aligned project surface that makes BIZRA's
// peak-project-management posture machine-verifiable. The companion to the
// human-facing canon at `docs/pm/PROJECT_CHARTER_AND_STATUS.md`: a reviewer
// asking "where is BIZRA?" can answer at three levels — read the canon,
// run `dema project-status --json`, or hash the receipt chain.
//
// Bound by all 3 structural laws of BIZRA topology:
//   - Node ordinal law         (commit 1831aa9)
//   - Seed-pattern invariant   (commit 8b55321)
//   - Skill Growth Law         (commit 1899332)
//
// PMBOK 7th-edition 12 principles surfaced as canon claims · each one bound
// to a structural mechanism in the codebase, not a slogan:
//   Stewardship · Team · Stakeholders · Value · Systems thinking · Leadership
//   Tailoring · Quality · Complexity · Risk · Adaptability/Resilience · Change
//
// Pure builder · deep-frozen · deterministic · no I/O · no clock reads inside.

import { buildPreviewBoundary } from "./preview-boundary.js";

const SCHEMA = "bizra.dema.project_status.v0.1";
const TRUTH_LABEL = "NODE0_LOCAL_SEED";
const MODE = "preview_only";

// ─── PMBOK 12-principle alignment (canon claims · each anchor-bound) ───────

const PMBOK_PRINCIPLES = Object.freeze([
  {
    id: "stewardship",
    pmbok_text: "Be a diligent, respectful, and caring steward.",
    bizra_embodiment: "CLAUDE.md halt gates · refuse-as-product taxonomy on every surface",
    anchor: "CLAUDE.md"
  },
  {
    id: "team",
    pmbok_text: "Create a collaborative project team environment.",
    bizra_embodiment: "node-level team · operator + invited humans via Node ordinal law · concentric rings refuse to skip cohorts",
    anchor: "docs/canon/BIZRA_TOPOLOGY_CANON.md#node-ordinal-law"
  },
  {
    id: "stakeholders",
    pmbok_text: "Effectively engage with stakeholders.",
    bizra_embodiment: "evidence-first GTM rings · Ring-1 N=1 closed (Samy) · refuse to claim rings not earned",
    anchor: "feedback_evidence_first_gtm_concentric_rings (operator memory)"
  },
  {
    id: "value",
    pmbok_text: "Focus on value.",
    bizra_embodiment: "unit of value = IRONCLAD Proof-Forge receipt · not features · not LOC · not commits",
    anchor: ".proof-forge/EVIDENCE_INDEX.json"
  },
  {
    id: "systems_thinking",
    pmbok_text: "Recognize, evaluate, and respond to system interactions.",
    bizra_embodiment: "3 structural laws (Node ordinal · Seed-pattern · Skill Growth) jointly govern topology",
    anchor: "docs/canon/BIZRA_TOPOLOGY_CANON.md"
  },
  {
    id: "leadership",
    pmbok_text: "Demonstrate leadership behaviors.",
    bizra_embodiment: "operator leads by typing exact-string GO · refuses fuzzy consent · holds Daughter Test before every act",
    anchor: "docs/06-adr/ADR-005-operator-actions-require-explicit-consent.md"
  },
  {
    id: "tailoring",
    pmbok_text: "Tailor based on context.",
    bizra_embodiment: "Master Craftsmanship 10-invariant binding · tailored to each slice (preview vs runtime · pure vs impure)",
    anchor: "docs/06-adr/ADR-008-runtime-activation.md"
  },
  {
    id: "quality",
    pmbok_text: "Build quality into processes and deliverables.",
    bizra_embodiment: "5 verification gates run on every commit · 16-key canonical boundary on every spine surface · ≥15 adversarial tests per component",
    anchor: "scripts/smoke-boundary.mjs"
  },
  {
    id: "complexity",
    pmbok_text: "Navigate complexity.",
    bizra_embodiment: "preview-only spine · runtime lives upstream · scope discipline · same installer for every node",
    anchor: "scripts/install/install.sh"
  },
  {
    id: "risk",
    pmbok_text: "Optimize risk responses.",
    bizra_embodiment: "risk_register surface · refuse-as-product taxonomy · rollback paths documented · halt-gates explicit",
    anchor: "CLAUDE.md (halt gates section)"
  },
  {
    id: "adaptability_resilience",
    pmbok_text: "Embrace adaptability and resiliency.",
    bizra_embodiment: "every slice is reversible · install.sh --uninstall returns clean state · receipt chain immutable but configurable per branch",
    anchor: "docs/06-adr/ADR-007-multi-session-chain-policy.md"
  },
  {
    id: "change",
    pmbok_text: "Enable change to achieve the envisioned future state.",
    bizra_embodiment: "version-bumped per slice · canon amendments via ADR or explicit canon-edit commit · Skill Growth Law governs self-improvement",
    anchor: "docs/canon/BIZRA_TOPOLOGY_CANON.md#skill-growth-law"
  }
]);

// ─── Canonical stakeholder roles · concentric rings (per memory anchor) ────

const STAKEHOLDER_ROLE_TAXONOMY = Object.freeze([
  "founder",
  "first_invited",
  "candidate",
  "future_ring_2_cohort",
  "future_ring_3_design_partners",
  "future_ring_4_public",
  "concurrent_claude_session"
]);

// ─── Refusal-as-product applied to PM claims ───────────────────────────────

const PRIMARY_REFUSALS = Object.freeze([
  "refuse_to_claim_progress_without_receipt_evidence",
  "refuse_to_rate_quality_by_self_assessment_alone",
  "refuse_to_skip_a_stakeholder_ring_in_gtm_progression",
  "refuse_to_close_a_risk_without_named_mitigation",
  "refuse_to_advance_phase_without_predecessor_phase_complete",
  "refuse_to_count_features_or_loc_as_units_of_value",
  "refuse_to_publish_status_that_contradicts_receipt_chain",
  "refuse_to_hide_open_typed_gos_from_handoff_state"
]);

const BLOCKED_EFFECTS = Object.freeze([
  "claim_progress_without_evidence",
  "rate_quality_by_self_reflection_alone",
  "skip_stakeholder_in_ring_progression",
  "close_risk_without_mitigation",
  "advance_phase_without_predecessor_complete",
  "publish_contradicting_receipt_chain",
  "hide_pending_typed_gos",
  "federation",
  "network_used",
  "receipt_mint"
]);

// ─── Helpers ────────────────────────────────────────────────────────────────

function isNonEmptyString(v) {
  return typeof v === "string" && v.length > 0;
}

function freezeStakeholder(s) {
  return Object.freeze({
    role: STAKEHOLDER_ROLE_TAXONOMY.includes(s?.role) ? s.role : "unknown",
    name: isNonEmptyString(s?.name) ? s.name : null,
    node_label: isNonEmptyString(s?.node_label) ? s.node_label : null,
    node_ordinal: typeof s?.node_ordinal === "number" && Number.isInteger(s.node_ordinal) ? s.node_ordinal : null,
    status: isNonEmptyString(s?.status) ? s.status : "unknown",
    count: typeof s?.count === "number" ? s.count : null,
    commitments: Array.isArray(s?.commitments)
      ? Object.freeze(s.commitments.filter(isNonEmptyString))
      : Object.freeze([])
  });
}

function freezeRisk(r) {
  const valid_severities = ["low", "medium", "high", "critical"];
  const valid_statuses = ["open", "monitored", "mitigated", "closed_with_mitigation", "accepted"];
  const noMitigation = !isNonEmptyString(r?.mitigation);
  const tryingToClose = ["closed_with_mitigation", "mitigated"].includes(r?.status);
  // Refuse-as-product: cannot close a risk without a named mitigation
  const adjustedStatus = (tryingToClose && noMitigation) ? "open" : r?.status;
  return Object.freeze({
    risk_id: isNonEmptyString(r?.risk_id) ? r.risk_id : null,
    title: isNonEmptyString(r?.title) ? r.title : null,
    severity: valid_severities.includes(r?.severity) ? r.severity : "medium",
    mitigation: isNonEmptyString(r?.mitigation) ? r.mitigation : null,
    status: valid_statuses.includes(adjustedStatus) ? adjustedStatus : "open",
    owner: isNonEmptyString(r?.owner) ? r.owner : null,
    refused_close_without_mitigation: tryingToClose && noMitigation
  });
}

function freezeOpenGo(go) {
  return Object.freeze({
    phrase: isNonEmptyString(go?.phrase) ? go.phrase : null,
    scope: isNonEmptyString(go?.scope) ? go.scope : null,
    halt_gate_class: isNonEmptyString(go?.halt_gate_class) ? go.halt_gate_class : null
  });
}

// ─── Main builder ───────────────────────────────────────────────────────────

export function buildProjectStatusPreview({
  project = null,
  stakeholders = [],
  value_stream = null,
  risk_register = [],
  quality_posture = null,
  open_typed_gos = [],
  deferred_actions = [],
  current_head_commit = null,
  current_branch = null
} = {}) {
  // Defensive defaults · operator running the script may pass nothing
  const proj = project && typeof project === "object" ? project : {};
  const projectOut = Object.freeze({
    name: isNonEmptyString(proj.name) ? proj.name : "BIZRA / Dema",
    operator: isNonEmptyString(proj.operator) ? proj.operator : "MoMo",
    operator_node: isNonEmptyString(proj.operator_node) ? proj.operator_node : "Node0",
    vision: isNonEmptyString(proj.vision)
      ? proj.vision
      : "Sovereign AI nodes that grow without betraying their humans.",
    current_phase: isNonEmptyString(proj.current_phase)
      ? proj.current_phase
      : "phase_0_local_sovereign_runtime",
    start_date_iso: isNonEmptyString(proj.start_date_iso) ? proj.start_date_iso : null
  });

  const stakeholdersOut = Object.freeze(
    (Array.isArray(stakeholders) ? stakeholders : []).map(freezeStakeholder)
  );

  const vs = value_stream && typeof value_stream === "object" ? value_stream : {};
  const valueStreamOut = Object.freeze({
    unit_of_value: "ironclad_proof_forge_receipt",
    receipts_total: typeof vs.receipts_total === "number" ? vs.receipts_total : null,
    receipts_today: typeof vs.receipts_today === "number" ? vs.receipts_today : null,
    spine_surfaces: typeof vs.spine_surfaces === "number" ? vs.spine_surfaces : null,
    structural_laws_canonized: typeof vs.structural_laws_canonized === "number" ? vs.structural_laws_canonized : null,
    tests_total: typeof vs.tests_total === "number" ? vs.tests_total : null,
    tests_failing: typeof vs.tests_failing === "number" ? vs.tests_failing : null,
    external_humans_in_canon: typeof vs.external_humans_in_canon === "number" ? vs.external_humans_in_canon : null,
    refusal_explicit: "value is NOT counted in features, LOC, commits, stars, or downloads"
  });

  const risksOut = Object.freeze(
    (Array.isArray(risk_register) ? risk_register : []).map(freezeRisk)
  );

  const qp = quality_posture && typeof quality_posture === "object" ? quality_posture : {};
  const qualityPostureOut = Object.freeze({
    master_craftsmanship_compliance: qp.master_craftsmanship_compliance === true,
    five_gate_state: isNonEmptyString(qp.five_gate_state) ? qp.five_gate_state : "unknown",
    adversarial_floor_per_component: typeof qp.adversarial_floor_per_component === "number" ? qp.adversarial_floor_per_component : 15,
    canonical_boundary_keys: 16,
    audit_method: "smoke-boundary script + canon-check + integration-check + llm-guidance + forge-verify"
  });

  const openGosOut = Object.freeze(
    (Array.isArray(open_typed_gos) ? open_typed_gos : []).map(freezeOpenGo)
  );

  const deferredOut = Object.freeze(
    (Array.isArray(deferred_actions) ? deferred_actions : [])
      .filter(isNonEmptyString)
      .map((s) => s)
  );

  // Aggregate counters (refuse-as-product: hide nothing)
  const counters = Object.freeze({
    stakeholders_total: stakeholdersOut.length,
    stakeholders_active: stakeholdersOut.filter((s) => s.status === "active" || s.status === "ghost_accepted_pending_device_install").length,
    risks_total: risksOut.length,
    risks_open: risksOut.filter((r) => r.status === "open" || r.status === "monitored").length,
    risks_refused_close_without_mitigation: risksOut.filter((r) => r.refused_close_without_mitigation).length,
    open_typed_gos: openGosOut.length,
    deferred_actions: deferredOut.length,
    pmbok_principles_anchored: PMBOK_PRINCIPLES.length
  });

  return Object.freeze({
    schema: SCHEMA,
    truth_label: TRUTH_LABEL,
    mode: MODE,
    receipt_shape_ready: true,
    project: projectOut,
    current_head_commit: isNonEmptyString(current_head_commit) ? current_head_commit : null,
    current_branch: isNonEmptyString(current_branch) ? current_branch : null,
    stakeholders: stakeholdersOut,
    value_stream: valueStreamOut,
    risk_register: risksOut,
    quality_posture: qualityPostureOut,
    open_typed_gos: openGosOut,
    deferred_actions: deferredOut,
    counters,
    pmbok_principles: PMBOK_PRINCIPLES,
    primary_refusals: PRIMARY_REFUSALS,
    blocked_effects: BLOCKED_EFFECTS,
    canon_anchors: Object.freeze({
      node_ordinal_law: "docs/canon/BIZRA_TOPOLOGY_CANON.md#node-ordinal-law",
      seed_pattern_invariant: "docs/canon/BIZRA_TOPOLOGY_CANON.md#seed-pattern-invariant-fractality",
      skill_growth_law: "docs/canon/BIZRA_TOPOLOGY_CANON.md#skill-growth-law",
      adr_001: "docs/06-adr/ADR-001-dema-is-one-face.md",
      adr_005: "docs/06-adr/ADR-005-operator-actions-require-explicit-consent.md",
      adr_007: "docs/06-adr/ADR-007-multi-session-chain-policy.md",
      adr_008: "docs/06-adr/ADR-008-runtime-activation.md",
      adr_009_poi: "docs/06-adr/ADR-009-poi-proof-of-impact-design.md",
      project_charter: "docs/pm/PROJECT_CHARTER_AND_STATUS.md",
      proof_forge_index: ".proof-forge/EVIDENCE_INDEX.json"
    }),
    boundary: buildPreviewBoundary()
  });
}

// ─── Public constants ──────────────────────────────────────────────────────

export const PROJECT_STATUS_SCHEMA = SCHEMA;
export const PROJECT_STATUS_PMBOK_PRINCIPLES = PMBOK_PRINCIPLES;
export const PROJECT_STATUS_STAKEHOLDER_ROLES = STAKEHOLDER_ROLE_TAXONOMY;
export const PROJECT_STATUS_PRIMARY_REFUSALS = PRIMARY_REFUSALS;
