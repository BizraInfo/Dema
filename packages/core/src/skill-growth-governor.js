// Skill Growth Governor — v0.1
//
// The proof-governed growth layer DEMA needs in order to learn safely.
// Implements the four-line law authored 2026-05-18:
//
//     No learning without evaluation.
//     No evaluation without evidence.
//     No skill promotion without receipt.
//     No overwrite without human consent.
//
// This is DEMA's answer to the OpenClaw / Hermes "self-improving agent"
// failure mode: agents that reflect, write skill files, and overwrite their
// own (or worse, the human's) prior work without an audit trail or success
// gate. The governor refuses every promotion that does not pass five gates,
// and surfaces eight named refusal paths as data — refusal-as-product, the
// same shape applied to node onboarding (v0.1c) and ordinal registration
// (v0.1e+f).
//
// Bound by:
//   - Node ordinal law         (commit 1831aa9)  — skills owned per human-node
//   - Seed-pattern invariant   (commit 8b55321)  — every node carries same gates
//   - ADR-005 exact-string consent              — promotion phrase is typed-GO
//   - ADR-009 POI design       (commit 229b25e) — promoted skills feed POI score
//
// Pure builder · no I/O · no clock reads inside · deep-frozen · deterministic.

import { buildPreviewBoundary } from "./preview-boundary.js";

const SCHEMA = "bizra.dema.skill_growth_governor.v0.1";
const TRUTH_LABEL = "NODE0_LOCAL_SEED";
const MODE = "preview_only";

// ─── Canonical refusal taxonomy ────────────────────────────────────────────

// The eight refusals the governor structurally surfaces. Each gets its own
// reason-string returned in the per-candidate evaluation when triggered.
const PRIMARY_REFUSALS = Object.freeze([
  "refuse_to_overwrite_human_edited_skill",
  "refuse_to_promote_without_evidence",
  "refuse_to_promote_failed_task_outcome",
  "refuse_to_promote_without_success_metric",
  "refuse_to_emit_skill_change_without_typed_consent",
  "refuse_to_archive_pinned_skill",
  "refuse_to_score_skill_by_self_reflection_alone",
  "refuse_to_create_skill_overlapping_protected_namespace",
]);

// Effects this surface explicitly blocks. All preview-only spine surfaces
// declare blocked_effects · the governor adds skill-specific ones on top of
// the canonical 16-key boundary.
const BLOCKED_EFFECTS = Object.freeze([
  "silent_skill_overwrite",
  "self_reflection_only_promotion",
  "promotion_without_receipt_link",
  "archive_pinned_skill",
  "create_skill_in_protected_namespace_without_override",
  "federation",
  "network_used",
  "receipt_mint",
  "chain_advance",
]);

// Namespaces the governor protects by default. New skills inside these must
// declare protected_namespace_override: true to be even evaluated. (The
// override itself is data the SAT pipeline can still refuse later; this is
// the governor's first guard, not the only guard.)
const PROTECTED_NAMESPACES = Object.freeze(
  new Set([
    "consent",
    "boundary",
    "receipt_mint",
    "federation",
    "identity",
    "canon",
  ]),
);

// The promotion phrase template. ADR-005 binding: exact-string, no fuzzy,
// no case-insensitive, no prefix match, no clipboard paste.
const PROMOTION_PHRASE_TEMPLATE = "GO promote skill <id> v<version>";

// ─── Helpers ────────────────────────────────────────────────────────────────

function isNonEmptyString(v) {
  return typeof v === "string" && v.length > 0;
}

function isPositiveInt(v) {
  return typeof v === "number" && Number.isInteger(v) && v > 0;
}

function isArray(v) {
  return Array.isArray(v);
}

// Build the exact promotion phrase a candidate must have typed. Pure
// substitution into the canonical template — no shortcuts.
function buildPromotionPhrase(skillId, version) {
  return PROMOTION_PHRASE_TEMPLATE.replace("<id>", String(skillId)).replace(
    "<version>",
    String(version),
  );
}

function gateResult(passed, reason = null) {
  return Object.freeze({ passed, reason });
}

// Find the existing skill (if any) with the same skill_id in existing_skills.
function findExistingSkill(skillId, existingSkills) {
  if (!isArray(existingSkills)) return null;
  return existingSkills.find((s) => s && s.skill_id === skillId) ?? null;
}

// Evaluate a single candidate against all 5 gates · pure function.
// Returns { gates, refusals, all_gates_passed, next_action }.
function evaluateCandidate(candidate, existingSkills) {
  const refusals = [];
  const gates = {};

  // Gate 1: evidence_exists — at least one receipt link
  const evidenceLinks = isArray(candidate?.evidence_receipt_ids)
    ? candidate.evidence_receipt_ids.filter(isNonEmptyString)
    : [];
  if (evidenceLinks.length === 0) {
    gates.evidence_exists = gateResult(false, "no_receipt_ids_linked");
    refusals.push("refuse_to_promote_without_evidence");
  } else {
    gates.evidence_exists = gateResult(true);
  }

  // Gate 2: success_metric_present — declared + scored + passed
  const sm = candidate?.success_metric;
  const smOk =
    sm &&
    typeof sm === "object" &&
    isNonEmptyString(sm.kind) &&
    typeof sm.score === "number" &&
    typeof sm.threshold === "number" &&
    typeof sm.passed === "boolean";
  if (!smOk) {
    gates.success_metric_present = gateResult(
      false,
      "success_metric_missing_or_malformed",
    );
    refusals.push("refuse_to_promote_without_success_metric");
  } else if (sm.passed === false) {
    gates.success_metric_present = gateResult(
      false,
      "success_metric_did_not_pass_threshold",
    );
    // Same refusal taxonomy: a metric that didn't pass is treated as no usable metric
    refusals.push("refuse_to_promote_without_success_metric");
  } else {
    gates.success_metric_present = gateResult(true);
  }

  // Gate 3: no_boundary_violation — the candidate must explicitly declare it
  // would not flip any canonical 16-key boundary if promoted. Default to
  // false (refuse) unless the caller passes the flag set to true.
  if (candidate?.no_boundary_violation === true) {
    gates.no_boundary_violation = gateResult(true);
  } else {
    gates.no_boundary_violation = gateResult(
      false,
      "boundary_violation_flag_not_explicitly_true",
    );
  }

  // Gate 4: sat_review_passed — upstream SAT pipeline verdict
  if (candidate?.sat_review_status === "passed") {
    gates.sat_review_passed = gateResult(true);
  } else {
    gates.sat_review_passed = gateResult(false, "sat_review_status_not_passed");
  }

  // Gate 5: human_consent_received — exact-string match
  const expectedPhrase = buildPromotionPhrase(
    candidate?.skill_id,
    candidate?.candidate_version,
  );
  const typedPhrase = candidate?.human_consent_phrase_typed ?? "";
  if (typeof typedPhrase === "string" && typedPhrase === expectedPhrase) {
    gates.human_consent_received = gateResult(true);
  } else {
    gates.human_consent_received = gateResult(
      false,
      "consent_phrase_not_typed_verbatim",
    );
    refusals.push("refuse_to_emit_skill_change_without_typed_consent");
  }

  // Side refusals (independent of the 5 gates) ────────────────────────────

  // A. Human-edit protection — sacred
  const existing = findExistingSkill(candidate?.skill_id, existingSkills);
  if (existing && existing.human_edit_protected === true) {
    refusals.push("refuse_to_overwrite_human_edited_skill");
  }

  // B. Failed task outcome — cannot promote
  if (candidate?.task_outcome === "failure") {
    refusals.push("refuse_to_promote_failed_task_outcome");
  }

  // C. Self-reflection-only — refused
  if (candidate?.self_reflection_only === true) {
    refusals.push("refuse_to_score_skill_by_self_reflection_alone");
  }

  // D. Pinned-skill archival
  if (
    candidate?.requested_action === "archive" &&
    existing &&
    existing.pinned === true
  ) {
    refusals.push("refuse_to_archive_pinned_skill");
  }

  // E. Protected namespace — no override
  if (
    isNonEmptyString(candidate?.namespace) &&
    PROTECTED_NAMESPACES.has(candidate.namespace) &&
    candidate.protected_namespace_override !== true
  ) {
    refusals.push("refuse_to_create_skill_overlapping_protected_namespace");
  }

  // ─── Final next_action computation ─────────────────────────────────────
  const allGatesPassed =
    gates.evidence_exists.passed &&
    gates.success_metric_present.passed &&
    gates.no_boundary_violation.passed &&
    gates.sat_review_passed.passed &&
    gates.human_consent_received.passed;
  const hasRefusals = refusals.length > 0;

  let next_action;
  if (hasRefusals) {
    next_action = "halt";
  } else if (allGatesPassed) {
    next_action = "promote";
  } else {
    next_action = "propose";
  }

  return Object.freeze({
    skill_id: candidate?.skill_id ?? null,
    candidate_version: candidate?.candidate_version ?? null,
    namespace: candidate?.namespace ?? null,
    requested_action: candidate?.requested_action ?? "promote",
    gates: Object.freeze(gates),
    all_gates_passed: allGatesPassed,
    refusals: Object.freeze([...new Set(refusals)]),
    next_action,
    promotion_phrase_required: expectedPhrase,
    existing_skill_protected:
      existing?.human_edit_protected === true ||
      existing?.pinned === true ||
      false,
  });
}

// ─── Main builder ───────────────────────────────────────────────────────────

export function buildSkillGrowthGovernorPreview({
  skill_candidates = [],
  existing_skills = [],
} = {}) {
  const candidatesIn = isArray(skill_candidates) ? skill_candidates : [];
  const existingIn = isArray(existing_skills) ? existing_skills : [];

  // Defensive freeze of existing skills surface
  const existingOut = existingIn
    .filter((s) => s && isNonEmptyString(s.skill_id))
    .map((s) =>
      Object.freeze({
        skill_id: s.skill_id,
        current_version: isPositiveInt(s.current_version)
          ? s.current_version
          : 1,
        human_edit_protected: s.human_edit_protected === true,
        pinned: s.pinned === true,
        last_edited_by: ["human", "dema", "sat"].includes(s.last_edited_by)
          ? s.last_edited_by
          : "unknown",
        namespace: isNonEmptyString(s.namespace) ? s.namespace : null,
      }),
    );

  // Per-candidate evaluation
  const evaluations = candidatesIn.map((c) =>
    evaluateCandidate(c, existingOut),
  );

  // Aggregate counters · what a TUI Growth panel needs at a glance
  const counters = {
    candidates_total: evaluations.length,
    candidates_promotable: evaluations.filter(
      (e) => e.next_action === "promote",
    ).length,
    candidates_halted: evaluations.filter((e) => e.next_action === "halt")
      .length,
    candidates_proposed: evaluations.filter((e) => e.next_action === "propose")
      .length,
    human_edited_skills_protected: existingOut.filter(
      (s) => s.human_edit_protected,
    ).length,
    pinned_skills: existingOut.filter((s) => s.pinned).length,
    refusals_total: evaluations.reduce((sum, e) => sum + e.refusals.length, 0),
  };

  return Object.freeze({
    schema: SCHEMA,
    truth_label: TRUTH_LABEL,
    mode: MODE,
    receipt_shape_ready: true,
    four_line_law: Object.freeze([
      "No learning without evaluation.",
      "No evaluation without evidence.",
      "No skill promotion without receipt.",
      "No overwrite without human consent.",
    ]),
    five_gates: Object.freeze([
      "evidence_exists",
      "success_metric_present",
      "no_boundary_violation",
      "sat_review_passed",
      "human_consent_received",
    ]),
    primary_refusals: PRIMARY_REFUSALS,
    blocked_effects: BLOCKED_EFFECTS,
    protected_namespaces: Object.freeze([...PROTECTED_NAMESPACES].sort()),
    consent: Object.freeze({
      promotion_phrase_template: PROMOTION_PHRASE_TEMPLATE,
      exact_string_required: true,
      fuzzy_match_allowed: false,
      case_insensitive_allowed: false,
      prefix_match_allowed: false,
      paste_allowed: false,
      adr_005_anchor:
        "docs/06-adr/ADR-005-operator-actions-require-explicit-consent.md",
    }),
    existing_skills: Object.freeze(existingOut),
    candidate_evaluations: Object.freeze(evaluations),
    counters: Object.freeze(counters),
    canon_anchors: Object.freeze({
      ordinal_law: "docs/canon/BIZRA_TOPOLOGY_CANON.md#node-ordinal-law",
      seed_pattern:
        "docs/canon/BIZRA_TOPOLOGY_CANON.md#seed-pattern-invariant-fractality",
      adr_005:
        "docs/06-adr/ADR-005-operator-actions-require-explicit-consent.md",
      adr_009_poi: "docs/06-adr/ADR-009-poi-proof-of-impact-design.md",
    }),
    boundary: buildPreviewBoundary(),
  });
}

// ─── Public constants ──────────────────────────────────────────────────────

export const SKILL_GROWTH_GOVERNOR_SCHEMA = SCHEMA;
export const SKILL_GROWTH_GOVERNOR_PRIMARY_REFUSALS = PRIMARY_REFUSALS;
export const SKILL_GROWTH_GOVERNOR_PROTECTED_NAMESPACES = PROTECTED_NAMESPACES;
export const SKILL_GROWTH_GOVERNOR_PROMOTION_PHRASE_TEMPLATE =
  PROMOTION_PHRASE_TEMPLATE;
export const SKILL_GROWTH_GOVERNOR_FIVE_GATES = Object.freeze([
  "evidence_exists",
  "success_metric_present",
  "no_boundary_violation",
  "sat_review_passed",
  "human_consent_received",
]);
