// NODE0-OSTREE-1A · local Node0 composition manifest producer.
//
// The "smallest honest next step" the OSTree TAD §8 names: promote the DECLARED
// `bizra.dema.node0_composition_manifest.v0.1` (§4 schema sketch) to a real pure
// kernel. An OSTree treefile declares what composes the tree; this declares what
// composes THIS Node0 — node ref, Block0 linkage, the content-addressed kernel
// set, SAT gates, and the prerequisite set — Ed25519-signed and bound to consent.
//
// Honest-unsealed: Block0 is not sealable today, so a caller passes
// block0_id: null / block0_sealed: false. The manifest composes the CURRENT
// node state and claims nothing it cannot prove — no libostree, no daemon, no
// federation, no deploy surface, no token, no public network.
//
// Pure-with-key-load: loads the operator key to sign; no other I/O, no clock
// (created_at_iso injected), no network, no repo scan. Verification trusts ONLY
// the external pubkey (embedded fingerprint never authoritative).

import { createPublicKey } from "node:crypto";
import {
  signPayload,
  verifyPayload,
} from "../../receipts/src/authorship-signature.js";
import {
  loadActiveKeyPair,
} from "../../receipts/src/authorship-key-store.js";
import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import { verifyConsentProof } from "../../receipts/src/consent-proof.js";

export const NODE0_COMPOSITION_MANIFEST_SCHEMA =
  "bizra.dema.node0_composition_manifest.v0.1";
export const PROVE_NODE0_COMPOSITION_ACTION_TYPE = "PROVE_NODE0_COMPOSITION";
export const PROVE_NODE0_COMPOSITION_CONSENT_PHRASE = "PROVE NODE0 COMPOSITION";

// §4 mandatory-false boundary (matches block0-manifest.js intent).
const REQUIRED_FALSE_BOUNDARY_FIELDS = Object.freeze([
  "token_minted_to_humans",
  "public_network_used",
  "federation_used",
]);

function defaultClaimBoundary() {
  return {
    token_minted_to_humans: false,
    public_network_used: false,
    federation_used: false,
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
    schema: NODE0_COMPOSITION_MANIFEST_SCHEMA,
    built: false,
    truth_label: "LOCAL_NODE0_COMPOSITION_MANIFEST_REFUSED",
    error,
  });
}
function reject(reason) {
  return Object.freeze({ verified: false, reason });
}

// Deterministic commitment (the consent target). Same shape build + caller use.
export function node0CompositionCommitment({
  operatorPubkeyPem,
  composition,
  createdAtIso,
} = {}) {
  const fp = ed25519FingerprintFromPem(operatorPubkeyPem);
  if (fp.error) return null;
  if (!isPlainObject(composition) || !isJsonSafe(composition)) return null;
  return sha256(
    stableStringify({
      operator_public_key_fingerprint: fp.fingerprint,
      composition_hash: sha256(stableStringify(composition)),
      claim_boundary: defaultClaimBoundary(),
      created_at_iso: createdAtIso,
    }),
  );
}

/**
 * Build a Node0 composition manifest. Pure-with-key-load. Fail-closed.
 */
export async function buildNode0CompositionManifest({
  demaHome,
  consentProof,
  composition,
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
  if (!isPlainObject(composition) || !isJsonSafe(composition)) {
    return fail("composition_invalid");
  }
  const activePair = await loadActiveKeyPair(demaHome);
  const privateKeyPem = activePair.ok ? activePair.private_key_pem : null;
  const publicKeyPem = activePair.ok ? activePair.public_key_pem : null;
  if (!privateKeyPem || !publicKeyPem) return fail("no_authorship_key");

  const fp = ed25519FingerprintFromPem(publicKeyPem);
  if (fp.error) return fail(fp.error);
  const fingerprint = fp.fingerprint;
  const claim_boundary = defaultClaimBoundary();
  const composition_hash = sha256(stableStringify(composition));

  const node0_composition_id = sha256(
    stableStringify({
      operator_public_key_fingerprint: fingerprint,
      composition_hash,
      claim_boundary,
      created_at_iso: createdAtIso,
    }),
  );

  const consentVerify = verifyConsentProof({
    consentProof,
    pubkeyPem: publicKeyPem,
    expectedActionScope: {
      action_type: PROVE_NODE0_COMPOSITION_ACTION_TYPE,
      target_hash: node0_composition_id,
    },
    now: createdAtIso,
  });
  if (!consentVerify.verified) return fail(consentVerify.reason);
  if (consentProof.consent_phrase !== PROVE_NODE0_COMPOSITION_CONSENT_PHRASE) {
    return fail("consent_phrase_mismatch");
  }

  const body = {
    schema: NODE0_COMPOSITION_MANIFEST_SCHEMA,
    node0_composition_id,
    operator_public_key_fingerprint: fingerprint,
    composition_hash,
    composition,
    claim_boundary,
    consent_proof_hash: consentProof.consent_proof_hash,
    created_at_iso: createdAtIso,
  };
  const node0_composition_proof_hash = sha256(stableStringify(body));
  const node0_composition_signature_b64 = signPayload(body, privateKeyPem);

  return Object.freeze({
    schema: NODE0_COMPOSITION_MANIFEST_SCHEMA,
    built: true,
    truth_label: "LOCAL_NODE0_COMPOSITION_MANIFEST_SIGNED",
    node0_composition_proof_hash,
    manifest: Object.freeze({
      ...body,
      node0_composition_signature_b64,
      node0_composition_proof_hash,
    }),
    boundary: Object.freeze({ ...claim_boundary }),
    what_this_proves: Object.freeze([
      "This local Node0 declared a bounded composition snapshot, operator-signed and consent-bound.",
    ]),
    what_this_does_not_prove: Object.freeze([
      "A sealed Block0, a live network, federation, a deploy surface, or a token. block0_sealed is whatever the caller honestly recorded.",
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
 * Verify a Node0 composition manifest under the EXTERNAL operator pubkey. Pure.
 */
export function verifyNode0CompositionManifest({
  manifest,
  operatorPubkeyPem,
} = {}) {
  if (!isPlainObject(manifest)) return reject("manifest_missing_or_malformed");
  if (manifest.schema !== NODE0_COMPOSITION_MANIFEST_SCHEMA) {
    return reject("manifest_schema_mismatch");
  }
  if (
    typeof operatorPubkeyPem !== "string" ||
    !operatorPubkeyPem.includes("BEGIN PUBLIC KEY")
  ) {
    return reject("external_pubkey_required");
  }
  const REQUIRED = [
    "node0_composition_id",
    "operator_public_key_fingerprint",
    "composition_hash",
    "composition",
    "claim_boundary",
    "consent_proof_hash",
    "created_at_iso",
    "node0_composition_signature_b64",
    "node0_composition_proof_hash",
  ];
  for (const f of REQUIRED) {
    if (manifest[f] === undefined || manifest[f] === null) {
      return reject(`structural_missing_field_${f}`);
    }
  }
  if (Object.keys(manifest).length !== REQUIRED.length + 1 /* schema */) {
    return reject("manifest_unexpected_field");
  }
  if (!isSha256Hex(manifest.node0_composition_proof_hash)) {
    return reject("node0_composition_proof_hash_invalid");
  }
  if (!isSha256Hex(manifest.consent_proof_hash)) {
    return reject("consent_proof_hash_invalid");
  }
  if (
    !isPlainObject(manifest.composition) ||
    !isJsonSafe(manifest.composition)
  ) {
    return reject("composition_invalid");
  }

  // Operator authority — external pubkey, Ed25519 only (fail-closed).
  const fp = ed25519FingerprintFromPem(operatorPubkeyPem);
  if (fp.error) return reject(fp.error);
  const fingerprint = fp.fingerprint;
  if (manifest.operator_public_key_fingerprint !== fingerprint) {
    return reject("operator_key_mismatch");
  }

  const boundaryError = validateClaimBoundary(manifest.claim_boundary);
  if (boundaryError) return reject(boundaryError);

  // The committed composition_hash must match the embedded composition.
  if (
    manifest.composition_hash !== sha256(stableStringify(manifest.composition))
  ) {
    return reject("composition_hash_mismatch");
  }

  // Re-derive the commitment from the committed fields.
  const expectedId = sha256(
    stableStringify({
      operator_public_key_fingerprint: fingerprint,
      composition_hash: manifest.composition_hash,
      claim_boundary: manifest.claim_boundary,
      created_at_iso: manifest.created_at_iso,
    }),
  );
  if (manifest.node0_composition_id !== expectedId) {
    return reject("node0_composition_id_mismatch");
  }

  // Re-derive the proof hash + verify the signature over the canonical body.
  const {
    node0_composition_signature_b64,
    node0_composition_proof_hash,
    ...body
  } = manifest;
  if (sha256(stableStringify(body)) !== node0_composition_proof_hash) {
    return reject("node0_composition_proof_hash_mismatch");
  }
  let ok;
  try {
    ok = verifyPayload(
      body,
      node0_composition_signature_b64,
      operatorPubkeyPem,
    );
  } catch {
    return reject("signature_invalid");
  }
  if (!ok) return reject("signature_invalid");

  return Object.freeze({
    verified: true,
    node0_composition_proof_hash,
    boundary: Object.freeze({ ...manifest.claim_boundary }),
  });
}
