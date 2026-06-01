// URP-STATUS-1A · local URP resource-status proof producer.
//
// Converts the Block0 prerequisite slot `urp_resource_status_proof_hash` from
// NAMED_ONLY to PRODUCER_LIVE-capable. The operator declares a BOUNDED,
// local-only resource-status snapshot, signs it with the Ed25519 key, and binds
// it to explicit PROVE_URP_RESOURCE_STATUS consent — and nothing more. It claims
// no public compute marketplace, no availability guarantee, no federation, no
// market value, no token issuance, no live network capacity, no third-party SLA.
//
// Pure-with-key-load: loads the operator key to sign; no other I/O, no clock
// (created_at_iso injected), no network. Verification trusts ONLY the external
// pubkey (embedded fingerprint never authoritative — REJECT-4).

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

export const URP_RESOURCE_STATUS_PROOF_SCHEMA =
  "bizra.dema.urp_resource_status_proof.v0.1";
export const PROVE_URP_RESOURCE_STATUS_ACTION_TYPE =
  "PROVE_URP_RESOURCE_STATUS";
export const PROVE_URP_RESOURCE_STATUS_CONSENT_PHRASE =
  "PROVE URP RESOURCE STATUS";

const REQUIRED_FALSE_BOUNDARY_FIELDS = Object.freeze([
  "public_compute_marketplace_claimed",
  "public_resource_availability_guaranteed",
  "federation_used",
  "public_market_value_claimed",
  "token_minted_to_humans",
  "live_network_capacity_claimed",
  "third_party_sla_claimed",
]);

function defaultClaimBoundary() {
  return {
    public_compute_marketplace_claimed: false,
    public_resource_availability_guaranteed: false,
    federation_used: false,
    public_market_value_claimed: false,
    token_minted_to_humans: false,
    live_network_capacity_claimed: false,
    third_party_sla_claimed: false,
  };
}

// Fail-closed (never throws) Ed25519 fingerprint.
function ed25519FingerprintFromPem(pubkeyPem) {
  if (
    typeof pubkeyPem !== "string" ||
    !pubkeyPem.includes("BEGIN PUBLIC KEY")
  ) {
    return { error: "external_pubkey_required" };
  }
  let pk;
  try {
    pk = createPublicKey(pubkeyPem);
  } catch {
    return { error: "external_pubkey_required" };
  }
  if (pk.asymmetricKeyType !== "ed25519") {
    return { error: "operator_key_not_ed25519" };
  }
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
function isPlainObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function isJsonSafe(value, seen = new WeakSet()) {
  if (value === null) return true;
  const t = typeof value;
  if (t === "string" || t === "boolean") return true;
  if (t === "number") return Number.isFinite(value);
  if (t === "object") {
    if (seen.has(value)) return false;
    seen.add(value);
    if (Array.isArray(value)) return value.every((v) => isJsonSafe(v, seen));
    return Object.values(value).every((v) => isJsonSafe(v, seen));
  }
  return false;
}

function fail(error) {
  return Object.freeze({
    schema: URP_RESOURCE_STATUS_PROOF_SCHEMA,
    built: false,
    truth_label: "LOCAL_URP_RESOURCE_STATUS_PROOF_REFUSED",
    error,
  });
}
function reject(reason) {
  return Object.freeze({ verified: false, reason });
}

// Deterministic commitment (the consent target). Same shape build + caller use.
export function urpResourceStatusCommitment({
  operatorPubkeyPem,
  resourceStatus,
  createdAtIso,
} = {}) {
  const fp = ed25519FingerprintFromPem(operatorPubkeyPem);
  if (fp.error) return null;
  if (!isPlainObject(resourceStatus) || !isJsonSafe(resourceStatus))
    return null;
  return sha256(
    stableStringify({
      operator_public_key_fingerprint: fp.fingerprint,
      resource_status_hash: sha256(stableStringify(resourceStatus)),
      claim_boundary: defaultClaimBoundary(),
      created_at_iso: createdAtIso,
    }),
  );
}

/**
 * Build a URP resource-status proof. Pure-with-key-load. Fail-closed.
 */
export async function buildUrpResourceStatusProof({
  demaHome,
  consentProof,
  resourceStatus,
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
  if (!isPlainObject(resourceStatus) || !isJsonSafe(resourceStatus)) {
    return fail("resource_status_invalid");
  }
  const privateKeyPem = await loadPrivateKey(demaHome);
  const publicKeyPem = await loadPublicKey(demaHome);
  if (!privateKeyPem || !publicKeyPem) return fail("no_authorship_key");

  const fp = ed25519FingerprintFromPem(publicKeyPem);
  if (fp.error) return fail(fp.error);
  const fingerprint = fp.fingerprint;
  const claim_boundary = defaultClaimBoundary();
  const resource_status_hash = sha256(stableStringify(resourceStatus));

  const urp_resource_status_id = sha256(
    stableStringify({
      operator_public_key_fingerprint: fingerprint,
      resource_status_hash,
      claim_boundary,
      created_at_iso: createdAtIso,
    }),
  );

  const consentVerify = verifyConsentProof({
    consentProof,
    pubkeyPem: publicKeyPem,
    expectedActionScope: {
      action_type: PROVE_URP_RESOURCE_STATUS_ACTION_TYPE,
      target_hash: urp_resource_status_id,
    },
    now: createdAtIso,
  });
  if (!consentVerify.verified) return fail(consentVerify.reason);
  if (
    consentProof.consent_phrase !== PROVE_URP_RESOURCE_STATUS_CONSENT_PHRASE
  ) {
    return fail("consent_phrase_mismatch");
  }

  const body = {
    schema: URP_RESOURCE_STATUS_PROOF_SCHEMA,
    urp_resource_status_id,
    operator_public_key_fingerprint: fingerprint,
    resource_status_hash,
    resource_status: resourceStatus,
    claim_boundary,
    consent_proof_hash: consentProof.consent_proof_hash,
    created_at_iso: createdAtIso,
  };
  const urp_resource_status_proof_hash = sha256(stableStringify(body));
  const urp_resource_status_signature_b64 = signPayload(body, privateKeyPem);

  return Object.freeze({
    schema: URP_RESOURCE_STATUS_PROOF_SCHEMA,
    built: true,
    truth_label: "LOCAL_URP_RESOURCE_STATUS_PROOF_SIGNED",
    urp_resource_status_proof_hash,
    proof: Object.freeze({
      ...body,
      urp_resource_status_signature_b64,
      urp_resource_status_proof_hash,
    }),
    boundary: Object.freeze({ ...claim_boundary }),
    what_this_proves: Object.freeze([
      "This local Node0 declared a bounded URP resource-status snapshot.",
      "The snapshot is operator Ed25519-signed and bound to explicit consent.",
    ]),
    what_this_does_not_prove: Object.freeze([
      "No public compute marketplace, no availability guarantee, no SLA.",
      "No federation, no live network capacity, no public market value, no token.",
    ]),
  });
}

function validateClaimBoundary(b) {
  if (!isPlainObject(b)) return "claim_boundary_invalid";
  if (Object.keys(b).length !== REQUIRED_FALSE_BOUNDARY_FIELDS.length) {
    return "claim_boundary_unexpected_field";
  }
  for (const f of REQUIRED_FALSE_BOUNDARY_FIELDS) {
    if (b[f] !== false) return "claim_boundary_violation";
  }
  return null;
}

/**
 * Verify a URP resource-status proof under the EXTERNAL operator pubkey. Pure.
 */
export function verifyUrpResourceStatusProof({
  proof,
  operatorPubkeyPem,
} = {}) {
  if (!isPlainObject(proof)) return reject("proof_missing_or_malformed");
  if (proof.schema !== URP_RESOURCE_STATUS_PROOF_SCHEMA) {
    return reject("proof_schema_mismatch");
  }
  if (
    typeof operatorPubkeyPem !== "string" ||
    !operatorPubkeyPem.includes("BEGIN PUBLIC KEY")
  ) {
    return reject("external_pubkey_required");
  }
  const REQUIRED = [
    "urp_resource_status_id",
    "operator_public_key_fingerprint",
    "resource_status_hash",
    "resource_status",
    "claim_boundary",
    "consent_proof_hash",
    "created_at_iso",
    "urp_resource_status_signature_b64",
    "urp_resource_status_proof_hash",
  ];
  for (const f of REQUIRED) {
    if (proof[f] === undefined || proof[f] === null) {
      return reject(`structural_missing_field_${f}`);
    }
  }
  if (Object.keys(proof).length !== REQUIRED.length + 1 /* schema */) {
    return reject("proof_unexpected_field");
  }
  if (!isSha256Hex(proof.urp_resource_status_proof_hash)) {
    return reject("urp_resource_status_proof_hash_invalid");
  }
  if (!isSha256Hex(proof.consent_proof_hash)) {
    return reject("consent_proof_hash_invalid");
  }
  if (
    !isPlainObject(proof.resource_status) ||
    !isJsonSafe(proof.resource_status)
  ) {
    return reject("resource_status_invalid");
  }

  // Operator authority — external pubkey, Ed25519 only (fail-closed).
  const fp = ed25519FingerprintFromPem(operatorPubkeyPem);
  if (fp.error) return reject(fp.error);
  const fingerprint = fp.fingerprint;
  if (proof.operator_public_key_fingerprint !== fingerprint) {
    return reject("operator_key_mismatch");
  }

  const boundaryError = validateClaimBoundary(proof.claim_boundary);
  if (boundaryError) return reject(boundaryError);

  // The committed resource_status_hash must match the embedded snapshot.
  if (
    proof.resource_status_hash !==
    sha256(stableStringify(proof.resource_status))
  ) {
    return reject("resource_status_hash_mismatch");
  }

  // Re-derive the commitment from the committed fields.
  const expectedId = sha256(
    stableStringify({
      operator_public_key_fingerprint: fingerprint,
      resource_status_hash: proof.resource_status_hash,
      claim_boundary: proof.claim_boundary,
      created_at_iso: proof.created_at_iso,
    }),
  );
  if (proof.urp_resource_status_id !== expectedId) {
    return reject("urp_resource_status_id_mismatch");
  }

  // Re-derive the proof hash + verify the signature over the canonical body.
  const {
    urp_resource_status_signature_b64,
    urp_resource_status_proof_hash,
    ...body
  } = proof;
  if (sha256(stableStringify(body)) !== urp_resource_status_proof_hash) {
    return reject("urp_resource_status_proof_hash_mismatch");
  }
  let ok;
  try {
    ok = verifyPayload(
      body,
      urp_resource_status_signature_b64,
      operatorPubkeyPem,
    );
  } catch {
    return reject("signature_invalid");
  }
  if (!ok) return reject("signature_invalid");

  return Object.freeze({
    verified: true,
    urp_resource_status_proof_hash,
    boundary: Object.freeze({ ...proof.claim_boundary }),
  });
}
