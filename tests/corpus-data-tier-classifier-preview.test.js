import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  buildCorpusDataTierClassifierPreview,
  CORPUS_DATA_TIER_CLASSIFIER_PREVIEW_SCHEMA
} from "../packages/core/src/corpus-data-tier-classifier-preview.js";

const modulePath = new URL("../packages/core/src/corpus-data-tier-classifier-preview.js", import.meta.url);
const cliPath = new URL("../apps/cli/src/index.js", import.meta.url);

test("buildCorpusDataTierClassifierPreview emits schema-tagged D0-D4 metadata classifications", () => {
  const preview = buildCorpusDataTierClassifierPreview();
  const byId = new Map(preview.classifications.map((classification) => [
    classification.item_id,
    classification
  ]));

  assert.equal(preview.schema, CORPUS_DATA_TIER_CLASSIFIER_PREVIEW_SCHEMA);
  assert.equal(preview.mode, "PREVIEW_ONLY");
  assert.equal(preview.verdict, "PREVIEW_CLASSIFIED");
  assert.equal(preview.summary.total_items, 5);
  assert.equal(preview.summary.preview_allowed_count, 3);
  assert.equal(preview.summary.quarantine_count, 2);
  assert.equal(preview.summary.counts_by_tier.D0, 1);
  assert.equal(preview.summary.counts_by_tier.D1, 1);
  assert.equal(preview.summary.counts_by_tier.D2, 1);
  assert.equal(preview.summary.counts_by_tier.D3, 1);
  assert.equal(preview.summary.counts_by_tier.D4, 1);
  assert.equal(byId.get("public_launch_note").tier, "D0");
  assert.equal(byId.get("operator_workflow_preference").tier, "D1");
  assert.equal(byId.get("node0_architecture_reasoning").tier, "D2");
  assert.equal(byId.get("investor_positioning_note").tier, "D3");
  assert.equal(byId.get("credential_or_identity_marker").tier, "D4");
});

test("classifier allows D0-D2 metadata design and quarantines D3-D4 metadata", () => {
  const preview = buildCorpusDataTierClassifierPreview();
  const allowed = preview.classifications.filter((classification) => classification.allowed_in_preview);
  const quarantined = preview.classifications.filter((classification) => !classification.allowed_in_preview);

  assert.deepEqual(allowed.map((classification) => classification.tier), ["D0", "D1", "D2"]);
  assert.deepEqual(quarantined.map((classification) => classification.tier), ["D3", "D4"]);
  assert.equal(quarantined[0].disposition, "quarantine_private_strategy_metadata");
  assert.equal(quarantined[1].disposition, "quarantine_secret_identity_or_high_sensitivity_metadata");
  assert.ok(preview.allowed_uses.includes("data_tier_classification_design"));
  assert.ok(preview.blocked_uses.includes("raw_ingestion"));
  assert.ok(preview.blocked_uses.includes("content_extraction"));
  assert.ok(preview.blocked_uses.includes("embedding_creation"));
  assert.ok(preview.blocked_uses.includes("runtime_memory_mutation"));
  assert.ok(preview.blocked_uses.includes("sharing_with_node1_node4"));
});

test("mixed metadata signals classify by highest-risk declared tier", () => {
  const preview = buildCorpusDataTierClassifierPreview({
    items: [{
      item_id: "mixed_design_and_secret_marker",
      source_id: "chatgpt_team",
      declared_signals: ["documentation", "architecture", "credential"],
      expected_use: "data_tier_classification_design"
    }]
  });

  assert.equal(preview.verdict, "PREVIEW_CLASSIFIED");
  assert.equal(preview.classifications[0].tier, "D4");
  assert.equal(preview.classifications[0].allowed_in_preview, false);
  assert.deepEqual(preview.classifications[0].matched_signals, ["architecture", "credential", "documentation"]);
});

test("malformed or raw-content inputs fail closed without echoing observed text", () => {
  const secretText = "raw-secret-transcript-should-not-appear";
  const raw = buildCorpusDataTierClassifierPreview({
    items: [{
      item_id: "raw_item",
      source_id: "chatgpt_team",
      declared_signals: ["documentation"],
      expected_use: "source_inventory",
      transcript: secretText
    }]
  });
  const unknownSignal = buildCorpusDataTierClassifierPreview({
    items: [{
      item_id: "unknown_signal_item",
      source_id: "chatgpt_team",
      declared_signals: ["custom_sensitive_signal"],
      expected_use: "source_inventory"
    }]
  });
  const unsafeId = buildCorpusDataTierClassifierPreview({
    items: [{
      item_id: "unsafe id with spaces",
      source_id: "chatgpt_team",
      declared_signals: ["documentation"],
      expected_use: "source_inventory"
    }]
  });
  const badUse = buildCorpusDataTierClassifierPreview({
    items: [{
      item_id: "bad_use_item",
      source_id: "chatgpt_team",
      declared_signals: ["documentation"],
      expected_use: "fine_tuning"
    }]
  });

  assert.equal(raw.verdict, "PREVIEW_REJECT");
  assert.equal(raw.reason, "item_must_not_include_raw_content");
  assert.doesNotMatch(JSON.stringify(raw), /raw-secret-transcript-should-not-appear/);
  assert.equal(unknownSignal.reason, "declared_signal_not_allowlisted");
  assert.equal(unsafeId.reason, "item_id_must_be_unique_safe_identifier");
  assert.equal(badUse.reason, "expected_use_not_allowlisted");
});

test("preview emits self-proactive harness, self-critique, micro-compliance, and micro-consent", () => {
  const preview = buildCorpusDataTierClassifierPreview();

  assert.equal(preview.self_proactive_harness.mode, "DETERMINISTIC_DATA_TIER_CLASSIFIER_PREVIEW");
  assert.equal(preview.self_proactive_harness.recommended_micro_action, "build_corpus_redaction_fixture_preview");
  assert.equal(preview.self_proactive_harness.gates.find((gate) => gate.gate === "metadata_only_inputs").pass, true);
  assert.equal(preview.self_critique.confidence, "bounded_preview");
  assert.equal(preview.micro_compliance.metadata_only, true);
  assert.equal(preview.micro_compliance.no_ingestion, true);
  assert.equal(preview.micro_compliance.no_embeddings, true);
  assert.equal(preview.micro_compliance.no_fine_tune, true);
  assert.equal(preview.micro_compliance.no_external_upload, true);
  assert.equal(preview.micro_compliance.no_runtime_memory_mutation, true);
  assert.equal(preview.micro_consent.raw_content_processing_authorized, false);
  assert.equal(preview.micro_consent.d3_d4_processing_authorized, false);
  assert.equal(preview.analogical_model.model, "color_label_not_container_opening");
});

test("preview keeps every authority and data movement boundary false", () => {
  const preview = buildCorpusDataTierClassifierPreview();
  const expectedFalseBoundaries = [
    "raw_content_ingested",
    "embeddings_created",
    "fine_tune_started",
    "external_upload_performed",
    "runtime_memory_mutated",
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
  const first = buildCorpusDataTierClassifierPreview();
  const second = buildCorpusDataTierClassifierPreview();

  assert.deepEqual(first, second);
  assert.notEqual(first, second);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.classifications), true);
  assert.equal(Object.isFrozen(first.classifications[0]), true);
  assert.equal(Object.isFrozen(first.data_tiers[0]), true);
  assert.throws(() => {
    first.classifications[0].tier = "D4";
  }, TypeError);
  assert.throws(() => {
    first.boundary.external_upload_performed = true;
  }, TypeError);
});

test("corpus data-tier classifier preview has no CLI wiring", async () => {
  const cliSource = await readFile(cliPath, "utf8");

  assert.doesNotMatch(cliSource, /corpus-data-tier-classifier-preview/);
  assert.doesNotMatch(cliSource, /corpus_data_tier_classifier_preview/);
  assert.doesNotMatch(cliSource, /data-tier classifier/i);
});

test("corpus data-tier classifier preview module has no runtime, network, filesystem, or randomness side effects", async () => {
  const source = await readFile(modulePath, "utf8");

  assert.doesNotMatch(source, /from\s+["']node:(net|dgram|http|https|tls|dns|worker_threads|vm|child_process|fs)["']/);
  assert.doesNotMatch(source, /\b(fetch|WebSocket|exec|execFile|spawn|spawnSync)\b/);
  assert.doesNotMatch(source, /\b(writeFile|appendFile|mkdir|rename|unlink|createWriteStream)\b/);
  assert.doesNotMatch(source, /\b(Date\.now|Math\.random|crypto\.random|process\.hrtime|performance\.now)\b/);
});
