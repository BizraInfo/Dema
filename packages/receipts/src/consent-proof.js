// KEYCONSENT-1A · Pure Consent Proof Kernel
//
// Turns consent from a typed shibboleth into cryptographic
// proof-of-presence. Operator's act of consenting becomes a signed,
// scoped, time-bounded artifact that an external verifier can
// confirm came from the operator's key — not just from someone who
// knows a string.
//
// Reuses (no duplication):
// - signPayload, verifyPayload      packages/receipts/src/authorship-signature.js
// - loadPrivateKey, loadPublicKey   packages/receipts/src/authorship-key-store.js
// - sha256, stableStringify         packages/consent/src/consent-common.js
//
// Spec reference: docs/security/KEYCONSENT_PREFLIGHT.md (commit 68b9a78,
// remote-CI verified 2026-05-29).
//
// SCOPE (this slice):
// - Pure kernel functions only. No CLI, no integration with existing
//   gates, no nonce registry (replay protection is scope + expiration
//   only this slice; single-use nonce is KEYCONSENT-2).
// - No network, no federation, no token/mint, no economic claim, no
//   new authentication system live.

import { randomBytes, createPublicKey } from "node:crypto";
import { signPayload, verifyPayload } from "./authorship-signature.js";
import { loadPrivateKey, loadPublicKey } from "./authorship-key-store.js";
import { sha256, stableStringify } from "../../consent/src/consent-common.js";

export const CONSENT_PROOF_SCHEMA = "bizra.dema.consent_proof.v0.1";

const DEFAULT_EXPIRES_MINUTES = 5;
const REQUIRED_FIELDS = Object.freeze([
  "schema",
  "consent_phrase",
  "action_scope",
  "nonce",
  "created_at_iso",
  "expires_at_iso",
  "operator_public_key_fingerprint",
  "consent_signature_b64",
  "consent_proof_hash",
]);

function fingerprintFromPem(pubkeyPem) {
  const pk = createPublicKey(pubkeyPem);
  const der = pk.export({ type: "spki", format: "der" });
  return sha256(der.toString("hex"));
}

function isValidActionScope(s) {
  if (!s || typeof s !== "object" || Array.isArray(s)) return false;
  if (typeof s.action_type !== "string" || s.action_type.length === 0) {
    return false;
  }
  if (typeof s.target_hash !== "string" || s.target_hash.length === 0) {
    return false;
  }
  return true;
}

function fail(error) {
  return Object.freeze({ built: false, error });
}

export async function buildConsentProof({
  phrase,
  actionScope,
  demaHome,
  nonce,
  createdAtIso,
  expiresAtIso,
}) {
  if (typeof phrase !== "string" || phrase.length === 0) {
    return fail("consent_phrase_required");
  }
  if (!isValidActionScope(actionScope)) {
    return fail("action_scope_invalid");
  }

  const privateKeyPem = await loadPrivateKey(demaHome);
  if (!privateKeyPem) {
    return fail("no_authorship_key");
  }
  const publicKeyPem = await loadPublicKey(demaHome);

  const nonceHex =
    typeof nonce === "string" && nonce.length > 0
      ? nonce
      : randomBytes(32).toString("hex");

  const createdIso = createdAtIso || new Date().toISOString();
  const expiresIso =
    expiresAtIso ||
    new Date(
      new Date(createdIso).getTime() + DEFAULT_EXPIRES_MINUTES * 60 * 1000,
    ).toISOString();

  const fingerprint = fingerprintFromPem(publicKeyPem);

  // Stable body — basis for both signature and consent_proof_hash.
  // Excludes the two derived fields (consent_signature_b64,
  // consent_proof_hash) by construction.
  const stableBody = Object.freeze({
    schema: CONSENT_PROOF_SCHEMA,
    consent_phrase: phrase,
    action_scope: Object.freeze({
      action_type: actionScope.action_type,
      target_hash: actionScope.target_hash,
      ...(typeof actionScope.rule_id === "string" &&
      actionScope.rule_id.length > 0
        ? { rule_id: actionScope.rule_id }
        : {}),
    }),
    nonce: nonceHex,
    created_at_iso: createdIso,
    expires_at_iso: expiresIso,
    operator_public_key_fingerprint: fingerprint,
  });

  const signature = signPayload(stableBody, privateKeyPem);
  const consentProofHash = sha256(stableStringify(stableBody));

  const consentProof = Object.freeze({
    ...stableBody,
    consent_signature_b64: signature,
    consent_proof_hash: consentProofHash,
  });

  return Object.freeze({
    built: true,
    consent_proof: consentProof,
    signer_public_key_pem: publicKeyPem,
  });
}

function reject(reason) {
  return Object.freeze({
    verified: false,
    rejected: true,
    reason,
  });
}

export function verifyConsentProof({
  consentProof,
  pubkeyPem,
  expectedActionScope,
  now,
}) {
  // ── Structural validation ────────────────────────────────────────
  if (
    !consentProof ||
    typeof consentProof !== "object" ||
    Array.isArray(consentProof)
  ) {
    return reject("consent_proof_missing_or_malformed");
  }
  if (consentProof.schema !== CONSENT_PROOF_SCHEMA) {
    return reject("consent_proof_schema_mismatch");
  }
  for (const f of REQUIRED_FIELDS) {
    if (consentProof[f] === undefined || consentProof[f] === null) {
      return reject(`structural_missing_field_${f}`);
    }
  }
  if (
    typeof pubkeyPem !== "string" ||
    !pubkeyPem.includes("BEGIN PUBLIC KEY")
  ) {
    return reject("external_pubkey_required");
  }
  if (!isValidActionScope(consentProof.action_scope)) {
    return reject("structural_action_scope_invalid");
  }

  // ── (1) Recompute consent_proof_hash from stable body ────────────
  const { consent_signature_b64, consent_proof_hash, ...stableBody } =
    consentProof;
  const recomputedHash = sha256(stableStringify(stableBody));
  if (recomputedHash !== consent_proof_hash) {
    return reject("consent_proof_hash_mismatch");
  }

  // ── (2) Verify Ed25519 signature using ONLY external pubkey ──────
  // Same trust invariant as verdict-receipt REJECT-4: the consent
  // proof's own embedded operator_public_key_fingerprint is NOT
  // used for authority; the verifier brings its own external pubkey.
  let sigValid;
  try {
    sigValid = verifyPayload(stableBody, consent_signature_b64, pubkeyPem);
  } catch {
    sigValid = false;
  }
  if (!sigValid) {
    return reject("consent_signature_invalid");
  }

  // ── (3) Scope match (if expected provided) ───────────────────────
  if (expectedActionScope) {
    if (
      expectedActionScope.action_type !== consentProof.action_scope.action_type
    ) {
      return reject("consent_scope_mismatch");
    }
    if (
      expectedActionScope.target_hash !== consentProof.action_scope.target_hash
    ) {
      return reject("consent_scope_mismatch");
    }
  }

  // ── (4) Freshness ────────────────────────────────────────────────
  // Verifier uses its own clock; created_at_iso is a CLAIM, expires
  // is bounded against caller-injected now (or current wall clock).
  const nowIso = now || new Date().toISOString();
  if (nowIso > consentProof.expires_at_iso) {
    return reject("consent_expired");
  }

  return Object.freeze({
    verified: true,
    consent_proof_hash,
    action_scope: consentProof.action_scope,
    operator_public_key_fingerprint:
      consentProof.operator_public_key_fingerprint,
  });
}
