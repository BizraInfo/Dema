// C5 · SAT-2 · Consent Auditor (per ADR-008 §C5).
//
// Second of the 5 SATs. Role: verify every L3+ action has an exact-string
// consent phrase + audit trail. NEVER accepts fuzzy consent · NEVER waives
// audit trail requirement.

import { buildAgentKernel, AGENT_KERNEL_MAX_ITERATIONS } from "./agent-kernel.js";
import { buildEffectCap } from "./effect-cap.js";
import { buildPreviewBoundary } from "./preview-boundary.js";

const SCHEMA = "bizra.dema.sat_consent_auditor.v0.1";
const VERDICT_SCHEMA = "bizra.dema.consent_audit_verdict.v0.1";

const SAT2_PERSONA = Object.freeze({
  sat_number: 2,
  sat_id: "sat-2-consent-auditor",
  role_name: "consent_auditor",
  role_description:
    "Audits actions for ADR-005 compliance: every L3+ action must have an " +
    "exact-string consent phrase + audit trail. NEVER accepts fuzzy match · " +
    "NEVER accepts case-insensitive match · NEVER waives audit requirement.",
  primary_capabilities: Object.freeze([
    "verify_consent_phrase_exact_match",
    "verify_audit_trail_present",
    "classify_action_risk_tier",
    "report_specific_audit_failures"
  ]),
  primary_refusals: Object.freeze([
    "accept_fuzzy_consent",
    "accept_case_insensitive_consent",
    "waive_audit_trail_requirement",
    "approve_l3_plus_without_consent",
    "modify_audited_action"
  ])
});

const SAT2_EFFECT_CAP_ALLOWED = Object.freeze(["render_terminal_output", "compute_hash"]);
const SAT2_EFFECT_CAP_EXTRA_BLOCKED = Object.freeze([
  "accept_fuzzy_consent",
  "waive_audit_trail",
  "approve_without_consent"
]);
const SAT2_CONSENT_PHRASE_TEMPLATE = "GO: invoke SAT-2 consent_auditor to audit";

const RISK_TIER_THRESHOLDS = Object.freeze({
  L0: { requires_consent: false, requires_audit_trail: false },
  L1: { requires_consent: false, requires_audit_trail: true },
  L2: { requires_consent: false, requires_audit_trail: true },
  L3: { requires_consent: true, requires_audit_trail: true },
  L4: { requires_consent: true, requires_audit_trail: true },
  L5: { requires_consent: true, requires_audit_trail: true }
});

function safeString(v, fallback = "") {
  return typeof v === "string" ? v : fallback;
}

function safeObject(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : null;
}

export function buildSATConsentAuditorEffectCap() {
  return buildEffectCap({
    name: "sat_consent_auditor",
    description: SAT2_PERSONA.role_description,
    allowed_effects: SAT2_EFFECT_CAP_ALLOWED,
    blocked_effects: SAT2_EFFECT_CAP_EXTRA_BLOCKED,
    consent_scope_template: SAT2_CONSENT_PHRASE_TEMPLATE,
    audit_trail_required: true
  });
}

export function buildSATConsentAuditorPreview() {
  return Object.freeze({
    schema: SCHEMA,
    truth_label: "NODE0_LOCAL_SEED",
    mode: "preview_only",
    persona: SAT2_PERSONA,
    effect_cap: buildSATConsentAuditorEffectCap(),
    consent_phrase_template: SAT2_CONSENT_PHRASE_TEMPLATE,
    memory_file_path: `~/.dema/agents/${SAT2_PERSONA.sat_id}/memory.json`,
    max_iterations: AGENT_KERNEL_MAX_ITERATIONS,
    risk_tier_thresholds: RISK_TIER_THRESHOLDS,
    refusal_invariants: Object.freeze([
      "SAT-2 never accepts fuzzy consent · exact string only",
      "SAT-2 never accepts case-insensitive consent",
      "SAT-2 never waives the audit trail requirement",
      "SAT-2 never approves an L3+ action without consent"
    ]),
    boundary: buildPreviewBoundary()
  });
}

export function buildSATConsentAuditorKernel({ mission_intent = "", max_iterations = AGENT_KERNEL_MAX_ITERATIONS } = {}) {
  return buildAgentKernel({
    agent_id: SAT2_PERSONA.sat_id,
    agent_role: "sat_consent_auditor",
    mission_intent: typeof mission_intent === "string" ? mission_intent : "",
    max_iterations
  });
}

// Audit an action for ADR-005 compliance.
//
// Action shape:
//   {
//     action_name: string
//     risk_tier: "L0"|"L1"|"L2"|"L3"|"L4"|"L5"
//     consent_phrase_required: string (the canonical phrase)
//     consent_phrase_provided: string (what operator typed)
//     audit_trail: object (receipt-shape or event-shape)
//   }
export function auditAction({ action = null } = {}) {
  const safeAction = safeObject(action);
  if (!safeAction) {
    return buildVerdict({
      verdict: "structurally_invalid",
      passed: false,
      violations: ["action_not_an_object"],
      action_name: null,
      risk_tier: null
    });
  }

  const actionName = safeString(safeAction.action_name, "");
  const tier = safeString(safeAction.risk_tier, "");
  const required = safeString(safeAction.consent_phrase_required, "");
  const provided = safeString(safeAction.consent_phrase_provided, "");
  const auditTrail = safeAction.audit_trail;

  const thresholds = RISK_TIER_THRESHOLDS[tier];
  const violations = [];

  if (!thresholds) {
    violations.push(`unknown_risk_tier · '${tier}' · expected L0-L5`);
  } else {
    // Consent check
    if (thresholds.requires_consent) {
      if (required.length === 0) {
        violations.push("required_consent_phrase_missing_from_action");
      } else if (provided.length === 0) {
        violations.push("operator_did_not_provide_consent_phrase");
      } else if (provided !== required) {
        violations.push(`consent_phrase_mismatch · required '${required}' · got '${provided}'`);
      }
    }
    // Audit trail check
    if (thresholds.requires_audit_trail) {
      if (!auditTrail || typeof auditTrail !== "object") {
        violations.push("audit_trail_missing_or_invalid");
      }
    }
    // Action name check
    if (actionName.length === 0) {
      violations.push("action_name_missing");
    }
  }

  const passed = violations.length === 0;
  const verdict = passed ? "audited_ok" : (!thresholds ? "structurally_invalid" : "audit_failed");

  return buildVerdict({
    verdict,
    passed,
    violations,
    action_name: actionName,
    risk_tier: tier
  });
}

function buildVerdict({ verdict, passed, violations, action_name, risk_tier }) {
  return Object.freeze({
    schema: VERDICT_SCHEMA,
    truth_label: passed ? "MEASURED" : "AUDIT_FAILED",
    mode: "verdict",
    audited_by: SAT2_PERSONA.sat_id,
    audited_at: new Date().toISOString(),
    action_name,
    risk_tier,
    verdict,
    passed,
    violations: Object.freeze(violations),
    audit_trail_required: true,
    receipt_shape_ready: passed,
    boundary: buildPreviewBoundary()
  });
}

export function buildSATConsentAuditorSummary() {
  const preview = buildSATConsentAuditorPreview();
  return Object.freeze({
    schema: "bizra.dema.sat_consent_auditor_summary.v0.1",
    truth_label: preview.truth_label,
    mode: "summary",
    source_schema: preview.schema,
    sat_number: preview.persona.sat_number,
    role_name: preview.persona.role_name,
    capability_count: preview.persona.primary_capabilities.length,
    refusal_count: preview.persona.primary_refusals.length,
    boundary: preview.boundary
  });
}

export const SAT_CONSENT_AUDITOR_SCHEMA_NAME = SCHEMA;
export const SAT_CONSENT_AUDITOR_VERDICT_SCHEMA_NAME = VERDICT_SCHEMA;
export const SAT_CONSENT_AUDITOR_PERSONA = SAT2_PERSONA;
export const SAT_CONSENT_AUDITOR_RISK_TIER_THRESHOLDS = RISK_TIER_THRESHOLDS;
