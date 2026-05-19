export const CORPUS_EVAL_SCORECARD_PREVIEW_SCHEMA = "bizra.dema.corpus_eval_scorecard_preview.v0.1";

const METRIC_IDS = Object.freeze([
  "correctness_floor",
  "truth_discipline_floor",
  "safety_floor",
  "evidence_alignment_floor",
  "operator_utility_floor",
  "overclaim_regression_rate",
  "quarantine_integrity_rate"
]);
const DOMAINS = Object.freeze(["architecture", "security", "code_quality", "truth_discipline", "agentic_workflow", "documentation", "benchmarking"]);
const PROOF_OF_TRUTH_AXES = Object.freeze(["formal", "cryptographic", "empirical", "economic"]);
const READINESS_STATES = Object.freeze(["schema_only", "awaiting_human_gold_labels", "blocked_until_authorized_eval"]);
const INPUT_STATES = Object.freeze(["metadata_only_fixture", "sanitized_label_slots", "quarantine_marker", "reject_marker"]);
const RAW_CONTENT_KEYS = new Set([
  "answer", "assistant", "best_answer", "chat", "chats", "completion", "content", "conversation", "conversations",
  "dialog", "gold", "ideal", "input", "messages", "output", "prompt", "question", "raw_text", "reference",
  "response", "score", "scores", "system", "target_bad", "target_good", "transcript", "turns", "user"
]);

const ALLOWED_USES = Object.freeze([
  "eval_scorecard_schema_design",
  "aggregate_metric_planning",
  "proof_of_truth_metric_mapping",
  "regression_gate_design",
  "manual_review_summary_design"
]);

const BLOCKED_USES = Object.freeze([
  "raw_ingestion", "content_extraction", "manual_review_execution", "benchmark_replay_execution",
  "score_computation", "local_model_invocation", "external_upload", "supervised_fine_tuning",
  "dpo_or_rlhf_training", "embedding_creation", "runtime_memory_mutation", "scorecard_persistence",
  "dataset_write", "skill_pattern_promotion", "preference_dataset_promotion", "sharing_with_node1_node4",
  "receipt_minting", "step7_minting"
]);

const DEFAULT_METRICS = Object.freeze([
  Object.freeze({
    metric_id: "correctness_floor",
    domain: "architecture",
    input_state: "sanitized_label_slots",
    readiness_state: "awaiting_human_gold_labels",
    proof_of_truth_axes: Object.freeze(["formal", "empirical"]),
    target: 4,
    direction: "gte",
    d3_d4_included: false
  }),
  Object.freeze({
    metric_id: "truth_discipline_floor",
    domain: "truth_discipline",
    input_state: "sanitized_label_slots",
    readiness_state: "awaiting_human_gold_labels",
    proof_of_truth_axes: Object.freeze(["formal", "cryptographic", "empirical"]),
    target: 4,
    direction: "gte",
    d3_d4_included: false
  }),
  Object.freeze({
    metric_id: "safety_floor",
    domain: "security",
    input_state: "sanitized_label_slots",
    readiness_state: "awaiting_human_gold_labels",
    proof_of_truth_axes: Object.freeze(["formal", "cryptographic"]),
    target: 5,
    direction: "gte",
    d3_d4_included: false
  }),
  Object.freeze({
    metric_id: "evidence_alignment_floor",
    domain: "documentation",
    input_state: "sanitized_label_slots",
    readiness_state: "awaiting_human_gold_labels",
    proof_of_truth_axes: Object.freeze(["formal", "cryptographic", "empirical"]),
    target: 4,
    direction: "gte",
    d3_d4_included: false
  }),
  Object.freeze({
    metric_id: "operator_utility_floor",
    domain: "agentic_workflow",
    input_state: "sanitized_label_slots",
    readiness_state: "awaiting_human_gold_labels",
    proof_of_truth_axes: Object.freeze(["empirical", "economic"]),
    target: 4,
    direction: "gte",
    d3_d4_included: false
  }),
  Object.freeze({
    metric_id: "overclaim_regression_rate",
    domain: "truth_discipline",
    input_state: "metadata_only_fixture",
    readiness_state: "blocked_until_authorized_eval",
    proof_of_truth_axes: Object.freeze(["formal", "empirical"]),
    target: 0,
    direction: "lte",
    d3_d4_included: false
  }),
  Object.freeze({
    metric_id: "quarantine_integrity_rate",
    domain: "security",
    input_state: "quarantine_marker",
    readiness_state: "schema_only",
    proof_of_truth_axes: Object.freeze(["formal", "cryptographic"]),
    target: 1,
    direction: "eq",
    d3_d4_included: true
  })
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function isSafeIdentifier(value) {
  return typeof value === "string" && /^[a-z0-9_]+$/.test(value);
}

function isPlainJsonMetadata(value) {
  if (value === null) return true;
  if (["string", "number", "boolean"].includes(typeof value)) return true;
  if (Array.isArray(value)) return value.every(isPlainJsonMetadata);
  if (typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return (prototype === Object.prototype || prototype === null)
    && Object.values(value).every(isPlainJsonMetadata);
}

function hasRawContentKey(value) {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(hasRawContentKey);
  return Object.keys(value).some((key) => RAW_CONTENT_KEYS.has(key) || hasRawContentKey(value[key]));
}

function allAllowed(values, allowedValues) {
  return Array.isArray(values) && values.length > 0 && values.every((value) => allowedValues.includes(value));
}

function validateMetric(metric) {
  if (!metric || typeof metric !== "object" || Array.isArray(metric)) return "metric_must_be_object";
  if (!isPlainJsonMetadata(metric)) return "metric_must_be_plain_json_metadata";
  if (hasRawContentKey(metric)) return "metric_must_not_include_raw_content_or_scores";
  if (!METRIC_IDS.includes(metric.metric_id)) return "metric_id_not_allowlisted";
  if (!DOMAINS.includes(metric.domain)) return "domain_not_allowlisted";
  if (!INPUT_STATES.includes(metric.input_state)) return "input_state_not_allowlisted";
  if (!READINESS_STATES.includes(metric.readiness_state)) return "readiness_state_not_allowlisted";
  if (!allAllowed(metric.proof_of_truth_axes, PROOF_OF_TRUTH_AXES)) return "proof_of_truth_axis_not_allowlisted";
  if (!["gte", "lte", "eq"].includes(metric.direction)) return "direction_not_allowlisted";
  if (typeof metric.target !== "number" || metric.target < 0 || metric.target > 5) return "target_must_be_number_between_zero_and_five";
  if (typeof metric.d3_d4_included !== "boolean") return "d3_d4_included_must_be_boolean";
  if (metric.d3_d4_included && metric.metric_id !== "quarantine_integrity_rate") return "d3_d4_only_allowed_for_quarantine_integrity";
  if (metric.input_state === "reject_marker" && metric.metric_id !== "quarantine_integrity_rate") return "reject_marker_not_scoreable";
  return null;
}

function validateMetrics(metrics) {
  if (!Array.isArray(metrics) || metrics.length === 0) return { ok: false, reason: "metrics_must_be_non_empty_array" };
  const seen = new Set();
  for (const metric of metrics) {
    const reason = validateMetric(metric);
    if (reason) return { ok: false, reason };
    if (seen.has(metric.metric_id)) return { ok: false, reason: "metric_id_must_be_unique" };
    seen.add(metric.metric_id);
  }
  return { ok: true };
}

function buildMetricSlot(metric) {
  return {
    metric_id: metric.metric_id,
    domain: metric.domain,
    input_state: metric.input_state,
    readiness_state: metric.readiness_state,
    proof_of_truth_axes: [...metric.proof_of_truth_axes].sort(),
    target: metric.target,
    direction: metric.direction,
    d3_d4_included: metric.d3_d4_included,
    metric_state: "not_computed_schema_only",
    evidence_state: "not_measured_no_receipt_minted"
  };
}

function ownershipScope() {
  return {
    declared_operator_owner: "mumu",
    local_product_face: "dema",
    governed_boundary: "node0",
    interpretation: "local_ownership_and_provenance_not_processing_authorization"
  };
}

function boundary() {
  return {
    raw_content_ingested: false,
    raw_content_opened: false,
    manual_review_executed: false,
    benchmark_executed: false,
    scores_computed: false,
    scorecard_persisted: false,
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
    receipt_minted: false,
    step7_mint_attempted: false
  };
}

function emptySummary() {
  return {
    total_metrics: 0,
    computed_metric_count: 0,
    awaiting_gold_label_count: 0,
    blocked_until_eval_count: 0,
    d3_d4_metric_count: 0
  };
}

function rejectPreview(reason) {
  return deepFreeze({
    schema: CORPUS_EVAL_SCORECARD_PREVIEW_SCHEMA,
    truth_label: "DECLARED",
    mode: "PREVIEW_ONLY",
    verdict: "PREVIEW_REJECT",
    ownership_scope: ownershipScope(),
    allowed_uses: clone(ALLOWED_USES),
    blocked_uses: clone(BLOCKED_USES),
    metric_slots: [],
    summary: emptySummary(),
    self_proactive_harness: {
      mode: "DETERMINISTIC_EVAL_SCORECARD_PREVIEW",
      recommended_micro_action: "fix_malformed_scorecard_metrics",
      gates: [
        { gate: "metadata_only_metrics", pass: reason !== "metric_must_not_include_raw_content_or_scores" },
        { gate: "closed_metric_allowlists", pass: !reason.endsWith("_not_allowlisted") },
        { gate: "no_score_computation", pass: true },
        { gate: "local_only_boundary", pass: true }
      ]
    },
    self_critique: {
      confidence: "rejected",
      limitation: "Malformed scorecard metrics are rejected before aggregate evaluation posture can be trusted.",
      weakest_link: reason
    },
    micro_compliance: {
      preview_only: true,
      deterministic: true,
      schema_only: true,
      metadata_only: true,
      no_scores_computed: true,
      no_benchmark_execution: true,
      no_model_invocation: true,
      no_training: true,
      fail_closed_on_malformed_input: true
    },
    micro_consent: {
      preview_scope: "corpus_eval_scorecard_preview_only",
      operator_declared_space_owner: true,
      ownership_is_processing_consent: false,
      raw_content_processing_authorized: false,
      benchmark_execution_authorized: false,
      score_computation_authorized: false,
      scorecard_persistence_authorized: false,
      fine_tune_authorized: false,
      dpo_or_rlhf_authorized: false,
      node_sharing_authorized: false,
      external_upload_authorized: false
    },
    analogical_model: {
      model: "scoreboard_layout_not_game_played",
      mapping: "This preview draws the scoreboard and threshold labels; it does not play games, record scores, or award points."
    },
    boundary: boundary(),
    next_safe_action: "fix_malformed_scorecard_metrics",
    reason
  });
}

export function buildCorpusEvalScorecardPreview({ metrics = DEFAULT_METRICS } = {}) {
  const validation = validateMetrics(metrics);
  if (!validation.ok) return rejectPreview(validation.reason);

  const metricSlots = metrics.map(buildMetricSlot);
  return deepFreeze({
    schema: CORPUS_EVAL_SCORECARD_PREVIEW_SCHEMA,
    truth_label: "DECLARED",
    mode: "PREVIEW_ONLY",
    verdict: "PREVIEW_SCORECARD_READY",
    ownership_scope: ownershipScope(),
    allowed_uses: clone(ALLOWED_USES),
    blocked_uses: clone(BLOCKED_USES),
    metric_slots: metricSlots,
    summary: {
      total_metrics: metricSlots.length,
      computed_metric_count: 0,
      awaiting_gold_label_count: metricSlots.filter((slot) => slot.readiness_state === "awaiting_human_gold_labels").length,
      blocked_until_eval_count: metricSlots.filter((slot) => slot.readiness_state === "blocked_until_authorized_eval").length,
      d3_d4_metric_count: metricSlots.filter((slot) => slot.d3_d4_included).length
    },
    self_proactive_harness: {
      mode: "DETERMINISTIC_EVAL_SCORECARD_PREVIEW",
      recommended_micro_action: "build_corpus_scorecard_receipt_schema_preview",
      gates: [
        { gate: "metadata_only_metrics", pass: true },
        { gate: "closed_metric_allowlists", pass: true },
        { gate: "no_score_computation", pass: true },
        { gate: "quarantine_integrity_is_only_d3_d4_metric", pass: metricSlots.filter((slot) => slot.d3_d4_included).every((slot) => slot.metric_id === "quarantine_integrity_rate") },
        { gate: "local_only_boundary", pass: true }
      ]
    },
    self_critique: {
      confidence: "bounded_preview",
      limitation: "This preview defines aggregate metric slots only; no benchmark run, human scoring, or empirical quality claim exists yet.",
      weakest_link: "future_scores_require_authorized_eval_and_gold_labels"
    },
    micro_compliance: {
      preview_only: true,
      deterministic: true,
      schema_only: true,
      metadata_only: true,
      no_scores_computed: true,
      no_benchmark_execution: true,
      no_model_invocation: true,
      no_training: true,
      fail_closed_on_malformed_input: false
    },
    micro_consent: {
      preview_scope: "corpus_eval_scorecard_preview_only",
      operator_declared_space_owner: true,
      ownership_is_processing_consent: false,
      raw_content_processing_authorized: false,
      benchmark_execution_authorized: false,
      score_computation_authorized: false,
      scorecard_persistence_authorized: false,
      fine_tune_authorized: false,
      dpo_or_rlhf_authorized: false,
      node_sharing_authorized: false,
      external_upload_authorized: false
    },
    analogical_model: {
      model: "scoreboard_layout_not_game_played",
      mapping: "This preview draws the scoreboard and threshold labels; it does not play games, record scores, or award points."
    },
    boundary: boundary(),
    next_safe_action: "build_corpus_scorecard_receipt_schema_preview",
    note: "Corpus Eval Scorecard Preview defines aggregate metric slots only. It performs no raw ingestion, content opening, manual review, benchmark replay, score computation, model call, dataset write, embeddings, fine-tuning, DPO/RLHF, upload, runtime memory mutation, node sharing, receipt mint, federation, runtime start, or Step 7 action."
  });
}
