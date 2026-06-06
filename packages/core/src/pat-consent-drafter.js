// C4 · PAT-5 · Consent Drafter (per ADR-008 §C4).
//
// Fifth of the 7 PATs. Role: draft exact-string consent phrases · present
// decision cards · NEVER approve · NEVER infer consent from implicit
// signals · NEVER fuzzy-match an operator typing.

import {
  buildAgentKernel,
  AGENT_KERNEL_MAX_ITERATIONS,
} from "./agent-kernel.js";
import { buildEffectCap } from "./effect-cap.js";
import { buildPreviewBoundary } from "./preview-boundary.js";

const SCHEMA = "bizra.dema.pat_consent_drafter.v0.1";
const DECISION_CARD_SCHEMA = "bizra.dema.consent_decision_card.v0.1";

const PAT5_PERSONA = Object.freeze({
  pat_number: 5,
  pat_id: "pat-5-consent-drafter",
  role_name: "consent_drafter",
  role_description:
    "Drafts exact-string consent phrases per ADR-005 · presents decision cards " +
    "with allowed/blocked effects clearly named · NEVER approves on behalf of " +
    "operator · NEVER fuzzy-matches a typed phrase · NEVER infers consent from " +
    "colloquial language.",
  primary_capabilities: Object.freeze([
    "draft_consent_phrase",
    "present_decision_card",
    "verify_exact_match",
    "classify_effect_risk",
  ]),
  primary_refusals: Object.freeze([
    "approve_on_behalf_of_operator",
    "fuzzy_match_consent_phrase",
    "case_insensitive_consent",
    "infer_consent_from_colloquial",
    "auto_renew_prior_consent",
    "skip_decision_card_presentation",
  ]),
});

const PAT5_EFFECT_CAP_ALLOWED = Object.freeze([
  "render_terminal_output",
  "compute_hash",
]);

const PAT5_EFFECT_CAP_EXTRA_BLOCKED = Object.freeze([
  "approve_on_behalf_of_operator",
  "fuzzy_match_consent_phrase",
  "case_insensitive_consent_check",
  "auto_renew_prior_consent",
  "infer_consent_from_implicit_signal",
]);

const PAT5_CONSENT_PHRASE_TEMPLATE =
  "GO: invoke PAT-5 consent_drafter to draft phrase";

const EFFECT_RISK_TIERS = Object.freeze({
  L0_OBSERVE: { tier: "L0", description: "pure read · no side effect" },
  L1_REMEMBER: { tier: "L1", description: "write to ~/.dema/ · reversible" },
  L2_PROPOSE: { tier: "L2", description: "generate preview · no execution" },
  L3_EXECUTE_LOCAL: {
    tier: "L3",
    description: "local file edit · branch create · reversible",
  },
  L4_GOVERNED_MUTATION: {
    tier: "L4",
    description: "mission submission · receipt mint · chain advance",
  },
  L5_IRREVERSIBLE: {
    tier: "L5",
    description: "push · key gen · public broadcast · external service",
  },
});

function safeString(v, fallback = "") {
  return typeof v === "string" ? v : fallback;
}

function filterStringArray(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.filter((v) => typeof v === "string" && v.length > 0);
}

function classifyEffectRisk(effect) {
  const e = String(effect || "").toLowerCase();
  if (/push|force_push|publish|broadcast|key_gen|external/.test(e)) return "L5";
  if (/mint|receipt|chain_advance|federation|node_connect|gateway/.test(e))
    return "L4";
  if (/write|edit|create_branch|commit|run_test/.test(e)) return "L3";
  if (/preview|draft|propose/.test(e)) return "L2";
  if (/remember|persist|today/.test(e)) return "L1";
  return "L0";
}

export function buildPATConsentDrafterEffectCap() {
  return buildEffectCap({
    name: "pat_consent_drafter",
    description: PAT5_PERSONA.role_description,
    allowed_effects: PAT5_EFFECT_CAP_ALLOWED,
    blocked_effects: PAT5_EFFECT_CAP_EXTRA_BLOCKED,
    consent_scope_template: PAT5_CONSENT_PHRASE_TEMPLATE,
    audit_trail_required: true,
  });
}

export function buildPATConsentDrafterPreview({ operator_name = "Mumu" } = {}) {
  return Object.freeze({
    schema: SCHEMA,
    truth_label: "NODE0_LOCAL_SEED",
    mode: "preview_only",
    persona: PAT5_PERSONA,
    serves_operator: safeString(operator_name, "Mumu"),
    effect_cap: buildPATConsentDrafterEffectCap(),
    consent_phrase_template: PAT5_CONSENT_PHRASE_TEMPLATE,
    memory_file_path: `~/.dema/agents/${PAT5_PERSONA.pat_id}/memory.json`,
    max_iterations: AGENT_KERNEL_MAX_ITERATIONS,
    effect_risk_tiers: EFFECT_RISK_TIERS,
    refusal_invariants: Object.freeze([
      "PAT-5 never approves on behalf of operator · only drafts",
      "PAT-5 never accepts a fuzzy-matched consent · exact string only",
      "PAT-5 never accepts a case-insensitive match · 'go' ≠ 'GO'",
      "PAT-5 never infers consent from colloquial language",
      "PAT-5 never auto-renews prior consent · each action gets fresh phrase",
    ]),
    boundary: buildPreviewBoundary(),
  });
}

export function buildPATConsentDrafterKernel({
  mission_intent = "",
  max_iterations = AGENT_KERNEL_MAX_ITERATIONS,
} = {}) {
  return buildAgentKernel({
    agent_id: PAT5_PERSONA.pat_id,
    agent_role: "pat_consent_drafter",
    mission_intent: safeString(mission_intent, ""),
    max_iterations,
  });
}

// Draft a consent decision card: clearly shows operator what's allowed
// vs blocked + computes a recommended consent phrase.
export function draftConsentDecisionCard({
  action_summary = "",
  allowed_effects = [],
  blocked_effects = [],
  scope_root = "",
} = {}) {
  const action = safeString(action_summary, "").trim();
  const allowed = filterStringArray(allowed_effects);
  const blocked = filterStringArray(blocked_effects);
  const scope = safeString(scope_root, "").trim();

  // Classify each effect by risk tier
  const allowedClassified = allowed.map((e) => ({
    effect: e,
    risk_tier: classifyEffectRisk(e),
  }));
  const blockedClassified = blocked.map((e) => ({
    effect: e,
    risk_tier: classifyEffectRisk(e),
  }));

  // Highest risk in allowed determines the overall consent intensity
  const tierOrder = { L0: 0, L1: 1, L2: 2, L3: 3, L4: 4, L5: 5 };
  const highestRiskTier = allowedClassified.reduce(
    (max, e) => (tierOrder[e.risk_tier] > tierOrder[max] ? e.risk_tier : max),
    "L0",
  );

  // Recommended consent phrase per tier
  let consentPhrase;
  if (action.length === 0) {
    consentPhrase = null;
  } else if (highestRiskTier === "L5") {
    consentPhrase = `GO: irreversibly ${action}`;
  } else if (highestRiskTier === "L4") {
    consentPhrase = `GO: mint-or-advance: ${action}`;
  } else if (highestRiskTier === "L3") {
    consentPhrase = `GO: locally execute: ${action} under '${scope}'`;
  } else {
    consentPhrase = `GO: preview-only: ${action}`;
  }

  const valid = action.length > 0 && allowed.length > 0 && blocked.length > 0;
  const refusal_reason = !valid
    ? action.length === 0
      ? "empty_action · cannot draft decision card"
      : allowed.length === 0
        ? "no_allowed_effects · decision card needs at least one allowed effect"
        : "no_blocked_effects · decision card must declare what is forbidden"
    : null;

  return Object.freeze({
    schema: DECISION_CARD_SCHEMA,
    truth_label: "NODE0_LOCAL_SEED",
    mode: "draft_only",
    drafted_by: PAT5_PERSONA.pat_id,
    drafted_at: new Date().toISOString(),
    action_summary: action,
    scope_root: scope,
    allowed_effects_classified: Object.freeze(
      allowedClassified.map((e) => Object.freeze(e)),
    ),
    blocked_effects_classified: Object.freeze(
      blockedClassified.map((e) => Object.freeze(e)),
    ),
    highest_risk_tier: highestRiskTier,
    recommended_consent_phrase: consentPhrase,
    requires_exact_match: true,
    requires_typed_go: true,
    valid,
    refusal_reason,
    audit_trail_required: true,
    receipt_shape_ready: valid,
    boundary: buildPreviewBoundary(),
  });
}

export function buildPATConsentDrafterSummary(options = {}) {
  const preview = buildPATConsentDrafterPreview(options);
  return Object.freeze({
    schema: "bizra.dema.pat_consent_drafter_summary.v0.1",
    truth_label: preview.truth_label,
    mode: "summary",
    source_schema: preview.schema,
    pat_number: preview.persona.pat_number,
    pat_id: preview.persona.pat_id,
    role_name: preview.persona.role_name,
    serves_operator: preview.serves_operator,
    capability_count: preview.persona.primary_capabilities.length,
    refusal_count: preview.persona.primary_refusals.length,
    boundary: preview.boundary,
  });
}

export const PAT_CONSENT_DRAFTER_SCHEMA_NAME = SCHEMA;
export const PAT_CONSENT_DRAFTER_DECISION_CARD_SCHEMA_NAME =
  DECISION_CARD_SCHEMA;
export const PAT_CONSENT_DRAFTER_PERSONA = PAT5_PERSONA;
export const PAT_CONSENT_DRAFTER_EFFECT_RISK_TIERS = EFFECT_RISK_TIERS;
