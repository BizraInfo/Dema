// KEYCONSENT-INTEGRATION-PROOF · functional attestation that the consent gate
// enforces (for the Block0 keyconsent_integration slot).
//
// keyconsent_integration is NOT a hash slot — the manifest commits
// keyconsent_integration_complete (bool) + keyconsent_truth_labels (array). An
// honest proof can NOT be a rubber-stamp on the boolean. So this producer
// FUNCTIONALLY exercises the real consent kernel at produce-time:
//   - a valid consent proof verifies (gate ACCEPTS valid),
//   - the same proof under a wrong action-scope is rejected (gate REJECTS scope),
//   - the same proof after expiry is rejected (gate REJECTS expired).
// `keyconsent_integration_complete` is DERIVED from those real results (not
// asserted), and the labels record which checks measured true. The attestation
// is operator-signed; the verifier confirms the signature + that every check
// passed — same producer→verifier trust model as the other genesis proofs.
//
// Pure-with-key-load: loads the operator key; no network, no clock (times
// derived from injected created_at_iso). Verification trusts ONLY the external
// pubkey.

import { createPublicKey } from "node:crypto";
import {
  signPayload,
  verifyPayload,
} from "../../receipts/src/authorship-signature.js";
import {
  loadActiveKeyPair,
} from "../../receipts/src/authorship-key-store.js";
import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import {
  buildConsentProof,
  verifyConsentProof,
} from "../../receipts/src/consent-proof.js";

export const KEYCONSENT_INTEGRATION_PROOF_SCHEMA =
  "bizra.dema.keyconsent_integration_proof.v0.1";

const PROBE_ACTION_TYPE = "KEYCONSENT_PROBE";
const PROBE_PHRASE = "KEYCONSENT PROBE";
// The required checks; keyconsent_truth_labels mirrors these 1:1 when measured.
const REQUIRED_CHECKS = Object.freeze([
  "accepts_valid",
  "rejects_wrong_scope",
  "rejects_expired",
]);
const CHECK_TO_LABEL = Object.freeze({
  accepts_valid: "MEASURED:consent_accepts_valid",
  rejects_wrong_scope: "MEASURED:consent_rejects_wrong_scope",
  rejects_expired: "MEASURED:consent_rejects_expired",
});

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

function fail(error) {
  return Object.freeze({
    schema: KEYCONSENT_INTEGRATION_PROOF_SCHEMA,
    built: false,
    truth_label: "LOCAL_KEYCONSENT_INTEGRATION_PROOF_REFUSED",
    error,
  });
}
function reject(reason) {
  return Object.freeze({ verified: false, reason });
}

function offsetIso(baseIso, ms) {
  // Deterministic time arithmetic from the injected base — NOT a wall clock.
  return new Date(Date.parse(baseIso) + ms).toISOString();
}

/**
 * Build a keyconsent integration proof by functionally exercising the consent
 * gate. Pure-with-key-load. Fail-closed.
 */
export async function buildKeyconsentIntegrationProof({
  demaHome,
  createdAtIso,
} = {}) {
  if (
    !isNonEmptyString(createdAtIso) ||
    Number.isNaN(Date.parse(createdAtIso))
  ) {
    return fail("created_at_iso_required");
  }
  const activePair = await loadActiveKeyPair(demaHome);
  const privateKeyPem = activePair.ok ? activePair.private_key_pem : null;
  const publicKeyPem = activePair.ok ? activePair.public_key_pem : null;
  if (!privateKeyPem || !publicKeyPem) return fail("no_authorship_key");

  const fp = ed25519FingerprintFromPem(publicKeyPem);
  if (fp.error) return fail(fp.error);
  const fingerprint = fp.fingerprint;

  // ── Functional probe of the real consent kernel ──────────────────────
  const probeScope = {
    action_type: PROBE_ACTION_TYPE,
    target_hash: sha256("keyconsent-integration-probe"),
  };
  const cp = await buildConsentProof({
    phrase: PROBE_PHRASE,
    actionScope: probeScope,
    demaHome,
    nonce: sha256(`keyconsent-probe-nonce:${createdAtIso}`).slice(0, 64),
    createdAtIso: offsetIso(createdAtIso, -60_000),
    expiresAtIso: offsetIso(createdAtIso, 240_000),
  });
  if (!cp.built) return fail("consent_probe_build_failed");

  const accepts = verifyConsentProof({
    consentProof: cp.consent_proof,
    pubkeyPem: publicKeyPem,
    expectedActionScope: probeScope,
    now: createdAtIso,
  });
  const rejectsWrongScope = verifyConsentProof({
    consentProof: cp.consent_proof,
    pubkeyPem: publicKeyPem,
    expectedActionScope: {
      action_type: "KEYCONSENT_WRONG",
      target_hash: probeScope.target_hash,
    },
    now: createdAtIso,
  });
  const rejectsExpired = verifyConsentProof({
    consentProof: cp.consent_proof,
    pubkeyPem: publicKeyPem,
    expectedActionScope: probeScope,
    now: offsetIso(createdAtIso, 300_000), // past expiry
  });

  const checks = {
    accepts_valid: accepts.verified === true,
    rejects_wrong_scope: rejectsWrongScope.verified === false,
    rejects_expired: rejectsExpired.verified === false,
  };
  const keyconsent_integration_complete = REQUIRED_CHECKS.every(
    (c) => checks[c] === true,
  );
  const keyconsent_truth_labels = REQUIRED_CHECKS.filter((c) => checks[c]).map(
    (c) => CHECK_TO_LABEL[c],
  );

  const body = {
    schema: KEYCONSENT_INTEGRATION_PROOF_SCHEMA,
    keyconsent_integration_complete,
    keyconsent_truth_labels,
    checks,
    operator_public_key_fingerprint: fingerprint,
    created_at_iso: createdAtIso,
  };
  const keyconsent_proof_hash = sha256(stableStringify(body));
  const keyconsent_signature_b64 = signPayload(body, privateKeyPem);

  return Object.freeze({
    schema: KEYCONSENT_INTEGRATION_PROOF_SCHEMA,
    built: true,
    truth_label: "LOCAL_KEYCONSENT_INTEGRATION_PROOF_SIGNED",
    keyconsent_integration_complete,
    keyconsent_proof_hash,
    proof: Object.freeze({
      ...body,
      keyconsent_truth_labels: Object.freeze([...keyconsent_truth_labels]),
      checks: Object.freeze({ ...checks }),
      keyconsent_signature_b64,
      keyconsent_proof_hash,
    }),
    what_this_proves: Object.freeze([
      "The local consent gate functionally accepts valid and rejects wrong-scope/expired consent.",
    ]),
    what_this_does_not_prove: Object.freeze([
      "No claim about runtime mutation coverage beyond the probed checks; no federation; no public network.",
    ]),
  });
}

/**
 * Verify a keyconsent integration proof under the EXTERNAL operator pubkey. Pure.
 * Returns verified:true only when the attestation is signed AND every required
 * check measured true (so a not-complete attestation never verifies live).
 */
export function verifyKeyconsentIntegrationProof({
  proof,
  operatorPubkeyPem,
} = {}) {
  if (!isPlainObject(proof)) return reject("proof_missing_or_malformed");
  if (proof.schema !== KEYCONSENT_INTEGRATION_PROOF_SCHEMA) {
    return reject("proof_schema_mismatch");
  }
  if (
    typeof operatorPubkeyPem !== "string" ||
    !operatorPubkeyPem.includes("BEGIN PUBLIC KEY")
  ) {
    return reject("external_pubkey_required");
  }
  const REQUIRED = [
    "keyconsent_integration_complete",
    "keyconsent_truth_labels",
    "checks",
    "operator_public_key_fingerprint",
    "created_at_iso",
    "keyconsent_signature_b64",
    "keyconsent_proof_hash",
  ];
  for (const f of REQUIRED) {
    if (proof[f] === undefined || proof[f] === null) {
      return reject(`structural_missing_field_${f}`);
    }
  }
  if (Object.keys(proof).length !== REQUIRED.length + 1 /* schema */) {
    return reject("proof_unexpected_field");
  }
  if (!isSha256Hex(proof.keyconsent_proof_hash)) {
    return reject("keyconsent_proof_hash_invalid");
  }
  if (!Array.isArray(proof.keyconsent_truth_labels)) {
    return reject("keyconsent_truth_labels_invalid");
  }
  if (!isPlainObject(proof.checks)) return reject("checks_invalid");

  const fp = ed25519FingerprintFromPem(operatorPubkeyPem);
  if (fp.error) return reject(fp.error);
  if (proof.operator_public_key_fingerprint !== fp.fingerprint) {
    return reject("operator_key_mismatch");
  }

  // Re-derive the proof hash + verify the signature over the canonical body.
  const { keyconsent_signature_b64, keyconsent_proof_hash, ...body } = proof;
  if (sha256(stableStringify(body)) !== keyconsent_proof_hash) {
    return reject("keyconsent_proof_hash_mismatch");
  }
  let ok;
  try {
    ok = verifyPayload(body, keyconsent_signature_b64, operatorPubkeyPem);
  } catch {
    return reject("signature_invalid");
  }
  if (!ok) return reject("signature_invalid");

  // Honest liveness gate: the slot is live ONLY if integration is complete AND
  // every required check measured true (a signed-but-incomplete attestation is
  // structurally valid but NOT live).
  if (proof.keyconsent_integration_complete !== true) {
    return reject("keyconsent_integration_incomplete");
  }
  for (const c of REQUIRED_CHECKS) {
    if (proof.checks[c] !== true) return reject(`keyconsent_check_failed_${c}`);
  }

  return Object.freeze({
    verified: true,
    keyconsent_proof_hash,
    keyconsent_integration_complete: true,
    keyconsent_truth_labels: Object.freeze([...proof.keyconsent_truth_labels]),
  });
}
