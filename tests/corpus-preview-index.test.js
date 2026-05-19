import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  buildCorpusPreviewIndex,
  CORPUS_PREVIEW_INDEX_SCHEMA
} from "../packages/core/src/corpus-preview-index.js";

const modulePath = new URL("../packages/core/src/corpus-preview-index.js", import.meta.url);
const cliPath = new URL("../apps/cli/src/index.js", import.meta.url);

test("buildCorpusPreviewIndex integrates every corpus preview surface in order", () => {
  const preview = buildCorpusPreviewIndex();

  assert.equal(preview.schema, CORPUS_PREVIEW_INDEX_SCHEMA);
  assert.equal(preview.mode, "PREVIEW_ONLY");
  assert.equal(preview.verdict, "PREVIEW_INDEX_READY");
  assert.equal(preview.summary.total_surfaces, 8);
  assert.equal(preview.summary.ready_surface_count, 8);
  assert.equal(preview.summary.rejected_surface_count, 0);
  assert.deepEqual(preview.surfaces.map((surface) => surface.surface_id), [
    "model_corpus_manifest",
    "corpus_data_tier_classifier",
    "corpus_redaction_fixture",
    "corpus_benchmark_schema",
    "corpus_manual_review_queue",
    "corpus_gold_label_fixture",
    "corpus_eval_scorecard",
    "corpus_scorecard_receipt_schema"
  ]);
});

test("index verifies child schema compatibility and closed child boundaries", () => {
  const preview = buildCorpusPreviewIndex();

  for (const surface of preview.surfaces) {
    assert.equal(surface.schema, surface.expected_schema);
    assert.equal(surface.mode, "PREVIEW_ONLY");
    assert.equal(surface.preview_only, true);
    assert.equal(surface.boundary_ok, true);
    assert.equal(surface.authority_state, "no_authority_expansion");
  }
  assert.equal(preview.self_proactive_harness.gates.find((gate) => gate.gate === "all_children_preview_only").pass, true);
  assert.equal(preview.self_proactive_harness.gates.find((gate) => gate.gate === "all_child_boundaries_closed").pass, true);
});

test("index can select an allowlisted subset without changing authority", () => {
  const preview = buildCorpusPreviewIndex({
    surfaceIds: ["model_corpus_manifest", "corpus_scorecard_receipt_schema"]
  });

  assert.equal(preview.summary.total_surfaces, 2);
  assert.deepEqual(preview.surfaces.map((surface) => surface.surface_id), [
    "model_corpus_manifest",
    "corpus_scorecard_receipt_schema"
  ]);
  assert.equal(preview.boundary.receipt_minted, false);
  assert.equal(preview.micro_consent.receipt_mint_authorized, false);
});

test("malformed index inputs fail closed without echoing raw content", () => {
  const secretText = "raw-index-content-should-not-appear";
  const raw = buildCorpusPreviewIndex({ metadata: { prompt: secretText } });
  const unknown = buildCorpusPreviewIndex({ surfaceIds: ["unknown_surface"] });
  const duplicate = buildCorpusPreviewIndex({ surfaceIds: ["model_corpus_manifest", "model_corpus_manifest"] });

  assert.equal(raw.verdict, "PREVIEW_REJECT");
  assert.equal(raw.reason, "index_must_not_include_raw_content_or_scores");
  assert.doesNotMatch(JSON.stringify(raw), /raw-index-content-should-not-appear/);
  assert.equal(unknown.reason, "surface_id_not_allowlisted");
  assert.equal(duplicate.reason, "surface_id_must_be_unique");
});

test("ownership is provenance and not processing authorization", () => {
  const preview = buildCorpusPreviewIndex();

  assert.equal(preview.ownership_scope.declared_operator_owner, "mumu");
  assert.equal(preview.ownership_scope.local_product_face, "dema");
  assert.equal(preview.ownership_scope.governed_boundary, "node0");
  assert.equal(preview.micro_consent.operator_declared_space_owner, true);
  assert.equal(preview.micro_consent.ownership_is_processing_consent, false);
  assert.equal(preview.micro_consent.raw_content_processing_authorized, false);
  assert.equal(preview.micro_consent.child_preview_execution_authorized, true);
  assert.equal(preview.micro_consent.benchmark_execution_authorized, false);
  assert.equal(preview.micro_consent.receipt_mint_authorized, false);
});

test("index emits self-proactive harness, self-critique, compliance, and analogy", () => {
  const preview = buildCorpusPreviewIndex();

  assert.equal(preview.self_proactive_harness.mode, "DETERMINISTIC_CORPUS_INDEX_PREVIEW");
  assert.equal(preview.self_proactive_harness.recommended_micro_action, "hold_until_authorized_scorecard_measurement_preview");
  assert.equal(preview.self_critique.confidence, "bounded_preview");
  assert.equal(preview.micro_compliance.index_only, true);
  assert.equal(preview.micro_compliance.metadata_only, true);
  assert.equal(preview.micro_compliance.no_child_authority_expansion, true);
  assert.equal(preview.micro_compliance.no_runtime, true);
  assert.equal(preview.analogical_model.model, "library_index_not_library_checkout");
});

test("index keeps every authority and data movement boundary false", () => {
  const preview = buildCorpusPreviewIndex();
  const expectedFalseBoundaries = [
    "raw_content_ingested",
    "raw_content_opened",
    "manual_review_executed",
    "benchmark_executed",
    "scores_computed",
    "hashes_computed",
    "receipt_minted",
    "receipt_persisted",
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
    "step7_mint_attempted"
  ];

  for (const key of expectedFalseBoundaries) {
    assert.equal(preview.boundary[key], false, `${key} must remain false`);
  }
});

test("index is deterministic, deeply frozen, and returns fresh objects", () => {
  const first = buildCorpusPreviewIndex();
  const second = buildCorpusPreviewIndex();

  assert.deepEqual(first, second);
  assert.notEqual(first, second);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.surfaces), true);
  assert.equal(Object.isFrozen(first.surfaces[0]), true);
  assert.throws(() => {
    first.surfaces[0].verdict = "changed";
  }, TypeError);
  assert.throws(() => {
    first.boundary.receipt_minted = true;
  }, TypeError);
});

test("corpus preview index has no CLI wiring", async () => {
  const cliSource = await readFile(cliPath, "utf8");

  assert.doesNotMatch(cliSource, /corpus-preview-index/);
  assert.doesNotMatch(cliSource, /corpus_preview_index/);
  assert.doesNotMatch(cliSource, /corpus preview index/i);
});

test("corpus preview index module has no runtime, network, filesystem, or randomness side effects", async () => {
  const source = await readFile(modulePath, "utf8");

  assert.doesNotMatch(source, /from\s+["']node:(net|dgram|http|https|tls|dns|worker_threads|vm|child_process|fs)["']/);
  assert.doesNotMatch(source, /\b(fetch|WebSocket|exec|execFile|spawn|spawnSync)\b/);
  assert.doesNotMatch(source, /\b(writeFile|appendFile|mkdir|rename|unlink|createWriteStream)\b/);
  assert.doesNotMatch(source, /\b(Date\.now|Math\.random|crypto\.random|process\.hrtime|performance\.now)\b/);
});
