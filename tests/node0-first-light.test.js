import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import * as firstLight from "../packages/core/src/node0-first-light.js";
import {
  buildFirstLightIndex,
  verifyFirstLightIndex,
  retrieveFirstLightSources,
  buildFirstLightPrompt,
  composeFirstLightAnswer,
  buildFirstLightReceipt,
  verifyFirstLightReceipt,
  buildFirstLightProofCard,
  verifyFirstLightProofCard,
} from "../packages/core/src/node0-first-light.js";
import { sha256CanonicalJsonV1 } from "../packages/canon/src/sha256-canonical-json-v1.js";

const HASH = /^sha256:[0-9a-f]{64}$/;
const ROOT = "/fixture/bizra-research";
const hashText = (value) =>
  `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;

const DOCUMENTS = Object.freeze([
  Object.freeze({
    relative_path: "canon/pat.md",
    text: [
      "# PAT",
      "PAT is the Proposal Agent Team.",
      "PAT proposes bounded work and must attach evidence.",
      "The unique source sentence PAT-ALPHA-731 remains local.",
    ].join("\n"),
  }),
  Object.freeze({
    relative_path: "canon/sat.md",
    text: [
      "# SAT",
      "SAT is the Safeguard Agent Team.",
      "SAT independently verifies evidence and may permit, refuse, or request review.",
      "The unique source sentence SAT-OMEGA-419 remains local.",
    ].join("\n"),
  }),
  Object.freeze({
    relative_path: "notes/unrelated.md",
    text: "# Gardening\nWater the seed without flooding the soil.",
  }),
]);

function buildFixture() {
  const index = buildFirstLightIndex({
    mission_id: "first-light-fixture",
    root_path: ROOT,
    documents: DOCUMENTS,
    indexed_at_iso: "2026-07-30T08:00:00.000Z",
  });
  const retrieval = retrieveFirstLightSources({
    index,
    documents: DOCUMENTS,
    question: "What are PAT and SAT, and how do they work together?",
    max_sources: 2,
  });
  const prompt = buildFirstLightPrompt({
    question: "What are PAT and SAT, and how do they work together?",
    retrieval,
  });
  const rawResponse =
    "PAT proposes bounded work with evidence [S1]. SAT independently verifies that evidence and can permit, refuse, or request review [S2].";
  const answer = composeFirstLightAnswer({
    response_text: rawResponse,
    retrieval,
  });
  return { index, retrieval, prompt, rawResponse, answer };
}

function receiptInput(fixture, responseText = fixture.rawResponse) {
  return {
    mission_id: "first-light-fixture",
    root_path: ROOT,
    root_set_hash: `sha256:${"1".repeat(64)}`,
    consent: {
      verified: true,
      action_class: "C3_LOCAL_WRITE",
      consent_context_hash: `sha256:${"2".repeat(64)}`,
      phrase_hash: `sha256:${"3".repeat(64)}`,
    },
    index: fixture.index,
    question: "What are PAT and SAT, and how do they work together?",
    retrieval: fixture.retrieval,
    prompt: fixture.prompt,
    model_result: {
      provider: "ollama",
      model: "qwen3:4b",
      target_endpoint: "http://localhost:11434",
      response_text: responseText,
    },
    answer_text: composeFirstLightAnswer({
      response_text: responseText,
      retrieval: fixture.retrieval,
    }),
    observed_at_iso: "2026-07-30T08:01:00.000Z",
  };
}

test("the deterministic index binds current files without persisting raw source text", () => {
  const a = buildFirstLightIndex({
    mission_id: "first-light-fixture",
    root_path: ROOT,
    documents: DOCUMENTS,
    indexed_at_iso: "2026-07-30T08:00:00.000Z",
  });
  const b = buildFirstLightIndex({
    mission_id: "first-light-fixture",
    root_path: ROOT,
    documents: DOCUMENTS,
    indexed_at_iso: "2026-07-30T08:00:00.000Z",
  });

  assert.equal(a.rejected, false);
  assert.equal(a.file_count, 3);
  assert.match(a.index_hash, HASH);
  assert.equal(a.index_hash, b.index_hash);
  assert.equal(JSON.stringify(a).includes("PAT-ALPHA-731"), false);
  assert.equal(JSON.stringify(a).includes("SAT-OMEGA-419"), false);
  assert.ok(a.files.every((file) => HASH.test(file.source_sha256)));
});

test("the persisted index stays canonical for documents with large vocabularies", () => {
  const documents = Array.from({ length: 527 }, (_, fileIndex) => ({
    relative_path: `docs/source-${String(fileIndex).padStart(3, "0")}.md`,
    text: Array.from(
      { length: 300 },
      (_, termIndex) => `term_${fileIndex}_${termIndex}`,
    ).join(" "),
  }));
  const index = buildFirstLightIndex({
    mission_id: "first-light-large-vocabulary",
    root_path: "/tmp/first-light-large-vocabulary",
    documents,
    indexed_at_iso: "2026-07-30T08:00:00.000Z",
  });

  assert.equal(index.rejected, false);
  assert.equal(index.file_count, 527);
  assert.ok(index.files.every((file) => !Object.hasOwn(file, "terms")));
  assert.ok(Buffer.byteLength(JSON.stringify(index), "utf8") < 1_048_576);
  assert.equal(verifyFirstLightIndex(index).verified, true);
});

test("index verification rejects a changed source hash", () => {
  const index = buildFirstLightIndex({
    mission_id: "first-light-fixture",
    root_path: ROOT,
    documents: DOCUMENTS,
    indexed_at_iso: "2026-07-30T08:00:00.000Z",
  });
  const tampered = structuredClone(index);
  tampered.files[0].source_sha256 = `sha256:${"0".repeat(64)}`;

  const verdict = verifyFirstLightIndex(tampered);
  assert.equal(verdict.verified, false);
  assert.ok(verdict.blocked_by.includes("index_hash_mismatch"));
});

test("retrieval selects PAT and SAT evidence with line and hash citations", () => {
  const { retrieval } = buildFixture();

  assert.equal(retrieval.rejected, false);
  assert.match(retrieval.retrieval_hash, HASH);
  assert.deepEqual(
    retrieval.sources.map((source) => source.relative_path).sort(),
    ["canon/pat.md", "canon/sat.md"],
  );
  for (const source of retrieval.sources) {
    assert.match(source.source_sha256, HASH);
    assert.match(source.excerpt_sha256, HASH);
    assert.ok(source.line_start >= 1);
    assert.ok(source.line_end >= source.line_start);
    assert.ok(source.matched_terms.includes("pat") || source.matched_terms.includes("sat"));
  }
});

test("model response citations accept only IDs from the retrieved source set", () => {
  const { retrieval } = buildFixture();
  const verify = firstLight.verifyFirstLightResponseCitations;

  assert.equal(typeof verify, "function");
  assert.deepEqual(
    verify?.({
      response_text: "PAT proposes [S1]; SAT verifies [S2].",
      retrieval,
    }),
    {
      verified: true,
      blocked_by: [],
      cited_source_ids: ["S1", "S2"],
    },
  );
  assert.deepEqual(
    verify?.({ response_text: "No source citation.", retrieval }),
    {
      verified: false,
      blocked_by: ["model_response_citation_missing"],
      cited_source_ids: [],
    },
  );
  assert.deepEqual(
    verify?.({ response_text: "PAT proposes [S1], but [S3] is unknown.", retrieval }),
    {
      verified: false,
      blocked_by: ["model_response_citation_unknown:S3"],
      cited_source_ids: ["S1", "S3"],
    },
  );
});

test("receipt build rejects missing and unknown model response citations", () => {
  const fixture = buildFixture();
  for (const [responseText, reason] of [
    ["No source citation.", "model_response_citation_missing"],
    ["PAT proposes [S1], but [S3] is unknown.", "model_response_citation_unknown:S3"],
  ]) {
    const receipt = buildFirstLightReceipt(receiptInput(fixture, responseText));
    assert.equal(receipt.rejected, true);
    assert.ok(receipt.blocked_by.includes(reason));
  }
});

test("the canonical receipt binds the exact answer and omits raw source excerpts", () => {
  const { index, retrieval, prompt, rawResponse, answer } = buildFixture();
  const receipt = buildFirstLightReceipt({
    mission_id: "first-light-fixture",
    root_path: ROOT,
    root_set_hash: `sha256:${"1".repeat(64)}`,
    consent: {
      verified: true,
      action_class: "C3_LOCAL_WRITE",
      consent_context_hash: `sha256:${"2".repeat(64)}`,
      phrase_hash: `sha256:${"3".repeat(64)}`,
    },
    index,
    question: "What are PAT and SAT, and how do they work together?",
    retrieval,
    prompt,
    model_result: {
      provider: "ollama",
      model: "qwen3:4b",
      target_endpoint: "http://localhost:11434",
      response_text: rawResponse,
    },
    answer_text: answer,
    observed_at_iso: "2026-07-30T08:01:00.000Z",
  });

  assert.equal(receipt.rejected, false);
  assert.match(receipt.receipt_id, HASH);
  assert.equal(verifyFirstLightReceipt(receipt).verified, true);
  assert.equal(receipt.answer.text, answer);
  assert.match(receipt.answer.sha256, HASH);
  assert.match(receipt.model.raw_response_sha256, HASH);
  assert.equal(receipt.model.raw_response_text, rawResponse);
  assert.equal(JSON.stringify(receipt).includes("PAT-ALPHA-731"), false);
  assert.equal(JSON.stringify(receipt).includes("SAT-OMEGA-419"), false);
  assert.ok(receipt.retrieval.sources.every((source) => !Object.hasOwn(source, "excerpt")));
});

test("receipt verification fails closed when the exact answer is changed", () => {
  const { index, retrieval, prompt, rawResponse, answer } = buildFixture();
  const receipt = buildFirstLightReceipt({
    mission_id: "first-light-fixture",
    root_path: ROOT,
    root_set_hash: `sha256:${"1".repeat(64)}`,
    consent: {
      verified: true,
      action_class: "C3_LOCAL_WRITE",
      consent_context_hash: `sha256:${"2".repeat(64)}`,
      phrase_hash: `sha256:${"3".repeat(64)}`,
    },
    index,
    question: "What are PAT and SAT, and how do they work together?",
    retrieval,
    prompt,
    model_result: {
      provider: "ollama",
      model: "qwen3:4b",
      target_endpoint: "http://localhost:11434",
      response_text: rawResponse,
    },
    answer_text: answer,
    observed_at_iso: "2026-07-30T08:01:00.000Z",
  });
  const tampered = structuredClone(receipt);
  tampered.answer.text = "A different answer.";

  const verdict = verifyFirstLightReceipt(tampered);
  assert.equal(verdict.verified, false);
  assert.ok(verdict.blocked_by.includes("answer_hash_mismatch"));
  assert.ok(verdict.blocked_by.includes("receipt_id_mismatch"));
});

test("a rehashed unrelated answer cannot masquerade as receipt-derived", () => {
  const { index, retrieval, prompt, rawResponse, answer } = buildFixture();
  const receipt = buildFirstLightReceipt({
    mission_id: "first-light-fixture",
    root_path: ROOT,
    root_set_hash: `sha256:${"1".repeat(64)}`,
    consent: {
      verified: true,
      action_class: "C3_LOCAL_WRITE",
      consent_context_hash: `sha256:${"2".repeat(64)}`,
      phrase_hash: `sha256:${"3".repeat(64)}`,
    },
    index,
    question: "What are PAT and SAT, and how do they work together?",
    retrieval,
    prompt,
    model_result: {
      provider: "ollama",
      model: "qwen3:4b",
      target_endpoint: "http://localhost:11434",
      response_text: rawResponse,
    },
    answer_text: answer,
    observed_at_iso: "2026-07-30T08:01:00.000Z",
  });
  const tampered = structuredClone(receipt);
  tampered.answer.text = "This answer is unrelated to the persisted model response.";
  tampered.answer.sha256 = `sha256:${createHash("sha256")
    .update(tampered.answer.text, "utf8")
    .digest("hex")}`;
  const { receipt_id: _old, ...body } = tampered;
  tampered.receipt_id = sha256CanonicalJsonV1(body);

  const verdict = verifyFirstLightReceipt(tampered);
  assert.equal(verdict.verified, false);
  assert.ok(verdict.blocked_by.includes("answer_derivation_mismatch"));
});

test("receipt verification rejects rehashed missing and unknown citations", () => {
  const fixture = buildFixture();
  const validReceipt = buildFirstLightReceipt(receiptInput(fixture));
  for (const [responseText, reason] of [
    ["No source citation.", "model_response_citation_missing"],
    ["PAT proposes [S1], but [S3] is unknown.", "model_response_citation_unknown:S3"],
  ]) {
    const tampered = structuredClone(validReceipt);
    tampered.model.raw_response_text = responseText;
    tampered.model.raw_response_sha256 = hashText(responseText);
    tampered.answer.text = composeFirstLightAnswer({
      response_text: responseText,
      retrieval: { rejected: false, sources: tampered.retrieval.sources },
    });
    tampered.answer.sha256 = hashText(tampered.answer.text);
    const { receipt_id: _old, ...body } = tampered;
    tampered.receipt_id = sha256CanonicalJsonV1(body);

    const verdict = verifyFirstLightReceipt(tampered);
    assert.equal(verdict.verified, false);
    assert.ok(verdict.blocked_by.includes(reason));
  }
});

test("the Proof Card is derived from the verified receipt and detects drift", () => {
  const { index, retrieval, prompt, rawResponse, answer } = buildFixture();
  const receipt = buildFirstLightReceipt({
    mission_id: "first-light-fixture",
    root_path: ROOT,
    root_set_hash: `sha256:${"1".repeat(64)}`,
    consent: {
      verified: true,
      action_class: "C3_LOCAL_WRITE",
      consent_context_hash: `sha256:${"2".repeat(64)}`,
      phrase_hash: `sha256:${"3".repeat(64)}`,
    },
    index,
    question: "What are PAT and SAT, and how do they work together?",
    retrieval,
    prompt,
    model_result: {
      provider: "ollama",
      model: "qwen3:4b",
      target_endpoint: "http://localhost:11434",
      response_text: rawResponse,
    },
    answer_text: answer,
    observed_at_iso: "2026-07-30T08:01:00.000Z",
  });
  const card = buildFirstLightProofCard(receipt);

  assert.equal(card.rejected, false);
  assert.equal(card.receipt_id, receipt.receipt_id);
  assert.equal(card.answer.text, receipt.answer.text);
  assert.equal(card.sources.length, 2);
  assert.equal(card.verification_state, "RECEIPT_DERIVED");
  assert.match(card.limitation, /receipt relationships/i);
  assert.match(card.limitation, /source bytes.*persisted-state verifier/i);
  assert.match(card.limitation, /suggestion.*not independently semantically verified/i);
  assert.match(card.proof_card_hash, HASH);
  assert.equal(
    verifyFirstLightProofCard({ card, receipt }).verified,
    true,
  );

  const tampered = structuredClone(card);
  tampered.sources[0].source_sha256 = `sha256:${"0".repeat(64)}`;
  const verdict = verifyFirstLightProofCard({ card: tampered, receipt });
  assert.equal(verdict.verified, false);
  assert.ok(verdict.blocked_by.includes("proof_card_mismatch"));
});
