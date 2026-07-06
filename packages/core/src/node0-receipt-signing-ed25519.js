// NODE0-RECEIPT-SIGNING-ED25519-1A — Ed25519 attestation bridge for #306 execute receipts.
//
// Signing authority ≠ execution authority. The private key attests receipt identity;
// it does not grant new filesystem, operator, or runtime execution power.

import { createHash, createPublicKey } from "node:crypto";
import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import {
  signPayload,
  verifyPayload,
} from "../../receipts/src/authorship-signature.js";
import {
  loadPrivateKey,
  loadPublicKey,
} from "../../receipts/src/authorship-key-store.js";
import {
  NODE0_REVERSIBLE_EXECUTE_RECEIPT_SCHEMA,
  recomputeReceiptContentHash,
  recomputeReceiptStateHash,
  verifyExecuteReceipt,
  planReversibleRename,
  executeReversibleRename,
  defaultNode0ReversibleExecuteGateFixture,
} from "./node0-reversible-execute-gate.js";

export const NODE0_RECEIPT_SIGNING_ED25519_SCHEMA =
  "bizra.dema.node0_receipt_signing_ed25519.v0.1";
// v0.2 (NODE0-RECEIPT-SIGNING-PARITY-1A): the consent assertion moved INSIDE the
// signed payload, matching PREVIEW-RECEIPT-SIGNING-1A semantics — the signature
// attests "signed under this exact consent", not merely "these bytes were signed".
export const NODE0_RECEIPT_ATTESTATION_PAYLOAD_SCHEMA =
  "bizra.dema.node0_receipt_attestation_payload.v0.2";
export const NODE0_RECEIPT_SIGNING_TRUTH_LABEL =
  "NODE0_SIGNED_SANDBOX_RECEIPT_ATTESTATION";
export const NODE0_RECEIPT_SIGNING_GO_PHRASE =
  "GO: sign sandbox execute receipt attestation";

const EXPECTED_SIGN_CONSENT_HASH = `sha256:${sha256(NODE0_RECEIPT_SIGNING_GO_PHRASE)}`;

function sha256Hex(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function publicKeyFingerprintFromPem(publicKeyPem) {
  const der = createPublicKey(publicKeyPem).export({ type: "spki", format: "der" });
  return sha256(der.toString("hex"));
}

function attestationBoundary() {
  return Object.freeze({
    signing_authority_not_execution: true,
    execution_authority_granted: false,
    network_used: false,
    federation_used: false,
    token_minted: false,
    wallet_accessed: false,
    private_key_exposed: false,
    operator_path_mutation: false,
    sandbox_execute_receipt_only: true,
  });
}

function blockedAttestation(plan, extraBlocks = [], extra = {}) {
  const blocked_by = [...new Set([...(plan?.blocked_by || []), ...extraBlocks])];
  return Object.freeze({
    schema: NODE0_RECEIPT_SIGNING_ED25519_SCHEMA,
    truth_label: NODE0_RECEIPT_SIGNING_TRUTH_LABEL,
    signed: false,
    blocked_by: Object.freeze(blocked_by),
    boundary: attestationBoundary(),
    ...extra,
  });
}

export function isEligibleExecuteReceiptForAttestation(receipt) {
  if (!receipt || typeof receipt !== "object") {
    return { eligible: false, blocked_by: ["receipt_not_object"] };
  }
  if (receipt.schema !== NODE0_REVERSIBLE_EXECUTE_RECEIPT_SCHEMA) {
    return { eligible: false, blocked_by: ["source_receipt_schema_mismatch"] };
  }
  if (receipt.executed !== true) {
    return { eligible: false, blocked_by: ["source_receipt_not_executed"] };
  }
  const blocked_by = [];
  if (!receipt.content_hash || typeof receipt.content_hash !== "string") {
    blocked_by.push("content_hash_missing");
  }
  if (!receipt.state_hash || typeof receipt.state_hash !== "string") {
    blocked_by.push("state_hash_missing");
  }
  if (
    receipt.content_hash &&
    recomputeReceiptContentHash(receipt) !== receipt.content_hash
  ) {
    blocked_by.push("source_content_hash_invalid");
  }
  if (receipt.state_hash && recomputeReceiptStateHash(receipt) !== receipt.state_hash) {
    blocked_by.push("source_state_hash_invalid");
  }
  return Object.freeze({
    eligible: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

export function planReceiptSigning({ consent, receipt } = {}) {
  const blocked_by = [];
  if (consent !== NODE0_RECEIPT_SIGNING_GO_PHRASE) {
    blocked_by.push("consent_phrase_mismatch");
  }
  const eligibility = isEligibleExecuteReceiptForAttestation(receipt);
  blocked_by.push(...eligibility.blocked_by);
  return Object.freeze({
    schema: NODE0_RECEIPT_SIGNING_ED25519_SCHEMA,
    truth_label: NODE0_RECEIPT_SIGNING_TRUTH_LABEL,
    consent_ok: !blocked_by.includes("consent_phrase_mismatch"),
    eligible: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

export function buildExecuteReceiptAttestationPayload(receipt) {
  const eligibility = isEligibleExecuteReceiptForAttestation(receipt);
  if (!eligibility.eligible) {
    throw new Error(`receipt_not_eligible:${eligibility.blocked_by.join(",")}`);
  }
  return Object.freeze({
    schema: NODE0_RECEIPT_ATTESTATION_PAYLOAD_SCHEMA,
    source_receipt_schema: receipt.schema,
    content_hash: receipt.content_hash,
    state_hash: receipt.state_hash,
    truth_label: NODE0_RECEIPT_SIGNING_TRUTH_LABEL,
    // Consent is part of the signed subject: a signature over a payload without
    // this block is not an attestation under the GO phrase and must not verify.
    consent: Object.freeze({
      go_phrase_hash: EXPECTED_SIGN_CONSENT_HASH,
      mode: "exact_sign",
    }),
    boundary: attestationBoundary(),
  });
}

export function signExecuteReceiptAttestation({
  receipt,
  consent,
  privateKeyPem,
  publicKeyPem,
  publicKeyFingerprint,
  signedAt = "2026-06-28T18:00:00.000Z",
} = {}) {
  const plan = planReceiptSigning({ consent, receipt });
  if (!plan.eligible) {
    return blockedAttestation(plan);
  }
  if (!privateKeyPem || !publicKeyPem) {
    return blockedAttestation(plan, ["signing_key_material_missing"]);
  }
  // The displayed fingerprint is always re-derived from the PEM; a mismatched
  // caller-supplied fingerprint blocks instead of shipping a false identity.
  let fingerprint;
  try {
    fingerprint = publicKeyFingerprintFromPem(publicKeyPem);
  } catch {
    return blockedAttestation(plan, ["public_key_invalid"]);
  }
  if (publicKeyFingerprint && publicKeyFingerprint !== fingerprint) {
    return blockedAttestation(plan, ["public_key_fingerprint_mismatch"]);
  }
  const payload = buildExecuteReceiptAttestationPayload(receipt);
  const signatureValue = signPayload(payload, privateKeyPem);
  return Object.freeze({
    schema: NODE0_RECEIPT_SIGNING_ED25519_SCHEMA,
    truth_label: NODE0_RECEIPT_SIGNING_TRUTH_LABEL,
    signed: true,
    signed_at: signedAt,
    payload,
    signature: Object.freeze({
      algorithm: "ed25519",
      value: signatureValue,
      public_key_fingerprint: fingerprint,
      public_key_pem: publicKeyPem,
    }),
    consent: Object.freeze({
      go_phrase_hash: EXPECTED_SIGN_CONSENT_HASH,
      mode: "exact_sign",
    }),
    blocked_by: Object.freeze([]),
    boundary: attestationBoundary(),
  });
}

export function verifyExecuteReceiptAttestation(attestation, { publicKeyPem } = {}) {
  if (!attestation || typeof attestation !== "object") {
    return { ok: false, reason: "attestation_not_object" };
  }
  if (attestation.schema !== NODE0_RECEIPT_SIGNING_ED25519_SCHEMA) {
    return { ok: false, reason: "schema_mismatch" };
  }
  if (attestation.signed !== true) {
    return { ok: false, reason: "not_signed" };
  }
  const payload = attestation.payload;
  if (!payload || payload.schema !== NODE0_RECEIPT_ATTESTATION_PAYLOAD_SCHEMA) {
    return { ok: false, reason: "payload_schema_mismatch" };
  }
  const b = attestation.boundary;
  if (
    !b ||
    b.signing_authority_not_execution !== true ||
    b.execution_authority_granted !== false ||
    b.private_key_exposed !== false
  ) {
    return { ok: false, reason: "boundary_invariant_violated" };
  }
  if (
    attestation.consent?.go_phrase_hash !== EXPECTED_SIGN_CONSENT_HASH
  ) {
    return { ok: false, reason: "consent_hash_invalid" };
  }
  // Consent must be INSIDE the signed subject (payload), not merely attached to
  // the attestation: a valid signature over a consent-free payload is not an
  // attestation under the GO phrase.
  if (
    payload.consent?.go_phrase_hash !== EXPECTED_SIGN_CONSENT_HASH ||
    payload.consent?.mode !== "exact_sign"
  ) {
    return { ok: false, reason: "consent_not_in_signed_subject" };
  }
  const keyPem = publicKeyPem || attestation.signature?.public_key_pem;
  if (!keyPem || !attestation.signature?.value) {
    return { ok: false, reason: "public_key_or_signature_missing" };
  }
  // The displayed fingerprint must re-derive from the key that actually
  // verifies the signature — a signature proves a key signed a subject; the
  // fingerprint match proves the displayed identity is that key.
  let derivedFingerprint;
  try {
    derivedFingerprint = publicKeyFingerprintFromPem(keyPem);
  } catch {
    return { ok: false, reason: "public_key_invalid" };
  }
  if (derivedFingerprint !== attestation.signature?.public_key_fingerprint) {
    return { ok: false, reason: "public_key_fingerprint_mismatch" };
  }
  const valid = verifyPayload(payload, attestation.signature.value, keyPem);
  if (!valid) {
    return { ok: false, reason: "signature_invalid" };
  }
  return { ok: true };
}

export function attestationBindsExecuteReceipt(receipt, attestation) {
  const verified = verifyExecuteReceiptAttestation(attestation);
  if (!verified.ok) {
    return verified;
  }
  if (receipt?.schema !== attestation.payload.source_receipt_schema) {
    return { ok: false, reason: "source_receipt_schema_bind_failed" };
  }
  if (receipt?.content_hash !== attestation.payload.content_hash) {
    return { ok: false, reason: "content_hash_bind_failed" };
  }
  if (receipt?.state_hash !== attestation.payload.state_hash) {
    return { ok: false, reason: "state_hash_bind_failed" };
  }
  return { ok: true };
}

export function attestationExposesPrivateKeyMaterial(attestation) {
  const serialized = stableStringify(attestation);
  return (
    /BEGIN PRIVATE KEY/i.test(serialized) ||
    /private_key_pem/i.test(serialized) ||
    /"private_key"/i.test(serialized)
  );
}

export async function signExecuteReceiptAttestationWithKeyStore({
  receipt,
  consent,
  demaHome,
  loadPrivateKeyFn = loadPrivateKey,
  loadPublicKeyFn = loadPublicKey,
  signedAt,
} = {}) {
  const plan = planReceiptSigning({ consent, receipt });
  if (!plan.eligible) {
    return blockedAttestation(plan);
  }
  const privateKeyPem = await loadPrivateKeyFn(demaHome);
  const publicKeyPem = await loadPublicKeyFn(demaHome);
  if (!privateKeyPem || !publicKeyPem) {
    return blockedAttestation(plan, ["key_store_unavailable"]);
  }
  return signExecuteReceiptAttestation({
    receipt,
    consent,
    privateKeyPem,
    publicKeyPem,
    signedAt,
  });
}

export function runNode0ReceiptSigningEd25519({
  fs,
  sandboxRoot,
  fixture = defaultNode0ReversibleExecuteGateFixture(),
  now = "2026-06-28T18:00:00.000Z",
  generateKeypair,
} = {}) {
  const blocked_by = [];
  if (
    !fs ||
    typeof fs.renameSync !== "function" ||
    typeof fs.realpathSync !== "function"
  ) {
    blocked_by.push("fs_adapter_missing");
  }

  const plan = planReversibleRename({
    sandboxRoot,
    fileName: fixture.fileName,
    newName: fixture.newName,
    goPhrase: fixture.goPhrase,
    actionType: fixture.actionType,
  });
  if (!plan.eligible) {
    blocked_by.push(...plan.blocked_by);
  }

  let receipt = null;
  if (blocked_by.length === 0) {
    receipt = executeReversibleRename({ plan, fs, now });
    if (receipt.executed !== true) {
      blocked_by.push(...(receipt.blocked_by || []));
    } else {
      const integrity = verifyExecuteReceipt(receipt, { fs });
      if (!integrity.ok) {
        blocked_by.push(`unsigned_integrity:${integrity.reason}`);
      }
    }
  }

  let attestation = null;
  let verify = null;
  let bind = null;
  let tamper_content_hash = null;
  let tamper_state_hash = null;
  let fingerprint_tamper_rejected = false;
  let consent_tamper_rejected = false;
  let bare_payload_signature_rejected = false;
  let unsigned_integrity_ok = receipt
    ? verifyExecuteReceipt(receipt, { fs }).ok
    : false;

  if (blocked_by.length === 0) {
    const keys =
      typeof generateKeypair === "function"
        ? generateKeypair()
        : null;
    if (!keys?.private_key_pem || !keys?.public_key_pem) {
      blocked_by.push("signing_keypair_missing");
    } else {
      attestation = signExecuteReceiptAttestation({
        receipt,
        consent: NODE0_RECEIPT_SIGNING_GO_PHRASE,
        privateKeyPem: keys.private_key_pem,
        publicKeyPem: keys.public_key_pem,
        publicKeyFingerprint: keys.public_key_fingerprint,
        signedAt: now,
      });
      if (attestation.signed !== true) {
        blocked_by.push(...(attestation.blocked_by || []));
      } else {
        verify = verifyExecuteReceiptAttestation(attestation, {
          publicKeyPem: keys.public_key_pem,
        });
        if (!verify.ok) blocked_by.push(`verify:${verify.reason}`);

        bind = attestationBindsExecuteReceipt(receipt, attestation);
        if (!bind.ok) blocked_by.push(`bind:${bind.reason}`);

        if (attestationExposesPrivateKeyMaterial(attestation)) {
          blocked_by.push("private_key_leaked_in_attestation");
        }

        const tamperedContent = {
          ...receipt,
          content_hash: `sha256:${sha256Hex("tampered")}`,
        };
        tamper_content_hash = attestationBindsExecuteReceipt(
          tamperedContent,
          attestation,
        );
        if (tamper_content_hash.ok) {
          blocked_by.push("tamper_content_hash_not_rejected");
        }

        const tamperedState = {
          ...receipt,
          state_hash: `sha256:${sha256Hex("tampered-state")}`,
        };
        tamper_state_hash = attestationBindsExecuteReceipt(
          tamperedState,
          attestation,
        );
        if (tamper_state_hash.ok) {
          blocked_by.push("tamper_state_hash_not_rejected");
        }

        // Parity scenarios (NODE0-RECEIPT-SIGNING-PARITY-1A):
        // swapped displayed fingerprint must fail against the verifying key.
        const fingerprintTamper = {
          ...attestation,
          signature: {
            ...attestation.signature,
            public_key_fingerprint: sha256("some-other-key"),
          },
        };
        fingerprint_tamper_rejected =
          verifyExecuteReceiptAttestation(fingerprintTamper, {
            publicKeyPem: keys.public_key_pem,
          }).ok === false;
        if (!fingerprint_tamper_rejected) {
          blocked_by.push("fingerprint_tamper_not_rejected");
        }

        // altered displayed consent must fail even with untouched signature.
        const consentTamper = {
          ...attestation,
          consent: {
            ...attestation.consent,
            go_phrase_hash: `sha256:${sha256Hex("some other phrase")}`,
          },
        };
        consent_tamper_rejected =
          verifyExecuteReceiptAttestation(consentTamper, {
            publicKeyPem: keys.public_key_pem,
          }).ok === false;
        if (!consent_tamper_rejected) {
          blocked_by.push("consent_tamper_not_rejected");
        }

        // a valid signature over a consent-free payload must not verify:
        // consent is inside the signed subject, not attached beside it.
        const { consent: _payloadConsent, ...barePayload } = attestation.payload;
        const bareForged = {
          ...attestation,
          payload: barePayload,
          signature: {
            ...attestation.signature,
            value: signPayload(barePayload, keys.private_key_pem),
          },
        };
        bare_payload_signature_rejected =
          verifyExecuteReceiptAttestation(bareForged, {
            publicKeyPem: keys.public_key_pem,
          }).ok === false;
        if (!bare_payload_signature_rejected) {
          blocked_by.push("bare_payload_signature_not_rejected");
        }
      }
    }
  }

  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: NODE0_RECEIPT_SIGNING_ED25519_SCHEMA,
    truth_label: NODE0_RECEIPT_SIGNING_TRUTH_LABEL,
    sandbox_root: sandboxRoot ?? null,
    content_hash: receipt?.content_hash ?? null,
    state_hash: receipt?.state_hash ?? null,
    attestation_signed: attestation?.signed === true,
    verify_ok: verify?.ok === true,
    bind_ok: bind?.ok === true,
    tamper_content_hash_rejected: tamper_content_hash?.ok === false,
    tamper_state_hash_rejected: tamper_state_hash?.ok === false,
    fingerprint_tamper_rejected,
    consent_tamper_rejected,
    bare_payload_signature_rejected,
    unsigned_integrity_ok,
    blocked_by: Object.freeze(blocked_by),
    receipt,
    attestation,
  });
}
