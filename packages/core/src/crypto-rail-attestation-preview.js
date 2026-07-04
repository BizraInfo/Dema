// Cryptographic-rail attestation preview v0.1 — NODE0-CRYPTO-RAIL-ATTEST-1A.
//
// PREVIEW_ONLY · NOT runtime · NOT a live signing service.
//
// Purpose: let a single proof-of-truth convergence claim raise its
// CRYPTOGRAPHIC rail from `schema_only` (level 1) to `local_signed` (level 4)
// — but ONLY when an actual Ed25519 signature, bound to the claim's canonical
// body, verifies. This kernel derives the evidence token; it never asserts it.
//
// No-overclaim (Ihsān · Law of Assumption): the token is DERIVED from a real
// verification outcome. Every failure path — no attestation, missing verifier,
// leaked key material, wrong key, tampered body, verifier error — fails CLOSED
// to `schema_only`. No claim sits above its evidence. A forged or absent
// signature can never lift the rail.
//
// Body-binding (lesson from #253/#254): the signature is verified against a
// payload DERIVED from the claim via `buildClaimAttestationPayload`, not
// against caller-supplied text. Tampering the id, statement, or any non-crypto
// rail changes the derived payload, so the signature no longer matches. The
// cryptographic rail token itself is excluded from the signed body — signing
// the thing you are trying to prove would be circular.
//
// Pure: no fs, network, process, clock, or random. Real Ed25519 verification is
// INJECTED as `verifySignature` (callers pass `verifyPayload` from
// packages/receipts/src/authorship-signature.js). Deep-frozen, all-false
// preview boundary.

import { buildPreviewBoundary } from "./preview-boundary.js";

export const CRYPTO_RAIL_ATTESTATION_SCHEMA =
  "bizra.dema.crypto_rail_attestation_preview.v0.1";

export const CRYPTO_RAIL_ATTESTATION_PAYLOAD_SCHEMA =
  "bizra.dema.crypto_rail_attestation_payload.v0.1";

// The one evidence token this kernel is allowed to emit on success. It maps to
// level 4 in proof-convergence-preview.js's `cryptographic` vocabulary.
const SIGNED_EVIDENCE = "local_signed";
// The honest floor when crypto is unproven: the claim still has a schema.
const UNPROVEN_EVIDENCE = "schema_only";

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value))
    return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function railToken(claim, rail) {
  const token = claim && claim.rails ? claim.rails[rail] : undefined;
  return typeof token === "string" ? token : null;
}

// Deterministic canonical body that a signature attests. Excludes the
// cryptographic rail (that is what the signature establishes) so the payload is
// never circular. Binds claim identity + statement + the other three rails.
export function buildClaimAttestationPayload(claim) {
  return Object.freeze({
    schema: CRYPTO_RAIL_ATTESTATION_PAYLOAD_SCHEMA,
    claim: Object.freeze({
      id: claim && claim.id != null ? claim.id : null,
      statement: claim && claim.statement ? claim.statement : "",
      rails_attested: Object.freeze({
        formal: railToken(claim, "formal"),
        empirical: railToken(claim, "empirical"),
        economic: railToken(claim, "economic"),
      }),
    }),
  });
}

// Guard: never emit a signed verdict for an attestation that carries private
// key material. Field NAMES that merely flag state (e.g. private_key_loaded)
// are fine; an actual `private_key` / `private_key_pem` value is not.
function exposesPrivateKeyMaterial(attestation) {
  if (!attestation || typeof attestation !== "object") return false;
  const scan = (obj) => {
    for (const [key, val] of Object.entries(obj)) {
      const k = key.toLowerCase();
      if (
        (k === "private_key" ||
          k === "private_key_pem" ||
          k === "privatekey" ||
          k === "secret_key") &&
        typeof val === "string" &&
        val.length > 0
      ) {
        return true;
      }
      if (val && typeof val === "object" && scan(val)) return true;
    }
    return false;
  };
  return scan(attestation);
}

function result(evidence, { verified, refusal_reasons, key_fingerprint }) {
  return deepFreeze({
    schema: CRYPTO_RAIL_ATTESTATION_SCHEMA,
    mode: "preview_only",
    evidence,
    verified: Boolean(verified),
    binds_body: evidence === SIGNED_EVIDENCE,
    algorithm: "ed25519",
    key_fingerprint: key_fingerprint ?? null,
    refusal_reasons: Object.freeze([...refusal_reasons]),
    boundary: buildPreviewBoundary(),
  });
}

// Derive the cryptographic-rail evidence token for a claim from an attestation.
// verifySignature: (payload, signatureBase64, publicKeyPem) => boolean — MUST
// be injected. Absent verifier fails closed; it is never assumed valid.
export function deriveCryptographicRail({
  claim,
  attestation,
  verifySignature,
} = {}) {
  const rejected = [];

  if (!attestation || typeof attestation !== "object") {
    return result(UNPROVEN_EVIDENCE, {
      verified: false,
      refusal_reasons: ["no_attestation"],
    });
  }
  if (exposesPrivateKeyMaterial(attestation)) {
    return result(UNPROVEN_EVIDENCE, {
      verified: false,
      refusal_reasons: ["private_key_material_present"],
    });
  }

  const sig = attestation.signature;
  const fingerprint =
    sig && typeof sig.public_key_fingerprint === "string"
      ? sig.public_key_fingerprint
      : null;

  if (!sig || typeof sig.value !== "string" || typeof sig.public_key_pem !== "string") {
    rejected.push("signature_material_missing");
    return result(UNPROVEN_EVIDENCE, {
      verified: false,
      refusal_reasons: rejected,
      key_fingerprint: fingerprint,
    });
  }
  if (typeof verifySignature !== "function") {
    rejected.push("verifier_not_injected");
    return result(UNPROVEN_EVIDENCE, {
      verified: false,
      refusal_reasons: rejected,
      key_fingerprint: fingerprint,
    });
  }

  const payload = buildClaimAttestationPayload(claim);
  let verified = false;
  try {
    verified = verifySignature(payload, sig.value, sig.public_key_pem) === true;
  } catch {
    rejected.push("verification_error");
    return result(UNPROVEN_EVIDENCE, {
      verified: false,
      refusal_reasons: rejected,
      key_fingerprint: fingerprint,
    });
  }

  if (!verified) {
    rejected.push("signature_invalid");
    return result(UNPROVEN_EVIDENCE, {
      verified: false,
      refusal_reasons: rejected,
      key_fingerprint: fingerprint,
    });
  }

  return result(SIGNED_EVIDENCE, {
    verified: true,
    refusal_reasons: [],
    key_fingerprint: fingerprint,
  });
}

// Return a NEW claim whose cryptographic rail token is the derived one. On any
// failure the token is left/forced at `schema_only`, so this can never over-lift
// a claim. Feed the result to buildProofConvergencePreview().
export function attestClaimCryptographicRail(claim, attestation, opts = {}) {
  const derived = deriveCryptographicRail({
    claim,
    attestation,
    verifySignature: opts.verifySignature,
  });
  const rails = { ...((claim && claim.rails) || {}) };
  rails.cryptographic = derived.evidence;
  return Object.freeze({
    ...claim,
    rails: Object.freeze(rails),
    crypto_rail_attestation: derived,
  });
}

// Re-derivation path (the required verify*): recompute the evidence token and
// confirm it matches the expected one. Fail-closed on mismatch.
export function verifyCryptoRailAttestation({
  claim,
  attestation,
  expected_evidence = SIGNED_EVIDENCE,
  verifySignature,
} = {}) {
  const derived = deriveCryptographicRail({
    claim,
    attestation,
    verifySignature,
  });
  return deepFreeze({
    schema: CRYPTO_RAIL_ATTESTATION_SCHEMA,
    mode: "preview_only",
    ok: derived.evidence === expected_evidence && derived.verified === true,
    derived_evidence: derived.evidence,
    expected_evidence,
    refusal_reasons: derived.refusal_reasons,
    boundary: buildPreviewBoundary(),
  });
}
