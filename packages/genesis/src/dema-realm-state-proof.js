// DEMA-REALM-STATE-1A · local Dema Realm state proof producer.
//
// Converts the Block0 prerequisite slot `dema_realm_state_proof_hash` from
// NAMED_ONLY to PRODUCER_LIVE-capable. The operator declares a BOUNDED,
// local-only Realm-state snapshot (the read-only counters that
// `gatherDemaRealmStatus` measures off disk: identity status, authorship
// receipt count, URP index count, checkpoint/timeline presence), signs it with
// the Ed25519 key, and binds it to explicit PROVE_DEMA_REALM_STATE consent —
// and nothing more. It claims NO live RPG world, NO persistent multiplayer
// realm, NO runtime-backed council, NO working cockpit beyond the read-only
// status surface, NO federation, NO public market value, NO token.
//
// The DESIGNED-only Realm surfaces (Council Chamber, Quest Board, Home TUI) are
// NOT inputs to this proof — only the measured status snapshot is committed.
//
// Pure-with-key-load: loads the operator key to sign; no other I/O, no clock
// (created_at_iso injected), no network. Verification trusts ONLY the external
// pubkey (embedded fingerprint never authoritative).

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

export const DEMA_REALM_STATE_PROOF_SCHEMA =
  "bizra.dema.dema_realm_state_proof.v0.1";
export const PROVE_DEMA_REALM_STATE_ACTION_TYPE = "PROVE_DEMA_REALM_STATE";
export const PROVE_DEMA_REALM_STATE_CONSENT_PHRASE = "PROVE DEMA REALM STATE";

const REQUIRED_FALSE_BOUNDARY_FIELDS = Object.freeze([
  "live_rpg_world_claimed",
  "persistent_multiplayer_realm_claimed",
  "runtime_backed_council_claimed",
  "working_cockpit_beyond_readonly_claimed",
  "federation_used",
  "public_market_value_claimed",
  "token_minted_to_humans",
]);

function defaultClaimBoundary() {
  return {
    live_rpg_world_claimed: false,
    persistent_multiplayer_realm_claimed: false,
    runtime_backed_council_claimed: false,
    working_cockpit_beyond_readonly_claimed: false,
    federation_used: false,
    public_market_value_claimed: false,
    token_minted_to_humans: false,
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
    schema: DEMA_REALM_STATE_PROOF_SCHEMA,
    built: false,
    truth_label: "LOCAL_DEMA_REALM_STATE_PROOF_REFUSED",
    error,
  });
}
function reject(reason) {
  return Object.freeze({ verified: false, reason });
}

// Deterministic commitment (the consent target). Same shape build + caller use.
export function demaRealmStateCommitment({
  operatorPubkeyPem,
  realmState,
  createdAtIso,
} = {}) {
  const fp = ed25519FingerprintFromPem(operatorPubkeyPem);
  if (fp.error) return null;
  if (!isPlainObject(realmState) || !isJsonSafe(realmState)) return null;
  return sha256(
    stableStringify({
      operator_public_key_fingerprint: fp.fingerprint,
      realm_state_hash: sha256(stableStringify(realmState)),
      claim_boundary: defaultClaimBoundary(),
      created_at_iso: createdAtIso,
    }),
  );
}

/**
 * Build a Dema Realm state proof. Pure-with-key-load. Fail-closed.
 */
export async function buildDemaRealmStateProof({
  demaHome,
  consentProof,
  realmState,
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
  if (!isPlainObject(realmState) || !isJsonSafe(realmState)) {
    return fail("realm_state_invalid");
  }
  const privateKeyPem = await loadPrivateKey(demaHome);
  const publicKeyPem = await loadPublicKey(demaHome);
  if (!privateKeyPem || !publicKeyPem) return fail("no_authorship_key");

  const fp = ed25519FingerprintFromPem(publicKeyPem);
  if (fp.error) return fail(fp.error);
  const fingerprint = fp.fingerprint;
  const claim_boundary = defaultClaimBoundary();
  const realm_state_hash = sha256(stableStringify(realmState));

  const dema_realm_state_id = sha256(
    stableStringify({
      operator_public_key_fingerprint: fingerprint,
      realm_state_hash,
      claim_boundary,
      created_at_iso: createdAtIso,
    }),
  );

  const consentVerify = verifyConsentProof({
    consentProof,
    pubkeyPem: publicKeyPem,
    expectedActionScope: {
      action_type: PROVE_DEMA_REALM_STATE_ACTION_TYPE,
      target_hash: dema_realm_state_id,
    },
    now: createdAtIso,
  });
  if (!consentVerify.verified) return fail(consentVerify.reason);
  if (consentProof.consent_phrase !== PROVE_DEMA_REALM_STATE_CONSENT_PHRASE) {
    return fail("consent_phrase_mismatch");
  }

  const body = {
    schema: DEMA_REALM_STATE_PROOF_SCHEMA,
    dema_realm_state_id,
    operator_public_key_fingerprint: fingerprint,
    realm_state_hash,
    realm_state: realmState,
    claim_boundary,
    consent_proof_hash: consentProof.consent_proof_hash,
    created_at_iso: createdAtIso,
  };
  const dema_realm_state_proof_hash = sha256(stableStringify(body));
  const dema_realm_state_signature_b64 = signPayload(body, privateKeyPem);

  return Object.freeze({
    schema: DEMA_REALM_STATE_PROOF_SCHEMA,
    built: true,
    truth_label: "LOCAL_DEMA_REALM_STATE_PROOF_SIGNED",
    dema_realm_state_proof_hash,
    proof: Object.freeze({
      ...body,
      dema_realm_state_signature_b64,
      dema_realm_state_proof_hash,
    }),
    boundary: Object.freeze({ ...claim_boundary }),
    what_this_proves: Object.freeze([
      "This local Node0 declared a bounded Realm-state snapshot (read-only counters).",
      "The snapshot is operator Ed25519-signed and bound to explicit consent.",
    ]),
    what_this_does_not_prove: Object.freeze([
      "No live RPG world, no persistent multiplayer realm, no runtime-backed council.",
      "No working cockpit beyond read-only status, no federation, no market value, no token.",
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
 * Verify a Dema Realm state proof under the EXTERNAL operator pubkey. Pure.
 */
export function verifyDemaRealmStateProof({ proof, operatorPubkeyPem } = {}) {
  if (!isPlainObject(proof)) return reject("proof_missing_or_malformed");
  if (proof.schema !== DEMA_REALM_STATE_PROOF_SCHEMA) {
    return reject("proof_schema_mismatch");
  }
  if (
    typeof operatorPubkeyPem !== "string" ||
    !operatorPubkeyPem.includes("BEGIN PUBLIC KEY")
  ) {
    return reject("external_pubkey_required");
  }
  const REQUIRED = [
    "dema_realm_state_id",
    "operator_public_key_fingerprint",
    "realm_state_hash",
    "realm_state",
    "claim_boundary",
    "consent_proof_hash",
    "created_at_iso",
    "dema_realm_state_signature_b64",
    "dema_realm_state_proof_hash",
  ];
  for (const f of REQUIRED) {
    if (proof[f] === undefined || proof[f] === null) {
      return reject(`structural_missing_field_${f}`);
    }
  }
  if (Object.keys(proof).length !== REQUIRED.length + 1 /* schema */) {
    return reject("proof_unexpected_field");
  }
  if (!isSha256Hex(proof.dema_realm_state_proof_hash)) {
    return reject("dema_realm_state_proof_hash_invalid");
  }
  if (!isSha256Hex(proof.consent_proof_hash)) {
    return reject("consent_proof_hash_invalid");
  }
  if (!isPlainObject(proof.realm_state) || !isJsonSafe(proof.realm_state)) {
    return reject("realm_state_invalid");
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

  // The committed realm_state_hash must match the embedded snapshot.
  if (proof.realm_state_hash !== sha256(stableStringify(proof.realm_state))) {
    return reject("realm_state_hash_mismatch");
  }

  // Re-derive the commitment from the committed fields.
  const expectedId = sha256(
    stableStringify({
      operator_public_key_fingerprint: fingerprint,
      realm_state_hash: proof.realm_state_hash,
      claim_boundary: proof.claim_boundary,
      created_at_iso: proof.created_at_iso,
    }),
  );
  if (proof.dema_realm_state_id !== expectedId) {
    return reject("dema_realm_state_id_mismatch");
  }

  // Re-derive the proof hash + verify the signature over the canonical body.
  const {
    dema_realm_state_signature_b64,
    dema_realm_state_proof_hash,
    ...body
  } = proof;
  if (sha256(stableStringify(body)) !== dema_realm_state_proof_hash) {
    return reject("dema_realm_state_proof_hash_mismatch");
  }
  let ok;
  try {
    ok = verifyPayload(body, dema_realm_state_signature_b64, operatorPubkeyPem);
  } catch {
    return reject("signature_invalid");
  }
  if (!ok) return reject("signature_invalid");

  return Object.freeze({
    verified: true,
    dema_realm_state_proof_hash,
    boundary: Object.freeze({ ...proof.claim_boundary }),
  });
}
