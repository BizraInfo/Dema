// NODE0-FOUNDER-IMPACT-DIGEST-0A — PURE, deterministic, content-addressed digest kernel.
//
// Given already-sanitized founder-corpus documents (metadata + a hash + a sanitizer verdict, plus the
// text used ONLY to derive concept frontmatter), it emits an OKF-conformant bundle of "concepts". Each
// concept carries a non-empty `type`, a parseable `frontmatter` object, and the BIZRA proof-extension
// keys (`truth_label`, `evidence`, `source_sha256`). The digest is deterministic and content-addressed:
// the same input always yields the same content_hash.
//
// Honesty boundary: the digest binds SOURCE HASHES and DECLARED metadata, never raw bytes. Dema does not
// understand the content — the concept `type` is the operator's declared type, never an inference. No raw
// source text is ever stored in a concept (frontmatter is metadata only). No model, no fs, no network.
//
// Pure kernel: no fs / net / clock / random. createHash is a deterministic digest only.

import { createHash } from "node:crypto";

export const NODE0_FOUNDER_IMPACT_DIGEST_SCHEMA = "bizra.dema.founder_impact_digest.v0.1";
export const NODE0_FOUNDER_IMPACT_DIGEST_TRUTH_LABEL = "NODE0_FOUNDER_IMPACT_CANDIDATE_LOCAL_ONLY";

const CONCEPT_SCHEMA = `${NODE0_FOUNDER_IMPACT_DIGEST_SCHEMA}.concept`;
const SHA256_HEX = /^[0-9a-f]{64}$/;

// Field names that would carry raw source content into a concept — never admissible in a digest.
const RAW_CONTENT_KEYS = Object.freeze([
  "text",
  "raw_content",
  "source_content",
  "file_content",
  "raw_text",
  "plaintext",
  "excerpt",
]);

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function contentAddress(body) {
  return Object.freeze({ ...body, content_hash: `sha256:${sha256(stableStringify(body))}` });
}

// A parseable frontmatter is a plain object (round-trips through JSON) — never an array, null, or scalar.
function isParseableFrontmatter(fm) {
  if (!fm || typeof fm !== "object" || Array.isArray(fm)) return false;
  try {
    JSON.parse(JSON.stringify(fm));
    return true;
  } catch {
    return false;
  }
}

function nonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

// Build one OKF concept from a sanitized doc. `type` is the operator's DECLARED type (non-empty required);
// frontmatter is metadata only (no raw text). Returns a content-addressed concept object.
function buildConcept(doc) {
  const source = typeof doc?.source === "string" ? doc.source : null;
  const type = typeof doc?.type === "string" ? doc.type : "";
  const source_sha256 = typeof doc?.source_sha256 === "string" ? doc.source_sha256 : "";
  const size_bytes = Number.isInteger(doc?.size_bytes) ? doc.size_bytes : null;
  const sanitizer_verdict = typeof doc?.sanitizer_verdict === "string" ? doc.sanitizer_verdict : "UNKNOWN";
  const frontmatter = {
    source,
    type,
    size_bytes,
    sanitizer_verdict,
    // A one-line, hash-derived, non-reversible fingerprint used purely for stable ordering / display.
    fingerprint: SHA256_HEX.test(source_sha256) ? source_sha256.slice(0, 12) : null,
  };
  return contentAddress({
    schema: CONCEPT_SCHEMA,
    type,
    frontmatter,
    truth_label: NODE0_FOUNDER_IMPACT_DIGEST_TRUTH_LABEL,
    evidence: { source_sha256, sanitizer_verdict, source },
    source_sha256,
    source,
  });
}

function scanRawContentLeak(node) {
  const hits = [];
  const walk = (v) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (v && typeof v === "object") {
      for (const [k, val] of Object.entries(v)) {
        if (RAW_CONTENT_KEYS.includes(k) && typeof val === "string" && val.trim() !== "") hits.push(k);
        walk(val);
      }
    }
  };
  walk(node);
  return hits;
}

// Assess OKF conformance for one concept. Returns the blocked_by codes (empty = conformant).
function conceptConformance(concept) {
  const codes = [];
  const id = concept?.source ?? "unknown";
  if (!nonEmptyString(concept?.type)) codes.push(`concept_type_missing:${id}`);
  if (!isParseableFrontmatter(concept?.frontmatter)) codes.push(`concept_frontmatter_unparseable:${id}`);
  if (concept?.truth_label !== NODE0_FOUNDER_IMPACT_DIGEST_TRUTH_LABEL) codes.push(`concept_truth_label_missing:${id}`);
  if (!concept?.evidence || typeof concept.evidence !== "object") codes.push(`concept_evidence_missing:${id}`);
  if (!SHA256_HEX.test(concept?.source_sha256 ?? "")) codes.push(`concept_source_sha256_missing:${id}`);
  else if (concept?.evidence?.source_sha256 !== concept.source_sha256) codes.push(`concept_evidence_hash_mismatch:${id}`);
  return codes;
}

export function buildFounderImpactDigest(sanitizedDocs) {
  const docs = Array.isArray(sanitizedDocs) ? sanitizedDocs : [];
  const concepts = docs.map(buildConcept);
  const blocked_by = [];
  for (const concept of concepts) blocked_by.push(...conceptConformance(concept));
  // A raw-content leak is a hard non-conformance (the digest must never carry raw bytes).
  for (const concept of concepts) {
    for (const k of scanRawContentLeak(concept)) blocked_by.push(`raw_content_leaked:${concept.source ?? "unknown"}:${k}`);
  }
  const conformant = blocked_by.length === 0;
  const body = {
    schema: NODE0_FOUNDER_IMPACT_DIGEST_SCHEMA,
    truth_label: NODE0_FOUNDER_IMPACT_DIGEST_TRUTH_LABEL,
    concepts: Object.freeze(concepts),
    concept_count: concepts.length,
    source_count: docs.length,
    conformant,
    blocked_by: Object.freeze([...new Set(blocked_by)]),
    what_this_proves:
      "An OKF-conformant, content-addressed digest of already-sanitized founder-corpus sources: one concept per source, each with a non-empty declared type, a parseable metadata frontmatter, and the BIZRA proof-extension keys (truth_label, evidence, source_sha256). Deterministic — the same input yields the same content hash. Binds source hashes and declared metadata, never raw bytes.",
    what_this_does_not_prove:
      "It does not understand, classify, or verify the content (the concept type is the operator's declared type, not an inference), runs no model, reads no file, and includes no raw source text. Conformance is a structural property, not a claim of meaning or impact.",
  };
  return contentAddress(body);
}

export function verifyFounderImpactDigest(digest) {
  if (!digest || typeof digest !== "object") {
    return Object.freeze({ ok: false, blocked_by: Object.freeze(["digest_not_object"]) });
  }
  const blocked_by = [];
  const { content_hash, ...body } = digest;
  if (content_hash !== `sha256:${sha256(stableStringify(body))}`) blocked_by.push("content_hash_mismatch");
  if (digest.schema !== NODE0_FOUNDER_IMPACT_DIGEST_SCHEMA) blocked_by.push("schema_mismatch");
  if (digest.truth_label !== NODE0_FOUNDER_IMPACT_DIGEST_TRUTH_LABEL) blocked_by.push("truth_label_mismatch");
  const concepts = Array.isArray(digest.concepts) ? digest.concepts : null;
  if (!concepts) {
    blocked_by.push("concepts_not_array");
  } else {
    if (concepts.length !== digest.concept_count) blocked_by.push("concept_count_mismatch");
    for (const concept of concepts) {
      // Each concept is itself content-addressed — re-derive its hash (tamper without recompute fails).
      const { content_hash: cHash, ...cBody } = concept ?? {};
      if (cHash !== `sha256:${sha256(stableStringify(cBody))}`) {
        blocked_by.push(`concept_content_hash_mismatch:${concept?.source ?? "unknown"}`);
      }
      blocked_by.push(...conceptConformance(concept));
      for (const k of scanRawContentLeak(concept)) blocked_by.push(`raw_content_leaked:${concept?.source ?? "unknown"}:${k}`);
    }
    // A digest that claims conformant:true must actually carry zero conformance issues.
    if (digest.conformant === true && blocked_by.length > 0) blocked_by.push("conformant_flag_inconsistent");
  }
  return Object.freeze({ ok: blocked_by.length === 0, blocked_by: Object.freeze([...new Set(blocked_by)]) });
}
