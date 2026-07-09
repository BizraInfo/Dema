import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  buildFounderImpactDigest,
  verifyFounderImpactDigest,
  NODE0_FOUNDER_IMPACT_DIGEST_SCHEMA,
  NODE0_FOUNDER_IMPACT_DIGEST_TRUTH_LABEL,
} from "../packages/core/src/node0-founder-impact-digest.js";

const sha = (s) => createHash("sha256").update(s, "utf8").digest("hex");

function docs() {
  return [
    {
      source: "corpus/a.md",
      type: "chat_export",
      size_bytes: 12,
      source_sha256: sha("hello world!"),
      sanitizer_verdict: "ALLOWED",
      text: "hello world!",
    },
    {
      source: "corpus/b.js",
      type: "code",
      size_bytes: 4,
      source_sha256: sha("x=1;"),
      sanitizer_verdict: "ALLOWED",
      text: "x=1;",
    },
  ];
}

test("digest carries schema + truth label + one concept per doc", () => {
  const digest = buildFounderImpactDigest(docs());
  assert.equal(digest.schema, NODE0_FOUNDER_IMPACT_DIGEST_SCHEMA);
  assert.equal(digest.truth_label, NODE0_FOUNDER_IMPACT_DIGEST_TRUTH_LABEL);
  assert.equal(digest.concept_count, 2);
  assert.equal(digest.source_count, 2);
});

test("OKF-conformant: every concept has non-empty type + parseable frontmatter + proof-extension keys", () => {
  const digest = buildFounderImpactDigest(docs());
  assert.equal(digest.conformant, true);
  for (const concept of digest.concepts) {
    assert.equal(typeof concept.type, "string");
    assert.ok(concept.type.length > 0, "concept.type must be non-empty");
    // parseable frontmatter = a plain object that round-trips through JSON
    assert.ok(
      concept.frontmatter && typeof concept.frontmatter === "object" && !Array.isArray(concept.frontmatter),
      "frontmatter must be a parseable plain object",
    );
    assert.doesNotThrow(() => JSON.parse(JSON.stringify(concept.frontmatter)));
    // BIZRA proof-extension keys
    assert.equal(concept.truth_label, NODE0_FOUNDER_IMPACT_DIGEST_TRUTH_LABEL);
    assert.ok(concept.evidence && typeof concept.evidence === "object");
    assert.match(concept.source_sha256, /^[0-9a-f]{64}$/);
    assert.equal(concept.evidence.source_sha256, concept.source_sha256);
  }
});

test("digest is deterministic + content-addressed (same input → same hash)", () => {
  const a = buildFounderImpactDigest(docs());
  const b = buildFounderImpactDigest(docs());
  assert.match(a.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(a.content_hash, b.content_hash);
});

test("digest binds source sha256, never raw bytes", () => {
  const digest = buildFounderImpactDigest(docs());
  const serialized = JSON.stringify(digest);
  assert.ok(!serialized.includes("hello world!"), "raw source text must not appear in digest");
  assert.ok(!serialized.includes("x=1;"), "raw source text must not appear in digest");
  for (const concept of digest.concepts) {
    assert.equal(concept.text, undefined);
    assert.equal(concept.frontmatter.text, undefined);
  }
});

test("verify re-derives the whole body — tampered concept type fails closed", () => {
  const digest = buildFounderImpactDigest(docs());
  assert.equal(verifyFounderImpactDigest(digest).ok, true);
  const tampered = {
    ...digest,
    concepts: [{ ...digest.concepts[0], type: "FORGED" }, digest.concepts[1]],
  };
  assert.equal(verifyFounderImpactDigest(tampered).ok, false);
});

test("a doc missing a non-empty type makes the digest non-conformant", () => {
  const bad = docs();
  bad[0] = { ...bad[0], type: "" };
  const digest = buildFounderImpactDigest(bad);
  assert.equal(digest.conformant, false);
  assert.ok(digest.blocked_by.some((c) => c.startsWith("concept_type_missing")));
});

test("verify rejects a non-object", () => {
  assert.equal(verifyFounderImpactDigest(null).ok, false);
});
