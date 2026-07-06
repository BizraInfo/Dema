import test from "node:test";
import assert from "node:assert/strict";

import {
  planDemaVerifiedAnswerReceiptCachePreview,
  buildDemaVerifiedAnswerReceiptCachePreviewPayload,
  verifyDemaVerifiedAnswerReceiptCachePreview,
  runDemaVerifiedAnswerReceiptCachePreview,
  createVerifiedAnswerRecord,
  verifyVerifiedAnswerRecord,
  lookupVerifiedAnswer,
  compareFreshness,
  supersedeRecord,
  CACHE_RECORD_STATUSES,
  DEMA_VERIFIED_ANSWER_RECEIPT_CACHE_PREVIEW_SCHEMA,
  DEMA_VERIFIED_ANSWER_RECEIPT_CACHE_PREVIEW_TRUTH_LABEL,
  DEMA_VERIFIED_ANSWER_RECEIPT_CACHE_PREVIEW_GO_PHRASE,
} from "../packages/core/src/dema-verified-answer-receipt-cache-preview.js";
import { runDemaVerifiedAnswerReceiptCachePreviewCheck } from "../scripts/review/dema-verified-answer-receipt-cache-preview-check.mjs";

const HASH_A = `sha256:${"a".repeat(64)}`;
const HASH_C = `sha256:${"c".repeat(64)}`;

const BASE_INPUT = {
  canonical_question: "What is the IHSAN floor?",
  answer: "The IHSAN floor is 0.95.",
  answer_summary: "IHSAN floor = 0.95",
  source_refs: ["core/integration/constants.py"],
  source_hashes: [HASH_A],
  consent_scope: "public",
  freshness_policy: { ttl_ms: 86_400_000 },
  created_at: 1_751_800_000_000,
};

function baseQuery(overrides = {}) {
  return {
    canonical_question: BASE_INPUT.canonical_question,
    consent_scope: "public",
    source_hashes: [HASH_A],
    now: BASE_INPUT.created_at + 1_000,
    ...overrides,
  };
}

// ---- scaffold contract (plan / build / verify / run / gate) ----------------

test("plan is fail-closed without the exact consent phrase", () => {
  const plan = planDemaVerifiedAnswerReceiptCachePreview({ consent: "wrong", input: BASE_INPUT });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("consent_phrase_mismatch"));
});

test("plan is eligible with exact consent and well-formed input", () => {
  const plan = planDemaVerifiedAnswerReceiptCachePreview({
    consent: DEMA_VERIFIED_ANSWER_RECEIPT_CACHE_PREVIEW_GO_PHRASE,
    input: BASE_INPUT,
  });
  assert.equal(plan.eligible, true, plan.blocked_by.join(", "));
});

test("plan pushes a named block for each missing input field", () => {
  const plan = planDemaVerifiedAnswerReceiptCachePreview({
    consent: DEMA_VERIFIED_ANSWER_RECEIPT_CACHE_PREVIEW_GO_PHRASE,
    input: {},
  });
  assert.equal(plan.eligible, false);
  for (const code of [
    "missing_canonical_question",
    "missing_answer",
    "missing_source_refs",
    "missing_source_hashes",
    "missing_consent_scope",
    "missing_or_invalid_freshness_policy",
    "missing_created_at",
  ]) {
    assert.ok(plan.blocked_by.includes(code), `expected ${code}`);
  }
});

test("plan flags a source_refs/source_hashes length mismatch", () => {
  const plan = planDemaVerifiedAnswerReceiptCachePreview({
    consent: DEMA_VERIFIED_ANSWER_RECEIPT_CACHE_PREVIEW_GO_PHRASE,
    input: { ...BASE_INPUT, source_hashes: [HASH_A, HASH_C] },
  });
  assert.ok(plan.blocked_by.includes("source_refs_hashes_length_mismatch"));
});

test("payload is content-addressed and carries an all-false boundary", () => {
  const payload = buildDemaVerifiedAnswerReceiptCachePreviewPayload(BASE_INPUT);
  assert.equal(payload.schema, DEMA_VERIFIED_ANSWER_RECEIPT_CACHE_PREVIEW_SCHEMA);
  assert.equal(payload.truth_label, DEMA_VERIFIED_ANSWER_RECEIPT_CACHE_PREVIEW_TRUTH_LABEL);
  assert.match(payload.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(payload.boundary.execution_allowed, false);
  assert.equal(payload.boundary.live_execution_performed, false);
});

test("verify accepts a freshly built payload", () => {
  const payload = buildDemaVerifiedAnswerReceiptCachePreviewPayload(BASE_INPUT);
  assert.equal(verifyDemaVerifiedAnswerReceiptCachePreview(payload).ok, true);
});

test("verify rejects a non-object and a tampered content_hash", () => {
  assert.equal(verifyDemaVerifiedAnswerReceiptCachePreview(null).ok, false);
  const payload = buildDemaVerifiedAnswerReceiptCachePreviewPayload(BASE_INPUT);
  const tampered = { ...payload, content_hash: `sha256:${"0".repeat(64)}` };
  assert.equal(verifyDemaVerifiedAnswerReceiptCachePreview(tampered).ok, false);
});

test("verify rejects a field change that did not update the content_hash", () => {
  const payload = buildDemaVerifiedAnswerReceiptCachePreviewPayload(BASE_INPUT);
  const forged = { ...payload, truth_label: "FORGED" };
  const verdict = verifyDemaVerifiedAnswerReceiptCachePreview(forged);
  assert.equal(verdict.ok, false);
  assert.ok(verdict.blocked_by.includes("content_hash_mismatch"));
});

test("verify rejects authority_delta != 0, a vacuous/flipped boundary, and an unknown status", () => {
  const payload = buildDemaVerifiedAnswerReceiptCachePreviewPayload(BASE_INPUT);
  assert.equal(verifyDemaVerifiedAnswerReceiptCachePreview({ ...payload, authority_delta: 1 }).ok, false);
  // vacuous {} boundary must NOT pass (non-vacuous deep key check)
  assert.ok(
    verifyDemaVerifiedAnswerReceiptCachePreview({ ...payload, boundary: {} }).blocked_by.includes(
      "boundary_not_all_false",
    ),
  );
  assert.ok(
    verifyDemaVerifiedAnswerReceiptCachePreview({
      ...payload,
      boundary: { ...payload.boundary, token_minted: true },
    }).blocked_by.includes("boundary_not_all_false"),
  );
  assert.ok(
    verifyDemaVerifiedAnswerReceiptCachePreview({ ...payload, status: "nonsense" }).blocked_by.includes(
      "unknown_status",
    ),
  );
});

test("review gate closes the loop: build -> verify -> tamper-reject", () => {
  const result = runDemaVerifiedAnswerReceiptCachePreviewCheck();
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.schema, DEMA_VERIFIED_ANSWER_RECEIPT_CACHE_PREVIEW_SCHEMA);
  assert.equal(result.truth_label, DEMA_VERIFIED_ANSWER_RECEIPT_CACHE_PREVIEW_TRUTH_LABEL);
});

test("orchestrator is fail-closed on bad consent and all-false on success", () => {
  const blocked = runDemaVerifiedAnswerReceiptCachePreview({ consent: "no", input: BASE_INPUT });
  assert.equal(blocked.ok, false);
  assert.ok(blocked.blocked_by.includes("consent_phrase_mismatch"));
  const ok = runDemaVerifiedAnswerReceiptCachePreview({
    consent: DEMA_VERIFIED_ANSWER_RECEIPT_CACHE_PREVIEW_GO_PHRASE,
    input: BASE_INPUT,
  });
  assert.equal(ok.ok, true, ok.blocked_by?.join(", "));
  assert.equal(ok.boundary.execution_allowed, false);
  assert.equal(ok.boundary.live_execution_performed, false);
});

// ---- domain contract (the 12 operator cases) -------------------------------

test("creates a deterministic verified record", () => {
  const r1 = createVerifiedAnswerRecord(BASE_INPUT);
  const r2 = createVerifiedAnswerRecord(BASE_INPUT);
  assert.equal(r1.status, "verified");
  assert.equal(r1.authority_delta, 0);
  assert.match(r1.cache_id, /^sha256:[0-9a-f]{64}$/);
  assert.equal(r1.content_hash, r2.content_hash);
  assert.equal(r1.expires_at, BASE_INPUT.created_at + BASE_INPUT.freshness_policy.ttl_ms);
  assert.equal(verifyVerifiedAnswerRecord(r1).ok, true);
});

test("rejects missing source refs", () => {
  assert.throws(
    () => createVerifiedAnswerRecord({ ...BASE_INPUT, source_refs: undefined }),
    /missing_source_refs/,
  );
});

test("rejects missing consent scope", () => {
  assert.throws(
    () => createVerifiedAnswerRecord({ ...BASE_INPUT, consent_scope: undefined }),
    /missing_consent_scope/,
  );
});

test("rejects a forged answer digest (content_hash no longer binds)", () => {
  const rec = createVerifiedAnswerRecord(BASE_INPUT);
  const forged = { ...rec, answer_digest: `sha256:${"b".repeat(64)}` };
  const verdict = verifyVerifiedAnswerRecord(forged);
  assert.equal(verdict.ok, false);
  assert.ok(verdict.blocked_by.includes("content_hash_mismatch"));
});

test("lookup returns a verified, fresh, in-scope, hash-matched record", () => {
  const rec = createVerifiedAnswerRecord(BASE_INPUT);
  const result = lookupVerifiedAnswer(baseQuery(), [rec]);
  assert.equal(result.hit, true);
  assert.equal(result.reason, "verified_fresh_scoped");
  assert.equal(result.answer_digest, rec.answer_digest);
  assert.equal(result.grants_action, false);
});

test("lookup refuses a stale record", () => {
  const rec = createVerifiedAnswerRecord(BASE_INPUT);
  const result = lookupVerifiedAnswer(baseQuery({ now: rec.expires_at + 1 }), [rec]);
  assert.equal(result.hit, false);
  assert.equal(result.reason, "no_matching_verified_fresh_scoped_record");
});

test("lookup refuses a consent-scope mismatch", () => {
  const rec = createVerifiedAnswerRecord(BASE_INPUT);
  const result = lookupVerifiedAnswer(baseQuery({ consent_scope: "private:mumu" }), [rec]);
  assert.equal(result.hit, false);
});

test("lookup refuses a source-hash mismatch", () => {
  const rec = createVerifiedAnswerRecord(BASE_INPUT);
  const result = lookupVerifiedAnswer(baseQuery({ source_hashes: [HASH_C] }), [rec]);
  assert.equal(result.hit, false);
});

test("lookup enforces operator consent for a private scope", () => {
  const rec = createVerifiedAnswerRecord({ ...BASE_INPUT, consent_scope: "private:mumu" });
  const q = { canonical_question: BASE_INPUT.canonical_question, consent_scope: "private:mumu", source_hashes: [HASH_A], now: BASE_INPUT.created_at + 1 };
  assert.equal(lookupVerifiedAnswer({ ...q }, [rec]).hit, false); // no operator_consent
  assert.equal(lookupVerifiedAnswer({ ...q, operator_consent: "mumu" }, [rec]).hit, true); // matching consent
});

test("supersede marks the old record superseded and it never hits again", () => {
  const oldRec = createVerifiedAnswerRecord(BASE_INPUT);
  const newRec = createVerifiedAnswerRecord({ ...BASE_INPUT, answer: "The IHSAN floor is 0.95 (v2).", created_at: BASE_INPUT.created_at + 10 });
  const superseded = supersedeRecord(oldRec, newRec);
  assert.equal(superseded.status, "superseded");
  assert.equal(superseded.superseded_by, newRec.cache_id);
  assert.equal(verifyVerifiedAnswerRecord(superseded).ok, true); // still a legitimate version
  // integrity-valid but non-verified status → proves the status gate, not just integrity
  assert.equal(lookupVerifiedAnswer(baseQuery(), [superseded]).hit, false);
  assert.throws(() => supersedeRecord(null, newRec), /supersede_requires_old_record/);
  assert.throws(() => supersedeRecord(oldRec, {}), /supersede_requires_new_record_with_cache_id/);
});

test("a rejected record never hits", () => {
  const rec = createVerifiedAnswerRecord(BASE_INPUT);
  const rejected = { ...rec, status: "rejected" };
  assert.ok(CACHE_RECORD_STATUSES.includes("rejected"));
  assert.equal(lookupVerifiedAnswer(baseQuery(), [rejected]).hit, false);
});

test("authority_delta stays 0 across create, hit, and supersede", () => {
  const rec = createVerifiedAnswerRecord(BASE_INPUT);
  assert.equal(rec.authority_delta, 0);
  assert.equal(lookupVerifiedAnswer(baseQuery(), [rec]).authority_delta, 0);
  const newRec = createVerifiedAnswerRecord({ ...BASE_INPUT, answer: "v2" });
  assert.equal(supersedeRecord(rec, newRec).authority_delta, 0);
});

test("no mint / URP / federation field can become true", () => {
  const rec = createVerifiedAnswerRecord(BASE_INPUT);
  const b = rec.boundary;
  assert.ok(Object.keys(b).length >= 8);
  assert.ok(Object.values(b).every((v) => v === false));
  assert.equal(b.token_minted, false);
  assert.equal(rec.grants_action, false);
  assert.equal(rec.token_minted, undefined);
  assert.equal(rec.urp, undefined);
  assert.equal(rec.federation, undefined);
  // verify catches a boundary flipped to a mint claim
  assert.equal(verifyVerifiedAnswerRecord({ ...rec, boundary: { ...b, token_minted: true } }).ok, false);
});

test("compareFreshness returns unknown on a malformed record or now", () => {
  assert.equal(compareFreshness(null, 1), "unknown");
  assert.equal(compareFreshness({ expires_at: 10 }, "not-a-number"), "unknown");
  assert.equal(compareFreshness({ expires_at: 10 }, 5), "fresh");
  assert.equal(compareFreshness({ expires_at: 10 }, 20), "stale");
});

test("lookup is fail-closed on a malformed query or cache", () => {
  assert.equal(lookupVerifiedAnswer(null, []).hit, false);
  assert.equal(lookupVerifiedAnswer(baseQuery(), "not-an-array").hit, false);
});
