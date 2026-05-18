import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildCorpusIntegrationPreview,
  buildCorpusIntegrationSummary,
  buildCorpusQueryPreview,
  CORPUS_INTEGRATION_DATA_TIERS,
  CORPUS_INTEGRATION_REQUIRED_BLOCKED_EFFECTS
} from "../packages/core/src/corpus-integration.js";
import { isCanonicalBoundary } from "../packages/core/src/preview-boundary.js";

test("Corpus integration · canonical schema · NODE0_LOCAL_SEED", () => {
  const p = buildCorpusIntegrationPreview();
  assert.equal(p.schema, "bizra.dema.corpus_integration.v0.1");
  assert.equal(p.truth_label, "NODE0_LOCAL_SEED");
});

test("Corpus integration · declares 5 data tiers D0-D4", () => {
  const p = buildCorpusIntegrationPreview();
  assert.equal(Object.keys(p.data_tiers).length, 5);
  assert.ok(Object.keys(p.data_tiers).includes("D0"));
  assert.ok(Object.keys(p.data_tiers).includes("D4"));
});

test("Corpus integration · d4_return_blocked=true · never returned", () => {
  const p = buildCorpusIntegrationPreview();
  assert.equal(p.d4_return_blocked, true);
});

test("Corpus integration · blocked_effects include modify · cache_outside · share_externally", () => {
  const p = buildCorpusIntegrationPreview();
  assert.ok(p.blocked_effects.includes("modify_corpus_data"));
  assert.ok(p.blocked_effects.includes("cache_results_outside_dema_home"));
  assert.ok(p.blocked_effects.includes("share_results_externally"));
  assert.ok(p.blocked_effects.includes("return_raw_d4_classified_content"));
});

test("Corpus integration · refusal_invariants include 'never modify' + 'never D4 return'", () => {
  const p = buildCorpusIntegrationPreview();
  assert.ok(p.refusal_invariants.some((r) => r.includes("never modified")));
  assert.ok(p.refusal_invariants.some((r) => r.includes("D4-classified content is NEVER returned")));
});

test("Corpus integration · boundary canonical · deep frozen", () => {
  const p = buildCorpusIntegrationPreview();
  assert.ok(isCanonicalBoundary(p.boundary));
  assert.ok(Object.isFrozen(p));
});

test("Corpus integration · accepts inventory metadata from v0.3 inventory", () => {
  const p = buildCorpusIntegrationPreview({
    inventory_sha256: "36c2e591".padEnd(64, "0"),
    total_messages: 27044,
    total_conversations: 1545,
    platforms: ["claude", "chatgpt", "gemini", "copilot"],
    consent_classification_applied: true
  });
  assert.equal(p.total_messages, 27044);
  assert.equal(p.total_conversations, 1545);
  assert.equal(p.platforms.length, 4);
  assert.equal(p.consent_classification_applied, true);
});

test("Query preview · valid input → consent phrase generated · query_executed=false", () => {
  const q = buildCorpusQueryPreview({
    query_text: "what did I say about consent gates",
    estimated_tier: "D1"
  });
  assert.equal(q.schema, "bizra.dema.corpus_query_preview.v0.1");
  assert.equal(q.valid, true);
  assert.equal(q.query_executed, false);
  assert.match(q.consent_phrase, /^GO: query corpus tier=D1/);
});

test("Query preview · empty query → refused", () => {
  const q = buildCorpusQueryPreview({ query_text: "" });
  assert.equal(q.valid, false);
  assert.ok(q.violations.includes("empty_query"));
});

test("Query preview · D4 query → REFUSED · never executed", () => {
  const q = buildCorpusQueryPreview({
    query_text: "test",
    estimated_tier: "D4"
  });
  assert.equal(q.valid, false);
  assert.ok(q.violations.includes("d4_queries_refused · D4 content is never returned"));
});

test("Query preview · max_results out of range → refused", () => {
  const q1 = buildCorpusQueryPreview({ query_text: "x", max_results: 0 });
  const q2 = buildCorpusQueryPreview({ query_text: "x", max_results: 999 });
  assert.equal(q1.valid, false);
  assert.equal(q2.valid, false);
});

test("Query preview · oversized query → refused", () => {
  const q = buildCorpusQueryPreview({ query_text: "x".repeat(3000) });
  assert.equal(q.valid, false);
  assert.ok(q.violations.includes("query_too_long"));
});

test("Query preview · unknown tier coerced to D1 default", () => {
  const q = buildCorpusQueryPreview({
    query_text: "test",
    estimated_tier: "MADE_UP"
  });
  assert.equal(q.estimated_data_tier, "D1");
  assert.equal(q.valid, true);
});

test("Query preview · query text redaction in preview (long queries truncated with ellipsis)", () => {
  const long = "a".repeat(100);
  const q = buildCorpusQueryPreview({ query_text: long });
  assert.equal(q.query_length_chars, 100);
  assert.ok(q.query_text_redacted_preview.length <= 65);
  assert.ok(q.query_text_redacted_preview.endsWith("…"));
});

test("Query preview deep-frozen + canonical boundary", () => {
  const q = buildCorpusQueryPreview({ query_text: "test" });
  assert.ok(Object.isFrozen(q));
  assert.ok(isCanonicalBoundary(q.boundary));
});

test("Summary + exports", () => {
  const s = buildCorpusIntegrationSummary({
    total_messages: 27044,
    inventory_sha256: "x".repeat(64)
  });
  assert.equal(s.total_messages, 27044);
  assert.equal(s.d4_return_blocked, true);
  assert.ok(JSON.stringify(s, null, 2).split("\n").length <= 40);
  assert.ok(Object.isFrozen(CORPUS_INTEGRATION_DATA_TIERS));
  assert.ok(Object.isFrozen(CORPUS_INTEGRATION_REQUIRED_BLOCKED_EFFECTS));
});
