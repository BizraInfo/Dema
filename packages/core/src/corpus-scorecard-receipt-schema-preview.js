export const CORPUS_SCORECARD_RECEIPT_SCHEMA_PREVIEW_SCHEMA =
  "bizra.dema.corpus_scorecard_receipt_schema_preview.v0.1";

const RECEIPT_FIELDS = Object.freeze([
  "schema",
  "producer",
  "scorecard_schema",
  "metric_set_hash",
  "gold_label_set_hash",
  "sanitized_candidate_set_hash",
  "proof_of_truth_axes",
  "measurement_summary",
  "boundary",
  "prev_receipt_hash",
  "seal",
]);
const REQUIRED_FIELDS = Object.freeze([
  "schema",
  "producer",
  "scorecard_schema",
  "boundary",
  "seal",
]);
const HASH_FIELDS = Object.freeze([
  "metric_set_hash",
  "gold_label_set_hash",
  "sanitized_candidate_set_hash",
  "prev_receipt_hash",
  "seal",
]);
const PROOF_OF_TRUTH_AXES = Object.freeze([
  "formal",
  "cryptographic",
  "empirical",
  "economic",
]);
const RECEIPT_STATES = Object.freeze([
  "schema_only_not_minted",
  "awaiting_authorized_measurement",
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

const ALLOWED_USES = Object.freeze([
  "scorecard_receipt_schema_design",
  "future_measurement_evidence_shape",
  "proof_of_truth_receipt_mapping",
  "audit_trail_design",
  "no_mint_boundary_documentation",
]);

const BLOCKED_USES = Object.freeze([
  "receipt_minting",
  "receipt_persistence",
  "hash_computation",
  "signature_creation",
  "score_computation",
  "raw_ingestion",
  "content_extraction",
  "manual_review_execution",
  "benchmark_replay_execution",
  "local_model_invocation",
  "external_upload",
  "supervised_fine_tuning",
  "dpo_or_rlhf_training",
  "embedding_creation",
  "runtime_memory_mutation",
  "dataset_write",
  "sharing_with_node1_node4",
  "step7_minting",
]);

const DEFAULT_SCHEMA_FIELDS = Object.freeze([
  Object.freeze({
    field_id: "schema",
    value_kind: "constant_identifier",
    required: true,
    source_state: "declared_schema_value",
  }),
  Object.freeze({
    field_id: "producer",
    value_kind: "constant_identifier",
    required: true,
    source_state: "declared_producer_value",
  }),
  Object.freeze({
    field_id: "scorecard_schema",
    value_kind: "schema_ref",
    required: true,
    source_state: "declared_schema_value",
  }),
  Object.freeze({
    field_id: "metric_set_hash",
    value_kind: "future_hash",
    required: false,
    source_state: "not_computed",
  }),
  Object.freeze({
    field_id: "gold_label_set_hash",
    value_kind: "future_hash",
    required: false,
    source_state: "not_computed",
  }),
  Object.freeze({
    field_id: "sanitized_candidate_set_hash",
    value_kind: "future_hash",
    required: false,
    source_state: "not_computed",
  }),
  Object.freeze({
    field_id: "proof_of_truth_axes",
    value_kind: "closed_axis_list",
    required: false,
    source_state: "declared_axis_allowlist",
  }),
  Object.freeze({
    field_id: "measurement_summary",
    value_kind: "future_measurement_summary",
    required: false,
    source_state: "not_measured",
  }),
  Object.freeze({
    field_id: "boundary",
    value_kind: "boundary_flags",
    required: true,
    source_state: "declared_no_side_effects",
  }),
  Object.freeze({
    field_id: "prev_receipt_hash",
    value_kind: "future_hash",
    required: false,
    source_state: "not_computed",
  }),
  Object.freeze({
    field_id: "seal",
    value_kind: "future_hash",
    required: true,
    source_state: "not_computed",
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

function isPlainJsonMetadata(value) {
  if (value === null) return true;
  if (["string", "number", "boolean"].includes(typeof value)) return true;
  if (Array.isArray(value)) return value.every(isPlainJsonMetadata);
  if (typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return (
    (prototype === Object.prototype || prototype === null) &&
    Object.values(value).every(isPlainJsonMetadata)
  );
}

function hasRawContentKey(value) {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(hasRawContentKey);
  return Object.keys(value).some(
    (key) => RAW_CONTENT_KEYS.has(key) || hasRawContentKey(value[key]),
  );
}

function validateField(field) {
  if (!field || typeof field !== "object" || Array.isArray(field))
    return "field_must_be_object";
  if (!isPlainJsonMetadata(field)) return "field_must_be_plain_json_metadata";
  if (hasRawContentKey(field))
    return "field_must_not_include_raw_content_or_scores";
  if (!RECEIPT_FIELDS.includes(field.field_id))
    return "field_id_not_allowlisted";
  if (typeof field.required !== "boolean")
    return "field_required_must_be_boolean";
  if (REQUIRED_FIELDS.includes(field.field_id) !== field.required)
    return "field_required_flag_mismatch";
  if (
    HASH_FIELDS.includes(field.field_id) &&
    field.source_state !== "not_computed"
  )
    return "hash_fields_must_remain_uncomputed";
  if (
    field.field_id === "measurement_summary" &&
    field.source_state !== "not_measured"
  )
    return "measurement_summary_must_remain_unmeasured";
  return null;
}

function validateFields(fields) {
  if (!Array.isArray(fields) || fields.length === 0)
    return { ok: false, reason: "fields_must_be_non_empty_array" };
  const seen = new Set();
  for (const field of fields) {
    const reason = validateField(field);
    if (reason) return { ok: false, reason };
    if (seen.has(field.field_id))
      return { ok: false, reason: "field_id_must_be_unique" };
    seen.add(field.field_id);
  }
  for (const required of REQUIRED_FIELDS) {
    if (!seen.has(required))
      return { ok: false, reason: "required_field_missing" };
  }
  return { ok: true };
}

function buildFieldSlot(field) {
  return {
    field_id: field.field_id,
    value_kind: field.value_kind,
    required: field.required,
    source_state: field.source_state,
    content_state: "not_present_not_opened",
    computation_state: HASH_FIELDS.includes(field.field_id)
      ? "not_computed"
      : "schema_only",
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

function boundary() {
  return {
    raw_content_ingested: false,
    raw_content_opened: false,
    manual_review_executed: false,
    benchmark_executed: false,
    scores_computed: false,
    hashes_computed: false,
    signature_created: false,
    receipt_minted: false,
    receipt_persisted: false,
    local_model_called: false,
    embeddings_created: false,
    fine_tune_started: false,
    dpo_or_rlhf_started: false,
    external_upload_performed: false,
    runtime_memory_mutated: false,
    dataset_written: false,
    node_sharing_performed: false,
    filesystem_write_performed: false,
    network_called: false,
    runtime_started: false,
    federation_started: false,
    step7_mint_attempted: false,
  };
}

function emptySummary() {
  return {
    total_fields: 0,
    required_field_count: 0,
    future_hash_field_count: 0,
    computed_field_count: 0,
    receipt_state: "schema_only_not_minted",
  };
}

function rejectPreview(reason) {
  return deepFreeze({
    schema: CORPUS_SCORECARD_RECEIPT_SCHEMA_PREVIEW_SCHEMA,
    truth_label: "DECLARED",
    mode: "PREVIEW_ONLY",
    verdict: "PREVIEW_REJECT",
    ownership_scope: ownershipScope(),
    allowed_uses: clone(ALLOWED_USES),
    blocked_uses: clone(BLOCKED_USES),
    receipt_state: "schema_only_not_minted",
    proof_of_truth_axes: clone(PROOF_OF_TRUTH_AXES),
    field_slots: [],
    summary: emptySummary(),
    self_proactive_harness: {
      mode: "DETERMINISTIC_SCORECARD_RECEIPT_SCHEMA_PREVIEW",
      recommended_micro_action: "fix_malformed_receipt_schema_fields",
      gates: [
        {
          gate: "metadata_only_receipt_schema",
          pass: reason !== "field_must_not_include_raw_content_or_scores",
        },
        {
          gate: "required_fields_present",
          pass: reason !== "required_field_missing",
        },
        {
          gate: "no_hash_or_seal_computation",
          pass: reason !== "hash_fields_must_remain_uncomputed",
        },
        { gate: "no_receipt_mint", pass: true },
      ],
    },
    self_critique: {
      confidence: "rejected",
      limitation:
        "Malformed receipt schema fields are rejected before a future evidence shape can be trusted.",
      weakest_link: reason,
    },
    micro_compliance: {
      preview_only: true,
      deterministic: true,
      schema_only: true,
      metadata_only: true,
      no_receipt_minted: true,
      no_hashes_computed: true,
      no_scores_computed: true,
      no_benchmark_execution: true,
      no_model_invocation: true,
      fail_closed_on_malformed_input: true,
    },
    micro_consent: {
      preview_scope: "corpus_scorecard_receipt_schema_preview_only",
      operator_declared_space_owner: true,
      ownership_is_processing_consent: false,
      raw_content_processing_authorized: false,
      score_computation_authorized: false,
      hash_computation_authorized: false,
      receipt_mint_authorized: false,
      receipt_persistence_authorized: false,
      benchmark_execution_authorized: false,
      node_sharing_authorized: false,
      external_upload_authorized: false,
    },
    analogical_model: {
      model: "receipt_form_not_receipt_issued",
      mapping:
        "This preview designs the blank receipt form; it does not fill, sign, seal, store, or issue a receipt.",
    },
    boundary: boundary(),
    next_safe_action: "fix_malformed_receipt_schema_fields",
    reason,
  });
}

export function buildCorpusScorecardReceiptSchemaPreview({
  fields = DEFAULT_SCHEMA_FIELDS,
} = {}) {
  const validation = validateFields(fields);
  if (!validation.ok) return rejectPreview(validation.reason);

  const fieldSlots = fields.map(buildFieldSlot);
  const computedFieldCount = fieldSlots.filter(
    (field) =>
      field.computation_state !== "not_computed" &&
      field.value_kind === "future_hash",
  ).length;

  return deepFreeze({
    schema: CORPUS_SCORECARD_RECEIPT_SCHEMA_PREVIEW_SCHEMA,
    truth_label: "DECLARED",
    mode: "PREVIEW_ONLY",
    verdict: "PREVIEW_RECEIPT_SCHEMA_READY",
    ownership_scope: ownershipScope(),
    allowed_uses: clone(ALLOWED_USES),
    blocked_uses: clone(BLOCKED_USES),
    receipt_state: RECEIPT_STATES[0],
    proof_of_truth_axes: clone(PROOF_OF_TRUTH_AXES),
    field_slots: fieldSlots,
    summary: {
      total_fields: fieldSlots.length,
      required_field_count: fieldSlots.filter((field) => field.required).length,
      future_hash_field_count: fieldSlots.filter(
        (field) => field.value_kind === "future_hash",
      ).length,
      computed_field_count: computedFieldCount,
      receipt_state: RECEIPT_STATES[0],
    },
    self_proactive_harness: {
      mode: "DETERMINISTIC_SCORECARD_RECEIPT_SCHEMA_PREVIEW",
      recommended_micro_action:
        "hold_until_authorized_scorecard_measurement_preview",
      gates: [
        { gate: "metadata_only_receipt_schema", pass: true },
        {
          gate: "required_fields_present",
          pass: REQUIRED_FIELDS.every((field) =>
            fieldSlots.some((slot) => slot.field_id === field),
          ),
        },
        {
          gate: "no_hash_or_seal_computation",
          pass: fieldSlots
            .filter((field) => field.value_kind === "future_hash")
            .every((field) => field.computation_state === "not_computed"),
        },
        { gate: "no_receipt_mint", pass: true },
      ],
    },
    self_critique: {
      confidence: "bounded_preview",
      limitation:
        "This preview defines a future scorecard evidence shape only; it does not compute hashes, sign, seal, persist, or mint a receipt.",
      weakest_link:
        "future_measurement_requires_explicit_authorization_and_real_score_inputs",
    },
    micro_compliance: {
      preview_only: true,
      deterministic: true,
      schema_only: true,
      metadata_only: true,
      no_receipt_minted: true,
      no_hashes_computed: true,
      no_scores_computed: true,
      no_benchmark_execution: true,
      no_model_invocation: true,
      fail_closed_on_malformed_input: false,
    },
    micro_consent: {
      preview_scope: "corpus_scorecard_receipt_schema_preview_only",
      operator_declared_space_owner: true,
      ownership_is_processing_consent: false,
      raw_content_processing_authorized: false,
      score_computation_authorized: false,
      hash_computation_authorized: false,
      receipt_mint_authorized: false,
      receipt_persistence_authorized: false,
      benchmark_execution_authorized: false,
      node_sharing_authorized: false,
      external_upload_authorized: false,
    },
    analogical_model: {
      model: "receipt_form_not_receipt_issued",
      mapping:
        "This preview designs the blank receipt form; it does not fill, sign, seal, store, or issue a receipt.",
    },
    boundary: boundary(),
    next_safe_action: "hold_until_authorized_scorecard_measurement_preview",
    note: "Corpus Scorecard Receipt Schema Preview defines future evidence fields only. It performs no raw ingestion, content opening, score computation, hash computation, signing, receipt minting, persistence, benchmark replay, model call, dataset write, upload, runtime memory mutation, node sharing, federation, runtime start, or Step 7 action.",
  });
}
