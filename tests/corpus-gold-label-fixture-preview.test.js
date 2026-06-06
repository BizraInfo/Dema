import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  buildCorpusGoldLabelFixturePreview,
  CORPUS_GOLD_LABEL_FIXTURE_PREVIEW_SCHEMA,
} from "../packages/core/src/corpus-gold-label-fixture-preview.js";

const modulePath = new URL(
  "../packages/core/src/corpus-gold-label-fixture-preview.js",
  import.meta.url,
);
const cliPath = new URL("../apps/cli/src/index.js", import.meta.url);

test("buildCorpusGoldLabelFixturePreview emits metadata-only label slots", () => {
  const preview = buildCorpusGoldLabelFixturePreview();
  const byId = new Map(
    preview.label_slots.map((slot) => [slot.label_id, slot]),
  );

  assert.equal(preview.schema, CORPUS_GOLD_LABEL_FIXTURE_PREVIEW_SCHEMA);
  assert.equal(preview.mode, "PREVIEW_ONLY");
  assert.equal(preview.verdict, "PREVIEW_LABEL_SLOTS_READY");
  assert.equal(preview.summary.total_fixtures, 6);
  assert.equal(preview.summary.scoreable_fixture_count, 4);
  assert.equal(preview.summary.no_label_fixture_count, 2);
  assert.equal(preview.summary.ready_for_human_scoring_count, 3);
  assert.equal(preview.summary.adjudication_required_count, 1);
  assert.equal(
    byId.get("label_gold_architecture_eval").label_kind,
    "eval_reference_fixture",
  );
  assert.equal(
    byId.get("label_debug_skill_pattern").label_kind,
    "skill_pattern_fixture",
  );
  assert.equal(
    byId.get("label_preference_uncertainty_pair").label_kind,
    "preference_pair_fixture",
  );
  assert.equal(
    byId.get("label_overclaim_negative_eval").case_truth_label,
    "negative_overclaim",
  );
});

test("D3 and D4 fixtures are no-label quarantine or reject slots", () => {
  const preview = buildCorpusGoldLabelFixturePreview();
  const d3 = preview.label_slots.find((slot) => slot.tier === "D3");
  const d4 = preview.label_slots.find((slot) => slot.tier === "D4");

  assert.equal(d3.queue_lane, "quarantine_review");
  assert.equal(d3.label_kind, "quarantine_no_label");
  assert.equal(d3.expected_min_score, null);
  assert.equal(d4.queue_lane, "reject_log");
  assert.equal(d4.label_kind, "reject_no_label");
  assert.equal(d4.expected_min_score, null);
  assert.equal(
    preview.self_proactive_harness.gates.find(
      (gate) => gate.gate === "d3_d4_no_label_guard",
    ).pass,
    true,
  );

  const invalid = buildCorpusGoldLabelFixturePreview({
    fixtures: [
      {
        label_id: "bad_private_label",
        candidate_id: "private_strategy_quarantine",
        source_id: "other",
        domain: "benchmarking",
        tier: "D3",
        queue_lane: "skill_pattern_review",
        case_truth_label: "needs_redaction",
        label_kind: "skill_pattern_fixture",
        review_outcome: "candidate_ready_for_human_scoring",
        rubric_axes: ["safety"],
        proof_of_truth_axes: ["formal"],
        expected_min_score: 4,
      },
    ],
  });

  assert.equal(invalid.verdict, "PREVIEW_REJECT");
  assert.equal(invalid.reason, "tier_label_policy_mismatch");
});

test("label slots contain no content or written answer key material", () => {
  const preview = buildCorpusGoldLabelFixturePreview();

  for (const slot of preview.label_slots) {
    assert.equal(slot.content_state, "not_present_not_opened");
    assert.equal(slot.label_material_state, "not_written_fixture_slot_only");
    assert.equal(
      slot.promotion_state,
      "not_promoted_requires_future_exact_consent",
    );
    assert.doesNotMatch(
      JSON.stringify(slot),
      /prompt|response|transcript|target_good|target_bad|best_answer/,
    );
  }
});

test("ownership is provenance and not label-writing consent", () => {
  const preview = buildCorpusGoldLabelFixturePreview();

  assert.equal(preview.ownership_scope.declared_operator_owner, "mumu");
  assert.equal(preview.ownership_scope.local_product_face, "dema");
  assert.equal(preview.ownership_scope.governed_boundary, "node0");
  assert.equal(preview.micro_consent.operator_declared_space_owner, true);
  assert.equal(preview.micro_consent.ownership_is_processing_consent, false);
  assert.equal(preview.micro_consent.raw_content_processing_authorized, false);
  assert.equal(preview.micro_consent.manual_review_execution_authorized, false);
  assert.equal(preview.micro_consent.gold_label_writing_authorized, false);
});

test("malformed or raw-content fixtures fail closed without echoing observed text", () => {
  const secretText = "raw-gold-answer-should-not-appear";
  const raw = buildCorpusGoldLabelFixturePreview({
    fixtures: [
      {
        label_id: "raw_label",
        candidate_id: "gold_architecture_eval",
        source_id: "chatgpt_team",
        domain: "architecture",
        tier: "D0",
        queue_lane: "benchmark_eval_review",
        case_truth_label: "verified_good",
        label_kind: "eval_reference_fixture",
        review_outcome: "candidate_ready_for_human_scoring",
        rubric_axes: ["correctness"],
        proof_of_truth_axes: ["formal"],
        expected_min_score: 4,
        target_good: secretText,
      },
    ],
  });
  const badRubric = buildCorpusGoldLabelFixturePreview({
    fixtures: [
      {
        label_id: "bad_rubric",
        candidate_id: "gold_architecture_eval",
        source_id: "chatgpt_team",
        domain: "architecture",
        tier: "D0",
        queue_lane: "benchmark_eval_review",
        case_truth_label: "verified_good",
        label_kind: "eval_reference_fixture",
        review_outcome: "candidate_ready_for_human_scoring",
        rubric_axes: ["vibes"],
        proof_of_truth_axes: ["formal"],
        expected_min_score: 4,
      },
    ],
  });

  assert.equal(raw.verdict, "PREVIEW_REJECT");
  assert.equal(raw.reason, "fixture_must_not_include_raw_content");
  assert.doesNotMatch(JSON.stringify(raw), /raw-gold-answer-should-not-appear/);
  assert.equal(badRubric.reason, "rubric_axis_not_allowlisted");
  assert.doesNotMatch(JSON.stringify(badRubric), /vibes/);
});

test("preview emits self-proactive harness, self-critique, micro-compliance, and analogical model", () => {
  const preview = buildCorpusGoldLabelFixturePreview();

  assert.equal(
    preview.self_proactive_harness.mode,
    "DETERMINISTIC_GOLD_LABEL_FIXTURE_PREVIEW",
  );
  assert.equal(
    preview.self_proactive_harness.recommended_micro_action,
    "build_corpus_eval_scorecard_preview",
  );
  assert.equal(preview.self_critique.confidence, "bounded_preview");
  assert.equal(preview.micro_compliance.fixture_only, true);
  assert.equal(preview.micro_compliance.metadata_only, true);
  assert.equal(preview.micro_compliance.no_chat_content_present, true);
  assert.equal(preview.micro_compliance.no_gold_labels_written, true);
  assert.equal(preview.micro_compliance.no_manual_review_executed, true);
  assert.equal(preview.micro_compliance.no_model_invocation, true);
  assert.equal(preview.micro_compliance.no_training, true);
  assert.equal(
    preview.analogical_model.model,
    "blank_answer_key_slots_not_answers",
  );
});

test("preview keeps every authority and data movement boundary false", () => {
  const preview = buildCorpusGoldLabelFixturePreview();
  const expectedFalseBoundaries = [
    "raw_content_ingested",
    "raw_content_opened",
    "manual_review_executed",
    "gold_labels_written",
    "label_fixture_persisted",
    "benchmark_executed",
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
  const first = buildCorpusGoldLabelFixturePreview();
  const second = buildCorpusGoldLabelFixturePreview();

  assert.deepEqual(first, second);
  assert.notEqual(first, second);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.label_slots), true);
  assert.equal(Object.isFrozen(first.label_slots[0]), true);
  assert.throws(() => {
    first.label_slots[0].expected_min_score = 1;
  }, TypeError);
  assert.throws(() => {
    first.boundary.gold_labels_written = true;
  }, TypeError);
});

test("corpus gold label fixture preview has no CLI wiring", async () => {
  const cliSource = await readFile(cliPath, "utf8");

  assert.doesNotMatch(cliSource, /corpus-gold-label-fixture-preview/);
  assert.doesNotMatch(cliSource, /corpus_gold_label_fixture_preview/);
  assert.doesNotMatch(cliSource, /gold label fixture/i);
});

test("corpus gold label fixture preview module has no runtime, network, filesystem, or randomness side effects", async () => {
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
