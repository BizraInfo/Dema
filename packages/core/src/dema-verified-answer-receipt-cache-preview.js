// DEMA-VERIFIED-ANSWER-RECEIPT-CACHE-PREVIEW-1A — Preview-only verified-answer receipt cache: stores previously
// verified answers as content-addressed records and reuses them only when fresh, in-scope, source-hash-matched, and
// status `verified`; a cache hit reuses proof, never grants action, never mints, never turns saved cost into value.
//
// Pure kernel: no fs / network / process / clock / random. `created_at` and `now` are INJECTED by the caller — the
// kernel reads no clock. The boundary is all-false; a cache hit carries `grants_action: false` and `authority_delta: 0`.
// A cache hit reuses a prior proof; it is not itself an action, an execution, a mint, or a value transfer.

import { createHash } from "node:crypto";

export const DEMA_VERIFIED_ANSWER_RECEIPT_CACHE_PREVIEW_SCHEMA = "bizra.dema.dema_verified_answer_receipt_cache_preview.v0.1";
export const DEMA_VERIFIED_ANSWER_RECEIPT_CACHE_PREVIEW_TRUTH_LABEL = "DEMA_VERIFIED_ANSWER_RECEIPT_CACHE_PREVIEW_MEASURED_REPO";
export const DEMA_VERIFIED_ANSWER_RECEIPT_CACHE_PREVIEW_GO_PHRASE = "GO: dema verified answer receipt cache preview";

// Cache-record lifecycle. A hit requires `verified`; every other status is a miss.
export const CACHE_RECORD_STATUSES = Object.freeze([
  "candidate",
  "verified",
  "stale",
  "rejected",
  "superseded",
]);

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

function canonicalizeQuestion(question) {
  return String(question).trim().toLowerCase().replace(/\s+/g, " ");
}

// All-false boundary invariant. Keep every key false; flipping any one is an execution claim.
export function demaVerifiedAnswerReceiptCachePreviewBoundary() {
  return Object.freeze({
    execution_allowed: false,
    daemon_started: false,
    network_used: false,
    token_minted: false,
    wallet_accessed: false,
    live_execution_performed: false,
    file_mutation_performed: false,
    model_invocation_performed: false,
  });
}

// Positive ontology validation → named blocks. Absence of a block is never validation:
// each precondition is proven present, not merely "not seen missing".
function cacheRecordInputBlocks(input) {
  const blocked_by = [];
  if (!input || typeof input !== "object") {
    blocked_by.push("input_not_object");
    return blocked_by;
  }
  if (typeof input.canonical_question !== "string" || input.canonical_question.trim() === "") {
    blocked_by.push("missing_canonical_question");
  }
  if (typeof input.answer !== "string" || input.answer === "") {
    blocked_by.push("missing_answer");
  }
  if (!Array.isArray(input.source_refs) || input.source_refs.length === 0) {
    blocked_by.push("missing_source_refs");
  }
  if (!Array.isArray(input.source_hashes) || input.source_hashes.length === 0) {
    blocked_by.push("missing_source_hashes");
  }
  if (
    Array.isArray(input.source_refs) &&
    Array.isArray(input.source_hashes) &&
    input.source_refs.length !== input.source_hashes.length
  ) {
    blocked_by.push("source_refs_hashes_length_mismatch");
  }
  if (typeof input.consent_scope !== "string" || input.consent_scope === "") {
    blocked_by.push("missing_consent_scope");
  }
  if (
    !input.freshness_policy ||
    typeof input.freshness_policy.ttl_ms !== "number" ||
    !Number.isFinite(input.freshness_policy.ttl_ms) ||
    input.freshness_policy.ttl_ms <= 0
  ) {
    blocked_by.push("missing_or_invalid_freshness_policy");
  }
  if (typeof input.created_at !== "number" || !Number.isFinite(input.created_at)) {
    blocked_by.push("missing_created_at");
  }
  return blocked_by;
}

// Fail-closed plan: exact GO-phrase byte match + positive input ontology validation.
export function planDemaVerifiedAnswerReceiptCachePreview({ consent, input } = {}) {
  const blocked_by = [];
  if (consent !== DEMA_VERIFIED_ANSWER_RECEIPT_CACHE_PREVIEW_GO_PHRASE) {
    blocked_by.push("consent_phrase_mismatch");
  }
  for (const code of cacheRecordInputBlocks(input)) {
    blocked_by.push(code);
  }
  return Object.freeze({
    schema: DEMA_VERIFIED_ANSWER_RECEIPT_CACHE_PREVIEW_SCHEMA,
    truth_label: DEMA_VERIFIED_ANSWER_RECEIPT_CACHE_PREVIEW_TRUTH_LABEL,
    eligible: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

// The record body carries the identity + proof + freshness + scope fields. `cache_id` binds the
// IDENTITY fields only (stable across status changes); `content_hash` (added by build) binds the WHOLE body.
function cacheRecordBody(input) {
  const canonical_question = canonicalizeQuestion(input.canonical_question);
  const answer_digest = `sha256:${sha256(input.answer)}`;
  const source_hashes = [...input.source_hashes];
  const consent_scope = input.consent_scope;
  const cache_id = `sha256:${sha256(
    stableStringify({ canonical_question, answer_digest, source_hashes, consent_scope }),
  )}`;
  const created_at = input.created_at;
  const expires_at = created_at + input.freshness_policy.ttl_ms;
  return {
    schema: DEMA_VERIFIED_ANSWER_RECEIPT_CACHE_PREVIEW_SCHEMA,
    truth_label: DEMA_VERIFIED_ANSWER_RECEIPT_CACHE_PREVIEW_TRUTH_LABEL,
    cache_id,
    canonical_question,
    answer_digest,
    answer_summary: typeof input.answer_summary === "string" ? input.answer_summary : "",
    source_refs: [...input.source_refs],
    source_hashes,
    consent_scope,
    freshness_policy: { ttl_ms: input.freshness_policy.ttl_ms },
    created_at,
    expires_at,
    status: "verified",
    grants_action: false,
    authority_delta: 0,
    boundary: demaVerifiedAnswerReceiptCachePreviewBoundary(),
  };
}

// Canonical, content-addressed payload (a cache record IS a payload). content_hash binds the whole body.
export function buildDemaVerifiedAnswerReceiptCachePreviewPayload(input) {
  const body = cacheRecordBody(input);
  const content_hash = `sha256:${sha256(stableStringify(body))}`;
  return Object.freeze({ ...body, content_hash });
}

// Body-bound re-derivation verifier: recompute the hash over the body MINUS content_hash and reject any mismatch,
// plus the invariant field checks (authority_delta 0, all-false boundary by DEEP key check, known status).
// Internal consistency only — a forge-and-recompute launder is not defended here (documented, not overclaimed).
export function verifyDemaVerifiedAnswerReceiptCachePreview(payload) {
  if (!payload || typeof payload !== "object") {
    return Object.freeze({
      ok: false,
      schema: DEMA_VERIFIED_ANSWER_RECEIPT_CACHE_PREVIEW_SCHEMA,
      truth_label: DEMA_VERIFIED_ANSWER_RECEIPT_CACHE_PREVIEW_TRUTH_LABEL,
      blocked_by: Object.freeze(["payload_not_object"]),
    });
  }
  const blocked_by = [];
  const { content_hash, ...body } = payload;
  const recomputed = `sha256:${sha256(stableStringify(body))}`;
  if (content_hash !== recomputed) {
    blocked_by.push("content_hash_mismatch");
  }
  if (payload.authority_delta !== 0) {
    blocked_by.push("authority_delta_nonzero");
  }
  // Deep all-false boundary check (a vacuous {} must NOT pass — canonical key set, every value false).
  const canonicalKeys = Object.keys(demaVerifiedAnswerReceiptCachePreviewBoundary());
  const pb = payload.boundary;
  if (
    !pb ||
    typeof pb !== "object" ||
    Object.keys(pb).length !== canonicalKeys.length ||
    canonicalKeys.some((k) => pb[k] !== false)
  ) {
    blocked_by.push("boundary_not_all_false");
  }
  if (!CACHE_RECORD_STATUSES.includes(payload.status)) {
    blocked_by.push("unknown_status");
  }
  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: DEMA_VERIFIED_ANSWER_RECEIPT_CACHE_PREVIEW_SCHEMA,
    truth_label: DEMA_VERIFIED_ANSWER_RECEIPT_CACHE_PREVIEW_TRUTH_LABEL,
    content_hash,
    boundary: demaVerifiedAnswerReceiptCachePreviewBoundary(),
    blocked_by: Object.freeze(blocked_by),
  });
}

// ---- Domain API ------------------------------------------------------------

// Create a content-addressed VERIFIED cache record. Fail-closed: throws on any missing/invalid field.
export function createVerifiedAnswerRecord(input) {
  const blocks = cacheRecordInputBlocks(input);
  if (blocks.length > 0) {
    throw new Error(`invalid_cache_record_input:${blocks.join(",")}`);
  }
  return buildDemaVerifiedAnswerReceiptCachePreviewPayload(input);
}

// Body-bound integrity + invariant check for a record (alias of the kernel verifier).
export function verifyVerifiedAnswerRecord(record) {
  return verifyDemaVerifiedAnswerReceiptCachePreview(record);
}

// Freshness is compared against an INJECTED `now` — the kernel reads no clock.
export function compareFreshness(record, now) {
  if (!record || typeof record.expires_at !== "number" || typeof now !== "number") {
    return "unknown";
  }
  return now < record.expires_at ? "fresh" : "stale";
}

function lookupMiss(reason) {
  return Object.freeze({
    hit: false,
    reason,
    grants_action: false,
    authority_delta: 0,
    boundary: demaVerifiedAnswerReceiptCachePreviewBoundary(),
  });
}

// Reuse a prior verified answer ONLY when every gate passes. A hit reuses proof; it never grants action.
export function lookupVerifiedAnswer(query, cache) {
  if (!query || typeof query !== "object") return lookupMiss("query_not_object");
  if (!Array.isArray(cache)) return lookupMiss("cache_not_array");

  const wantQuestion = canonicalizeQuestion(query.canonical_question ?? "");
  const wantScope = query.consent_scope;
  const wantHashes = Array.isArray(query.source_hashes)
    ? [...query.source_hashes].sort()
    : null;
  const now = query.now;

  for (const record of cache) {
    if (!verifyVerifiedAnswerRecord(record).ok) continue; // integrity
    if (record.status !== "verified") continue; // candidate/stale/rejected/superseded never hit
    if (record.canonical_question !== wantQuestion) continue;
    if (compareFreshness(record, now) !== "fresh") continue; // stale never hits
    if (record.consent_scope !== wantScope) continue; // scope mismatch never hits
    // source-hash set equality (order-independent)
    const recordHashes = [...record.source_hashes].sort();
    if (
      !wantHashes ||
      recordHashes.length !== wantHashes.length ||
      recordHashes.some((h, i) => h !== wantHashes[i])
    ) {
      continue; // source-hash mismatch never hits
    }
    // private scope requires a matching operator consent token
    if (record.consent_scope.startsWith("private:")) {
      const owner = record.consent_scope.slice("private:".length);
      if (query.operator_consent !== owner) continue;
    }
    return Object.freeze({
      hit: true,
      reason: "verified_fresh_scoped",
      cache_id: record.cache_id,
      answer_digest: record.answer_digest,
      answer_summary: record.answer_summary,
      truth_label: DEMA_VERIFIED_ANSWER_RECEIPT_CACHE_PREVIEW_TRUTH_LABEL,
      grants_action: false, // a hit reuses proof; it never grants action
      authority_delta: 0,
      boundary: demaVerifiedAnswerReceiptCachePreviewBoundary(),
    });
  }
  return lookupMiss("no_matching_verified_fresh_scoped_record");
}

// Immutable supersede: returns a NEW version of the old record with status `superseded` and a pointer to the
// new record's cache_id; content_hash is re-derived so the superseded record still verifies as a legitimate version.
export function supersedeRecord(oldRecord, newRecord) {
  if (!oldRecord || typeof oldRecord !== "object") {
    throw new Error("supersede_requires_old_record");
  }
  if (!newRecord || typeof newRecord !== "object" || typeof newRecord.cache_id !== "string") {
    throw new Error("supersede_requires_new_record_with_cache_id");
  }
  const { content_hash: _drop, ...rest } = oldRecord;
  const body = {
    ...rest,
    status: "superseded",
    superseded_by: newRecord.cache_id,
    boundary: demaVerifiedAnswerReceiptCachePreviewBoundary(),
  };
  const content_hash = `sha256:${sha256(stableStringify(body))}`;
  return Object.freeze({ ...body, content_hash });
}

// Orchestrator the review gate consumes: plan -> build -> verify -> tamper-reject self-check.
export function runDemaVerifiedAnswerReceiptCachePreview({ consent, input } = {}) {
  const plan = planDemaVerifiedAnswerReceiptCachePreview({ consent, input });
  if (!plan.eligible) {
    return Object.freeze({
      ok: false,
      schema: DEMA_VERIFIED_ANSWER_RECEIPT_CACHE_PREVIEW_SCHEMA,
      truth_label: DEMA_VERIFIED_ANSWER_RECEIPT_CACHE_PREVIEW_TRUTH_LABEL,
      boundary: demaVerifiedAnswerReceiptCachePreviewBoundary(),
      blocked_by: plan.blocked_by,
    });
  }
  const payload = buildDemaVerifiedAnswerReceiptCachePreviewPayload(input);
  const verdict = verifyDemaVerifiedAnswerReceiptCachePreview(payload);
  const tampered = { ...payload, answer_digest: `sha256:${"0".repeat(64)}` };
  const tamperCaught = verifyDemaVerifiedAnswerReceiptCachePreview(tampered).ok === false;

  const blocked_by = [];
  if (!verdict.ok) blocked_by.push(...verdict.blocked_by);
  if (!tamperCaught) blocked_by.push("tamper_not_detected");

  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: DEMA_VERIFIED_ANSWER_RECEIPT_CACHE_PREVIEW_SCHEMA,
    truth_label: DEMA_VERIFIED_ANSWER_RECEIPT_CACHE_PREVIEW_TRUTH_LABEL,
    content_hash: payload.content_hash,
    cache_id: payload.cache_id,
    boundary: demaVerifiedAnswerReceiptCachePreviewBoundary(),
    blocked_by: Object.freeze(blocked_by),
  });
}
