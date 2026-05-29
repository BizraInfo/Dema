// Rule: consent_proof_replay_verification.v0.1
//
// PURE function: evaluate(input) -> { score, computed }.
// No I/O, no Date.now, no Math.random, no network, no global state.
// Re-derivable: a stranger holding only this file + the input object
// can reconstruct the score bit-for-bit. Mirrors the purity discipline
// of rule-canonical-shape.v0.1.
//
// Input shape (all caller-injected; rule reads no ambient state):
//   {
//     consent_proofs:      array of KEYCONSENT-1A consent_proof envelopes,
//     verifier_pubkey_pem: PEM string (external authority for signature),
//     verifier_now_iso:    ISO-8601 string (injected clock for freshness)
//   }
//
// Output shape:
//   {
//     score:    number in [0,1],
//     computed: {
//       attempted:          int,
//       verified:           int,
//       verifier_breakdown: array of {consent_proof_hash, verified, reason?}
//                           (deterministic order = input order)
//     }
//   }
//
// Error envelope (fail-closed, per POI_0_PREFLIGHT.md §9 + task contract):
//   { verdict: "error", score: 0, computed: { error: "<reason>" } }
// Reasons:
//   - input_shape_invalid       (input not an object, or consent_proofs not array)
//   - verifier_pubkey_required  (missing/empty verifier_pubkey_pem)
//   - verifier_now_iso_required (missing/empty verifier_now_iso)
//
// Score: attempted > 0 ? clamp01(verified / attempted) : 0.
// Empty input array is an explicit zero, NOT an error — divide-by-zero
// is collapsed to 0 per preflight §9.
//
// Per-proof verifier (inline minimal replay): a consent_proof is
// considered `verified: true` iff it passes — in this order —
//   (1) structural envelope check (object + schema + required fields),
//   (2) recomputed consent_proof_hash matches embedded hash,
//   (3) Ed25519 signature over stable body verifies against the
//       caller-supplied verifier_pubkey_pem (NOT the embedded fingerprint),
//   (4) freshness: verifier_now_iso <= expires_at_iso.
// The reasons surfaced match KEYCONSENT-1A's verifier vocabulary so a
// reader of either module learns the same failure language.

import { verifyPayload } from "../../receipts/src/authorship-signature.js";
import { sha256, stableStringify } from "../../consent/src/consent-common.js";

export const RULE_ID = "consent_proof_replay_verification.v0.1";

const CONSENT_PROOF_SCHEMA = "bizra.dema.consent_proof.v0.1";

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

function errorEnvelope(error) {
  return Object.freeze({
    verdict: "error",
    score: 0,
    computed: Object.freeze({ error }),
  });
}

function clamp01(n) {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function rowVerified(hash) {
  return Object.freeze({ consent_proof_hash: hash, verified: true });
}

function rowRejected(hash, reason) {
  return Object.freeze({
    consent_proof_hash: hash,
    verified: false,
    reason,
  });
}

// Per-proof minimal replay. Pure: only reads cp, pubkeyPem, nowIso.
function verifyOne(cp, pubkeyPem, nowIso) {
  // (1) Structural
  if (!cp || typeof cp !== "object" || Array.isArray(cp)) {
    return rowRejected("", "consent_proof_missing_or_malformed");
  }
  const claimedHash =
    typeof cp.consent_proof_hash === "string" ? cp.consent_proof_hash : "";
  if (cp.schema !== CONSENT_PROOF_SCHEMA) {
    return rowRejected(claimedHash, "consent_proof_schema_mismatch");
  }
  for (const f of REQUIRED_FIELDS) {
    if (cp[f] === undefined || cp[f] === null) {
      return rowRejected(claimedHash, `structural_missing_field_${f}`);
    }
  }
  if (
    !cp.action_scope ||
    typeof cp.action_scope !== "object" ||
    Array.isArray(cp.action_scope) ||
    typeof cp.action_scope.action_type !== "string" ||
    cp.action_scope.action_type.length === 0 ||
    typeof cp.action_scope.target_hash !== "string" ||
    cp.action_scope.target_hash.length === 0
  ) {
    return rowRejected(claimedHash, "structural_action_scope_invalid");
  }

  // (2) Hash recompute over stable body (everything except sig + hash field).
  const { consent_signature_b64, consent_proof_hash, ...stableBody } = cp;
  const recomputed = sha256(stableStringify(stableBody));
  if (recomputed !== consent_proof_hash) {
    return rowRejected(claimedHash, "consent_proof_hash_mismatch");
  }

  // (3) Signature against EXTERNAL pubkey (verifier_pubkey_pem). The
  //     embedded operator_public_key_fingerprint is a CLAIM and is NOT
  //     used for authority — same invariant as KEYCONSENT-1A and the
  //     verdict-receipt REJECT-4 rule.
  let sigValid;
  try {
    sigValid = verifyPayload(stableBody, consent_signature_b64, pubkeyPem);
  } catch {
    sigValid = false;
  }
  if (!sigValid) {
    return rowRejected(claimedHash, "consent_signature_invalid");
  }

  // (4) Freshness against caller-injected verifier clock.
  if (nowIso > cp.expires_at_iso) {
    return rowRejected(claimedHash, "consent_expired");
  }

  return rowVerified(claimedHash);
}

export function evaluate(input) {
  // ── Input-shape gates ────────────────────────────────────────────
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return errorEnvelope("input_shape_invalid");
  }
  if (!Array.isArray(input.consent_proofs)) {
    return errorEnvelope("input_shape_invalid");
  }
  if (
    typeof input.verifier_pubkey_pem !== "string" ||
    input.verifier_pubkey_pem.length === 0
  ) {
    return errorEnvelope("verifier_pubkey_required");
  }
  if (
    typeof input.verifier_now_iso !== "string" ||
    input.verifier_now_iso.length === 0
  ) {
    return errorEnvelope("verifier_now_iso_required");
  }

  // ── Per-proof replay, input order preserved ──────────────────────
  const breakdown = [];
  let verified = 0;
  for (const cp of input.consent_proofs) {
    const row = verifyOne(
      cp,
      input.verifier_pubkey_pem,
      input.verifier_now_iso,
    );
    breakdown.push(row);
    if (row.verified) verified += 1;
  }

  const attempted = input.consent_proofs.length;
  const score = attempted > 0 ? clamp01(verified / attempted) : 0;

  return Object.freeze({
    score,
    computed: Object.freeze({
      attempted,
      verified,
      verifier_breakdown: Object.freeze(breakdown),
    }),
  });
}
