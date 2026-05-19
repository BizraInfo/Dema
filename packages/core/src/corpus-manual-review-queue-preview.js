export const CORPUS_MANUAL_REVIEW_QUEUE_PREVIEW_SCHEMA = "bizra.dema.corpus_manual_review_queue_preview.v0.1";

const SOURCE_IDS = Object.freeze(["claude_desktop", "chatgpt_team", "google_gemini", "deepseek", "kimi", "z_ai", "other"]);
const DOMAINS = Object.freeze(["architecture", "security", "code_quality", "truth_discipline", "agentic_workflow", "documentation", "benchmarking"]);
const TIERS = Object.freeze(["D0", "D1", "D2", "D3", "D4"]);
const DIFFICULTIES = Object.freeze(["easy", "medium", "hard", "rare_path"]);
const SAMPLE_ROLES = Object.freeze(["evaluation_only", "skill_pattern_candidate", "preference_candidate"]);
const CASE_TRUTH_LABELS = Object.freeze(["verified_good", "use_for_eval_only", "negative_overclaim", "right_for_wrong_reasons", "needs_redaction", "forbidden"]);
const REDACTION_STATES = Object.freeze(["sanitized_metadata_only", "quarantine_marker", "reject_marker"]);
const QUEUE_LANES = Object.freeze(["benchmark_eval_review", "skill_pattern_review", "preference_pair_review", "quarantine_review", "reject_log"]);
const PROOF_OF_TRUTH_AXES = Object.freeze(["formal", "cryptographic", "empirical", "economic"]);
const SNR_PROFILES = Object.freeze(["high_signal_low_noise", "overclaim_probe", "hidden_pattern_probe", "benchmark_gold_candidate"]);

const RAW_CONTENT_KEYS = new Set([
  "answer", "assistant", "best_answer", "chat", "chats", "completion", "content", "conversation", "conversations",
  "dialog", "gold", "ideal", "input", "messages", "output", "prompt", "question", "raw_text", "reference",
  "response", "system", "target_bad", "target_good", "transcript", "turns", "user"
]);

const ALLOWED_USES = Object.freeze([
  "manual_review_queue_design", "sanitized_benchmark_candidate_prioritization", "local_asset_inventory_planning",
  "truth_label_review_design", "skill_pattern_review_design", "preference_pair_review_design"
]);

const BLOCKED_USES = Object.freeze([
  "raw_ingestion", "content_extraction", "benchmark_replay_execution", "local_model_invocation", "external_upload",
  "supervised_fine_tuning", "dpo_or_rlhf_training", "embedding_creation", "runtime_memory_mutation",
  "skill_pattern_promotion", "preference_dataset_promotion", "queue_persistence", "sharing_with_node1_node4",
  "receipt_minting", "step7_minting"
]);

const DEFAULT_CANDIDATES = Object.freeze([
  Object.freeze({
    candidate_id: "gold_architecture_eval",
    source_id: "chatgpt_team",
    domain: "architecture",
    difficulty: "hard",
    tier: "D0",
    case_truth_label: "verified_good",
    sample_role: "evaluation_only",
    redaction_state: "sanitized_metadata_only",
    proof_of_truth_axes: Object.freeze(["formal", "cryptographic", "empirical", "economic"]),
    snr_profile: "benchmark_gold_candidate"
  }),
  Object.freeze({
    candidate_id: "debug_skill_pattern_review",
    source_id: "claude_desktop",
    domain: "code_quality",
    difficulty: "rare_path",
    tier: "D1",
    case_truth_label: "verified_good",
    sample_role: "skill_pattern_candidate",
    redaction_state: "sanitized_metadata_only",
    proof_of_truth_axes: Object.freeze(["formal", "empirical"]),
    snr_profile: "high_signal_low_noise"
  }),
  Object.freeze({
    candidate_id: "preference_pair_uncertainty_review",
    source_id: "z_ai",
    domain: "agentic_workflow",
    difficulty: "rare_path",
    tier: "D2",
    case_truth_label: "right_for_wrong_reasons",
    sample_role: "preference_candidate",
    redaction_state: "sanitized_metadata_only",
    proof_of_truth_axes: Object.freeze(["formal", "empirical"]),
    snr_profile: "hidden_pattern_probe"
  }),
  Object.freeze({
    candidate_id: "overclaim_negative_eval",
    source_id: "other",
    domain: "truth_discipline",
    difficulty: "hard",
    tier: "D2",
    case_truth_label: "negative_overclaim",
    sample_role: "evaluation_only",
    redaction_state: "sanitized_metadata_only",
    proof_of_truth_axes: Object.freeze(["formal", "cryptographic", "empirical"]),
    snr_profile: "overclaim_probe"
  }),
  Object.freeze({
    candidate_id: "private_strategy_quarantine",
    source_id: "other",
    domain: "benchmarking",
    difficulty: "rare_path",
    tier: "D3",
    case_truth_label: "needs_redaction",
    sample_role: "evaluation_only",
    redaction_state: "quarantine_marker",
    proof_of_truth_axes: Object.freeze(["formal", "cryptographic"]),
    snr_profile: "hidden_pattern_probe"
  }),
  Object.freeze({
    candidate_id: "credential_marker_reject",
    source_id: "other",
    domain: "security",
    difficulty: "rare_path",
    tier: "D4",
    case_truth_label: "forbidden",
    sample_role: "evaluation_only",
    redaction_state: "reject_marker",
    proof_of_truth_axes: Object.freeze(["formal", "cryptographic"]),
    snr_profile: "overclaim_probe"
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

function laneFor(candidate) {
  if (candidate.tier === "D4") return "reject_log";
  if (candidate.tier === "D3") return "quarantine_review";
  if (candidate.sample_role === "skill_pattern_candidate") return "skill_pattern_review";
  if (candidate.sample_role === "preference_candidate") return "preference_pair_review";
  return "benchmark_eval_review";
}

function validateTierLane(candidate) {
  if (candidate.tier === "D3") {
    return candidate.sample_role === "evaluation_only"
      && candidate.redaction_state === "quarantine_marker"
      && laneFor(candidate) === "quarantine_review";
  }
  if (candidate.tier === "D4") {
    return candidate.sample_role === "evaluation_only"
      && candidate.redaction_state === "reject_marker"
      && laneFor(candidate) === "reject_log";
  }
  return candidate.redaction_state === "sanitized_metadata_only";
}

function validateCandidates(candidates) {
  if (!Array.isArray(candidates) || candidates.length === 0) return { ok: false, reason: "candidates_must_be_non_empty_array" };
  const seen = new Set();
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return { ok: false, reason: "candidate_must_be_object" };
    if (!isPlainJsonMetadata(candidate)) return { ok: false, reason: "candidate_must_be_plain_json_metadata" };
    if (hasRawContentKey(candidate)) return { ok: false, reason: "candidate_must_not_include_raw_content" };
    if (!isSafeIdentifier(candidate.candidate_id) || seen.has(candidate.candidate_id)) {
      return { ok: false, reason: "candidate_id_must_be_unique_safe_identifier" };
    }
    seen.add(candidate.candidate_id);
    if (!SOURCE_IDS.includes(candidate.source_id)) return { ok: false, reason: "source_id_not_allowlisted" };
    if (!DOMAINS.includes(candidate.domain)) return { ok: false, reason: "domain_not_allowlisted" };
    if (!DIFFICULTIES.includes(candidate.difficulty)) return { ok: false, reason: "difficulty_not_allowlisted" };
    if (!TIERS.includes(candidate.tier)) return { ok: false, reason: "tier_not_allowlisted" };
    if (!CASE_TRUTH_LABELS.includes(candidate.case_truth_label)) return { ok: false, reason: "case_truth_label_not_allowlisted" };
    if (!SAMPLE_ROLES.includes(candidate.sample_role)) return { ok: false, reason: "sample_role_not_allowlisted" };
    if (!REDACTION_STATES.includes(candidate.redaction_state)) return { ok: false, reason: "redaction_state_not_allowlisted" };
    if (!allAllowed(candidate.proof_of_truth_axes, PROOF_OF_TRUTH_AXES)) return { ok: false, reason: "proof_of_truth_axis_not_allowlisted" };
    if (!SNR_PROFILES.includes(candidate.snr_profile)) return { ok: false, reason: "snr_profile_not_allowlisted" };
    if (!validateTierLane(candidate)) return { ok: false, reason: "tier_lane_policy_mismatch" };
  }
  return { ok: true };
}

function priorityScore(candidate) {
  if (["D3", "D4"].includes(candidate.tier)) return 0;
  const truth = { verified_good: 30, negative_overclaim: 24, right_for_wrong_reasons: 20, use_for_eval_only: 16 }[candidate.case_truth_label] ?? 8;
  const difficulty = { rare_path: 18, hard: 14, medium: 8, easy: 4 }[candidate.difficulty];
  const snr = { benchmark_gold_candidate: 24, high_signal_low_noise: 20, overclaim_probe: 18, hidden_pattern_probe: 16 }[candidate.snr_profile];
  const proof = candidate.proof_of_truth_axes.length * 5;
  const role = candidate.sample_role === "evaluation_only" ? 8 : 5;
  return truth + difficulty + snr + proof + role;
}

function buildQueueItem(candidate) {
  const lane = laneFor(candidate);
  return {
    candidate_id: candidate.candidate_id,
    source_id: candidate.source_id,
    domain: candidate.domain,
    difficulty: candidate.difficulty,
    tier: candidate.tier,
    case_truth_label: candidate.case_truth_label,
    sample_role: candidate.sample_role,
    redaction_state: candidate.redaction_state,
    queue_lane: lane,
    priority_score: priorityScore(candidate),
    proof_of_truth_axes: [...candidate.proof_of_truth_axes].sort(),
    snr_profile: candidate.snr_profile,
    local_asset_state: "declared_local_node0_space",
    review_state: lane === "reject_log" ? "log_rejection_without_opening_content" : "manual_review_required",
    promotion_state: "not_promoted_requires_future_exact_consent"
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
    local_model_called: false,
    embeddings_created: false,
    fine_tune_started: false,
    dpo_or_rlhf_started: false,
    external_upload_performed: false,
    runtime_memory_mutated: false,
    skill_pattern_promoted: false,
    preference_promoted: false,
    queue_persisted: false,
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
    total_candidates: 0,
    actionable_review_count: 0,
    quarantine_count: 0,
    reject_count: 0,
    highest_priority_candidate: null,
    lanes: Object.fromEntries(QUEUE_LANES.map((lane) => [lane, 0]))
  };
}

function rejectPreview(reason) {
  return deepFreeze({
    schema: CORPUS_MANUAL_REVIEW_QUEUE_PREVIEW_SCHEMA,
    truth_label: "DECLARED",
    mode: "PREVIEW_ONLY",
    verdict: "PREVIEW_REJECT",
    ownership_scope: ownershipScope(),
    allowed_uses: clone(ALLOWED_USES),
    blocked_uses: clone(BLOCKED_USES),
    queue_items: [],
    summary: emptySummary(),
    self_proactive_harness: {
      mode: "DETERMINISTIC_MANUAL_REVIEW_QUEUE_PREVIEW",
      recommended_micro_action: "fix_malformed_review_queue_inputs",
      gates: [
        { gate: "local_asset_metadata_only", pass: reason !== "candidate_must_not_include_raw_content" },
        { gate: "closed_allowlists", pass: !reason.endsWith("_not_allowlisted") },
        { gate: "d3_d4_non_actionable_lanes", pass: reason !== "tier_lane_policy_mismatch" },
        { gate: "local_only_boundary", pass: true }
      ]
    },
    self_critique: {
      confidence: "rejected",
      limitation: "Malformed review queue inputs are rejected before prioritization can be trusted.",
      weakest_link: reason
    },
    micro_compliance: {
      preview_only: true,
      deterministic: true,
      metadata_only: true,
      no_chat_content_present: true,
      no_manual_review_executed: true,
      no_model_invocation: true,
      no_queue_persistence: true,
      no_training: true,
      fail_closed_on_malformed_input: true
    },
    micro_consent: {
      preview_scope: "corpus_manual_review_queue_preview_only",
      operator_declared_space_owner: true,
      ownership_is_processing_consent: false,
      raw_content_processing_authorized: false,
      manual_review_execution_authorized: false,
      benchmark_execution_authorized: false,
      skill_pattern_promotion_authorized: false,
      preference_promotion_authorized: false,
      fine_tune_authorized: false,
      dpo_or_rlhf_authorized: false,
      node_sharing_authorized: false,
      external_upload_authorized: false
    },
    analogical_model: {
      model: "library_card_catalog_not_book_opening",
      mapping: "This preview orders local card-catalog entries for human review; it does not open books, copy pages, or train on them."
    },
    boundary: boundary(),
    next_safe_action: "fix_malformed_review_queue_inputs",
    reason
  });
}

export function buildCorpusManualReviewQueuePreview({ candidates = DEFAULT_CANDIDATES } = {}) {
  const validation = validateCandidates(candidates);
  if (!validation.ok) return rejectPreview(validation.reason);

  const queueItems = candidates.map(buildQueueItem)
    .sort((a, b) => b.priority_score - a.priority_score || a.candidate_id.localeCompare(b.candidate_id));
  const lanes = Object.fromEntries(QUEUE_LANES.map((lane) => [
    lane,
    queueItems.filter((item) => item.queue_lane === lane).length
  ]));

  return deepFreeze({
    schema: CORPUS_MANUAL_REVIEW_QUEUE_PREVIEW_SCHEMA,
    truth_label: "DECLARED",
    mode: "PREVIEW_ONLY",
    verdict: "PREVIEW_QUEUE_READY",
    ownership_scope: ownershipScope(),
    allowed_uses: clone(ALLOWED_USES),
    blocked_uses: clone(BLOCKED_USES),
    queue_items: queueItems,
    summary: {
      total_candidates: queueItems.length,
      actionable_review_count: queueItems.filter((item) => !["quarantine_review", "reject_log"].includes(item.queue_lane)).length,
      quarantine_count: lanes.quarantine_review,
      reject_count: lanes.reject_log,
      highest_priority_candidate: queueItems[0]?.candidate_id ?? null,
      lanes
    },
    self_proactive_harness: {
      mode: "DETERMINISTIC_MANUAL_REVIEW_QUEUE_PREVIEW",
      recommended_micro_action: "build_corpus_gold_label_fixture_preview",
      gates: [
        { gate: "local_asset_metadata_only", pass: true },
        { gate: "closed_allowlists", pass: true },
        { gate: "d3_d4_non_actionable_lanes", pass: lanes.quarantine_review > 0 && lanes.reject_log > 0 },
        { gate: "local_only_boundary", pass: true }
      ]
    },
    self_critique: {
      confidence: "bounded_preview",
      limitation: "Priorities are deterministic metadata heuristics; human gold labels and future proof receipts are still required.",
      weakest_link: "no_real_conversation_content_or_model_output_reviewed"
    },
    micro_compliance: {
      preview_only: true,
      deterministic: true,
      metadata_only: true,
      no_chat_content_present: true,
      no_manual_review_executed: true,
      no_model_invocation: true,
      no_queue_persistence: true,
      no_training: true,
      fail_closed_on_malformed_input: false
    },
    micro_consent: {
      preview_scope: "corpus_manual_review_queue_preview_only",
      operator_declared_space_owner: true,
      ownership_is_processing_consent: false,
      raw_content_processing_authorized: false,
      manual_review_execution_authorized: false,
      benchmark_execution_authorized: false,
      skill_pattern_promotion_authorized: false,
      preference_promotion_authorized: false,
      fine_tune_authorized: false,
      dpo_or_rlhf_authorized: false,
      node_sharing_authorized: false,
      external_upload_authorized: false
    },
    analogical_model: {
      model: "library_card_catalog_not_book_opening",
      mapping: "This preview orders local card-catalog entries for human review; it does not open books, copy pages, or train on them."
    },
    boundary: boundary(),
    next_safe_action: "build_corpus_gold_label_fixture_preview",
    note: "Corpus Manual Review Queue Preview ranks sanitized local metadata candidates only. It performs no raw ingestion, content extraction, manual review execution, benchmark replay, model call, dataset write, embeddings, fine-tuning, DPO/RLHF, upload, runtime memory mutation, node sharing, receipt mint, federation, runtime start, or Step 7 action."
  });
}
