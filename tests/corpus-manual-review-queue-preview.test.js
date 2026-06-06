import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  buildCorpusManualReviewQueuePreview,
  CORPUS_MANUAL_REVIEW_QUEUE_PREVIEW_SCHEMA,
} from "../packages/core/src/corpus-manual-review-queue-preview.js";

const modulePath = new URL(
  "../packages/core/src/corpus-manual-review-queue-preview.js",
  import.meta.url,
);
const cliPath = new URL("../apps/cli/src/index.js", import.meta.url);

test("buildCorpusManualReviewQueuePreview emits a prioritized metadata-only queue", () => {
  const preview = buildCorpusManualReviewQueuePreview();

  assert.equal(preview.schema, CORPUS_MANUAL_REVIEW_QUEUE_PREVIEW_SCHEMA);
  assert.equal(preview.mode, "PREVIEW_ONLY");
  assert.equal(preview.verdict, "PREVIEW_QUEUE_READY");
  assert.equal(preview.summary.total_candidates, 6);
  assert.equal(preview.summary.actionable_review_count, 4);
  assert.equal(preview.summary.quarantine_count, 1);
  assert.equal(preview.summary.reject_count, 1);
  assert.equal(
    preview.summary.highest_priority_candidate,
    "gold_architecture_eval",
  );
  assert.deepEqual(
    preview.queue_items.map((item) => item.candidate_id).slice(0, 4),
    [
      "gold_architecture_eval",
      "debug_skill_pattern_review",
      "overclaim_negative_eval",
      "preference_pair_uncertainty_review",
    ],
  );
});

test("queue lanes keep D3 and D4 non-actionable", () => {
  const preview = buildCorpusManualReviewQueuePreview();
  const byId = new Map(
    preview.queue_items.map((item) => [item.candidate_id, item]),
  );

  assert.equal(
    byId.get("private_strategy_quarantine").queue_lane,
    "quarantine_review",
  );
  assert.equal(byId.get("private_strategy_quarantine").priority_score, 0);
  assert.equal(byId.get("credential_marker_reject").queue_lane, "reject_log");
  assert.equal(
    byId.get("credential_marker_reject").review_state,
    "log_rejection_without_opening_content",
  );
  assert.equal(
    preview.self_proactive_harness.gates.find(
      (gate) => gate.gate === "d3_d4_non_actionable_lanes",
    ).pass,
    true,
  );

  const invalid = buildCorpusManualReviewQueuePreview({
    candidates: [
      {
        candidate_id: "bad_private_candidate",
        source_id: "other",
        domain: "benchmarking",
        difficulty: "rare_path",
        tier: "D3",
        case_truth_label: "needs_redaction",
        sample_role: "skill_pattern_candidate",
        redaction_state: "sanitized_metadata_only",
        proof_of_truth_axes: ["formal"],
        snr_profile: "hidden_pattern_probe",
      },
    ],
  });

  assert.equal(invalid.verdict, "PREVIEW_REJECT");
  assert.equal(invalid.reason, "tier_lane_policy_mismatch");
});

test("ownership is provenance and never processing authorization", () => {
  const preview = buildCorpusManualReviewQueuePreview();

  assert.equal(preview.ownership_scope.declared_operator_owner, "mumu");
  assert.equal(preview.ownership_scope.local_product_face, "dema");
  assert.equal(preview.ownership_scope.governed_boundary, "node0");
  assert.equal(
    preview.ownership_scope.interpretation,
    "local_ownership_and_provenance_not_processing_authorization",
  );
  assert.equal(preview.micro_consent.operator_declared_space_owner, true);
  assert.equal(preview.micro_consent.ownership_is_processing_consent, false);
  assert.equal(preview.micro_consent.raw_content_processing_authorized, false);
  assert.equal(preview.micro_consent.manual_review_execution_authorized, false);
  assert.equal(preview.micro_consent.benchmark_execution_authorized, false);
});

test("malformed and raw-content candidates fail closed without echoing observed text", () => {
  const secretText = "raw-local-chat-should-not-appear";
  const raw = buildCorpusManualReviewQueuePreview({
    candidates: [
      {
        candidate_id: "raw_candidate",
        source_id: "chatgpt_team",
        domain: "architecture",
        difficulty: "medium",
        tier: "D0",
        case_truth_label: "verified_good",
        sample_role: "evaluation_only",
        redaction_state: "sanitized_metadata_only",
        proof_of_truth_axes: ["formal"],
        snr_profile: "high_signal_low_noise",
        metadata: { prompt: secretText },
      },
    ],
  });
  const badAxis = buildCorpusManualReviewQueuePreview({
    candidates: [
      {
        candidate_id: "bad_axis",
        source_id: "chatgpt_team",
        domain: "architecture",
        difficulty: "medium",
        tier: "D0",
        case_truth_label: "verified_good",
        sample_role: "evaluation_only",
        redaction_state: "sanitized_metadata_only",
        proof_of_truth_axes: ["oracle"],
        snr_profile: "high_signal_low_noise",
      },
    ],
  });
  const badId = buildCorpusManualReviewQueuePreview({
    candidates: [
      {
        candidate_id: "bad id",
        source_id: "chatgpt_team",
        domain: "architecture",
        difficulty: "medium",
        tier: "D0",
        case_truth_label: "verified_good",
        sample_role: "evaluation_only",
        redaction_state: "sanitized_metadata_only",
        proof_of_truth_axes: ["formal"],
        snr_profile: "high_signal_low_noise",
      },
    ],
  });

  assert.equal(raw.verdict, "PREVIEW_REJECT");
  assert.equal(raw.reason, "candidate_must_not_include_raw_content");
  assert.doesNotMatch(JSON.stringify(raw), /raw-local-chat-should-not-appear/);
  assert.equal(badAxis.reason, "proof_of_truth_axis_not_allowlisted");
  assert.equal(badId.reason, "candidate_id_must_be_unique_safe_identifier");
});

test("preview emits self-proactive harness, self-critique, micro-compliance, and analogical model", () => {
  const preview = buildCorpusManualReviewQueuePreview();

  assert.equal(
    preview.self_proactive_harness.mode,
    "DETERMINISTIC_MANUAL_REVIEW_QUEUE_PREVIEW",
  );
  assert.equal(
    preview.self_proactive_harness.recommended_micro_action,
    "build_corpus_gold_label_fixture_preview",
  );
  assert.equal(
    preview.self_proactive_harness.gates.find(
      (gate) => gate.gate === "local_asset_metadata_only",
    ).pass,
    true,
  );
  assert.equal(preview.self_critique.confidence, "bounded_preview");
  assert.equal(preview.micro_compliance.metadata_only, true);
  assert.equal(preview.micro_compliance.no_chat_content_present, true);
  assert.equal(preview.micro_compliance.no_manual_review_executed, true);
  assert.equal(preview.micro_compliance.no_model_invocation, true);
  assert.equal(preview.micro_compliance.no_queue_persistence, true);
  assert.equal(preview.micro_compliance.no_training, true);
  assert.equal(
    preview.analogical_model.model,
    "library_card_catalog_not_book_opening",
  );
});

test("preview keeps every authority and data movement boundary false", () => {
  const preview = buildCorpusManualReviewQueuePreview();
  const expectedFalseBoundaries = [
    "raw_content_ingested",
    "raw_content_opened",
    "manual_review_executed",
    "benchmark_executed",
    "local_model_called",
    "embeddings_created",
    "fine_tune_started",
    "dpo_or_rlhf_started",
    "external_upload_performed",
    "runtime_memory_mutated",
    "skill_pattern_promoted",
    "preference_promoted",
    "queue_persisted",
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
  const first = buildCorpusManualReviewQueuePreview();
  const second = buildCorpusManualReviewQueuePreview();

  assert.deepEqual(first, second);
  assert.notEqual(first, second);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.queue_items), true);
  assert.equal(Object.isFrozen(first.queue_items[0]), true);
  assert.throws(() => {
    first.queue_items[0].priority_score = 0;
  }, TypeError);
  assert.throws(() => {
    first.boundary.manual_review_executed = true;
  }, TypeError);
});

test("corpus manual review queue preview has no CLI wiring", async () => {
  const cliSource = await readFile(cliPath, "utf8");

  assert.doesNotMatch(cliSource, /corpus-manual-review-queue-preview/);
  assert.doesNotMatch(cliSource, /corpus_manual_review_queue_preview/);
  assert.doesNotMatch(cliSource, /manual review queue/i);
});

test("corpus manual review queue preview module has no runtime, network, filesystem, or randomness side effects", async () => {
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
