import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  buildCorpusRedactionFixturePreview,
  CORPUS_REDACTION_FIXTURE_PREVIEW_SCHEMA
} from "../packages/core/src/corpus-redaction-fixture-preview.js";

const modulePath = new URL("../packages/core/src/corpus-redaction-fixture-preview.js", import.meta.url);
const cliPath = new URL("../apps/cli/src/index.js", import.meta.url);

test("buildCorpusRedactionFixturePreview emits schema-tagged fixture redaction cases", () => {
  const preview = buildCorpusRedactionFixturePreview();
  const byId = new Map(preview.redaction_cases.map((entry) => [entry.fixture_id, entry]));

  assert.equal(preview.schema, CORPUS_REDACTION_FIXTURE_PREVIEW_SCHEMA);
  assert.equal(preview.mode, "PREVIEW_ONLY");
  assert.equal(preview.verdict, "PREVIEW_FIXTURED");
  assert.equal(preview.summary.total_fixtures, 5);
  assert.equal(preview.summary.metadata_only_allowed_count, 3);
  assert.equal(preview.summary.quarantine_count, 1);
  assert.equal(preview.summary.reject_count, 1);
  assert.equal(byId.get("public_reference_fixture").tier, "D0");
  assert.equal(byId.get("workflow_preference_fixture").tier, "D1");
  assert.equal(byId.get("architecture_reasoning_fixture").tier, "D2");
  assert.equal(byId.get("private_strategy_fixture").tier, "D3");
  assert.equal(byId.get("credential_marker_fixture").tier, "D4");
});

test("fixture preview allows D0-D2 metadata markers and blocks D3-D4 handling", () => {
  const preview = buildCorpusRedactionFixturePreview();
  const allowed = preview.redaction_cases.filter((entry) => entry.preview_allowed);
  const blocked = preview.redaction_cases.filter((entry) => !entry.preview_allowed);

  assert.deepEqual(allowed.map((entry) => entry.policy_action), [
    "allow_metadata_only_marker",
    "allow_metadata_only_marker",
    "allow_metadata_only_marker"
  ]);
  assert.deepEqual(blocked.map((entry) => entry.policy_action), [
    "quarantine_private_strategy_marker",
    "reject_secret_identity_or_credential_marker"
  ]);
  assert.equal(blocked[0].redaction_marker, "[D3_QUARANTINED_NO_CONTENT_OPENED]");
  assert.equal(blocked[1].redaction_marker, "[D4_REJECTED_NO_CONTENT_OPENED]");
  assert.ok(preview.blocked_uses.includes("redacting_real_corpus_text"));
  assert.ok(preview.blocked_uses.includes("raw_ingestion"));
  assert.ok(preview.blocked_uses.includes("embedding_creation"));
  assert.ok(preview.blocked_uses.includes("runtime_memory_mutation"));
  assert.ok(preview.blocked_uses.includes("sharing_with_node1_node4"));
});

test("redaction cases never contain opened content or computed digests", () => {
  const preview = buildCorpusRedactionFixturePreview();

  for (const entry of preview.redaction_cases) {
    assert.equal(entry.content_state, "not_present_not_opened");
    assert.equal(entry.digest_state, "not_computed_no_ingestion");
    assert.doesNotMatch(JSON.stringify(entry), /transcript|prompt|response|best_answer|target_good|target_bad/);
  }
});

test("malformed or raw-content fixtures fail closed without echoing observed text", () => {
  const secretText = "raw-private-chat-should-not-appear";
  const raw = buildCorpusRedactionFixturePreview({
    fixtures: [{
      fixture_id: "raw_fixture",
      source_id: "chatgpt_team",
      tier: "D0",
      declared_handling: "metadata_only_public_reference",
      best_answer: secretText
    }]
  });
  const badTier = buildCorpusRedactionFixturePreview({
    fixtures: [{
      fixture_id: "bad_tier_fixture",
      source_id: "chatgpt_team",
      tier: "D5",
      declared_handling: "metadata_only_public_reference"
    }]
  });
  const badSource = buildCorpusRedactionFixturePreview({
    fixtures: [{
      fixture_id: "bad_source_fixture",
      source_id: "unknown_model",
      tier: "D0",
      declared_handling: "metadata_only_public_reference"
    }]
  });
  const unsafeId = buildCorpusRedactionFixturePreview({
    fixtures: [{
      fixture_id: "unsafe id",
      source_id: "chatgpt_team",
      tier: "D0",
      declared_handling: "metadata_only_public_reference"
    }]
  });

  assert.equal(raw.verdict, "PREVIEW_REJECT");
  assert.equal(raw.reason, "fixture_must_not_include_raw_content");
  assert.doesNotMatch(JSON.stringify(raw), /raw-private-chat-should-not-appear/);
  assert.equal(badTier.reason, "tier_not_allowlisted");
  assert.equal(badSource.reason, "source_id_not_allowlisted");
  assert.equal(unsafeId.reason, "fixture_id_must_be_unique_safe_identifier");
});

test("preview emits deterministic harness, self-critique, compliance, and consent", () => {
  const preview = buildCorpusRedactionFixturePreview();

  assert.equal(preview.self_proactive_harness.mode, "DETERMINISTIC_REDACTION_FIXTURE_PREVIEW");
  assert.equal(preview.self_proactive_harness.recommended_micro_action, "build_corpus_benchmark_schema_preview");
  assert.equal(preview.self_proactive_harness.gates.find((gate) => gate.gate === "fixture_metadata_only").pass, true);
  assert.equal(preview.self_proactive_harness.gates.find((gate) => gate.gate === "d3_quarantine_marker_available").pass, true);
  assert.equal(preview.self_proactive_harness.gates.find((gate) => gate.gate === "d4_reject_marker_available").pass, true);
  assert.equal(preview.self_critique.confidence, "bounded_preview");
  assert.equal(preview.micro_compliance.fixture_only, true);
  assert.equal(preview.micro_compliance.no_real_redaction, true);
  assert.equal(preview.micro_compliance.no_ingestion, true);
  assert.equal(preview.micro_compliance.no_embeddings, true);
  assert.equal(preview.micro_compliance.no_fine_tune, true);
  assert.equal(preview.micro_consent.raw_content_processing_authorized, false);
  assert.equal(preview.micro_consent.real_redaction_authorized, false);
  assert.equal(preview.micro_consent.d3_d4_processing_authorized, false);
  assert.equal(preview.analogical_model.model, "sealed_box_handling_labels");
});

test("preview keeps every authority and data movement boundary false", () => {
  const preview = buildCorpusRedactionFixturePreview();
  const expectedFalseBoundaries = [
    "raw_content_ingested",
    "raw_content_opened",
    "real_redaction_performed",
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
  const first = buildCorpusRedactionFixturePreview();
  const second = buildCorpusRedactionFixturePreview();

  assert.deepEqual(first, second);
  assert.notEqual(first, second);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.redaction_cases), true);
  assert.equal(Object.isFrozen(first.redaction_cases[0]), true);
  assert.equal(Object.isFrozen(first.data_tiers[0]), true);
  assert.throws(() => {
    first.redaction_cases[0].policy_action = "open_content";
  }, TypeError);
  assert.throws(() => {
    first.boundary.raw_content_opened = true;
  }, TypeError);
});

test("corpus redaction fixture preview has no CLI wiring", async () => {
  const cliSource = await readFile(cliPath, "utf8");

  assert.doesNotMatch(cliSource, /corpus-redaction-fixture-preview/);
  assert.doesNotMatch(cliSource, /corpus_redaction_fixture_preview/);
  assert.doesNotMatch(cliSource, /redaction fixture/i);
});

test("corpus redaction fixture preview module has no runtime, network, filesystem, or randomness side effects", async () => {
  const source = await readFile(modulePath, "utf8");

  assert.doesNotMatch(source, /from\s+["']node:(net|dgram|http|https|tls|dns|worker_threads|vm|child_process|fs)["']/);
  assert.doesNotMatch(source, /\b(fetch|WebSocket|exec|execFile|spawn|spawnSync)\b/);
  assert.doesNotMatch(source, /\b(writeFile|appendFile|mkdir|rename|unlink|createWriteStream)\b/);
  assert.doesNotMatch(source, /\b(Date\.now|Math\.random|crypto\.random|process\.hrtime|performance\.now)\b/);
});
