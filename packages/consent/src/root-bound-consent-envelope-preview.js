// DEMA-ROOT-BOUND-CONSENT-ENVELOPE-PREVIEW-1A — PREVIEW_ONLY consent-context
// envelope + fail-closed validator.
//
// PREVIEW_ONLY. This kernel BINDS an exact consent phrase to the exact action
// context (proposal, payload, capability scope, root set, action class, nonce,
// expiry) so a valid phrase cannot be replayed against a different payload,
// mission, action class, or scope. It RECORDS/VALIDATES a consent binding ONLY.
// It runs no optimizer, invokes no model, opens no network, performs no live
// mutation, mints nothing, and binds no identity.
//
// Core law: a consent phrase authorizes exactly one action context — nothing else.
//
// Pure kernel: no fs / net / http / child_process / fetch, no Date.now, no
// Math.random. Effects are injected: the caller passes `nonce` and `expires_at`
// (and `now` at evaluation) explicitly. Time comparison uses Date.parse over
// caller-supplied RFC3339 strings — a pure parse, not a clock read. Content
// addressing uses node:crypto (universal). Boundary is the canonical all-false
// preview boundary; every claim is a preview.

import { createHash } from "node:crypto";

import {
  buildPreviewBoundary,
} from "../../core/src/boundary-schema.js";

export const ROOT_BOUND_CONSENT_ENVELOPE_SCHEMA = "bizra.consent.context.v0.1";
export const ROOT_BOUND_CONSENT_EVAL_SCHEMA = "bizra.consent.context_eval.v0.1";
export const ROOT_BOUND_CONSENT_TRUTH_LABEL = "PREVIEW_ONLY";

// Ordered action-class ladder. A consent binds exactly one class: presented must
// equal the envelope class (strict) — a read consent never authorizes a write.
export const ACTION_CLASS_LADDER = Object.freeze([
  "C0_OBSERVE",
  "C1_READ",
  "C2_DRAFT",
  "C3_LOCAL_WRITE",
  "C4_EXTERNAL",
  "C5_IRREVERSIBLE",
]);

// The whitelisted envelope key set. Anything else in the input is dropped (no
// smuggling of raw secrets / root-document text into the hashed body).
export const EXPECTED_ENVELOPE_KEYS = Object.freeze([
  "schema",
  "truth_label",
  "proposal_hash",
  "action_class",
  "capability_scope_hash",
  "payload_hash",
  "root_set_hash",
  "nonce",
  "expires_at",
  "required_phrase",
  "phrase_hash",
  "consent_context_hash",
]);

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function hashText(value) {
  return `sha256:${sha256(String(value))}`;
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashBody(body) {
  return `sha256:${sha256(stableStringify(body))}`;
}

function str(value) {
  if (typeof value === "string") return value;
  return value == null ? "" : String(value);
}

// All-false canonical preview boundary. Recording/validating a consent binding is
// never executing it — every effect key stays false.
export function rootBoundConsentEnvelopeBoundary() {
  return buildPreviewBoundary();
}

// Content-addressed consent-context envelope. Only whitelisted fields are carried
// (no smuggled keys). phrase_hash and consent_context_hash are DERIVED, never
// caller-supplied — the hash binds the whole body, not a circular self-reference.
// Deterministic: identical input → deep-equal envelope + identical hash.
export function buildConsentContext(input = {}) {
  const e = input && typeof input === "object" ? input : {};
  const required_phrase = str(e.required_phrase);
  const body = {
    schema: ROOT_BOUND_CONSENT_ENVELOPE_SCHEMA,
    truth_label: ROOT_BOUND_CONSENT_TRUTH_LABEL,
    proposal_hash: str(e.proposal_hash),
    action_class: str(e.action_class),
    capability_scope_hash: str(e.capability_scope_hash),
    payload_hash: str(e.payload_hash),
    root_set_hash: str(e.root_set_hash),
    nonce: str(e.nonce),
    expires_at: str(e.expires_at),
    required_phrase,
    phrase_hash: hashText(required_phrase),
  };
  const consent_context_hash = hashBody(body);
  return Object.freeze({ ...body, consent_context_hash });
}

// Re-derive the sealed context hash from the envelope body minus its derived hash
// field. Any field mutated after sealing (or an extra smuggled key) breaks this.
function recomputeContextHash(envelope) {
  const { consent_context_hash: _drop, ...body } = envelope;
  return hashBody(body);
}

// Fail-closed, context-bound consent evaluation. `presented` carries what the
// caller is ACTUALLY about to do; every binding must hold or the verdict BLOCKS.
// Returns { schema, accepted, verdict, reason, blocked_by, escalation, boundary,
// authority_delta }. authority_delta is always 0 — evaluating consent grants no
// authority.
export function evaluateContextBoundConsent({ envelope, presented, now, usedNonces = [] } = {}) {
  const boundary = rootBoundConsentEnvelopeBoundary();
  const blocked_by = [];
  let escalation = false;

  const env = envelope && typeof envelope === "object" ? envelope : null;
  const pres = presented && typeof presented === "object" ? presented : null;
  if (!env) blocked_by.push("envelope_invalid");
  if (!pres) blocked_by.push("presented_invalid");

  if (env && pres) {
    // Consent phrase must exist and match byte-for-byte. Fuzzy / "auto" / "/A"
    // style phrases fail here (they are not the exact required phrase).
    if (str(env.required_phrase).length === 0) blocked_by.push("required_phrase_missing");
    if (str(env.nonce).length === 0) blocked_by.push("nonce_missing");
    if (str(env.root_set_hash).length === 0) blocked_by.push("root_set_missing");

    // Integrity first: the sealed context hash must re-derive from the body.
    if (str(env.consent_context_hash).length === 0) {
      blocked_by.push("consent_context_hash_missing");
    } else if (recomputeContextHash(env) !== env.consent_context_hash) {
      blocked_by.push("consent_context_hash_mismatch");
    }

    // Exact-phrase consent.
    if (str(pres.phrase) !== str(env.required_phrase)) blocked_by.push("phrase_mismatch");

    // Context bindings — the phrase authorizes exactly THIS context.
    if (str(pres.proposal_hash) !== str(env.proposal_hash)) blocked_by.push("proposal_hash_mismatch");
    if (str(pres.payload_hash) !== str(env.payload_hash)) blocked_by.push("payload_hash_mismatch");
    if (str(pres.capability_scope_hash) !== str(env.capability_scope_hash)) {
      blocked_by.push("capability_scope_hash_mismatch");
    }
    if (str(pres.root_set_hash) !== str(env.root_set_hash)) blocked_by.push("root_set_hash_mismatch");

    // Action-class ladder — strict equality; a read consent never permits a write.
    const envRank = ACTION_CLASS_LADDER.indexOf(str(env.action_class));
    const presRank = ACTION_CLASS_LADDER.indexOf(str(pres.action_class));
    if (envRank === -1) blocked_by.push("action_class_invalid_envelope");
    if (presRank === -1) blocked_by.push("action_class_invalid_presented");
    if (str(pres.action_class) !== str(env.action_class)) blocked_by.push("action_class_mismatch");
    escalation = envRank !== -1 && presRank !== -1 && presRank > envRank;

    // Expiry — parse RFC3339, fail closed on unparseable or expired consent.
    const nowMs = Date.parse(str(now));
    const expMs = Date.parse(str(env.expires_at));
    if (Number.isNaN(nowMs)) blocked_by.push("now_invalid");
    if (Number.isNaN(expMs)) blocked_by.push("expires_at_invalid");
    if (!Number.isNaN(nowMs) && !Number.isNaN(expMs) && nowMs >= expMs) {
      blocked_by.push("consent_expired");
    }

    // Nonce replay — a reused nonce is a replay.
    const used = usedNonces instanceof Set
      ? usedNonces
      : new Set(Array.isArray(usedNonces) ? usedNonces : []);
    if (used.has(str(env.nonce))) blocked_by.push("nonce_replayed");
  }

  const accepted = blocked_by.length === 0;
  return Object.freeze({
    schema: ROOT_BOUND_CONSENT_EVAL_SCHEMA,
    truth_label: ROOT_BOUND_CONSENT_TRUTH_LABEL,
    accepted,
    verdict: accepted ? "PERMIT_PREVIEW" : "BLOCK",
    reason: accepted ? "context_bound_consent_permitted" : blocked_by[0],
    blocked_by: Object.freeze(blocked_by),
    escalation,
    boundary,
    authority_delta: 0,
  });
}

// Orchestrator the review gate consumes: build the envelope, permit the exactly
// matched context, then self-probe that a replay against a different payload is
// blocked. Boundary stays all-false; authority_delta stays 0.
export function runRootBoundConsentEnvelopePreview({ input, now, usedNonces = [] } = {}) {
  const boundary = rootBoundConsentEnvelopeBoundary();
  const base = {
    schema: ROOT_BOUND_CONSENT_EVAL_SCHEMA,
    truth_label: ROOT_BOUND_CONSENT_TRUTH_LABEL,
    boundary,
    authority_delta: 0,
  };

  const envelope = buildConsentContext(input);
  const matched = {
    proposal_hash: envelope.proposal_hash,
    payload_hash: envelope.payload_hash,
    capability_scope_hash: envelope.capability_scope_hash,
    action_class: envelope.action_class,
    root_set_hash: envelope.root_set_hash,
    phrase: envelope.required_phrase,
  };

  const permit = evaluateContextBoundConsent({ envelope, presented: matched, now, usedNonces });
  if (!permit.accepted) {
    return Object.freeze({
      ...base,
      ok: false,
      blocked_by: Object.freeze(["matched_context_not_permitted", ...permit.blocked_by]),
    });
  }

  // Closed-loop self-check: the same phrase against a different payload MUST block
  // or the validator is not fail-closed.
  const replay = evaluateContextBoundConsent({
    envelope,
    presented: { ...matched, payload_hash: `sha256:${"e".repeat(64)}` },
    now,
    usedNonces,
  });
  if (replay.accepted) {
    return Object.freeze({ ...base, ok: false, blocked_by: Object.freeze(["replay_not_blocked"]) });
  }

  return Object.freeze({
    ...base,
    ok: true,
    verdict: permit.verdict,
    consent_context_hash: envelope.consent_context_hash,
    blocked_by: Object.freeze([]),
  });
}
