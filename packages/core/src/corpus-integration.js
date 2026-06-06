// C8 · Corpus integration (per ADR-008 §C8).
//
// 27,044 message corpus (Founder Asset Inventory v0.3) made queryable.
// Consent-aware retrieval · per-conversation classification. Builds on
// existing corpus-preview-index module. NEVER ingests new data ·
// NEVER modifies the corpus.

import { buildPreviewBoundary } from "./preview-boundary.js";

const SCHEMA = "bizra.dema.corpus_integration.v0.1";
const QUERY_PREVIEW_SCHEMA = "bizra.dema.corpus_query_preview.v0.1";

const REQUIRED_BLOCKED_EFFECTS = Object.freeze([
  "modify_corpus_data",
  "ingest_new_data_without_consent",
  "cache_results_outside_dema_home",
  "return_raw_d4_classified_content",
  "execute_full_text_search_without_consent_scope",
  "share_results_externally",
  "federation_invocation",
]);

const DATA_TIERS = Object.freeze({
  D0: "public · safe to surface freely",
  D1: "operator-personal · default-restricted",
  D2: "third-party-mentioned · classified per relationship",
  D3: "sensitive-operational · explicit consent per query",
  D4: "secret · NEVER returned · NEVER processed",
});

function safeString(v, fallback = "") {
  return typeof v === "string" ? v : fallback;
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function safeNumber(v, fallback = 0) {
  return typeof v === "number" && !Number.isNaN(v) ? v : fallback;
}

export function buildCorpusIntegrationPreview({
  inventory_sha256 = "",
  total_messages = 0,
  total_conversations = 0,
  platforms = [],
  consent_classification_applied = false,
} = {}) {
  return Object.freeze({
    schema: SCHEMA,
    truth_label: "NODE0_LOCAL_SEED",
    mode: "preview_only",
    inventory_sha256: safeString(inventory_sha256),
    total_messages: safeNumber(total_messages, 0),
    total_conversations: safeNumber(total_conversations, 0),
    platforms: Object.freeze(
      safeArray(platforms).filter((p) => typeof p === "string"),
    ),
    consent_classification_applied,
    data_tiers: DATA_TIERS,
    d4_return_blocked: true,
    blocked_effects: REQUIRED_BLOCKED_EFFECTS,
    refusal_invariants: Object.freeze([
      "Corpus is never modified · read-only access",
      "D4-classified content is NEVER returned · refusal is default",
      "D3 content requires per-query consent · not session-wide",
      "Results are never cached outside ~/.dema",
      "Federation never invoked on corpus queries",
    ]),
    boundary: buildPreviewBoundary(),
  });
}

// Preview a corpus query: declare what would be searched · estimate hits ·
// classify expected data tier · generate per-query consent phrase.
// NEVER actually queries · this is the preview layer for C8 v0.1.
export function buildCorpusQueryPreview({
  query_text = "",
  date_range_start = null,
  date_range_end = null,
  platforms_filter = [],
  max_results = 10,
  estimated_tier = "D1",
} = {}) {
  const q = safeString(query_text).trim();
  const start =
    date_range_start && typeof date_range_start === "string"
      ? date_range_start
      : null;
  const end =
    date_range_end && typeof date_range_end === "string"
      ? date_range_end
      : null;
  const platforms = safeArray(platforms_filter).filter(
    (p) => typeof p === "string",
  );
  const maxR = safeNumber(max_results, 10);
  const tier = Object.keys(DATA_TIERS).includes(estimated_tier)
    ? estimated_tier
    : "D1";

  const violations = [];
  if (q.length === 0) violations.push("empty_query");
  if (q.length > 2000) violations.push("query_too_long");
  if (maxR <= 0 || maxR > 100)
    violations.push("max_results_out_of_range · expected 1-100");
  if (tier === "D4")
    violations.push("d4_queries_refused · D4 content is never returned");

  const valid = violations.length === 0;
  const consentPhrase = valid
    ? `GO: query corpus tier=${tier} · '${q.slice(0, 80)}'`
    : null;

  return Object.freeze({
    schema: QUERY_PREVIEW_SCHEMA,
    truth_label: "NODE0_LOCAL_SEED",
    mode: "draft_only",
    drafted_at: new Date().toISOString(),
    query_text_redacted_preview: q.length > 60 ? q.slice(0, 60) + "…" : q,
    query_length_chars: q.length,
    date_range_start: start,
    date_range_end: end,
    platforms_filter: Object.freeze(platforms),
    max_results: maxR,
    estimated_data_tier: tier,
    expected_d4_results: 0,
    valid,
    violations: Object.freeze(violations),
    consent_phrase: consentPhrase,
    query_executed: false,
    results_count: 0,
    audit_trail_required: true,
    receipt_shape_ready: valid,
    boundary: buildPreviewBoundary(),
  });
}

export function buildCorpusIntegrationSummary(options = {}) {
  const preview = buildCorpusIntegrationPreview(options);
  return Object.freeze({
    schema: "bizra.dema.corpus_integration_summary.v0.1",
    truth_label: preview.truth_label,
    mode: "summary",
    source_schema: preview.schema,
    total_messages: preview.total_messages,
    total_conversations: preview.total_conversations,
    platform_count: preview.platforms.length,
    inventory_sha256_length: preview.inventory_sha256.length,
    data_tier_count: Object.keys(preview.data_tiers).length,
    d4_return_blocked: preview.d4_return_blocked,
    boundary: preview.boundary,
  });
}

export const CORPUS_INTEGRATION_SCHEMA_NAME = SCHEMA;
export const CORPUS_INTEGRATION_QUERY_PREVIEW_SCHEMA_NAME =
  QUERY_PREVIEW_SCHEMA;
export const CORPUS_INTEGRATION_DATA_TIERS = DATA_TIERS;
export const CORPUS_INTEGRATION_REQUIRED_BLOCKED_EFFECTS =
  REQUIRED_BLOCKED_EFFECTS;
