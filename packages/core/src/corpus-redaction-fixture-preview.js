export const CORPUS_REDACTION_FIXTURE_PREVIEW_SCHEMA =
  "bizra.dema.corpus_redaction_fixture_preview.v0.1";

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

const FIXTURE_TIERS = Object.freeze(["D0", "D1", "D2", "D3", "D4"]);

const ALLOWED_USES = Object.freeze([
  "redaction_policy_fixture_design",
  "data_tier_handling_preview",
  "benchmark_schema_design",
  "manual_review_queue_design",
]);

const BLOCKED_USES = Object.freeze([
  "raw_ingestion",
  "content_extraction",
  "redacting_real_corpus_text",
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
  "best_answer",
  "target_good",
  "target_bad",
]);

const DEFAULT_FIXTURES = Object.freeze([
  Object.freeze({
    fixture_id: "public_reference_fixture",
    source_id: "chatgpt_team",
    tier: "D0",
    declared_handling: "metadata_only_public_reference",
  }),
  Object.freeze({
    fixture_id: "workflow_preference_fixture",
    source_id: "claude_desktop",
    tier: "D1",
    declared_handling: "metadata_only_preference",
  }),
  Object.freeze({
    fixture_id: "architecture_reasoning_fixture",
    source_id: "z_ai",
    tier: "D2",
    declared_handling: "metadata_only_project_reasoning",
  }),
  Object.freeze({
    fixture_id: "private_strategy_fixture",
    source_id: "other",
    tier: "D3",
    declared_handling: "quarantine_private_strategy",
  }),
  Object.freeze({
    fixture_id: "credential_marker_fixture",
    source_id: "other",
    tier: "D4",
    declared_handling: "reject_secret_identity_or_credential",
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

function hasRawContent(fixture) {
  return Object.keys(fixture).some((key) => RAW_CONTENT_KEYS.has(key));
}

function tierDefinition(tier) {
  return DATA_TIERS.find((definition) => definition.tier === tier);
}

function actionForTier(tier) {
  if (tier === "D4") return "reject_secret_identity_or_credential_marker";
  if (tier === "D3") return "quarantine_private_strategy_marker";
  return "allow_metadata_only_marker";
}

function markerForTier(tier) {
  if (tier === "D4") return "[D4_REJECTED_NO_CONTENT_OPENED]";
  if (tier === "D3") return "[D3_QUARANTINED_NO_CONTENT_OPENED]";
  return `[${tier}_METADATA_ONLY_NO_CONTENT_OPENED]`;
}

function validateFixtures(fixtures) {
  if (!Array.isArray(fixtures) || fixtures.length === 0) {
    return { ok: false, reason: "fixtures_must_be_non_empty_array" };
  }

  const seen = new Set();
  for (const fixture of fixtures) {
    if (!fixture || typeof fixture !== "object" || Array.isArray(fixture)) {
      return { ok: false, reason: "fixture_must_be_object" };
    }
    if (hasRawContent(fixture)) {
      return { ok: false, reason: "fixture_must_not_include_raw_content" };
    }
    if (!isSafeIdentifier(fixture.fixture_id) || seen.has(fixture.fixture_id)) {
      return { ok: false, reason: "fixture_id_must_be_unique_safe_identifier" };
    }
    seen.add(fixture.fixture_id);
    if (!SOURCE_IDS.includes(fixture.source_id)) {
      return { ok: false, reason: "source_id_not_allowlisted" };
    }
    if (!FIXTURE_TIERS.includes(fixture.tier)) {
      return { ok: false, reason: "tier_not_allowlisted" };
    }
    if (!isSafeIdentifier(fixture.declared_handling)) {
      return { ok: false, reason: "declared_handling_must_be_safe_identifier" };
    }
  }

  return { ok: true };
}

function buildRedactionCase(fixture) {
  const definition = tierDefinition(fixture.tier);
  return {
    fixture_id: fixture.fixture_id,
    source_id: fixture.source_id,
    tier: fixture.tier,
    label: definition.label,
    declared_handling: fixture.declared_handling,
    policy_action: actionForTier(fixture.tier),
    preview_allowed: definition.allowed_in_preview,
    redaction_marker: markerForTier(fixture.tier),
    content_state: "not_present_not_opened",
    digest_state: "not_computed_no_ingestion",
  };
}

function boundary() {
  return {
    raw_content_ingested: false,
    raw_content_opened: false,
    real_redaction_performed: false,
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
    schema: CORPUS_REDACTION_FIXTURE_PREVIEW_SCHEMA,
    truth_label: "DECLARED",
    mode: "PREVIEW_ONLY",
    verdict: "PREVIEW_REJECT",
    data_tiers: clone(DATA_TIERS),
    allowed_uses: clone(ALLOWED_USES),
    blocked_uses: clone(BLOCKED_USES),
    redaction_cases: [],
    summary: {
      total_fixtures: 0,
      metadata_only_allowed_count: 0,
      quarantine_count: 0,
      reject_count: 0,
    },
    self_proactive_harness: {
      mode: "DETERMINISTIC_REDACTION_FIXTURE_PREVIEW",
      recommended_micro_action: "fix_malformed_redaction_fixtures",
      gates: [
        {
          gate: "fixture_metadata_only",
          pass: reason !== "fixture_must_not_include_raw_content",
        },
        { gate: "d3_quarantine_marker_available", pass: true },
        { gate: "d4_reject_marker_available", pass: true },
        { gate: "local_only_boundary", pass: true },
      ],
    },
    self_critique: {
      confidence: "rejected",
      limitation:
        "Malformed redaction fixtures are rejected before a safe handling preview can be trusted.",
      weakest_link: reason,
    },
    micro_compliance: {
      preview_only: true,
      deterministic: true,
      fixture_only: true,
      metadata_only: true,
      no_real_redaction: true,
      no_ingestion: true,
      no_embeddings: true,
      no_fine_tune: true,
      no_external_upload: true,
      no_runtime_memory_mutation: true,
      fail_closed_on_malformed_input: true,
    },
    micro_consent: {
      preview_scope: "corpus_redaction_fixture_preview_only",
      raw_content_processing_authorized: false,
      real_redaction_authorized: false,
      d3_d4_processing_authorized: false,
      node_sharing_authorized: false,
      fine_tune_authorized: false,
      external_upload_authorized: false,
    },
    analogical_model: {
      model: "sealed_box_handling_labels",
      mapping:
        "This preview proves which labels go on sealed boxes; it does not open boxes or redact live material.",
    },
    boundary: boundary(),
    next_safe_action: "fix_malformed_redaction_fixtures",
    reason,
  });
}

export function buildCorpusRedactionFixturePreview({
  fixtures = DEFAULT_FIXTURES,
} = {}) {
  const validation = validateFixtures(fixtures);
  if (!validation.ok) return rejectPreview(validation.reason);

  const redactionCases = fixtures.map(buildRedactionCase);
  const metadataOnlyAllowedCount = redactionCases.filter(
    (entry) => entry.preview_allowed,
  ).length;
  const quarantineCount = redactionCases.filter(
    (entry) => entry.policy_action === "quarantine_private_strategy_marker",
  ).length;
  const rejectCount = redactionCases.filter(
    (entry) =>
      entry.policy_action === "reject_secret_identity_or_credential_marker",
  ).length;

  return deepFreeze({
    schema: CORPUS_REDACTION_FIXTURE_PREVIEW_SCHEMA,
    truth_label: "DECLARED",
    mode: "PREVIEW_ONLY",
    verdict: "PREVIEW_FIXTURED",
    data_tiers: clone(DATA_TIERS),
    allowed_uses: clone(ALLOWED_USES),
    blocked_uses: clone(BLOCKED_USES),
    redaction_cases: redactionCases,
    summary: {
      total_fixtures: redactionCases.length,
      metadata_only_allowed_count: metadataOnlyAllowedCount,
      quarantine_count: quarantineCount,
      reject_count: rejectCount,
    },
    self_proactive_harness: {
      mode: "DETERMINISTIC_REDACTION_FIXTURE_PREVIEW",
      recommended_micro_action: "build_corpus_benchmark_schema_preview",
      gates: [
        { gate: "fixture_metadata_only", pass: true },
        { gate: "d3_quarantine_marker_available", pass: quarantineCount > 0 },
        { gate: "d4_reject_marker_available", pass: rejectCount > 0 },
        { gate: "local_only_boundary", pass: true },
      ],
    },
    self_critique: {
      confidence: "bounded_preview",
      limitation:
        "This fixture preview demonstrates handling labels only; it does not inspect, redact, hash, or persist real corpus content.",
      weakest_link: "real_redaction_not_authorized_or_executed",
    },
    micro_compliance: {
      preview_only: true,
      deterministic: true,
      fixture_only: true,
      metadata_only: true,
      no_real_redaction: true,
      no_ingestion: true,
      no_embeddings: true,
      no_fine_tune: true,
      no_external_upload: true,
      no_runtime_memory_mutation: true,
      fail_closed_on_malformed_input: false,
    },
    micro_consent: {
      preview_scope: "corpus_redaction_fixture_preview_only",
      raw_content_processing_authorized: false,
      real_redaction_authorized: false,
      d3_d4_processing_authorized: false,
      node_sharing_authorized: false,
      fine_tune_authorized: false,
      external_upload_authorized: false,
    },
    analogical_model: {
      model: "sealed_box_handling_labels",
      mapping:
        "This preview proves which labels go on sealed boxes; it does not open boxes or redact live material.",
    },
    boundary: boundary(),
    next_safe_action: "build_corpus_benchmark_schema_preview",
    note: "Corpus Redaction Fixture Preview uses canned metadata-only fixtures. It performs no raw ingestion, content extraction, real redaction, embeddings, fine-tuning, upload, runtime memory mutation, node sharing, receipt mint, federation, runtime start, or Step 7 action.",
  });
}
