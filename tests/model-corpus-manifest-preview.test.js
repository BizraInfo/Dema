import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  buildModelCorpusManifestPreview,
  MODEL_CORPUS_MANIFEST_PREVIEW_SCHEMA,
} from "../packages/core/src/model-corpus-manifest-preview.js";

const modulePath = new URL(
  "../packages/core/src/model-corpus-manifest-preview.js",
  import.meta.url,
);
const cliPath = new URL("../apps/cli/src/index.js", import.meta.url);

test("buildModelCorpusManifestPreview emits a schema-tagged multi-model source inventory", () => {
  const preview = buildModelCorpusManifestPreview();
  const counts = Object.fromEntries(
    preview.sources.map((source) => [
      source.source_id,
      source.estimated_conversations,
    ]),
  );

  assert.equal(preview.schema, MODEL_CORPUS_MANIFEST_PREVIEW_SCHEMA);
  assert.equal(preview.mode, "PREVIEW_ONLY");
  assert.equal(preview.verdict, "PARTIAL_PLACEHOLDER");
  assert.equal(preview.total_estimated_conversations, 5000);
  assert.equal(preview.known_source_count_total, 2300);
  assert.equal(counts.claude_desktop, 900);
  assert.equal(counts.chatgpt_team, 1400);
  assert.ok(Object.hasOwn(counts, "google_gemini"));
  assert.ok(Object.hasOwn(counts, "deepseek"));
  assert.ok(Object.hasOwn(counts, "kimi"));
  assert.ok(Object.hasOwn(counts, "z_ai"));
});

test("preview allows source inventory design and blocks ingestion, upload, tuning, memory mutation, and node sharing", () => {
  const preview = buildModelCorpusManifestPreview();

  assert.ok(preview.allowed_uses.includes("source_inventory"));
  assert.ok(preview.allowed_uses.includes("snr_pattern_design"));
  assert.ok(preview.allowed_uses.includes("micro_consent_classifier_design"));
  assert.ok(preview.blocked_uses.includes("raw_ingestion"));
  assert.ok(preview.blocked_uses.includes("external_upload"));
  assert.ok(preview.blocked_uses.includes("fine_tuning"));
  assert.ok(preview.blocked_uses.includes("runtime_memory_mutation"));
  assert.ok(preview.blocked_uses.includes("sharing_with_node1_node4"));
  assert.equal(preview.micro_consent.raw_content_processing_authorized, false);
  assert.equal(preview.micro_consent.node_sharing_authorized, false);
  assert.equal(preview.micro_consent.fine_tune_authorized, false);
  assert.equal(preview.micro_consent.external_upload_authorized, false);
});

test("preview emits data tiers and marks D3/D4 unavailable for preview use", () => {
  const preview = buildModelCorpusManifestPreview();
  const tiers = new Map(preview.data_tiers.map((tier) => [tier.tier, tier]));

  assert.equal(tiers.get("D0").allowed_in_preview, true);
  assert.equal(tiers.get("D1").allowed_in_preview, true);
  assert.equal(tiers.get("D2").allowed_in_preview, true);
  assert.equal(tiers.get("D3").allowed_in_preview, false);
  assert.equal(tiers.get("D4").allowed_in_preview, false);
});

test("preview emits self-proactive harness, self-critique, micro-compliance, and analogy", () => {
  const preview = buildModelCorpusManifestPreview();

  assert.equal(
    preview.self_proactive_harness.mode,
    "DETERMINISTIC_MANIFEST_PREVIEW",
  );
  assert.equal(
    preview.self_proactive_harness.recommended_micro_action,
    "build_corpus_data_tier_classifier_preview",
  );
  assert.equal(
    preview.self_proactive_harness.gates.find(
      (gate) => gate.gate === "raw_content_absent",
    ).pass,
    true,
  );
  assert.equal(preview.self_critique.confidence, "bounded_preview");
  assert.equal(preview.micro_compliance.no_ingestion, true);
  assert.equal(preview.micro_compliance.no_embeddings, true);
  assert.equal(preview.micro_compliance.no_fine_tune, true);
  assert.equal(preview.micro_compliance.no_external_upload, true);
  assert.equal(preview.micro_compliance.no_runtime_memory_mutation, true);
  assert.equal(preview.analogical_model.model, "ore_manifest_not_refinery");
});

test("preview keeps every authority and data movement boundary false", () => {
  const preview = buildModelCorpusManifestPreview();
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
    "step7_mint_attempted",
  ];

  for (const key of expectedFalseBoundaries) {
    assert.equal(preview.boundary[key], false, `${key} must remain false`);
  }
});

test("malformed manifests fail closed without echoing raw content", () => {
  const secretText = "raw-sensitive-chat-transcript-should-not-appear";
  const raw = buildModelCorpusManifestPreview({
    sources: [
      {
        source_id: "claude_desktop",
        estimated_conversations: 1,
        source_type: "frontier_llm_chat",
        expected_strengths: [],
        risk_notes: [],
        content: secretText,
      },
    ],
  });
  const unknown = buildModelCorpusManifestPreview({
    sources: [
      {
        source_id: "unknown_model",
        estimated_conversations: 1,
        source_type: "frontier_llm_chat",
        expected_strengths: [],
        risk_notes: [],
      },
    ],
  });
  const invalidCount = buildModelCorpusManifestPreview({
    sources: [
      {
        source_id: "claude_desktop",
        estimated_conversations: -1,
        source_type: "frontier_llm_chat",
        expected_strengths: [],
        risk_notes: [],
      },
    ],
  });
  const invalidTotal = buildModelCorpusManifestPreview({
    totalEstimatedConversations: 1,
  });

  assert.equal(raw.verdict, "PREVIEW_REJECT");
  assert.equal(raw.reason, "source_must_not_include_raw_content");
  assert.doesNotMatch(
    JSON.stringify(raw),
    /raw-sensitive-chat-transcript-should-not-appear/,
  );
  assert.equal(unknown.verdict, "PREVIEW_REJECT");
  assert.equal(unknown.reason, "source_id_not_allowlisted");
  assert.equal(
    invalidCount.reason,
    "estimated_conversations_must_be_non_negative_integer_or_null",
  );
  assert.equal(
    invalidTotal.reason,
    "total_estimated_conversations_must_cover_known_source_counts",
  );
});

test("preview is deterministic, deeply frozen, and returns fresh objects", () => {
  const first = buildModelCorpusManifestPreview();
  const second = buildModelCorpusManifestPreview();

  assert.deepEqual(first, second);
  assert.notEqual(first, second);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.sources), true);
  assert.equal(Object.isFrozen(first.sources[0]), true);
  assert.equal(Object.isFrozen(first.allowed_uses), true);
  assert.equal(Object.isFrozen(first.data_tiers[0]), true);
  assert.throws(() => {
    first.sources[0].estimated_conversations = 0;
  }, TypeError);
  assert.throws(() => {
    first.boundary.external_upload_performed = true;
  }, TypeError);
});

test("model corpus manifest preview has no CLI wiring", async () => {
  const cliSource = await readFile(cliPath, "utf8");

  assert.doesNotMatch(cliSource, /model-corpus-manifest-preview/);
  assert.doesNotMatch(cliSource, /model_corpus_manifest_preview/);
  assert.doesNotMatch(cliSource, /corpus manifest/i);
});

test("model corpus manifest preview module has no runtime, network, filesystem, or randomness side effects", async () => {
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
