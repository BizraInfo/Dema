// C4 · PAT-2 · Research Companion (per ADR-008 §C4).
//
// Second of the 7 PATs. Role: bounded corpus query · evidence synthesis ·
// bounded web fetch (future C10 dependency). Drafts research plans
// describing what would be queried · returns evidence-shape objects.
//
// Like PAT-1, PAT-2 is config-and-helpers on top of C3/C2. Does NOT
// invoke LLM or fetch web in v0.1 · those are caller responsibilities
// once C8 (corpus integration) and C10 (web access) land.

import {
  buildAgentKernel,
  AGENT_KERNEL_MAX_ITERATIONS,
} from "./agent-kernel.js";
import { buildEffectCap } from "./effect-cap.js";
import { buildPreviewBoundary } from "./preview-boundary.js";

const SCHEMA = "bizra.dema.pat_research_companion.v0.1";
const RESEARCH_PLAN_SCHEMA = "bizra.dema.research_plan.v0.1";

const PAT2_PERSONA = Object.freeze({
  pat_number: 2,
  pat_id: "pat-2-research-companion",
  role_name: "research_companion",
  role_description:
    "Drafts bounded research plans · queries the operator's conversation corpus ·" +
    " requests bounded web fetch (when C10 lands) · synthesizes evidence into" +
    " hash-bound references. Never modifies corpus · never caches outside ~/.dema." +
    " All findings carry source hashes for re-verification.",
  primary_capabilities: Object.freeze([
    "draft_research_plan",
    "query_corpus_with_consent",
    "request_bounded_web_fetch",
    "synthesize_hash_bound_evidence",
  ]),
  primary_refusals: Object.freeze([
    "execute_runtime",
    "mint_receipts",
    "advance_chain",
    "modify_corpus_data",
    "cache_findings_outside_dema_home",
    "fetch_without_consent_per_url",
    "claim_findings_as_verified_without_source_hash",
  ]),
});

const PAT2_EFFECT_CAP_ALLOWED = Object.freeze([
  "render_terminal_output",
  "compute_hash",
  "stat_file_metadata",
]);

const PAT2_EFFECT_CAP_EXTRA_BLOCKED = Object.freeze([
  "modify_corpus_data",
  "cache_outside_dema_home",
  "fetch_without_consent",
  "claim_unverified_finding_as_verified",
]);

const PAT2_CONSENT_PHRASE_TEMPLATE =
  "GO: invoke PAT-2 research_companion to draft plan";

function safeString(v, fallback = "") {
  return typeof v === "string" ? v : fallback;
}

function filterStringArray(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.filter((v) => typeof v === "string" && v.length > 0);
}

export function buildPATResearchCompanionEffectCap() {
  return buildEffectCap({
    name: "pat_research_companion",
    description: PAT2_PERSONA.role_description,
    allowed_effects: PAT2_EFFECT_CAP_ALLOWED,
    blocked_effects: PAT2_EFFECT_CAP_EXTRA_BLOCKED,
    consent_scope_template: PAT2_CONSENT_PHRASE_TEMPLATE,
    audit_trail_required: true,
  });
}

export function buildPATResearchCompanionPreview({
  operator_name = "Mumu",
} = {}) {
  return Object.freeze({
    schema: SCHEMA,
    truth_label: "NODE0_LOCAL_SEED",
    mode: "preview_only",
    persona: PAT2_PERSONA,
    serves_operator: safeString(operator_name, "Mumu"),
    effect_cap: buildPATResearchCompanionEffectCap(),
    consent_phrase_template: PAT2_CONSENT_PHRASE_TEMPLATE,
    memory_file_path: `~/.dema/agents/${PAT2_PERSONA.pat_id}/memory.json`,
    max_iterations: AGENT_KERNEL_MAX_ITERATIONS,
    refusal_invariants: Object.freeze([
      "PAT-2 never modifies the source corpus · only reads with consent",
      "PAT-2 never caches findings outside ~/.dema · all evidence stays local",
      "PAT-2 never fetches a URL without per-URL consent (when C10 lands)",
      "PAT-2 never claims a finding as verified without a source hash",
    ]),
    boundary: buildPreviewBoundary(),
  });
}

export function buildPATResearchCompanionKernel({
  mission_intent = "",
  max_iterations = AGENT_KERNEL_MAX_ITERATIONS,
} = {}) {
  return buildAgentKernel({
    agent_id: PAT2_PERSONA.pat_id,
    agent_role: "pat_research_companion",
    mission_intent: safeString(mission_intent, ""),
    max_iterations,
  });
}

// Draft a research plan: declares queries to run + sources to consult +
// expected evidence shape. Plans are DRAFTS · execution happens when
// C8 (corpus) and C10 (web) land.
export function draftResearchPlan({
  research_question = "",
  sources_to_consult = [],
  expected_evidence_types = ["text_excerpt", "hash_bound_reference"],
} = {}) {
  const question = safeString(research_question, "").trim();
  const sources = filterStringArray(sources_to_consult);
  const evidenceTypes = filterStringArray(expected_evidence_types);

  // Categorize sources by type (URL · corpus path · memory file · etc.)
  const sourceCategories = sources.map((src) => {
    if (/^https?:\/\//i.test(src))
      return { source: src, category: "url", requires_web_consent: true };
    if (
      src.startsWith("~/.dema/memory/") ||
      src.startsWith("~/.dema/receipts/")
    ) {
      return {
        source: src,
        category: "local_dema_file",
        requires_web_consent: false,
      };
    }
    if (src.startsWith("corpus://"))
      return {
        source: src,
        category: "corpus_query",
        requires_web_consent: false,
      };
    return { source: src, category: "unknown", requires_web_consent: false };
  });

  const requiresAnyWebConsent = sourceCategories.some(
    (s) => s.requires_web_consent === true,
  );
  const consentPhrasePerUrl = sourceCategories
    .filter((s) => s.requires_web_consent === true)
    .map((s) => `GO: fetch '${s.source}'`);

  const valid =
    question.length > 0 && sources.length > 0 && evidenceTypes.length > 0;
  const refusal_reason = !valid
    ? question.length === 0
      ? "empty_question · cannot draft plan"
      : sources.length === 0
        ? "no_sources · plan would have nothing to query"
        : "no_evidence_types · plan must declare what evidence shapes to return"
    : null;

  return Object.freeze({
    schema: RESEARCH_PLAN_SCHEMA,
    truth_label: "NODE0_LOCAL_SEED",
    mode: "draft_only",
    drafted_by: PAT2_PERSONA.pat_id,
    drafted_at: new Date().toISOString(),
    research_question: question,
    sources_to_consult: Object.freeze(
      sourceCategories.map((s) => Object.freeze(s)),
    ),
    expected_evidence_types: Object.freeze([...new Set(evidenceTypes)]),
    requires_any_web_consent: requiresAnyWebConsent,
    consent_phrases_per_url: Object.freeze(consentPhrasePerUrl),
    queries_executed_count: 0,
    findings_count: 0,
    valid,
    refusal_reason,
    audit_trail_required: true,
    receipt_shape_ready: valid,
    boundary: buildPreviewBoundary(),
  });
}

export function buildPATResearchCompanionSummary(options = {}) {
  const preview = buildPATResearchCompanionPreview(options);
  return Object.freeze({
    schema: "bizra.dema.pat_research_companion_summary.v0.1",
    truth_label: preview.truth_label,
    mode: "summary",
    source_schema: preview.schema,
    pat_number: preview.persona.pat_number,
    pat_id: preview.persona.pat_id,
    role_name: preview.persona.role_name,
    serves_operator: preview.serves_operator,
    capability_count: preview.persona.primary_capabilities.length,
    refusal_count: preview.persona.primary_refusals.length,
    consent_phrase_template: preview.consent_phrase_template,
    boundary: preview.boundary,
  });
}

export const PAT_RESEARCH_COMPANION_SCHEMA_NAME = SCHEMA;
export const PAT_RESEARCH_COMPANION_PLAN_SCHEMA_NAME = RESEARCH_PLAN_SCHEMA;
export const PAT_RESEARCH_COMPANION_CONSENT_PHRASE_TEMPLATE =
  PAT2_CONSENT_PHRASE_TEMPLATE;
export const PAT_RESEARCH_COMPANION_PERSONA = PAT2_PERSONA;
