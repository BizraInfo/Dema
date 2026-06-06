import {
  buildCorpusBenchmarkSchemaPreview,
  CORPUS_BENCHMARK_SCHEMA_PREVIEW_SCHEMA,
} from "./corpus-benchmark-schema-preview.js";
import {
  buildCorpusDataTierClassifierPreview,
  CORPUS_DATA_TIER_CLASSIFIER_PREVIEW_SCHEMA,
} from "./corpus-data-tier-classifier-preview.js";
import {
  buildCorpusEvalScorecardPreview,
  CORPUS_EVAL_SCORECARD_PREVIEW_SCHEMA,
} from "./corpus-eval-scorecard-preview.js";
import {
  buildCorpusGoldLabelFixturePreview,
  CORPUS_GOLD_LABEL_FIXTURE_PREVIEW_SCHEMA,
} from "./corpus-gold-label-fixture-preview.js";
import {
  buildCorpusManualReviewQueuePreview,
  CORPUS_MANUAL_REVIEW_QUEUE_PREVIEW_SCHEMA,
} from "./corpus-manual-review-queue-preview.js";
import {
  buildCorpusRedactionFixturePreview,
  CORPUS_REDACTION_FIXTURE_PREVIEW_SCHEMA,
} from "./corpus-redaction-fixture-preview.js";
import {
  buildCorpusScorecardReceiptSchemaPreview,
  CORPUS_SCORECARD_RECEIPT_SCHEMA_PREVIEW_SCHEMA,
} from "./corpus-scorecard-receipt-schema-preview.js";
import {
  buildModelCorpusManifestPreview,
  MODEL_CORPUS_MANIFEST_PREVIEW_SCHEMA,
} from "./model-corpus-manifest-preview.js";

export const CORPUS_PREVIEW_INDEX_SCHEMA =
  "bizra.dema.corpus_preview_index.v0.1";

const SURFACES = Object.freeze([
  Object.freeze({
    surface_id: "model_corpus_manifest",
    schema: MODEL_CORPUS_MANIFEST_PREVIEW_SCHEMA,
    build: buildModelCorpusManifestPreview,
  }),
  Object.freeze({
    surface_id: "corpus_data_tier_classifier",
    schema: CORPUS_DATA_TIER_CLASSIFIER_PREVIEW_SCHEMA,
    build: buildCorpusDataTierClassifierPreview,
  }),
  Object.freeze({
    surface_id: "corpus_redaction_fixture",
    schema: CORPUS_REDACTION_FIXTURE_PREVIEW_SCHEMA,
    build: buildCorpusRedactionFixturePreview,
  }),
  Object.freeze({
    surface_id: "corpus_benchmark_schema",
    schema: CORPUS_BENCHMARK_SCHEMA_PREVIEW_SCHEMA,
    build: buildCorpusBenchmarkSchemaPreview,
  }),
  Object.freeze({
    surface_id: "corpus_manual_review_queue",
    schema: CORPUS_MANUAL_REVIEW_QUEUE_PREVIEW_SCHEMA,
    build: buildCorpusManualReviewQueuePreview,
  }),
  Object.freeze({
    surface_id: "corpus_gold_label_fixture",
    schema: CORPUS_GOLD_LABEL_FIXTURE_PREVIEW_SCHEMA,
    build: buildCorpusGoldLabelFixturePreview,
  }),
  Object.freeze({
    surface_id: "corpus_eval_scorecard",
    schema: CORPUS_EVAL_SCORECARD_PREVIEW_SCHEMA,
    build: buildCorpusEvalScorecardPreview,
  }),
  Object.freeze({
    surface_id: "corpus_scorecard_receipt_schema",
    schema: CORPUS_SCORECARD_RECEIPT_SCHEMA_PREVIEW_SCHEMA,
    build: buildCorpusScorecardReceiptSchemaPreview,
  }),
]);

const RAW_CONTENT_KEYS = new Set([
  "answer",
  "assistant",
  "best_answer",
  "chat",
  "chats",
  "completion",
  "content",
  "conversation",
  "conversations",
  "dialog",
  "gold",
  "ideal",
  "input",
  "messages",
  "output",
  "prompt",
  "question",
  "raw_text",
  "reference",
  "response",
  "score",
  "scores",
  "system",
  "target_bad",
  "target_good",
  "transcript",
  "turns",
  "user",
]);

const BLOCKED_USES = Object.freeze([
  "raw_ingestion",
  "content_extraction",
  "manual_review_execution",
  "benchmark_replay_execution",
  "score_computation",
  "hash_computation",
  "receipt_minting",
  "receipt_persistence",
  "local_model_invocation",
  "external_upload",
  "supervised_fine_tuning",
  "dpo_or_rlhf_training",
  "embedding_creation",
  "runtime_memory_mutation",
  "dataset_write",
  "skill_pattern_promotion",
  "preference_dataset_promotion",
  "sharing_with_node1_node4",
  "runtime_start",
  "federation_start",
  "step7_minting",
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

function hasRawContentKey(value) {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(hasRawContentKey);
  return Object.keys(value).some(
    (key) => RAW_CONTENT_KEYS.has(key) || hasRawContentKey(value[key]),
  );
}

function surfaceById(surfaceId) {
  return SURFACES.find((surface) => surface.surface_id === surfaceId);
}

function validateSurfaceIds(surfaceIds) {
  if (!Array.isArray(surfaceIds) || surfaceIds.length === 0) {
    return { ok: false, reason: "surface_ids_must_be_non_empty_array" };
  }
  const seen = new Set();
  for (const surfaceId of surfaceIds) {
    if (!surfaceById(surfaceId))
      return { ok: false, reason: "surface_id_not_allowlisted" };
    if (seen.has(surfaceId))
      return { ok: false, reason: "surface_id_must_be_unique" };
    seen.add(surfaceId);
  }
  return { ok: true };
}

function boundary() {
  return {
    raw_content_ingested: false,
    raw_content_opened: false,
    manual_review_executed: false,
    benchmark_executed: false,
    scores_computed: false,
    hashes_computed: false,
    receipt_minted: false,
    receipt_persisted: false,
    local_model_called: false,
    embeddings_created: false,
    fine_tune_started: false,
    dpo_or_rlhf_started: false,
    external_upload_performed: false,
    runtime_memory_mutated: false,
    skill_pattern_promoted: false,
    preference_promoted: false,
    dataset_written: false,
    node_sharing_performed: false,
    filesystem_write_performed: false,
    network_called: false,
    runtime_started: false,
    federation_started: false,
    step7_mint_attempted: false,
  };
}

function ownershipScope() {
  return {
    declared_operator_owner: "mumu",
    local_product_face: "dema",
    governed_boundary: "node0",
    interpretation:
      "local_ownership_and_provenance_not_processing_authorization",
  };
}

function rejectPreview(reason) {
  return deepFreeze({
    schema: CORPUS_PREVIEW_INDEX_SCHEMA,
    truth_label: "DECLARED",
    mode: "PREVIEW_ONLY",
    verdict: "PREVIEW_REJECT",
    ownership_scope: ownershipScope(),
    surfaces: [],
    blocked_uses: clone(BLOCKED_USES),
    summary: {
      total_surfaces: 0,
      ready_surface_count: 0,
      rejected_surface_count: 0,
    },
    self_proactive_harness: {
      mode: "DETERMINISTIC_CORPUS_INDEX_PREVIEW",
      recommended_micro_action: "fix_malformed_corpus_index_inputs",
      gates: [
        {
          gate: "metadata_only_index",
          pass: reason !== "index_must_not_include_raw_content_or_scores",
        },
        {
          gate: "surface_ids_allowlisted",
          pass: reason !== "surface_id_not_allowlisted",
        },
        { gate: "all_children_preview_only", pass: true },
        { gate: "local_only_boundary", pass: true },
      ],
    },
    self_critique: {
      confidence: "rejected",
      limitation:
        "Malformed index inputs are rejected before corpus preview integration can be trusted.",
      weakest_link: reason,
    },
    micro_compliance: {
      preview_only: true,
      deterministic: true,
      index_only: true,
      metadata_only: true,
      no_child_authority_expansion: true,
      no_runtime: true,
      fail_closed_on_malformed_input: true,
    },
    micro_consent: {
      preview_scope: "corpus_preview_index_only",
      operator_declared_space_owner: true,
      ownership_is_processing_consent: false,
      raw_content_processing_authorized: false,
      child_preview_execution_authorized: true,
      benchmark_execution_authorized: false,
      score_computation_authorized: false,
      receipt_mint_authorized: false,
      node_sharing_authorized: false,
      external_upload_authorized: false,
    },
    analogical_model: {
      model: "library_index_not_library_checkout",
      mapping:
        "This preview lists safe corpus preview shelves; it does not open books, run evaluations, or issue receipts.",
    },
    boundary: boundary(),
    next_safe_action: "fix_malformed_corpus_index_inputs",
    reason,
  });
}

function buildSurfaceEntry(surface) {
  const preview = surface.build();
  return {
    surface_id: surface.surface_id,
    schema: preview.schema,
    expected_schema: surface.schema,
    mode: preview.mode,
    verdict: preview.verdict,
    next_safe_action: preview.next_safe_action,
    boundary_ok: Object.values(preview.boundary ?? {}).every(
      (value) => value === false,
    ),
    preview_only:
      preview.mode === "PREVIEW_ONLY" &&
      preview.micro_compliance?.preview_only === true,
    authority_state: "no_authority_expansion",
  };
}

export function buildCorpusPreviewIndex({
  surfaceIds = SURFACES.map((surface) => surface.surface_id),
  metadata = {},
} = {}) {
  if (hasRawContentKey(metadata))
    return rejectPreview("index_must_not_include_raw_content_or_scores");
  const validation = validateSurfaceIds(surfaceIds);
  if (!validation.ok) return rejectPreview(validation.reason);

  const surfaces = surfaceIds.map((surfaceId) =>
    buildSurfaceEntry(surfaceById(surfaceId)),
  );
  const rejectedSurfaceCount = surfaces.filter(
    (surface) => surface.verdict === "PREVIEW_REJECT",
  ).length;

  return deepFreeze({
    schema: CORPUS_PREVIEW_INDEX_SCHEMA,
    truth_label: "DECLARED",
    mode: "PREVIEW_ONLY",
    verdict: "PREVIEW_INDEX_READY",
    ownership_scope: ownershipScope(),
    surfaces,
    blocked_uses: clone(BLOCKED_USES),
    summary: {
      total_surfaces: surfaces.length,
      ready_surface_count: surfaces.length - rejectedSurfaceCount,
      rejected_surface_count: rejectedSurfaceCount,
    },
    self_proactive_harness: {
      mode: "DETERMINISTIC_CORPUS_INDEX_PREVIEW",
      recommended_micro_action:
        "hold_until_authorized_scorecard_measurement_preview",
      gates: [
        { gate: "metadata_only_index", pass: true },
        { gate: "surface_ids_allowlisted", pass: true },
        {
          gate: "all_children_preview_only",
          pass: surfaces.every((surface) => surface.preview_only),
        },
        {
          gate: "all_child_boundaries_closed",
          pass: surfaces.every((surface) => surface.boundary_ok),
        },
        { gate: "local_only_boundary", pass: true },
      ],
    },
    self_critique: {
      confidence: "bounded_preview",
      limitation:
        "This index integrates preview metadata only; it does not expose a CLI command or authorize corpus processing.",
      weakest_link: "future_measurement_still_requires_explicit_authorization",
    },
    micro_compliance: {
      preview_only: true,
      deterministic: true,
      index_only: true,
      metadata_only: true,
      no_child_authority_expansion: true,
      no_runtime: true,
      fail_closed_on_malformed_input: false,
    },
    micro_consent: {
      preview_scope: "corpus_preview_index_only",
      operator_declared_space_owner: true,
      ownership_is_processing_consent: false,
      raw_content_processing_authorized: false,
      child_preview_execution_authorized: true,
      benchmark_execution_authorized: false,
      score_computation_authorized: false,
      receipt_mint_authorized: false,
      node_sharing_authorized: false,
      external_upload_authorized: false,
    },
    analogical_model: {
      model: "library_index_not_library_checkout",
      mapping:
        "This preview lists safe corpus preview shelves; it does not open books, run evaluations, or issue receipts.",
    },
    boundary: boundary(),
    next_safe_action: "hold_until_authorized_scorecard_measurement_preview",
    note: "Corpus Preview Index integrates existing corpus preview surfaces as metadata only. It performs no raw ingestion, content opening, manual review, benchmark replay, score computation, hash computation, receipt minting, model call, dataset write, upload, runtime memory mutation, node sharing, federation, runtime start, or Step 7 action.",
  });
}
