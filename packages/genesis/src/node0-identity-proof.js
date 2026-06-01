// NODE0-IDENTITY-1A · local Node0 identity proof producer.
//
// Converts the Block0 prerequisite slot `node0_identity_proof_hash` from
// NAMED_ONLY to PRODUCER_LIVE. Binds THIS local Node0 identity to the operator's
// Ed25519 public key under explicit PROVE_NODE0_IDENTITY consent — and nothing
// more. It claims no legal identity, no biometric identity, no federation
// identity, no public-network identity, no market value, no token issuance.
//
// Pure-with-key-load: loads the operator key to sign; no other I/O, no clock
// (created_at_iso is injected), no network. Verification trusts ONLY the
// external pubkey (embedded fingerprint never authoritative — REJECT-4).

import { createPublicKey } from "node:crypto";
import {
  signPayload,
  verifyPayload,
} from "../../receipts/src/authorship-signature.js";
import {
  loadPrivateKey,
  loadPublicKey,
} from "../../receipts/src/authorship-key-store.js";
import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import { verifyConsentProof } from "../../receipts/src/consent-proof.js";

export const NODE0_IDENTITY_PROOF_SCHEMA =
  "bizra.dema.node0_identity_proof.v0.1";
export const PROVE_NODE0_IDENTITY_ACTION_TYPE = "PROVE_NODE0_IDENTITY";
export const PROVE_NODE0_IDENTITY_CONSENT_PHRASE = "PROVE NODE0 IDENTITY";

// The exact, fail-closed claim boundary — every field must be false, no extras.
const REQUIRED_FALSE_BOUNDARY_FIELDS = Object.freeze([
  "public_network_launched",
  "federation_used",
  "public_market_value_claimed",
  "token_minted_to_humans",
  "legal_identity_claimed",
  "biometric_identity_claimed",
]);

function defaultClaimBoundary() {
  return {
    public_network_launched: false,
    federation_used: false,
    public_market_value_claimed: false,
    token_minted_to_humans: false,
    legal_identity_claimed: false,
    biometric_identity_claimed: false,
  };
}

function ed25519FingerprintFromPem(pubkeyPem) {
  const pk = createPublicKey(pubkeyPem);
  if (pk.asymmetricKeyType !== "ed25519")
    return { error: "operator_key_not_ed25519" };
  return {
    fingerprint: sha256(
      pk.export({ type: "spki", format: "der" }).toString("hex"),
    ),
  };
}

function isSha256Hex(s) {
  return typeof s === "string" && /^[a-f0-9]{64}$/.test(s);
}
function isNonEmptyString(s) {
  return typeof s === "string" && s.length > 0;
}

function fail(error, extra = {}) {
  return Object.freeze({
    schema: NODE0_IDENTITY_PROOF_SCHEMA,
    built: false,
    truth_label: "LOCAL_NODE0_IDENTITY_PROOF_REFUSED",
    error,
    ...extra,
  });
}
function reject(reason) {
  return Object.freeze({ verified: false, reason });
}

// Deterministic Node0 identity commitment (the consent target). Same shape used
// by build + the consent caller, so the caller can scope consent to it.
export function node0IdentityCommitment({
  operatorPubkeyPem,
  createdAtIso,
} = {}) {
  const fp = ed25519FingerprintFromPem(operatorPubkeyPem);
  if (fp.error) return null;
  return sha256(
    stableStringify({
      genesis_node_id: fp.fingerprint,
      genesis_human_id: fp.fingerprint,
      operator_public_key_fingerprint: fp.fingerprint,
      claim_boundary: defaultClaimBoundary(),
      created_at_iso: createdAtIso,
    }),
  );
}

function buildBody({
  fingerprint,
  claim_boundary,
  created_at_iso,
  node0_identity_id,
  consent_proof_hash,
}) {
  return {
    schema: NODE0_IDENTITY_PROOF_SCHEMA,
    node0_identity_id,
    genesis_node_id: fingerprint,
    genesis_human_id: fingerprint,
    operator_public_key_fingerprint: fingerprint,
    claim_boundary,
    consent_proof_hash,
    created_at_iso,
  };
}

/**
 * Build a Node0 identity proof. Pure-with-key-load. Fail-closed.
 */
export async function buildNode0IdentityProof({
  demaHome,
  consentProof,
  createdAtIso,
} = {}) {
  if (
    !isNonEmptyString(createdAtIso) ||
    Number.isNaN(Date.parse(createdAtIso))
  ) {
    return fail("created_at_iso_required");
  }
  if (!consentProof || typeof consentProof !== "object") {
    return fail("consent_proof_required");
  }
  const privateKeyPem = await loadPrivateKey(demaHome);
  const publicKeyPem = await loadPublicKey(demaHome);
  if (!privateKeyPem || !publicKeyPem) return fail("no_authorship_key");

  const fp = ed25519FingerprintFromPem(publicKeyPem);
  if (fp.error) return fail(fp.error);
  const fingerprint = fp.fingerprint;
  const claim_boundary = defaultClaimBoundary();

  const node0_identity_id = sha256(
    stableStringify({
      genesis_node_id: fingerprint,
      genesis_human_id: fingerprint,
      operator_public_key_fingerprint: fingerprint,
      claim_boundary,
      created_at_iso: createdAtIso,
    }),
  );

  // Consent must be key-bound, scoped to this identity commitment, and carry the
  // exact phrase (scope binding alone is not enough — the operator must have
  // typed this specific consent).
  const consentVerify = verifyConsentProof({
    consentProof,
    pubkeyPem: publicKeyPem,
    expectedActionScope: {
      action_type: PROVE_NODE0_IDENTITY_ACTION_TYPE,
      target_hash: node0_identity_id,
    },
    now: createdAtIso,
  });
  if (!consentVerify.verified) return fail(consentVerify.reason);
  if (consentProof.consent_phrase !== PROVE_NODE0_IDENTITY_CONSENT_PHRASE) {
    return fail("consent_phrase_mismatch");
  }

  const body = buildBody({
    fingerprint,
    claim_boundary,
    created_at_iso: createdAtIso,
    node0_identity_id,
    consent_proof_hash: consentProof.consent_proof_hash,
  });
  const node0_identity_proof_hash = sha256(stableStringify(body));
  const node0_identity_signature_b64 = signPayload(body, privateKeyPem);

  return Object.freeze({
    schema: NODE0_IDENTITY_PROOF_SCHEMA,
    built: true,
    truth_label: "LOCAL_NODE0_IDENTITY_PROOF_SIGNED",
    node0_identity_proof_hash,
    proof: Object.freeze({
      ...body,
      node0_identity_signature_b64,
      node0_identity_proof_hash,
    }),
    boundary: Object.freeze({ ...claim_boundary }),
    what_this_proves: Object.freeze([
      "This local Node0 identity is bound to this operator Ed25519 key.",
      "The binding was made under explicit, key-bound PROVE_NODE0_IDENTITY consent.",
    ]),
    what_this_does_not_prove: Object.freeze([
      "No legal identity, no biometric identity.",
      "No federation / Node1+ identity, no public-network identity.",
      "No public market value, no token issuance.",
    ]),
  });
}

function validateClaimBoundary(b) {
  if (!b || typeof b !== "object" || Array.isArray(b)) {
    return "claim_boundary_invalid";
  }
  if (Object.keys(b).length !== REQUIRED_FALSE_BOUNDARY_FIELDS.length) {
    return "claim_boundary_unexpected_field";
  }
  for (const f of REQUIRED_FALSE_BOUNDARY_FIELDS) {
    if (b[f] !== false) return "claim_boundary_violation";
  }
  return null;
}

/**
 * Verify a Node0 identity proof under the EXTERNAL operator pubkey. Pure.
 */
export function verifyNode0IdentityProof({ proof, operatorPubkeyPem } = {}) {
  if (!proof || typeof proof !== "object" || Array.isArray(proof)) {
    return reject("proof_missing_or_malformed");
  }
  if (proof.schema !== NODE0_IDENTITY_PROOF_SCHEMA) {
    return reject("proof_schema_mismatch");
  }
  if (
    typeof operatorPubkeyPem !== "string" ||
    !operatorPubkeyPem.includes("BEGIN PUBLIC KEY")
  ) {
    return reject("external_pubkey_required");
  }
  for (const f of [
    "node0_identity_id",
    "genesis_node_id",
    "genesis_human_id",
    "operator_public_key_fingerprint",
    "claim_boundary",
    "consent_proof_hash",
    "created_at_iso",
    "node0_identity_signature_b64",
    "node0_identity_proof_hash",
  ]) {
    if (proof[f] === undefined || proof[f] === null) {
      return reject(`structural_missing_field_${f}`);
    }
  }
  if (!isSha256Hex(proof.node0_identity_proof_hash)) {
    return reject("node0_identity_proof_hash_invalid");
  }

  // Operator authority — external pubkey, Ed25519 only.
  let fingerprint;
  try {
    const fp = ed25519FingerprintFromPem(operatorPubkeyPem);
    if (fp.error) return reject(fp.error);
    fingerprint = fp.fingerprint;
  } catch {
    return reject("external_pubkey_required");
  }
  if (proof.operator_public_key_fingerprint !== fingerprint) {
    return reject("operator_key_mismatch");
  }
  // The identity IS the key — genesis ids must equal the fingerprint.
  if (proof.genesis_node_id !== fingerprint)
    return reject("genesis_node_id_mismatch");
  if (proof.genesis_human_id !== fingerprint)
    return reject("genesis_human_id_mismatch");

  const boundaryError = validateClaimBoundary(proof.claim_boundary);
  if (boundaryError) return reject(boundaryError);

  // Re-derive the identity commitment from the committed fields.
  const expectedId = sha256(
    stableStringify({
      genesis_node_id: fingerprint,
      genesis_human_id: fingerprint,
      operator_public_key_fingerprint: fingerprint,
      claim_boundary: proof.claim_boundary,
      created_at_iso: proof.created_at_iso,
    }),
  );
  if (proof.node0_identity_id !== expectedId) {
    return reject("node0_identity_id_mismatch");
  }

  // Re-derive the proof hash + verify the signature over the canonical body.
  const { node0_identity_signature_b64, node0_identity_proof_hash, ...body } =
    proof;
  if (sha256(stableStringify(body)) !== node0_identity_proof_hash) {
    return reject("node0_identity_proof_hash_mismatch");
  }
  let ok;
  try {
    ok = verifyPayload(body, node0_identity_signature_b64, operatorPubkeyPem);
  } catch {
    return reject("signature_invalid");
  }
  if (!ok) return reject("signature_invalid");

  return Object.freeze({
    verified: true,
    node0_identity_proof_hash,
    boundary: Object.freeze({ ...proof.claim_boundary }),
  });
}
