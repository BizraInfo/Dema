export const CORPUS_BENCHMARK_SCHEMA_PREVIEW_SCHEMA =
  "bizra.dema.corpus_benchmark_schema_preview.v0.1";

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
    benchmark_schema_allowed: true,
  }),
  Object.freeze({
    tier: "D1",
    label: "preferences_and_style",
    benchmark_schema_allowed: true,
  }),
  Object.freeze({
    tier: "D2",
    label: "project_reasoning",
    benchmark_schema_allowed: true,
  }),
  Object.freeze({
    tier: "D3",
    label: "private_strategy",
    benchmark_schema_allowed: false,
  }),
  Object.freeze({
    tier: "D4",
    label: "secrets_credentials_identity_financial_health",
    benchmark_schema_allowed: false,
  }),
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

const DIFFICULTIES = Object.freeze(["easy", "medium", "hard", "rare_path"]);
const SAMPLE_ROLES = Object.freeze([
  "evaluation_only",
  "skill_pattern_candidate",
  "preference_candidate",
]);
const CASE_TRUTH_LABELS = Object.freeze([
  "verified_good",
  "use_for_eval_only",
  "negative_overclaim",
  "right_for_wrong_reasons",
  "needs_redaction",
  "forbidden",
]);
const EXPECTED_DISPOSITIONS = Object.freeze([
  "score_eval_only",
  "candidate_skill_pattern_preview",
  "candidate_preference_preview",
  "quarantine_private_strategy",
  "reject_secret_identity_or_credential",
]);

const PROOF_OF_TRUTH_AXES = Object.freeze([
  "formal",
  "cryptographic",
  "empirical",
  "economic",
]);
const SCORING_AXES = Object.freeze([
  "answer_correctness",
  "truth_discipline",
  "safety_compliance",
  "evidence_alignment",
  "uncertainty_calibration",
  "operator_utility",
]);
const SAPE_PROBES = Object.freeze([
  "rare_path_probe",
  "symbolic_neural_bridge",
  "abstraction_lift",
  "logic_creative_tension",
]);
const SNR_PROFILES = Object.freeze([
  "high_signal_low_noise",
  "overclaim_probe",
  "hidden_pattern_probe",
  "benchmark_gold_candidate",
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
  "benchmark_schema_design",
  "manual_review_queue_design",
  "skill_pattern_candidate_schema",
  "preference_dataset_candidate_schema",
  "truth_discipline_eval_design",
  "sape_probe_design",
  "snr_scoring_design",
]);

const BLOCKED_USES = Object.freeze([
  "raw_ingestion",
  "content_extraction",
  "benchmark_replay_execution",
  "local_model_invocation",
  "external_upload",
  "supervised_fine_tuning",
  "dpo_or_rlhf_training",
  "embedding_creation",
  "runtime_memory_mutation",
  "skill_pattern_promotion",
  "preference_dataset_promotion",
  "sharing_with_node1_node4",
  "receipt_minting",
  "step7_minting",
]);

const DEFAULT_CASES = Object.freeze([
  Object.freeze({
    case_id: "exact_solvable_public_case",
    source_id: "chatgpt_team",
    domain: "architecture",
    difficulty: "medium",
    tier: "D0",
    case_truth_label: "verified_good",
    sample_role: "evaluation_only",
    expected_disposition: "score_eval_only",
    declared_tags: Object.freeze(["node0", "architecture", "exact_solvable"]),
    scoring_axes: Object.freeze([
      "answer_correctness",
      "truth_discipline",
      "evidence_alignment",
    ]),
    proof_of_truth_axes: Object.freeze([
      "formal",
      "cryptographic",
      "empirical",
      "economic",
    ]),
    sape_probes: Object.freeze(["symbolic_neural_bridge", "abstraction_lift"]),
    snr_profile: "benchmark_gold_candidate",
  }),
  Object.freeze({
    case_id: "debug_skill_pattern_case",
    source_id: "claude_desktop",
    domain: "code_quality",
    difficulty: "hard",
    tier: "D1",
    case_truth_label: "verified_good",
    sample_role: "skill_pattern_candidate",
    expected_disposition: "candidate_skill_pattern_preview",
    declared_tags: Object.freeze([
      "debugging",
      "tool_reasoning",
      "skill_pattern",
    ]),
    scoring_axes: Object.freeze([
      "answer_correctness",
      "safety_compliance",
      "operator_utility",
    ]),
    proof_of_truth_axes: Object.freeze(["formal", "empirical"]),
    sape_probes: Object.freeze(["rare_path_probe", "logic_creative_tension"]),
    snr_profile: "high_signal_low_noise",
  }),
  Object.freeze({
    case_id: "preference_reasoning_case",
    source_id: "z_ai",
    domain: "agentic_workflow",
    difficulty: "rare_path",
    tier: "D2",
    case_truth_label: "right_for_wrong_reasons",
    sample_role: "preference_candidate",
    expected_disposition: "candidate_preference_preview",
    declared_tags: Object.freeze([
      "preference_pair",
      "agentic_workflow",
      "uncertainty",
    ]),
    scoring_axes: Object.freeze([
      "truth_discipline",
      "uncertainty_calibration",
      "operator_utility",
    ]),
    proof_of_truth_axes: Object.freeze(["formal", "empirical"]),
    sape_probes: Object.freeze(["rare_path_probe", "symbolic_neural_bridge"]),
    snr_profile: "hidden_pattern_probe",
  }),
  Object.freeze({
    case_id: "negative_overclaim_case",
    source_id: "other",
    domain: "truth_discipline",
    difficulty: "hard",
    tier: "D2",
    case_truth_label: "negative_overclaim",
    sample_role: "evaluation_only",
    expected_disposition: "score_eval_only",
    declared_tags: Object.freeze(["overclaim", "claim_boundary", "discipline"]),
    scoring_axes: Object.freeze([
      "truth_discipline",
      "safety_compliance",
      "evidence_alignment",
    ]),
    proof_of_truth_axes: Object.freeze([
      "formal",
      "cryptographic",
      "empirical",
    ]),
    sape_probes: Object.freeze(["logic_creative_tension", "abstraction_lift"]),
    snr_profile: "overclaim_probe",
  }),
  Object.freeze({
    case_id: "private_strategy_eval_only_case",
    source_id: "other",
    domain: "benchmarking",
    difficulty: "rare_path",
    tier: "D3",
    case_truth_label: "needs_redaction",
    sample_role: "evaluation_only",
    expected_disposition: "quarantine_private_strategy",
    declared_tags: Object.freeze([
      "private_strategy",
      "quarantine",
      "eval_only",
    ]),
    scoring_axes: Object.freeze(["safety_compliance", "truth_discipline"]),
    proof_of_truth_axes: Object.freeze(["formal", "cryptographic"]),
    sape_probes: Object.freeze(["rare_path_probe"]),
    snr_profile: "hidden_pattern_probe",
  }),
  Object.freeze({
    case_id: "credential_marker_eval_only_case",
    source_id: "other",
    domain: "security",
    difficulty: "rare_path",
    tier: "D4",
    case_truth_label: "forbidden",
    sample_role: "evaluation_only",
    expected_disposition: "reject_secret_identity_or_credential",
    declared_tags: Object.freeze(["credential_marker", "reject", "eval_only"]),
    scoring_axes: Object.freeze(["safety_compliance", "truth_discipline"]),
    proof_of_truth_axes: Object.freeze(["formal", "cryptographic"]),
    sape_probes: Object.freeze(["rare_path_probe"]),
    snr_profile: "overclaim_probe",
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

function tierDefinition(tier) {
  return DATA_TIERS.find((definition) => definition.tier === tier);
}

function validateD3D4Rule(benchmarkCase) {
  if (benchmarkCase.tier === "D3") {
    return (
      benchmarkCase.sample_role === "evaluation_only" &&
      benchmarkCase.expected_disposition === "quarantine_private_strategy"
    );
  }
  if (benchmarkCase.tier === "D4") {
    return (
      benchmarkCase.sample_role === "evaluation_only" &&
      benchmarkCase.expected_disposition ===
        "reject_secret_identity_or_credential"
    );
  }
  return ![
    "quarantine_private_strategy",
    "reject_secret_identity_or_credential",
  ].includes(benchmarkCase.expected_disposition);
}

function validateCases(cases) {
  if (!Array.isArray(cases) || cases.length === 0) {
    return { ok: false, reason: "cases_must_be_non_empty_array" };
  }

  const seen = new Set();
  for (const benchmarkCase of cases) {
    if (
      !benchmarkCase ||
      typeof benchmarkCase !== "object" ||
      Array.isArray(benchmarkCase)
    ) {
      return { ok: false, reason: "case_must_be_object" };
    }
    if (!isPlainJsonMetadata(benchmarkCase)) {
      return { ok: false, reason: "case_must_be_plain_json_metadata" };
    }
    if (hasRawContentKey(benchmarkCase)) {
      return { ok: false, reason: "case_must_not_include_raw_content" };
    }
    if (
      !isSafeIdentifier(benchmarkCase.case_id) ||
      seen.has(benchmarkCase.case_id)
    ) {
      return { ok: false, reason: "case_id_must_be_unique_safe_identifier" };
    }
    seen.add(benchmarkCase.case_id);
    if (!SOURCE_IDS.includes(benchmarkCase.source_id))
      return { ok: false, reason: "source_id_not_allowlisted" };
    if (!DOMAINS.includes(benchmarkCase.domain))
      return { ok: false, reason: "domain_not_allowlisted" };
    if (!DIFFICULTIES.includes(benchmarkCase.difficulty))
      return { ok: false, reason: "difficulty_not_allowlisted" };
    if (
      !DATA_TIERS.some((definition) => definition.tier === benchmarkCase.tier)
    ) {
      return { ok: false, reason: "tier_not_allowlisted" };
    }
    if (!CASE_TRUTH_LABELS.includes(benchmarkCase.case_truth_label)) {
      return { ok: false, reason: "case_truth_label_not_allowlisted" };
    }
    if (!SAMPLE_ROLES.includes(benchmarkCase.sample_role))
      return { ok: false, reason: "sample_role_not_allowlisted" };
    if (!EXPECTED_DISPOSITIONS.includes(benchmarkCase.expected_disposition)) {
      return { ok: false, reason: "expected_disposition_not_allowlisted" };
    }
    if (!validateD3D4Rule(benchmarkCase)) {
      return {
        ok: false,
        reason: "d3_d4_must_be_evaluation_only_and_quarantined_or_rejected",
      };
    }
    if (
      !Array.isArray(benchmarkCase.declared_tags) ||
      benchmarkCase.declared_tags.length === 0 ||
      !benchmarkCase.declared_tags.every(isSafeIdentifier)
    ) {
      return { ok: false, reason: "declared_tags_must_be_safe_identifiers" };
    }
    if (!allAllowed(benchmarkCase.scoring_axes, SCORING_AXES)) {
      return { ok: false, reason: "scoring_axis_not_allowlisted" };
    }
    if (!allAllowed(benchmarkCase.proof_of_truth_axes, PROOF_OF_TRUTH_AXES)) {
      return { ok: false, reason: "proof_of_truth_axis_not_allowlisted" };
    }
    if (!allAllowed(benchmarkCase.sape_probes, SAPE_PROBES)) {
      return { ok: false, reason: "sape_probe_not_allowlisted" };
    }
    if (!SNR_PROFILES.includes(benchmarkCase.snr_profile)) {
      return { ok: false, reason: "snr_profile_not_allowlisted" };
    }
  }

  return { ok: true };
}

function buildCasePreview(benchmarkCase) {
  const tier = tierDefinition(benchmarkCase.tier);
  return {
    case_id: benchmarkCase.case_id,
    source_id: benchmarkCase.source_id,
    domain: benchmarkCase.domain,
    difficulty: benchmarkCase.difficulty,
    tier: benchmarkCase.tier,
    tier_label: tier.label,
    case_truth_label: benchmarkCase.case_truth_label,
    sample_role: benchmarkCase.sample_role,
    expected_disposition: benchmarkCase.expected_disposition,
    declared_tags: [...benchmarkCase.declared_tags].sort(),
    scoring_axes: [...benchmarkCase.scoring_axes].sort(),
    proof_of_truth_axes: [...benchmarkCase.proof_of_truth_axes].sort(),
    sape_probes: [...benchmarkCase.sape_probes].sort(),
    snr_profile: benchmarkCase.snr_profile,
    benchmark_schema_allowed: tier.benchmark_schema_allowed,
    benchmark_execution_state: "not_executed_schema_only",
    promotion_state: "not_promoted_requires_future_exact_consent",
  };
}

function boundary() {
  return {
    raw_content_ingested: false,
    raw_content_opened: false,
    benchmark_executed: false,
    local_model_called: false,
    embeddings_created: false,
    fine_tune_started: false,
    dpo_or_rlhf_started: false,
    external_upload_performed: false,
    runtime_memory_mutated: false,
    skill_pattern_promoted: false,
    preference_promoted: false,
    supervised_dataset_written: false,
    dpo_dataset_written: false,
    node_sharing_performed: false,
    filesystem_write_performed: false,
    network_called: false,
    runtime_started: false,
    federation_started: false,
    receipt_minted: false,
    step7_mint_attempted: false,
  };
}

function ownershipScope() {
  return {
    declared_operator_owner: "mumu",
    local_product_face: "dema",
    governed_boundary: "node0",
    interpretation: "ownership_and_provenance_not_processing_authorization",
  };
}

function emptySummary() {
  return {
    total_cases: 0,
    eval_only_count: 0,
    skill_pattern_candidate_count: 0,
    preference_candidate_count: 0,
    d3_d4_total_count: 0,
    d3_d4_eval_only_count: 0,
    proof_of_truth_axes_required: clone(PROOF_OF_TRUTH_AXES),
    sape_probe_count: 0,
  };
}

function rejectPreview(reason) {
  return deepFreeze({
    schema: CORPUS_BENCHMARK_SCHEMA_PREVIEW_SCHEMA,
    truth_label: "DECLARED",
    mode: "PREVIEW_ONLY",
    verdict: "PREVIEW_REJECT",
    data_tiers: clone(DATA_TIERS),
    ownership_scope: ownershipScope(),
    allowed_uses: clone(ALLOWED_USES),
    blocked_uses: clone(BLOCKED_USES),
    benchmark_cases: [],
    summary: emptySummary(),
    self_proactive_harness: {
      mode: "DETERMINISTIC_BENCHMARK_SCHEMA_PREVIEW",
      recommended_micro_action: "fix_malformed_benchmark_schema_inputs",
      gates: [
        {
          gate: "metadata_only_schema",
          pass: reason !== "case_must_not_include_raw_content",
        },
        {
          gate: "closed_axis_allowlists",
          pass: !reason.endsWith("_not_allowlisted"),
        },
        {
          gate: "d3_d4_eval_only_guard",
          pass:
            reason !==
            "d3_d4_must_be_evaluation_only_and_quarantined_or_rejected",
        },
        { gate: "local_only_boundary", pass: true },
      ],
    },
    self_critique: {
      confidence: "rejected",
      limitation:
        "Malformed benchmark schema inputs are rejected before an evaluation contract can be trusted.",
      weakest_link: reason,
    },
    micro_compliance: {
      preview_only: true,
      deterministic: true,
      schema_only: true,
      metadata_only: true,
      no_chat_content_present: true,
      no_benchmark_execution: true,
      no_skill_pattern_promoted: true,
      no_preference_promoted: true,
      no_ingestion: true,
      no_embeddings: true,
      no_fine_tune: true,
      no_external_upload: true,
      no_runtime_memory_mutation: true,
      fail_closed_on_malformed_input: true,
    },
    micro_consent: {
      preview_scope: "corpus_benchmark_schema_preview_only",
      operator_declared_space_owner: true,
      ownership_is_processing_consent: false,
      raw_content_processing_authorized: false,
      benchmark_execution_authorized: false,
      skill_pattern_promotion_authorized: false,
      preference_promotion_authorized: false,
      fine_tune_authorized: false,
      dpo_or_rlhf_authorized: false,
      node_sharing_authorized: false,
      external_upload_authorized: false,
    },
    analogical_model: {
      model: "exam_rubric_not_exam_room",
      mapping:
        "This preview defines how future sanitized cases could be scored; it does not administer the exam or reveal the answers.",
    },
    boundary: boundary(),
    next_safe_action: "fix_malformed_benchmark_schema_inputs",
    reason,
  });
}

export function buildCorpusBenchmarkSchemaPreview({
  cases = DEFAULT_CASES,
} = {}) {
  const validation = validateCases(cases);
  if (!validation.ok) return rejectPreview(validation.reason);

  const benchmarkCases = cases.map(buildCasePreview);
  const d3D4Cases = benchmarkCases.filter((entry) =>
    ["D3", "D4"].includes(entry.tier),
  );
  const distinctSapeProbes = new Set(
    benchmarkCases.flatMap((entry) => entry.sape_probes),
  );
  const summary = {
    total_cases: benchmarkCases.length,
    eval_only_count: benchmarkCases.filter(
      (entry) => entry.sample_role === "evaluation_only",
    ).length,
    skill_pattern_candidate_count: benchmarkCases.filter(
      (entry) => entry.sample_role === "skill_pattern_candidate",
    ).length,
    preference_candidate_count: benchmarkCases.filter(
      (entry) => entry.sample_role === "preference_candidate",
    ).length,
    d3_d4_total_count: d3D4Cases.length,
    d3_d4_eval_only_count: d3D4Cases.filter(
      (entry) => entry.sample_role === "evaluation_only",
    ).length,
    proof_of_truth_axes_required: clone(PROOF_OF_TRUTH_AXES),
    sape_probe_count: distinctSapeProbes.size,
  };

  return deepFreeze({
    schema: CORPUS_BENCHMARK_SCHEMA_PREVIEW_SCHEMA,
    truth_label: "DECLARED",
    mode: "PREVIEW_ONLY",
    verdict: "PREVIEW_SCHEMA_READY",
    data_tiers: clone(DATA_TIERS),
    ownership_scope: ownershipScope(),
    allowed_uses: clone(ALLOWED_USES),
    blocked_uses: clone(BLOCKED_USES),
    benchmark_cases: benchmarkCases,
    summary,
    self_proactive_harness: {
      mode: "DETERMINISTIC_BENCHMARK_SCHEMA_PREVIEW",
      recommended_micro_action: "build_corpus_manual_review_queue_preview",
      gates: [
        { gate: "metadata_only_schema", pass: true },
        { gate: "closed_axis_allowlists", pass: true },
        {
          gate: "d3_d4_eval_only_guard",
          pass: summary.d3_d4_eval_only_count === summary.d3_d4_total_count,
        },
        {
          gate: "proof_of_truth_axes_declared",
          pass: summary.proof_of_truth_axes_required.length === 4,
        },
        { gate: "local_only_boundary", pass: true },
      ],
    },
    self_critique: {
      confidence: "bounded_preview",
      limitation:
        "This schema preview defines benchmark metadata contracts only; it does not run Dema, inspect chats, create datasets, or prove answer quality.",
      weakest_link: "future_sanitized_cases_require_human_gold_labels",
    },
    micro_compliance: {
      preview_only: true,
      deterministic: true,
      schema_only: true,
      metadata_only: true,
      no_chat_content_present: true,
      no_benchmark_execution: true,
      no_skill_pattern_promoted: true,
      no_preference_promoted: true,
      no_ingestion: true,
      no_embeddings: true,
      no_fine_tune: true,
      no_external_upload: true,
      no_runtime_memory_mutation: true,
      fail_closed_on_malformed_input: false,
    },
    micro_consent: {
      preview_scope: "corpus_benchmark_schema_preview_only",
      operator_declared_space_owner: true,
      ownership_is_processing_consent: false,
      raw_content_processing_authorized: false,
      benchmark_execution_authorized: false,
      skill_pattern_promotion_authorized: false,
      preference_promotion_authorized: false,
      fine_tune_authorized: false,
      dpo_or_rlhf_authorized: false,
      node_sharing_authorized: false,
      external_upload_authorized: false,
    },
    analogical_model: {
      model: "exam_rubric_not_exam_room",
      mapping:
        "This preview defines how future sanitized cases could be scored; it does not administer the exam or reveal the answers.",
    },
    boundary: boundary(),
    next_safe_action: "build_corpus_manual_review_queue_preview",
    note: "Corpus Benchmark Schema Preview turns corpus strategy into metadata-only benchmark contracts. It performs no raw ingestion, replay, local model call, dataset write, embeddings, fine-tuning, DPO/RLHF, upload, runtime memory mutation, node sharing, receipt mint, federation, runtime start, or Step 7 action.",
  });
}
