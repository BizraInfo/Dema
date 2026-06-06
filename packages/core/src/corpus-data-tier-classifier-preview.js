export const CORPUS_DATA_TIER_CLASSIFIER_PREVIEW_SCHEMA =
  "bizra.dema.corpus_data_tier_classifier_preview.v0.1";

const SOURCE_IDS = Object.freeze([
  "claude_desktop",
  "chatgpt_team",
  "google_gemini",
  "deepseek",
  "kimi",
  "z_ai",
  "other",
]);

const DATA_TIERS = Object.freeze([
  Object.freeze({
    tier: "D0",
    label: "public_or_non_sensitive",
    allowed_in_preview: true,
  }),
  Object.freeze({
    tier: "D1",
    label: "preferences_and_style",
    allowed_in_preview: true,
  }),
  Object.freeze({
    tier: "D2",
    label: "project_reasoning",
    allowed_in_preview: true,
  }),
  Object.freeze({
    tier: "D3",
    label: "private_strategy",
    allowed_in_preview: false,
  }),
  Object.freeze({
    tier: "D4",
    label: "secrets_credentials_identity_financial_health",
    allowed_in_preview: false,
  }),
]);

const TIER_RANKS = Object.freeze({ D0: 0, D1: 1, D2: 2, D3: 3, D4: 4 });

const SIGNAL_TIERS = Object.freeze({
  public_context: "D0",
  documentation: "D0",
  released_artifact: "D0",
  non_sensitive_reference: "D0",
  preference: "D1",
  tone: "D1",
  workflow: "D1",
  ux_feedback: "D1",
  model_reliability_observation: "D1",
  project_reasoning: "D2",
  architecture: "D2",
  implementation_plan: "D2",
  test_strategy: "D2",
  process_pattern: "D2",
  snr_pattern: "D2",
  private_strategy: "D3",
  investor_narrative: "D3",
  negotiation: "D3",
  unreleased_roadmap: "D3",
  competitive_positioning: "D3",
  secret: "D4",
  credential: "D4",
  api_key: "D4",
  token: "D4",
  identity_document: "D4",
  financial_account: "D4",
  health_data: "D4",
  biometric: "D4",
  private_key: "D4",
});

const ALLOWED_USES = Object.freeze([
  "source_inventory",
  "data_tier_classification_design",
  "snr_pattern_design",
  "micro_consent_classifier_design",
  "dema_ux_optimization_design",
  "process_mining_rule_design",
  "model_reliability_profile_design",
]);

const BLOCKED_USES = Object.freeze([
  "raw_ingestion",
  "content_extraction",
  "external_upload",
  "fine_tuning",
  "embedding_creation",
  "runtime_memory_mutation",
  "sharing_with_node1_node4",
  "secret_extraction",
  "identity_or_financial_profiling",
  "receipt_minting",
  "step7_minting",
]);

const RAW_CONTENT_KEYS = new Set([
  "content",
  "conversation",
  "conversations",
  "messages",
  "raw_text",
  "transcript",
  "prompt",
  "response",
]);

const DEFAULT_ITEMS = Object.freeze([
  Object.freeze({
    item_id: "public_launch_note",
    source_id: "chatgpt_team",
    declared_signals: Object.freeze(["public_context", "documentation"]),
    expected_use: "source_inventory",
  }),
  Object.freeze({
    item_id: "operator_workflow_preference",
    source_id: "claude_desktop",
    declared_signals: Object.freeze(["preference", "workflow"]),
    expected_use: "dema_ux_optimization_design",
  }),
  Object.freeze({
    item_id: "node0_architecture_reasoning",
    source_id: "z_ai",
    declared_signals: Object.freeze([
      "architecture",
      "implementation_plan",
      "test_strategy",
    ]),
    expected_use: "data_tier_classification_design",
  }),
  Object.freeze({
    item_id: "investor_positioning_note",
    source_id: "other",
    declared_signals: Object.freeze(["private_strategy", "investor_narrative"]),
    expected_use: "snr_pattern_design",
  }),
  Object.freeze({
    item_id: "credential_or_identity_marker",
    source_id: "other",
    declared_signals: Object.freeze(["credential", "identity_document"]),
    expected_use: "source_inventory",
  }),
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value))
    return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function isSafeIdentifier(value) {
  return typeof value === "string" && /^[a-z0-9_]+$/.test(value);
}

function hasRawContent(item) {
  return Object.keys(item).some((key) => RAW_CONTENT_KEYS.has(key));
}

function tierDefinition(tier) {
  return DATA_TIERS.find((definition) => definition.tier === tier);
}

function dispositionForTier(tier) {
  if (tier === "D4")
    return "quarantine_secret_identity_or_high_sensitivity_metadata";
  if (tier === "D3") return "quarantine_private_strategy_metadata";
  return "preview_metadata_design_allowed";
}

function validateItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, reason: "items_must_be_non_empty_array" };
  }

  const seen = new Set();
  for (const item of items) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { ok: false, reason: "item_must_be_object" };
    }
    if (hasRawContent(item)) {
      return { ok: false, reason: "item_must_not_include_raw_content" };
    }
    if (!isSafeIdentifier(item.item_id) || seen.has(item.item_id)) {
      return { ok: false, reason: "item_id_must_be_unique_safe_identifier" };
    }
    seen.add(item.item_id);
    if (!SOURCE_IDS.includes(item.source_id)) {
      return { ok: false, reason: "source_id_not_allowlisted" };
    }
    if (!ALLOWED_USES.includes(item.expected_use)) {
      return { ok: false, reason: "expected_use_not_allowlisted" };
    }
    if (
      !Array.isArray(item.declared_signals) ||
      item.declared_signals.length === 0
    ) {
      return { ok: false, reason: "declared_signals_must_be_non_empty_array" };
    }
    for (const signal of item.declared_signals) {
      if (!isSafeIdentifier(signal) || !Object.hasOwn(SIGNAL_TIERS, signal)) {
        return { ok: false, reason: "declared_signal_not_allowlisted" };
      }
    }
  }

  return { ok: true };
}

function classifyItem(item) {
  const tier = item.declared_signals.reduce((highestTier, signal) => {
    const signalTier = SIGNAL_TIERS[signal];
    return TIER_RANKS[signalTier] > TIER_RANKS[highestTier]
      ? signalTier
      : highestTier;
  }, "D0");
  const definition = tierDefinition(tier);

  return {
    item_id: item.item_id,
    source_id: item.source_id,
    expected_use: item.expected_use,
    matched_signals: [...item.declared_signals].sort(),
    tier,
    label: definition.label,
    allowed_in_preview: definition.allowed_in_preview,
    disposition: dispositionForTier(tier),
  };
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
    step7_mint_attempted: false,
  };
}

function rejectPreview(reason) {
  return deepFreeze({
    schema: CORPUS_DATA_TIER_CLASSIFIER_PREVIEW_SCHEMA,
    truth_label: "DECLARED",
    mode: "PREVIEW_ONLY",
    verdict: "PREVIEW_REJECT",
    data_tiers: clone(DATA_TIERS),
    allowed_uses: clone(ALLOWED_USES),
    blocked_uses: clone(BLOCKED_USES),
    classifications: [],
    summary: {
      total_items: 0,
      preview_allowed_count: 0,
      quarantine_count: 0,
      counts_by_tier: { D0: 0, D1: 0, D2: 0, D3: 0, D4: 0 },
    },
    self_proactive_harness: {
      mode: "DETERMINISTIC_DATA_TIER_CLASSIFIER_PREVIEW",
      recommended_micro_action: "fix_malformed_classifier_inputs",
      gates: [
        {
          gate: "metadata_only_inputs",
          pass: reason !== "item_must_not_include_raw_content",
        },
        {
          gate: "signals_allowlisted",
          pass: reason !== "declared_signal_not_allowlisted",
        },
        { gate: "d3_d4_quarantine_available", pass: true },
        { gate: "local_only_boundary", pass: true },
      ],
    },
    self_critique: {
      confidence: "rejected",
      limitation:
        "Malformed classifier inputs are rejected before any data-tier posture can be trusted.",
      weakest_link: reason,
    },
    micro_compliance: {
      preview_only: true,
      deterministic: true,
      metadata_only: true,
      no_ingestion: true,
      no_embeddings: true,
      no_fine_tune: true,
      no_external_upload: true,
      no_runtime_memory_mutation: true,
      fail_closed_on_malformed_input: true,
    },
    micro_consent: {
      preview_scope: "corpus_data_tier_classifier_preview_only",
      raw_content_processing_authorized: false,
      d3_d4_processing_authorized: false,
      node_sharing_authorized: false,
      fine_tune_authorized: false,
      external_upload_authorized: false,
    },
    analogical_model: {
      model: "color_label_not_container_opening",
      mapping:
        "This preview labels sealed boxes by declared handling risk; it does not open, copy, upload, or train on the boxes.",
    },
    boundary: boundary(),
    next_safe_action: "fix_malformed_classifier_inputs",
    reason,
  });
}

export function buildCorpusDataTierClassifierPreview({
  items = DEFAULT_ITEMS,
} = {}) {
  const validation = validateItems(items);
  if (!validation.ok) return rejectPreview(validation.reason);

  const classifications = items.map(classifyItem);
  const countsByTier = { D0: 0, D1: 0, D2: 0, D3: 0, D4: 0 };
  for (const classification of classifications)
    countsByTier[classification.tier] += 1;
  const previewAllowedCount = classifications.filter(
    (classification) => classification.allowed_in_preview,
  ).length;

  return deepFreeze({
    schema: CORPUS_DATA_TIER_CLASSIFIER_PREVIEW_SCHEMA,
    truth_label: "DECLARED",
    mode: "PREVIEW_ONLY",
    verdict: "PREVIEW_CLASSIFIED",
    data_tiers: clone(DATA_TIERS),
    allowed_uses: clone(ALLOWED_USES),
    blocked_uses: clone(BLOCKED_USES),
    classifications,
    summary: {
      total_items: classifications.length,
      preview_allowed_count: previewAllowedCount,
      quarantine_count: classifications.length - previewAllowedCount,
      counts_by_tier: countsByTier,
    },
    self_proactive_harness: {
      mode: "DETERMINISTIC_DATA_TIER_CLASSIFIER_PREVIEW",
      recommended_micro_action: "build_corpus_redaction_fixture_preview",
      gates: [
        { gate: "metadata_only_inputs", pass: true },
        { gate: "signals_allowlisted", pass: true },
        { gate: "d3_d4_quarantine_available", pass: true },
        { gate: "local_only_boundary", pass: true },
      ],
    },
    self_critique: {
      confidence: "bounded_preview",
      limitation:
        "Classification is based only on declared metadata signals; no conversation content is inspected or proven.",
      weakest_link: "operator_declared_signals_require_future_evidence",
    },
    micro_compliance: {
      preview_only: true,
      deterministic: true,
      metadata_only: true,
      no_ingestion: true,
      no_embeddings: true,
      no_fine_tune: true,
      no_external_upload: true,
      no_runtime_memory_mutation: true,
      fail_closed_on_malformed_input: false,
    },
    micro_consent: {
      preview_scope: "corpus_data_tier_classifier_preview_only",
      raw_content_processing_authorized: false,
      d3_d4_processing_authorized: false,
      node_sharing_authorized: false,
      fine_tune_authorized: false,
      external_upload_authorized: false,
    },
    analogical_model: {
      model: "color_label_not_container_opening",
      mapping:
        "This preview labels sealed boxes by declared handling risk; it does not open, copy, upload, or train on the boxes.",
    },
    boundary: boundary(),
    next_safe_action: "build_corpus_redaction_fixture_preview",
    note: "Corpus Data Tier Classifier Preview classifies allowlisted metadata signals only. It performs no raw ingestion, content extraction, embeddings, fine-tuning, upload, runtime memory mutation, node sharing, receipt mint, federation, runtime start, or Step 7 action.",
  });
}
