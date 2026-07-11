import test from "node:test";
import assert from "node:assert/strict";

import {
  buildConsentContext,
  evaluateContextBoundConsent,
  runRootBoundConsentEnvelopePreview,
  rootBoundConsentEnvelopeBoundary,
  ROOT_BOUND_CONSENT_ENVELOPE_SCHEMA,
  ROOT_BOUND_CONSENT_EVAL_SCHEMA,
  ROOT_BOUND_CONSENT_TRUTH_LABEL,
  ACTION_CLASS_LADDER,
  EXPECTED_ENVELOPE_KEYS,
} from "../packages/consent/src/root-bound-consent-envelope-preview.js";
import { runRootBoundConsentEnvelopePreviewCheck } from "../scripts/review/root-bound-consent-envelope-preview-check.mjs";
import {
  buildPreviewBoundary,
  isCanonicalBoundary,
} from "../packages/core/src/boundary-schema.js";

// One well-formed consent-context input. The caller has already hashed the
// proposal, capability scope, payload, and root set; the kernel only ever binds
// those hashes (never the raw documents behind them).
const ENVELOPE_INPUT = {
  proposal_hash: `sha256:${"1".repeat(64)}`,
  action_class: "C1_READ",
  capability_scope_hash: `sha256:${"2".repeat(64)}`,
  payload_hash: `sha256:${"3".repeat(64)}`,
  root_set_hash: `sha256:${"4".repeat(64)}`,
  nonce: "nonce-abc-123",
  expires_at: "2026-07-11T12:00:00Z",
  required_phrase: "GO: dema root-bound consent envelope preview 1a",
};

const NOW_BEFORE = "2026-07-11T11:00:00Z";
const NOW_AT_EXPIRY = "2026-07-11T12:00:00Z";
const OTHER_HASH = `sha256:${"e".repeat(64)}`;

function presentedFrom(envelope, overrides = {}) {
  return {
    proposal_hash: envelope.proposal_hash,
    payload_hash: envelope.payload_hash,
    capability_scope_hash: envelope.capability_scope_hash,
    action_class: envelope.action_class,
    root_set_hash: envelope.root_set_hash,
    phrase: envelope.required_phrase,
    ...overrides,
  };
}

function evalWith(envelope, presentedOverrides = {}, { now = NOW_BEFORE, usedNonces = [] } = {}) {
  return evaluateContextBoundConsent({
    envelope,
    presented: presentedFrom(envelope, presentedOverrides),
    now,
    usedNonces,
  });
}

// --- invariants ---

test("boundary is the canonical all-false object (deep-equal, not vacuous)", () => {
  const boundary = rootBoundConsentEnvelopeBoundary();
  assert.deepEqual(boundary, buildPreviewBoundary());
  assert.ok(isCanonicalBoundary(boundary));
  for (const value of Object.values(boundary)) assert.equal(value, false);
});

test("every verdict carries authority_delta 0 and the canonical boundary", () => {
  const envelope = buildConsentContext(ENVELOPE_INPUT);
  const permit = evalWith(envelope);
  const block = evalWith(envelope, { phrase: "wrong" });
  for (const verdict of [permit, block]) {
    assert.equal(verdict.authority_delta, 0);
    assert.deepEqual(verdict.boundary, buildPreviewBoundary());
    assert.equal(verdict.schema, ROOT_BOUND_CONSENT_EVAL_SCHEMA);
  }
});

// --- positive ---

test("fully matching presented context, unused nonce, now < expiry → PERMIT_PREVIEW", () => {
  const envelope = buildConsentContext(ENVELOPE_INPUT);
  assert.equal(envelope.schema, ROOT_BOUND_CONSENT_ENVELOPE_SCHEMA);
  assert.equal(envelope.truth_label, ROOT_BOUND_CONSENT_TRUTH_LABEL);
  assert.match(envelope.consent_context_hash, /^sha256:[0-9a-f]{64}$/);

  const verdict = evalWith(envelope);
  assert.equal(verdict.accepted, true, verdict.reason);
  assert.equal(verdict.verdict, "PERMIT_PREVIEW");
  assert.deepEqual(verdict.blocked_by, []);
});

// --- fail-closed contract (one per case) ---

test("1: a phrase that is not an exact byte match BLOCKS", () => {
  const envelope = buildConsentContext(ENVELOPE_INPUT);
  const verdict = evalWith(envelope, { phrase: "GO: dema root-bound consent envelope preview 1A" });
  assert.equal(verdict.accepted, false);
  assert.equal(verdict.verdict, "BLOCK");
  assert.ok(verdict.blocked_by.includes("phrase_mismatch"));
});

test("2: same phrase but a different proposal_hash BLOCKS (replay against another proposal)", () => {
  const envelope = buildConsentContext(ENVELOPE_INPUT);
  const verdict = evalWith(envelope, { proposal_hash: OTHER_HASH });
  assert.equal(verdict.accepted, false);
  assert.ok(verdict.blocked_by.includes("proposal_hash_mismatch"));
});

test("3: same phrase but an altered payload_hash BLOCKS", () => {
  const envelope = buildConsentContext(ENVELOPE_INPUT);
  const verdict = evalWith(envelope, { payload_hash: OTHER_HASH });
  assert.equal(verdict.accepted, false);
  assert.ok(verdict.blocked_by.includes("payload_hash_mismatch"));
});

test("4: same phrase but a changed capability_scope_hash BLOCKS (scope expansion)", () => {
  const envelope = buildConsentContext(ENVELOPE_INPUT);
  const verdict = evalWith(envelope, { capability_scope_hash: OTHER_HASH });
  assert.equal(verdict.accepted, false);
  assert.ok(verdict.blocked_by.includes("capability_scope_hash_mismatch"));
});

test("5: a read consent (C1_READ) does not authorize a write (C3_LOCAL_WRITE)", () => {
  const envelope = buildConsentContext(ENVELOPE_INPUT);
  assert.equal(envelope.action_class, "C1_READ");
  const verdict = evalWith(envelope, { action_class: "C3_LOCAL_WRITE" });
  assert.equal(verdict.accepted, false);
  assert.ok(verdict.blocked_by.includes("action_class_mismatch"));
  assert.equal(verdict.escalation, true);
  // and the ladder is ordered as declared
  assert.ok(ACTION_CLASS_LADDER.indexOf("C3_LOCAL_WRITE") > ACTION_CLASS_LADDER.indexOf("C1_READ"));
});

test("5b: even a de-escalation (C1_READ envelope, C0_OBSERVE presented) BLOCKS (strict equality)", () => {
  const envelope = buildConsentContext(ENVELOPE_INPUT);
  const verdict = evalWith(envelope, { action_class: "C0_OBSERVE" });
  assert.equal(verdict.accepted, false);
  assert.ok(verdict.blocked_by.includes("action_class_mismatch"));
});

test("6: a tampered/missing presented root_set_hash BLOCKS", () => {
  const envelope = buildConsentContext(ENVELOPE_INPUT);
  const verdict = evalWith(envelope, { root_set_hash: OTHER_HASH });
  assert.equal(verdict.accepted, false);
  assert.ok(verdict.blocked_by.includes("root_set_hash_mismatch"));
});

test("6b: an envelope with an empty root_set_hash BLOCKS regardless of presented", () => {
  const envelope = buildConsentContext({ ...ENVELOPE_INPUT, root_set_hash: "" });
  const verdict = evaluateContextBoundConsent({
    envelope,
    presented: presentedFrom(envelope), // presented also "" — the missing-root check still fires
    now: NOW_BEFORE,
    usedNonces: [],
  });
  assert.equal(verdict.accepted, false);
  assert.ok(verdict.blocked_by.includes("root_set_missing"));
});

test("7: now >= expires_at BLOCKS (expired consent)", () => {
  const envelope = buildConsentContext(ENVELOPE_INPUT);
  const verdict = evalWith(envelope, {}, { now: NOW_AT_EXPIRY });
  assert.equal(verdict.accepted, false);
  assert.ok(verdict.blocked_by.includes("consent_expired"));
});

test("8: a nonce already in usedNonces BLOCKS (replay)", () => {
  const envelope = buildConsentContext(ENVELOPE_INPUT);
  const verdict = evalWith(envelope, {}, { usedNonces: ["nonce-abc-123"] });
  assert.equal(verdict.accepted, false);
  assert.ok(verdict.blocked_by.includes("nonce_replayed"));
});

test("9: any field mutated after the context hash was sealed BLOCKS (hash mismatch)", () => {
  const envelope = buildConsentContext(ENVELOPE_INPUT);
  // Move payload_hash on BOTH the envelope and the presented context so the
  // binding checks would pass — only the sealed consent_context_hash catches it.
  const mutated = { ...envelope, payload_hash: OTHER_HASH };
  const verdict = evaluateContextBoundConsent({
    envelope: mutated,
    presented: presentedFrom(mutated),
    now: NOW_BEFORE,
    usedNonces: [],
  });
  assert.equal(verdict.accepted, false);
  assert.ok(verdict.blocked_by.includes("consent_context_hash_mismatch"));
});

test("9b: a directly forged consent_context_hash BLOCKS", () => {
  const envelope = buildConsentContext(ENVELOPE_INPUT);
  const forged = { ...envelope, consent_context_hash: `sha256:${"0".repeat(64)}` };
  const verdict = evaluateContextBoundConsent({
    envelope: forged,
    presented: presentedFrom(forged),
    now: NOW_BEFORE,
    usedNonces: [],
  });
  assert.equal(verdict.accepted, false);
  assert.ok(verdict.blocked_by.includes("consent_context_hash_mismatch"));
});

test('10: a generic "/A" or "auto" phrase does NOT satisfy consent', () => {
  const envelope = buildConsentContext(ENVELOPE_INPUT);
  for (const phrase of ["/A", "auto", "A", "yes", "GO"]) {
    const verdict = evalWith(envelope, { phrase });
    assert.equal(verdict.accepted, false, `"${phrase}" must not permit`);
    assert.ok(verdict.blocked_by.includes("phrase_mismatch"));
  }
});

test("11: an envelope with an empty required_phrase BLOCKS (no vacuous consent)", () => {
  const envelope = buildConsentContext({ ...ENVELOPE_INPUT, required_phrase: "" });
  const verdict = evaluateContextBoundConsent({
    envelope,
    presented: presentedFrom(envelope),
    now: NOW_BEFORE,
    usedNonces: [],
  });
  assert.equal(verdict.accepted, false);
  assert.ok(verdict.blocked_by.includes("required_phrase_missing"));
});

test("12: an envelope with an empty nonce BLOCKS (no unbindable consent)", () => {
  const envelope = buildConsentContext({ ...ENVELOPE_INPUT, nonce: "" });
  const verdict = evaluateContextBoundConsent({
    envelope,
    presented: presentedFrom(envelope),
    now: NOW_BEFORE,
    usedNonces: [],
  });
  assert.equal(verdict.accepted, false);
  assert.ok(verdict.blocked_by.includes("nonce_missing"));
});

test("13: an envelope with an empty consent_context_hash BLOCKS (nothing to verify against)", () => {
  const envelope = buildConsentContext(ENVELOPE_INPUT);
  const stripped = { ...envelope, consent_context_hash: "" };
  const verdict = evaluateContextBoundConsent({
    envelope: stripped,
    presented: presentedFrom(stripped),
    now: NOW_BEFORE,
    usedNonces: [],
  });
  assert.equal(verdict.accepted, false);
  assert.ok(verdict.blocked_by.includes("consent_context_hash_missing"));
});

test("14: an unparseable `now` BLOCKS (fail closed on a bad clock, never open)", () => {
  const envelope = buildConsentContext(ENVELOPE_INPUT);
  const verdict = evalWith(envelope, {}, { now: "not-a-timestamp" });
  assert.equal(verdict.accepted, false);
  assert.ok(verdict.blocked_by.includes("now_invalid"));
});

test("15: an unparseable expires_at BLOCKS (fail closed, never treated as non-expiring)", () => {
  const envelope = buildConsentContext({ ...ENVELOPE_INPUT, expires_at: "whenever" });
  const verdict = evalWith(envelope);
  assert.equal(verdict.accepted, false);
  assert.ok(verdict.blocked_by.includes("expires_at_invalid"));
});

// --- determinism + content addressing ---

test("buildConsentContext is deterministic (identical input → deep-equal envelope + hash)", () => {
  const a = buildConsentContext(ENVELOPE_INPUT);
  const b = buildConsentContext({ ...ENVELOPE_INPUT });
  assert.deepEqual(a, b);
  assert.equal(a.consent_context_hash, b.consent_context_hash);
  assert.equal(a.phrase_hash, b.phrase_hash);
  assert.match(a.phrase_hash, /^sha256:[0-9a-f]{64}$/);
});

// --- secret / raw-document exclusion ---

test("envelope + verdict carry only hashes — no private key or raw root document text", () => {
  const envelope = buildConsentContext(ENVELOPE_INPUT);
  const verdict = evalWith(envelope);
  const forbidden = [
    "private_key",
    "BEGIN PRIVATE KEY",
    "BEGIN RSA PRIVATE KEY",
    "secret_key",
    "PRIVATE KEY-----",
  ];
  for (const blob of [JSON.stringify(envelope), JSON.stringify(verdict)]) {
    for (const needle of forbidden) {
      assert.ok(!blob.includes(needle), `must not leak ${needle}`);
    }
  }
  assert.deepEqual(Object.keys(envelope).sort(), [...EXPECTED_ENVELOPE_KEYS].sort());
});

test("smuggled input fields (private key, raw root body) are dropped from the envelope", () => {
  const envelope = buildConsentContext({
    ...ENVELOPE_INPUT,
    private_key: "-----BEGIN PRIVATE KEY-----leak-----END PRIVATE KEY-----",
    root_document_text: "SECRET_ROOT_DOCUMENT_BODY",
    extra: { nested: "SECRET_ROOT_DOCUMENT_BODY" },
  });
  const blob = JSON.stringify(envelope);
  assert.ok(!blob.includes("SECRET_ROOT_DOCUMENT_BODY"));
  assert.ok(!blob.includes("BEGIN PRIVATE KEY"));
  assert.ok(!("private_key" in envelope));
  assert.ok(!("root_document_text" in envelope));
  assert.ok(!("extra" in envelope));
});

// --- orchestrator + review gate ---

test("orchestrator permits the matched context and blocks a replay; boundary all-false", () => {
  const result = runRootBoundConsentEnvelopePreview({ input: ENVELOPE_INPUT, now: NOW_BEFORE, usedNonces: [] });
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.schema, ROOT_BOUND_CONSENT_EVAL_SCHEMA);
  assert.equal(result.authority_delta, 0);
  assert.deepEqual(result.boundary, buildPreviewBoundary());
});

test("review gate closes the loop: build → permit → replay-block", () => {
  const result = runRootBoundConsentEnvelopePreviewCheck();
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.schema, ROOT_BOUND_CONSENT_EVAL_SCHEMA);
  assert.equal(result.truth_label, ROOT_BOUND_CONSENT_TRUTH_LABEL);
});
