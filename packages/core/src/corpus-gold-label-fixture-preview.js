export const CORPUS_GOLD_LABEL_FIXTURE_PREVIEW_SCHEMA =
  "bizra.dema.corpus_gold_label_fixture_preview.v0.1";

const SOURCE_IDS = Object.freeze([
  "claude_desktop",
  "chatgpt_team",
  "google_gemini",
  "deepseek",
  "kimi",
  "z_ai",
  "other",
]);
const DOMAINS = Object.freeze([
  "architecture",
  "security",
  "code_quality",
  "truth_discipline",
  "agentic_workflow",
  "documentation",
  "benchmarking",
]);
const TIERS = Object.freeze(["D0", "D1", "D2", "D3", "D4"]);
const QUEUE_LANES = Object.freeze([
  "benchmark_eval_review",
  "skill_pattern_review",
  "preference_pair_review",
  "quarantine_review",
  "reject_log",
]);
const CASE_TRUTH_LABELS = Object.freeze([
  "verified_good",
  "use_for_eval_only",
  "negative_overclaim",
  "right_for_wrong_reasons",
  "needs_redaction",
  "forbidden",
]);
const LABEL_KINDS = Object.freeze([
  "eval_reference_fixture",
  "skill_pattern_fixture",
  "preference_pair_fixture",
  "negative_eval_fixture",
  "quarantine_no_label",
  "reject_no_label",
]);
const REVIEW_OUTCOMES = Object.freeze([
  "candidate_ready_for_human_scoring",
  "candidate_needs_human_adjudication",
  "quarantine_without_label",
  "reject_without_label",
]);
const RUBRIC_AXES = Object.freeze([
  "correctness",
  "truth_discipline",
  "safety",
  "evidence_alignment",
  "operator_utility",
]);
const PROOF_OF_TRUTH_AXES = Object.freeze([
  "formal",
  "cryptographic",
  "empirical",
  "economic",
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
  "system",
  "target_bad",
  "target_good",
  "transcript",
  "turns",
  "user",
]);

const ALLOWED_USES = Object.freeze([
  "gold_label_fixture_design",
  "human_scoring_rubric_design",
  "truth_label_review_design",
  "sanitized_eval_reference_planning",
  "skill_pattern_label_planning",
  "preference_pair_label_planning",
]);

const BLOCKED_USES = Object.freeze([
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
  "label_persistence",
  "dataset_write",
  "skill_pattern_promotion",
  "preference_dataset_promotion",
  "sharing_with_node1_node4",
  "receipt_minting",
  "step7_minting",
]);

const DEFAULT_FIXTURES = Object.freeze([
  Object.freeze({
    label_id: "label_gold_architecture_eval",
    candidate_id: "gold_architecture_eval",
    source_id: "chatgpt_team",
    domain: "architecture",
    tier: "D0",
    queue_lane: "benchmark_eval_review",
    case_truth_label: "verified_good",
    label_kind: "eval_reference_fixture",
    review_outcome: "candidate_ready_for_human_scoring",
    rubric_axes: Object.freeze([
      "correctness",
      "truth_discipline",
      "evidence_alignment",
      "operator_utility",
    ]),
    proof_of_truth_axes: Object.freeze([
      "formal",
      "cryptographic",
      "empirical",
      "economic",
    ]),
    expected_min_score: 4,
  }),
  Object.freeze({
    label_id: "label_debug_skill_pattern",
    candidate_id: "debug_skill_pattern_review",
    source_id: "claude_desktop",
    domain: "code_quality",
    tier: "D1",
    queue_lane: "skill_pattern_review",
    case_truth_label: "verified_good",
    label_kind: "skill_pattern_fixture",
    review_outcome: "candidate_ready_for_human_scoring",
    rubric_axes: Object.freeze(["correctness", "safety", "operator_utility"]),
    proof_of_truth_axes: Object.freeze(["formal", "empirical"]),
    expected_min_score: 4,
  }),
  Object.freeze({
    label_id: "label_preference_uncertainty_pair",
    candidate_id: "preference_pair_uncertainty_review",
    source_id: "z_ai",
    domain: "agentic_workflow",
    tier: "D2",
    queue_lane: "preference_pair_review",
    case_truth_label: "right_for_wrong_reasons",
    label_kind: "preference_pair_fixture",
    review_outcome: "candidate_needs_human_adjudication",
    rubric_axes: Object.freeze([
      "truth_discipline",
      "safety",
      "operator_utility",
    ]),
    proof_of_truth_axes: Object.freeze(["formal", "empirical"]),
    expected_min_score: 3,
  }),
  Object.freeze({
    label_id: "label_overclaim_negative_eval",
    candidate_id: "overclaim_negative_eval",
    source_id: "other",
    domain: "truth_discipline",
    tier: "D2",
    queue_lane: "benchmark_eval_review",
    case_truth_label: "negative_overclaim",
    label_kind: "negative_eval_fixture",
    review_outcome: "candidate_ready_for_human_scoring",
    rubric_axes: Object.freeze([
      "truth_discipline",
      "safety",
      "evidence_alignment",
    ]),
    proof_of_truth_axes: Object.freeze([
      "formal",
      "cryptographic",
      "empirical",
    ]),
    expected_min_score: 4,
  }),
  Object.freeze({
    label_id: "label_private_strategy_quarantine",
    candidate_id: "private_strategy_quarantine",
    source_id: "other",
    domain: "benchmarking",
    tier: "D3",
    queue_lane: "quarantine_review",
    case_truth_label: "needs_redaction",
    label_kind: "quarantine_no_label",
    review_outcome: "quarantine_without_label",
    rubric_axes: Object.freeze(["safety"]),
    proof_of_truth_axes: Object.freeze(["formal", "cryptographic"]),
    expected_min_score: null,
  }),
  Object.freeze({
    label_id: "label_credential_marker_reject",
    candidate_id: "credential_marker_reject",
    source_id: "other",
    domain: "security",
    tier: "D4",
    queue_lane: "reject_log",
    case_truth_label: "forbidden",
    label_kind: "reject_no_label",
    review_outcome: "reject_without_label",
    rubric_axes: Object.freeze(["safety"]),
    proof_of_truth_axes: Object.freeze(["formal", "cryptographic"]),
    expected_min_score: null,
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

function allAllowed(values, allowedValues) {
  return (
    Array.isArray(values) &&
    values.length > 0 &&
    values.every((value) => allowedValues.includes(value))
  );
}

function validateTierLabelPolicy(fixture) {
  if (fixture.tier === "D3") {
    return (
      fixture.queue_lane === "quarantine_review" &&
      fixture.label_kind === "quarantine_no_label" &&
      fixture.review_outcome === "quarantine_without_label" &&
      fixture.expected_min_score === null
    );
  }
  if (fixture.tier === "D4") {
    return (
      fixture.queue_lane === "reject_log" &&
      fixture.label_kind === "reject_no_label" &&
      fixture.review_outcome === "reject_without_label" &&
      fixture.expected_min_score === null
    );
  }
  return (
    !["quarantine_review", "reject_log"].includes(fixture.queue_lane) &&
    !["quarantine_no_label", "reject_no_label"].includes(fixture.label_kind) &&
    Number.isInteger(fixture.expected_min_score) &&
    fixture.expected_min_score >= 1 &&
    fixture.expected_min_score <= 5
  );
}

function validateFixtures(fixtures) {
  if (!Array.isArray(fixtures) || fixtures.length === 0)
    return { ok: false, reason: "fixtures_must_be_non_empty_array" };
  const seen = new Set();
  for (const fixture of fixtures) {
    if (!fixture || typeof fixture !== "object" || Array.isArray(fixture))
      return { ok: false, reason: "fixture_must_be_object" };
    if (!isPlainJsonMetadata(fixture))
      return { ok: false, reason: "fixture_must_be_plain_json_metadata" };
    if (hasRawContentKey(fixture))
      return { ok: false, reason: "fixture_must_not_include_raw_content" };
    if (!isSafeIdentifier(fixture.label_id) || seen.has(fixture.label_id)) {
      return { ok: false, reason: "label_id_must_be_unique_safe_identifier" };
    }
    seen.add(fixture.label_id);
    if (!isSafeIdentifier(fixture.candidate_id))
      return { ok: false, reason: "candidate_id_must_be_safe_identifier" };
    if (!SOURCE_IDS.includes(fixture.source_id))
      return { ok: false, reason: "source_id_not_allowlisted" };
    if (!DOMAINS.includes(fixture.domain))
      return { ok: false, reason: "domain_not_allowlisted" };
    if (!TIERS.includes(fixture.tier))
      return { ok: false, reason: "tier_not_allowlisted" };
    if (!QUEUE_LANES.includes(fixture.queue_lane))
      return { ok: false, reason: "queue_lane_not_allowlisted" };
    if (!CASE_TRUTH_LABELS.includes(fixture.case_truth_label))
      return { ok: false, reason: "case_truth_label_not_allowlisted" };
    if (!LABEL_KINDS.includes(fixture.label_kind))
      return { ok: false, reason: "label_kind_not_allowlisted" };
    if (!REVIEW_OUTCOMES.includes(fixture.review_outcome))
      return { ok: false, reason: "review_outcome_not_allowlisted" };
    if (!allAllowed(fixture.rubric_axes, RUBRIC_AXES))
      return { ok: false, reason: "rubric_axis_not_allowlisted" };
    if (!allAllowed(fixture.proof_of_truth_axes, PROOF_OF_TRUTH_AXES))
      return { ok: false, reason: "proof_of_truth_axis_not_allowlisted" };
    if (!validateTierLabelPolicy(fixture))
      return { ok: false, reason: "tier_label_policy_mismatch" };
  }
  return { ok: true };
}

function buildLabelSlot(fixture) {
  return {
    label_id: fixture.label_id,
    candidate_id: fixture.candidate_id,
    source_id: fixture.source_id,
    domain: fixture.domain,
    tier: fixture.tier,
    queue_lane: fixture.queue_lane,
    case_truth_label: fixture.case_truth_label,
    label_kind: fixture.label_kind,
    review_outcome: fixture.review_outcome,
    rubric_axes: [...fixture.rubric_axes].sort(),
    proof_of_truth_axes: [...fixture.proof_of_truth_axes].sort(),
    expected_min_score: fixture.expected_min_score,
    content_state: "not_present_not_opened",
    label_material_state: "not_written_fixture_slot_only",
    promotion_state: "not_promoted_requires_future_exact_consent",
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
    gold_labels_written: false,
    label_fixture_persisted: false,
    benchmark_executed: false,
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
    step7_mint_attempted: false,
  };
}

function emptySummary() {
  return {
    total_fixtures: 0,
    scoreable_fixture_count: 0,
    no_label_fixture_count: 0,
    ready_for_human_scoring_count: 0,
    adjudication_required_count: 0,
  };
}

function rejectPreview(reason) {
  return deepFreeze({
    schema: CORPUS_GOLD_LABEL_FIXTURE_PREVIEW_SCHEMA,
    truth_label: "DECLARED",
    mode: "PREVIEW_ONLY",
    verdict: "PREVIEW_REJECT",
    ownership_scope: ownershipScope(),
    allowed_uses: clone(ALLOWED_USES),
    blocked_uses: clone(BLOCKED_USES),
    label_slots: [],
    summary: emptySummary(),
    self_proactive_harness: {
      mode: "DETERMINISTIC_GOLD_LABEL_FIXTURE_PREVIEW",
      recommended_micro_action: "fix_malformed_gold_label_fixtures",
      gates: [
        {
          gate: "metadata_only_label_slots",
          pass: reason !== "fixture_must_not_include_raw_content",
        },
        {
          gate: "closed_rubric_allowlists",
          pass: !reason.endsWith("_not_allowlisted"),
        },
        {
          gate: "d3_d4_no_label_guard",
          pass: reason !== "tier_label_policy_mismatch",
        },
        { gate: "local_only_boundary", pass: true },
      ],
    },
    self_critique: {
      confidence: "rejected",
      limitation:
        "Malformed label fixtures are rejected before gold-label slots can be trusted.",
      weakest_link: reason,
    },
    micro_compliance: {
      preview_only: true,
      deterministic: true,
      fixture_only: true,
      metadata_only: true,
      no_chat_content_present: true,
      no_gold_labels_written: true,
      no_manual_review_executed: true,
      no_model_invocation: true,
      no_training: true,
      fail_closed_on_malformed_input: true,
    },
    micro_consent: {
      preview_scope: "corpus_gold_label_fixture_preview_only",
      operator_declared_space_owner: true,
      ownership_is_processing_consent: false,
      raw_content_processing_authorized: false,
      manual_review_execution_authorized: false,
      gold_label_writing_authorized: false,
      benchmark_execution_authorized: false,
      skill_pattern_promotion_authorized: false,
      preference_promotion_authorized: false,
      fine_tune_authorized: false,
      dpo_or_rlhf_authorized: false,
      node_sharing_authorized: false,
      external_upload_authorized: false,
    },
    analogical_model: {
      model: "blank_answer_key_slots_not_answers",
      mapping:
        "This preview defines where future human gold labels could go; it does not reveal answers or write the key.",
    },
    boundary: boundary(),
    next_safe_action: "fix_malformed_gold_label_fixtures",
    reason,
  });
}

export function buildCorpusGoldLabelFixturePreview({
  fixtures = DEFAULT_FIXTURES,
} = {}) {
  const validation = validateFixtures(fixtures);
  if (!validation.ok) return rejectPreview(validation.reason);

  const labelSlots = fixtures.map(buildLabelSlot);
  const noLabelCount = labelSlots.filter((slot) =>
    ["quarantine_no_label", "reject_no_label"].includes(slot.label_kind),
  ).length;

  return deepFreeze({
    schema: CORPUS_GOLD_LABEL_FIXTURE_PREVIEW_SCHEMA,
    truth_label: "DECLARED",
    mode: "PREVIEW_ONLY",
    verdict: "PREVIEW_LABEL_SLOTS_READY",
    ownership_scope: ownershipScope(),
    allowed_uses: clone(ALLOWED_USES),
    blocked_uses: clone(BLOCKED_USES),
    label_slots: labelSlots,
    summary: {
      total_fixtures: labelSlots.length,
      scoreable_fixture_count: labelSlots.length - noLabelCount,
      no_label_fixture_count: noLabelCount,
      ready_for_human_scoring_count: labelSlots.filter(
        (slot) => slot.review_outcome === "candidate_ready_for_human_scoring",
      ).length,
      adjudication_required_count: labelSlots.filter(
        (slot) => slot.review_outcome === "candidate_needs_human_adjudication",
      ).length,
    },
    self_proactive_harness: {
      mode: "DETERMINISTIC_GOLD_LABEL_FIXTURE_PREVIEW",
      recommended_micro_action: "build_corpus_eval_scorecard_preview",
      gates: [
        { gate: "metadata_only_label_slots", pass: true },
        { gate: "closed_rubric_allowlists", pass: true },
        { gate: "d3_d4_no_label_guard", pass: noLabelCount === 2 },
        { gate: "local_only_boundary", pass: true },
      ],
    },
    self_critique: {
      confidence: "bounded_preview",
      limitation:
        "This preview defines label slots and rubrics only; no human judgment, answer key, or dataset artifact is produced.",
      weakest_link:
        "future_gold_labels_require_explicit_human_review_and_consent",
    },
    micro_compliance: {
      preview_only: true,
      deterministic: true,
      fixture_only: true,
      metadata_only: true,
      no_chat_content_present: true,
      no_gold_labels_written: true,
      no_manual_review_executed: true,
      no_model_invocation: true,
      no_training: true,
      fail_closed_on_malformed_input: false,
    },
    micro_consent: {
      preview_scope: "corpus_gold_label_fixture_preview_only",
      operator_declared_space_owner: true,
      ownership_is_processing_consent: false,
      raw_content_processing_authorized: false,
      manual_review_execution_authorized: false,
      gold_label_writing_authorized: false,
      benchmark_execution_authorized: false,
      skill_pattern_promotion_authorized: false,
      preference_promotion_authorized: false,
      fine_tune_authorized: false,
      dpo_or_rlhf_authorized: false,
      node_sharing_authorized: false,
      external_upload_authorized: false,
    },
    analogical_model: {
      model: "blank_answer_key_slots_not_answers",
      mapping:
        "This preview defines where future human gold labels could go; it does not reveal answers or write the key.",
    },
    boundary: boundary(),
    next_safe_action: "build_corpus_eval_scorecard_preview",
    note: "Corpus Gold Label Fixture Preview creates metadata-only rubric slots for future sanitized candidates. It performs no raw ingestion, content opening, manual review, answer-key writing, benchmark replay, model call, dataset write, embeddings, fine-tuning, DPO/RLHF, upload, runtime memory mutation, node sharing, receipt mint, federation, runtime start, or Step 7 action.",
  });
}
