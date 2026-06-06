import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  buildCorpusEvalScorecardPreview,
  CORPUS_EVAL_SCORECARD_PREVIEW_SCHEMA,
} from "../packages/core/src/corpus-eval-scorecard-preview.js";

const modulePath = new URL(
  "../packages/core/src/corpus-eval-scorecard-preview.js",
  import.meta.url,
);
const cliPath = new URL("../apps/cli/src/index.js", import.meta.url);

test("buildCorpusEvalScorecardPreview emits aggregate metric slots without scores", () => {
  const preview = buildCorpusEvalScorecardPreview();
  const ids = preview.metric_slots.map((slot) => slot.metric_id);

  assert.equal(preview.schema, CORPUS_EVAL_SCORECARD_PREVIEW_SCHEMA);
  assert.equal(preview.mode, "PREVIEW_ONLY");
  assert.equal(preview.verdict, "PREVIEW_SCORECARD_READY");
  assert.equal(preview.summary.total_metrics, 7);
  assert.equal(preview.summary.computed_metric_count, 0);
  assert.equal(preview.summary.awaiting_gold_label_count, 5);
  assert.equal(preview.summary.blocked_until_eval_count, 1);
  assert.equal(preview.summary.d3_d4_metric_count, 1);
  assert.deepEqual(ids, [
    "correctness_floor",
    "truth_discipline_floor",
    "safety_floor",
    "evidence_alignment_floor",
    "operator_utility_floor",
    "overclaim_regression_rate",
    "quarantine_integrity_rate",
  ]);
});

test("scorecard declares proof axes and threshold directions without execution", () => {
  const preview = buildCorpusEvalScorecardPreview();
  const byId = new Map(
    preview.metric_slots.map((slot) => [slot.metric_id, slot]),
  );

  assert.deepEqual(byId.get("correctness_floor").proof_of_truth_axes, [
    "empirical",
    "formal",
  ]);
  assert.equal(byId.get("safety_floor").target, 5);
  assert.equal(byId.get("overclaim_regression_rate").direction, "lte");
  assert.equal(byId.get("quarantine_integrity_rate").direction, "eq");
  for (const slot of preview.metric_slots) {
    assert.equal(slot.metric_state, "not_computed_schema_only");
    assert.equal(slot.evidence_state, "not_measured_no_receipt_minted");
  }
});

test("D3/D4 participation is limited to quarantine integrity", () => {
  const preview = buildCorpusEvalScorecardPreview();
  const d3d4 = preview.metric_slots.filter((slot) => slot.d3_d4_included);

  assert.equal(d3d4.length, 1);
  assert.equal(d3d4[0].metric_id, "quarantine_integrity_rate");
  assert.equal(
    preview.self_proactive_harness.gates.find(
      (gate) => gate.gate === "quarantine_integrity_is_only_d3_d4_metric",
    ).pass,
    true,
  );

  const invalid = buildCorpusEvalScorecardPreview({
    metrics: [
      {
        metric_id: "safety_floor",
        domain: "security",
        input_state: "sanitized_label_slots",
        readiness_state: "awaiting_human_gold_labels",
        proof_of_truth_axes: ["formal"],
        target: 5,
        direction: "gte",
        d3_d4_included: true,
      },
    ],
  });

  assert.equal(invalid.verdict, "PREVIEW_REJECT");
  assert.equal(invalid.reason, "d3_d4_only_allowed_for_quarantine_integrity");
});

test("ownership is provenance and not score computation consent", () => {
  const preview = buildCorpusEvalScorecardPreview();

  assert.equal(preview.ownership_scope.declared_operator_owner, "mumu");
  assert.equal(preview.ownership_scope.local_product_face, "dema");
  assert.equal(preview.ownership_scope.governed_boundary, "node0");
  assert.equal(preview.micro_consent.operator_declared_space_owner, true);
  assert.equal(preview.micro_consent.ownership_is_processing_consent, false);
  assert.equal(preview.micro_consent.benchmark_execution_authorized, false);
  assert.equal(preview.micro_consent.score_computation_authorized, false);
  assert.equal(preview.micro_consent.scorecard_persistence_authorized, false);
});

test("malformed scorecards fail closed without echoing raw content or scores", () => {
  const secretText = "raw-score-answer-should-not-appear";
  const raw = buildCorpusEvalScorecardPreview({
    metrics: [
      {
        metric_id: "correctness_floor",
        domain: "architecture",
        input_state: "sanitized_label_slots",
        readiness_state: "awaiting_human_gold_labels",
        proof_of_truth_axes: ["formal"],
        target: 4,
        direction: "gte",
        d3_d4_included: false,
        metadata: { target_good: secretText },
      },
    ],
  });
  const badMetric = buildCorpusEvalScorecardPreview({
    metrics: [
      {
        metric_id: "made_up_metric",
        domain: "architecture",
        input_state: "sanitized_label_slots",
        readiness_state: "awaiting_human_gold_labels",
        proof_of_truth_axes: ["formal"],
        target: 4,
        direction: "gte",
        d3_d4_included: false,
      },
    ],
  });
  const badScore = buildCorpusEvalScorecardPreview({
    metrics: [
      {
        metric_id: "correctness_floor",
        domain: "architecture",
        input_state: "sanitized_label_slots",
        readiness_state: "awaiting_human_gold_labels",
        proof_of_truth_axes: ["formal"],
        target: 4,
        direction: "gte",
        d3_d4_included: false,
        score: 5,
      },
    ],
  });

  assert.equal(raw.verdict, "PREVIEW_REJECT");
  assert.equal(raw.reason, "metric_must_not_include_raw_content_or_scores");
  assert.doesNotMatch(
    JSON.stringify(raw),
    /raw-score-answer-should-not-appear/,
  );
  assert.equal(badMetric.reason, "metric_id_not_allowlisted");
  assert.equal(
    badScore.reason,
    "metric_must_not_include_raw_content_or_scores",
  );
});

test("preview emits self-proactive harness, self-critique, micro-compliance, and analogical model", () => {
  const preview = buildCorpusEvalScorecardPreview();

  assert.equal(
    preview.self_proactive_harness.mode,
    "DETERMINISTIC_EVAL_SCORECARD_PREVIEW",
  );
  assert.equal(
    preview.self_proactive_harness.recommended_micro_action,
    "build_corpus_scorecard_receipt_schema_preview",
  );
  assert.equal(
    preview.self_proactive_harness.gates.find(
      (gate) => gate.gate === "no_score_computation",
    ).pass,
    true,
  );
  assert.equal(preview.self_critique.confidence, "bounded_preview");
  assert.equal(preview.micro_compliance.schema_only, true);
  assert.equal(preview.micro_compliance.no_scores_computed, true);
  assert.equal(preview.micro_compliance.no_benchmark_execution, true);
  assert.equal(preview.micro_compliance.no_model_invocation, true);
  assert.equal(preview.micro_compliance.no_training, true);
  assert.equal(
    preview.analogical_model.model,
    "scoreboard_layout_not_game_played",
  );
});

test("preview keeps every authority and data movement boundary false", () => {
  const preview = buildCorpusEvalScorecardPreview();
  const expectedFalseBoundaries = [
    "raw_content_ingested",
    "raw_content_opened",
    "manual_review_executed",
    "benchmark_executed",
    "scores_computed",
    "scorecard_persisted",
    "local_model_called",
    "embeddings_created",
    "fine_tune_started",
    "dpo_or_rlhf_started",
    "external_upload_performed",
    "runtime_memory_mutated",
    "skill_pattern_promoted",
    "preference_promoted",
    "dataset_written",
    "node_sharing_performed",
    "filesystem_write_performed",
    "network_called",
    "runtime_started",
    "federation_started",
    "receipt_minted",
    "step7_mint_attempted",
  ];

  for (const key of expectedFalseBoundaries) {
    assert.equal(preview.boundary[key], false, `${key} must remain false`);
  }
});

test("preview is deterministic, deeply frozen, and returns fresh objects", () => {
  const first = buildCorpusEvalScorecardPreview();
  const second = buildCorpusEvalScorecardPreview();

  assert.deepEqual(first, second);
  assert.notEqual(first, second);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.metric_slots), true);
  assert.equal(Object.isFrozen(first.metric_slots[0]), true);
  assert.throws(() => {
    first.metric_slots[0].target = 1;
  }, TypeError);
  assert.throws(() => {
    first.boundary.scores_computed = true;
  }, TypeError);
});

test("corpus eval scorecard preview has no CLI wiring", async () => {
  const cliSource = await readFile(cliPath, "utf8");

  assert.doesNotMatch(cliSource, /corpus-eval-scorecard-preview/);
  assert.doesNotMatch(cliSource, /corpus_eval_scorecard_preview/);
  assert.doesNotMatch(cliSource, /eval scorecard/i);
});

test("corpus eval scorecard preview module has no runtime, network, filesystem, or randomness side effects", async () => {
  const source = await readFile(modulePath, "utf8");

  assert.doesNotMatch(
    source,
    /from\s+["']node:(net|dgram|http|https|tls|dns|worker_threads|vm|child_process|fs)["']/,
  );
  assert.doesNotMatch(
    source,
    /\b(fetch|WebSocket|exec|execFile|spawn|spawnSync)\b/,
  );
  assert.doesNotMatch(
    source,
    /\b(writeFile|appendFile|mkdir|rename|unlink|createWriteStream)\b/,
  );
  assert.doesNotMatch(
    source,
    /\b(Date\.now|Math\.random|crypto\.random|process\.hrtime|performance\.now)\b/,
  );
});
