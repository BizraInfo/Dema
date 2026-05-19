export const MODEL_CORPUS_MANIFEST_PREVIEW_SCHEMA = "bizra.dema.model_corpus_manifest_preview.v0.1";

const SOURCE_IDS = Object.freeze([
  "claude_desktop",
  "chatgpt_team",
  "google_gemini",
  "deepseek",
  "kimi",
  "z_ai",
  "other"
]);

const DEFAULT_SOURCES = Object.freeze([
  Object.freeze({
    source_id: "claude_desktop",
    estimated_conversations: 900,
    source_type: "frontier_llm_chat",
    expected_strengths: Object.freeze(["synthesis", "long_context_reasoning", "investor_narrative"]),
    risk_notes: Object.freeze(["polished_overconfidence", "execution_detail_may_need_repo_proof"])
  }),
  Object.freeze({
    source_id: "chatgpt_team",
    estimated_conversations: 1400,
    source_type: "frontier_llm_chat",
    expected_strengths: Object.freeze(["planning", "coding", "tool_reasoning", "broad_synthesis"]),
    risk_notes: Object.freeze(["may_overgeneralize_without_current_repo_evidence"])
  }),
  Object.freeze({
    source_id: "google_gemini",
    estimated_conversations: null,
    source_type: "frontier_llm_chat",
    expected_strengths: Object.freeze(["multimodal_reasoning", "ecosystem_context"]),
    risk_notes: Object.freeze(["verify_current_facts_before_use"])
  }),
  Object.freeze({
    source_id: "deepseek",
    estimated_conversations: null,
    source_type: "frontier_llm_chat",
    expected_strengths: Object.freeze(["code_reasoning", "math", "compact_analysis"]),
    risk_notes: Object.freeze(["test_system_claims_against_repo"])
  }),
  Object.freeze({
    source_id: "kimi",
    estimated_conversations: null,
    source_type: "frontier_llm_chat",
    expected_strengths: Object.freeze(["long_context", "retrieval_heavy_synthesis"]),
    risk_notes: Object.freeze(["normalize_language_and_context_drift"])
  }),
  Object.freeze({
    source_id: "z_ai",
    estimated_conversations: null,
    source_type: "agent_sdk_workspace_chat",
    expected_strengths: Object.freeze(["local_skill_context", "workspace_tooling_context"]),
    risk_notes: Object.freeze(["separate_workspace_facts_from_bizra_facts"])
  }),
  Object.freeze({
    source_id: "other",
    estimated_conversations: null,
    source_type: "mixed_llm_chat",
    expected_strengths: Object.freeze(["diversity", "edge_case_detection"]),
    risk_notes: Object.freeze(["source_quality_must_be_classified_before_use"])
  })
]);

const RAW_CONTENT_KEYS = new Set([
  "content",
  "conversation",
  "conversations",
  "messages",
  "raw_text",
  "transcript",
  "prompt",
  "response"
]);

const ALLOWED_USES = Object.freeze([
  "source_inventory",
  "snr_pattern_design",
  "micro_consent_classifier_design",
  "dema_ux_optimization_design",
  "process_mining_rule_design",
  "model_reliability_profile_design"
]);

const BLOCKED_USES = Object.freeze([
  "raw_ingestion",
  "external_upload",
  "fine_tuning",
  "embedding_creation",
  "runtime_memory_mutation",
  "sharing_with_node1_node4",
  "secret_extraction",
  "identity_or_financial_profiling"
]);

const DATA_TIERS = Object.freeze([
  Object.freeze({ tier: "D0", label: "public_or_non_sensitive", allowed_in_preview: true }),
  Object.freeze({ tier: "D1", label: "preferences_and_style", allowed_in_preview: true }),
  Object.freeze({ tier: "D2", label: "project_reasoning", allowed_in_preview: true }),
  Object.freeze({ tier: "D3", label: "private_strategy", allowed_in_preview: false }),
  Object.freeze({ tier: "D4", label: "secrets_credentials_identity_financial_health", allowed_in_preview: false })
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function isNonNegativeIntegerOrNull(value) {
  return value === null || (Number.isInteger(value) && value >= 0);
}

function hasRawContent(source) {
  return Object.keys(source).some((key) => RAW_CONTENT_KEYS.has(key));
}

function validateSources(sources, totalEstimatedConversations) {
  if (!Array.isArray(sources) || sources.length === 0) {
    return { ok: false, reason: "sources_must_be_non_empty_array" };
  }
  const seen = new Set();
  let knownTotal = 0;
  for (const source of sources) {
    if (!source || typeof source !== "object" || Array.isArray(source)) {
      return { ok: false, reason: "source_must_be_object" };
    }
    if (hasRawContent(source)) {
      return { ok: false, reason: "source_must_not_include_raw_content" };
    }
    if (!SOURCE_IDS.includes(source.source_id)) {
      return { ok: false, reason: "source_id_not_allowlisted" };
    }
    if (seen.has(source.source_id)) {
      return { ok: false, reason: "source_id_must_be_unique" };
    }
    seen.add(source.source_id);
    if (!isNonNegativeIntegerOrNull(source.estimated_conversations)) {
      return { ok: false, reason: "estimated_conversations_must_be_non_negative_integer_or_null" };
    }
    if (source.estimated_conversations !== null) knownTotal += source.estimated_conversations;
    if (!Array.isArray(source.expected_strengths) || !Array.isArray(source.risk_notes)) {
      return { ok: false, reason: "source_strengths_and_risks_must_be_arrays" };
    }
  }
  if (!Number.isInteger(totalEstimatedConversations) || totalEstimatedConversations < knownTotal) {
    return { ok: false, reason: "total_estimated_conversations_must_cover_known_source_counts" };
  }
  return { ok: true, knownTotal };
}

function boundary() {
  return {
    raw_content_ingested: false,
    embeddings_created: false,
    fine_tune_started: false,
    external_upload_performed: false,
    runtime_memory_mutated: false,
    node_sharing_performed: false,
    filesystem_write_performed: false,
    network_called: false,
    runtime_started: false,
    federation_started: false,
    receipt_minted: false,
    step7_mint_attempted: false
  };
}

function rejectPreview(reason) {
  return deepFreeze({
    schema: MODEL_CORPUS_MANIFEST_PREVIEW_SCHEMA,
    truth_label: "DECLARED",
    mode: "PREVIEW_ONLY",
    verdict: "PREVIEW_REJECT",
    total_estimated_conversations: null,
    known_source_count_total: null,
    sources: [],
    allowed_uses: clone(ALLOWED_USES),
    blocked_uses: clone(BLOCKED_USES),
    data_tiers: clone(DATA_TIERS),
    self_proactive_harness: {
      mode: "DETERMINISTIC_MANIFEST_PREVIEW",
      recommended_micro_action: "fix_malformed_manifest_inputs",
      gates: [
        { gate: "source_inventory_structured", pass: false },
        { gate: "raw_content_absent", pass: reason !== "source_must_not_include_raw_content" },
        { gate: "local_only_boundary", pass: true },
        { gate: "node_sharing_blocked", pass: true }
      ]
    },
    self_critique: {
      confidence: "rejected",
      limitation: "Malformed manifest inputs are rejected before any corpus inventory can be trusted.",
      weakest_link: reason
    },
    micro_compliance: {
      preview_only: true,
      deterministic: true,
      no_ingestion: true,
      no_embeddings: true,
      no_fine_tune: true,
      no_external_upload: true,
      no_runtime_memory_mutation: true,
      fail_closed_on_malformed_input: true
    },
    micro_consent: {
      preview_scope: "model_corpus_manifest_preview_only",
      operator_declared_asset_only: true,
      raw_content_processing_authorized: false,
      node_sharing_authorized: false,
      fine_tune_authorized: false,
      external_upload_authorized: false
    },
    analogical_model: {
      model: "ore_manifest_not_refinery",
      mapping: "This preview lists where cognitive ore may exist; it does not mine, melt, upload, or train on it."
    },
    boundary: boundary(),
    next_safe_action: "fix_malformed_manifest_inputs",
    reason
  });
}

export function buildModelCorpusManifestPreview({
  totalEstimatedConversations = 5000,
  sources = DEFAULT_SOURCES
} = {}) {
  const validation = validateSources(sources, totalEstimatedConversations);
  if (!validation.ok) return rejectPreview(validation.reason);

  return deepFreeze({
    schema: MODEL_CORPUS_MANIFEST_PREVIEW_SCHEMA,
    truth_label: "DECLARED",
    mode: "PREVIEW_ONLY",
    verdict: "PARTIAL_PLACEHOLDER",
    total_estimated_conversations: totalEstimatedConversations,
    known_source_count_total: validation.knownTotal,
    sources: clone(sources),
    allowed_uses: clone(ALLOWED_USES),
    blocked_uses: clone(BLOCKED_USES),
    data_tiers: clone(DATA_TIERS),
    source_reliability_profile_required: true,
    cross_model_snr_scoring_required: true,
    self_proactive_harness: {
      mode: "DETERMINISTIC_MANIFEST_PREVIEW",
      recommended_micro_action: "build_corpus_data_tier_classifier_preview",
      gates: [
        { gate: "source_inventory_structured", pass: true },
        { gate: "raw_content_absent", pass: true },
        { gate: "local_only_boundary", pass: true },
        { gate: "node_sharing_blocked", pass: true }
      ]
    },
    self_critique: {
      confidence: "bounded_preview",
      limitation: "Counts and sources are operator-declared until independently inventoried; this preview does not inspect any conversation content.",
      weakest_link: "source_counts_not_yet_evidence_backed"
    },
    micro_compliance: {
      preview_only: true,
      deterministic: true,
      no_ingestion: true,
      no_embeddings: true,
      no_fine_tune: true,
      no_external_upload: true,
      no_runtime_memory_mutation: true,
      fail_closed_on_malformed_input: false
    },
    micro_consent: {
      preview_scope: "model_corpus_manifest_preview_only",
      operator_declared_asset_only: true,
      raw_content_processing_authorized: false,
      node_sharing_authorized: false,
      fine_tune_authorized: false,
      external_upload_authorized: false
    },
    analogical_model: {
      model: "ore_manifest_not_refinery",
      mapping: "This preview lists where cognitive ore may exist; it does not mine, melt, upload, or train on it."
    },
    boundary: boundary(),
    next_safe_action: "build_corpus_data_tier_classifier_preview",
    note: "Model Corpus Manifest Preview inventories operator-declared multi-model conversation sources only. It performs no raw ingestion, embeddings, fine-tuning, upload, runtime memory mutation, node sharing, runtime start, federation, receipt mint, or Step 7 action."
  });
}
