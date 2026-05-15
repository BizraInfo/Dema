import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  buildCorpusBenchmarkSchemaPreview,
  CORPUS_BENCHMARK_SCHEMA_PREVIEW_SCHEMA
} from "../packages/core/src/corpus-benchmark-schema-preview.js";

const modulePath = new URL("../packages/core/src/corpus-benchmark-schema-preview.js", import.meta.url);
const cliPath = new URL("../apps/cli/src/index.js", import.meta.url);

test("buildCorpusBenchmarkSchemaPreview emits schema-tagged benchmark metadata contracts", () => {
  const preview = buildCorpusBenchmarkSchemaPreview();
  const byId = new Map(preview.benchmark_cases.map((entry) => [entry.case_id, entry]));

  assert.equal(preview.schema, CORPUS_BENCHMARK_SCHEMA_PREVIEW_SCHEMA);
  assert.equal(preview.mode, "PREVIEW_ONLY");
  assert.equal(preview.verdict, "PREVIEW_SCHEMA_READY");
  assert.equal(preview.summary.total_cases, 6);
  assert.equal(preview.summary.eval_only_count, 4);
  assert.equal(preview.summary.skill_pattern_candidate_count, 1);
  assert.equal(preview.summary.preference_candidate_count, 1);
  assert.equal(preview.summary.d3_d4_total_count, 2);
  assert.equal(preview.summary.d3_d4_eval_only_count, 2);
  assert.equal(byId.get("exact_solvable_public_case").tier, "D0");
  assert.equal(byId.get("debug_skill_pattern_case").sample_role, "skill_pattern_candidate");
  assert.equal(byId.get("preference_reasoning_case").expected_disposition, "candidate_preference_preview");
  assert.equal(byId.get("negative_overclaim_case").case_truth_label, "negative_overclaim");
});

test("schema declares SAPE, SNR, and Proof-of-Truth axes without executing benchmarks", () => {
  const preview = buildCorpusBenchmarkSchemaPreview();
  const allProofAxes = new Set(preview.benchmark_cases.flatMap((entry) => entry.proof_of_truth_axes));
  const allSapeProbes = new Set(preview.benchmark_cases.flatMap((entry) => entry.sape_probes));

  assert.deepEqual(preview.summary.proof_of_truth_axes_required, ["formal", "cryptographic", "empirical", "economic"]);
  assert.ok(allProofAxes.has("formal"));
  assert.ok(allProofAxes.has("cryptographic"));
  assert.ok(allProofAxes.has("empirical"));
  assert.ok(allProofAxes.has("economic"));
  assert.ok(allSapeProbes.has("rare_path_probe"));
  assert.ok(allSapeProbes.has("symbolic_neural_bridge"));
  assert.ok(allSapeProbes.has("abstraction_lift"));
  assert.ok(allSapeProbes.has("logic_creative_tension"));
  assert.ok(preview.benchmark_cases.some((entry) => entry.snr_profile === "overclaim_probe"));
  assert.equal(preview.boundary.benchmark_executed, false);
  assert.equal(preview.boundary.local_model_called, false);
});

test("D3 and D4 cases are hard-gated to evaluation-only quarantine or rejection", () => {
  const preview = buildCorpusBenchmarkSchemaPreview();
  const blocked = preview.benchmark_cases.filter((entry) => ["D3", "D4"].includes(entry.tier));

  assert.deepEqual(blocked.map((entry) => entry.sample_role), ["evaluation_only", "evaluation_only"]);
  assert.deepEqual(blocked.map((entry) => entry.expected_disposition), [
    "quarantine_private_strategy",
    "reject_secret_identity_or_credential"
  ]);
  assert.deepEqual(blocked.map((entry) => entry.benchmark_schema_allowed), [false, false]);
  assert.equal(preview.self_proactive_harness.gates.find((gate) => gate.gate === "d3_d4_eval_only_guard").pass, true);

  const invalidD3 = buildCorpusBenchmarkSchemaPreview({
    cases: [{
      case_id: "bad_d3_candidate",
      source_id: "other",
      domain: "benchmarking",
      difficulty: "rare_path",
      tier: "D3",
      case_truth_label: "needs_redaction",
      sample_role: "preference_candidate",
      expected_disposition: "candidate_preference_preview",
      declared_tags: ["private_strategy"],
      scoring_axes: ["safety_compliance"],
      proof_of_truth_axes: ["formal"],
      sape_probes: ["rare_path_probe"],
      snr_profile: "hidden_pattern_probe"
    }]
  });

  assert.equal(invalidD3.verdict, "PREVIEW_REJECT");
  assert.equal(invalidD3.reason, "d3_d4_must_be_evaluation_only_and_quarantined_or_rejected");
});

test("closed allowlists reject unknown axes and profiles without echoing caller content", () => {
  const badAxis = buildCorpusBenchmarkSchemaPreview({
    cases: [{
      case_id: "bad_axis_case",
      source_id: "chatgpt_team",
      domain: "architecture",
      difficulty: "medium",
      tier: "D0",
      case_truth_label: "verified_good",
      sample_role: "evaluation_only",
      expected_disposition: "score_eval_only",
      declared_tags: ["node0"],
      scoring_axes: ["run_curl_hidden_command"],
      proof_of_truth_axes: ["formal"],
      sape_probes: ["rare_path_probe"],
      snr_profile: "high_signal_low_noise"
    }]
  });
  const badProof = buildCorpusBenchmarkSchemaPreview({
    cases: [{
      case_id: "bad_proof_case",
      source_id: "chatgpt_team",
      domain: "architecture",
      difficulty: "medium",
      tier: "D0",
      case_truth_label: "verified_good",
      sample_role: "evaluation_only",
      expected_disposition: "score_eval_only",
      declared_tags: ["node0"],
      scoring_axes: ["answer_correctness"],
      proof_of_truth_axes: ["oracle"],
      sape_probes: ["rare_path_probe"],
      snr_profile: "high_signal_low_noise"
    }]
  });

  assert.equal(badAxis.reason, "scoring_axis_not_allowlisted");
  assert.equal(badProof.reason, "proof_of_truth_axis_not_allowlisted");
  assert.doesNotMatch(JSON.stringify(badAxis), /run_curl_hidden_command/);
  assert.doesNotMatch(JSON.stringify(badProof), /oracle/);
});

test("raw-content keys fail closed recursively without echoing observed text", () => {
  const secretText = "raw-chat-answer-should-not-appear";
  const rawTopLevel = buildCorpusBenchmarkSchemaPreview({
    cases: [{
      case_id: "raw_input_case",
      source_id: "chatgpt_team",
      domain: "architecture",
      difficulty: "medium",
      tier: "D0",
      case_truth_label: "verified_good",
      sample_role: "evaluation_only",
      expected_disposition: "score_eval_only",
      input: secretText,
      declared_tags: ["node0"],
      scoring_axes: ["answer_correctness"],
      proof_of_truth_axes: ["formal"],
      sape_probes: ["rare_path_probe"],
      snr_profile: "high_signal_low_noise"
    }]
  });
  const rawNested = buildCorpusBenchmarkSchemaPreview({
    cases: [{
      case_id: "raw_nested_case",
      source_id: "chatgpt_team",
      domain: "architecture",
      difficulty: "medium",
      tier: "D0",
      case_truth_label: "verified_good",
      sample_role: "evaluation_only",
      expected_disposition: "score_eval_only",
      declared_tags: ["node0"],
      scoring_axes: ["answer_correctness"],
      proof_of_truth_axes: ["formal"],
      sape_probes: ["rare_path_probe"],
      snr_profile: "high_signal_low_noise",
      metadata: { transcript: secretText }
    }]
  });

  assert.equal(rawTopLevel.verdict, "PREVIEW_REJECT");
  assert.equal(rawTopLevel.reason, "case_must_not_include_raw_content");
  assert.equal(rawNested.reason, "case_must_not_include_raw_content");
  assert.doesNotMatch(JSON.stringify(rawTopLevel), /raw-chat-answer-should-not-appear/);
  assert.doesNotMatch(JSON.stringify(rawNested), /raw-chat-answer-should-not-appear/);
});

test("schema emits micro-compliance, micro-consent, self-critique, and analogical model", () => {
  const preview = buildCorpusBenchmarkSchemaPreview();

  assert.equal(preview.ownership_scope.declared_operator_owner, "mumu");
  assert.equal(preview.ownership_scope.local_product_face, "dema");
  assert.equal(preview.ownership_scope.governed_boundary, "node0");
  assert.equal(preview.ownership_scope.interpretation, "ownership_and_provenance_not_processing_authorization");
  assert.equal(preview.self_proactive_harness.mode, "DETERMINISTIC_BENCHMARK_SCHEMA_PREVIEW");
  assert.equal(preview.self_proactive_harness.recommended_micro_action, "build_corpus_manual_review_queue_preview");
  assert.equal(preview.self_proactive_harness.gates.find((gate) => gate.gate === "proof_of_truth_axes_declared").pass, true);
  assert.equal(preview.self_critique.confidence, "bounded_preview");
  assert.equal(preview.micro_compliance.schema_only, true);
  assert.equal(preview.micro_compliance.no_chat_content_present, true);
  assert.equal(preview.micro_compliance.no_benchmark_execution, true);
  assert.equal(preview.micro_compliance.no_skill_pattern_promoted, true);
  assert.equal(preview.micro_compliance.no_preference_promoted, true);
  assert.equal(preview.micro_consent.operator_declared_space_owner, true);
  assert.equal(preview.micro_consent.ownership_is_processing_consent, false);
  assert.equal(preview.micro_consent.benchmark_execution_authorized, false);
  assert.equal(preview.micro_consent.skill_pattern_promotion_authorized, false);
  assert.equal(preview.micro_consent.preference_promotion_authorized, false);
  assert.equal(preview.micro_consent.fine_tune_authorized, false);
  assert.equal(preview.micro_consent.dpo_or_rlhf_authorized, false);
  assert.equal(preview.analogical_model.model, "exam_rubric_not_exam_room");
});

test("preview keeps every authority and data movement boundary false", () => {
  const preview = buildCorpusBenchmarkSchemaPreview();
  const expectedFalseBoundaries = [
    "raw_content_ingested",
    "raw_content_opened",
    "benchmark_executed",
    "local_model_called",
    "embeddings_created",
    "fine_tune_started",
    "dpo_or_rlhf_started",
    "external_upload_performed",
    "runtime_memory_mutated",
    "skill_pattern_promoted",
    "preference_promoted",
    "supervised_dataset_written",
    "dpo_dataset_written",
    "node_sharing_performed",
    "filesystem_write_performed",
    "network_called",
    "runtime_started",
    "federation_started",
    "receipt_minted",
    "step7_mint_attempted"
  ];

  for (const key of expectedFalseBoundaries) {
    assert.equal(preview.boundary[key], false, `${key} must remain false`);
  }
});

test("preview is deterministic, deeply frozen, and returns fresh objects", () => {
  const first = buildCorpusBenchmarkSchemaPreview();
  const second = buildCorpusBenchmarkSchemaPreview();

  assert.deepEqual(first, second);
  assert.notEqual(first, second);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.benchmark_cases), true);
  assert.equal(Object.isFrozen(first.benchmark_cases[0]), true);
  assert.equal(Object.isFrozen(first.data_tiers[0]), true);
  assert.throws(() => {
    first.benchmark_cases[0].sample_role = "run";
  }, TypeError);
  assert.throws(() => {
    first.boundary.benchmark_executed = true;
  }, TypeError);
});

test("corpus benchmark schema preview has no CLI wiring", async () => {
  const cliSource = await readFile(cliPath, "utf8");

  assert.doesNotMatch(cliSource, /corpus-benchmark-schema-preview/);
  assert.doesNotMatch(cliSource, /corpus_benchmark_schema_preview/);
  assert.doesNotMatch(cliSource, /benchmark schema/i);
});

test("corpus benchmark schema preview module has no runtime, network, filesystem, or randomness side effects", async () => {
  const source = await readFile(modulePath, "utf8");

  assert.doesNotMatch(source, /from\s+["']node:(net|dgram|http|https|tls|dns|worker_threads|vm|child_process|fs)["']/);
  assert.doesNotMatch(source, /\b(fetch|WebSocket|exec|execFile|spawn|spawnSync)\b/);
  assert.doesNotMatch(source, /\b(writeFile|appendFile|mkdir|rename|unlink|createWriteStream)\b/);
  assert.doesNotMatch(source, /\b(Date\.now|Math\.random|crypto\.random|process\.hrtime|performance\.now)\b/);
});
