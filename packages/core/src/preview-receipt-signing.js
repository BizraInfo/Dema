// PREVIEW-RECEIPT-SIGNING-1A — bind preview-stack receipts to the existing Ed25519
// signing rail via a canonical envelope adapter. No new signing system: the
// canonical stringify, hash, signature primitives, and key-store loaders are the
// SAME modules used by node0-receipt-signing-ed25519.js (#307/#308).
//
// Signing authority ≠ execution authority. A signature attests preview-receipt
// identity; it grants no runtime, network, mint, autonomy, or public-safe power.
//
// Pure kernel: no fs / network / process / clock / random. Keypair generation and
// key-store loaders are INJECTED by callers (the review gate injects the existing
// generateEd25519Keypair); `signedAt` is an injected timestamp with a fixed default.

import { createPublicKey } from "node:crypto";
import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import {
  signPayload,
  verifyPayload,
} from "../../receipts/src/authorship-signature.js";
import {
  loadActiveKeyPair,
} from "../../receipts/src/authorship-key-store.js";

export const PREVIEW_RECEIPT_SIGNING_SCHEMA = "bizra.dema.preview_receipt_signing.v0.1";
export const PREVIEW_RECEIPT_SIGNING_TRUTH_LABEL = "PREVIEW_RECEIPT_SIGNING_MEASURED_REPO";
export const PREVIEW_RECEIPT_SIGNING_GO_PHRASE = "GO: sign preview-stack receipt";

const EXPECTED_SIGN_CONSENT_HASH = `sha256:${sha256(PREVIEW_RECEIPT_SIGNING_GO_PHRASE)}`;

// Fields added by signing on top of the canonical unsigned body. Verification
// reconstructs the unsigned body by stripping exactly these and restoring the
// unsigned markers, so the signature binds the WHOLE body, not a subset.
const SIGNING_METADATA_FIELDS = Object.freeze(["signed_at", "consent"]);

function publicKeyFingerprintFromPem(publicKeyPem) {
  const der = createPublicKey(publicKeyPem).export({ type: "spki", format: "der" });
  return sha256(der.toString("hex"));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

// All-false boundary invariant. These keys mirror the capability-truth-registry
// row boundary — keep them all false; flipping any one is an execution claim.
// `public_safe_claim: false` = signing a preview receipt never makes it public-safe.
export function previewReceiptSigningBoundary() {
  return Object.freeze({
    execution_allowed: false,
    daemon_started: false,
    network_used: false,
    token_minted: false,
    wallet_accessed: false,
    live_execution_performed: false,
    file_mutation_performed: false,
    model_invocation_performed: false,
    public_safe_claim: false,
  });
}

const BOUNDARY_KEYS = Object.freeze(Object.keys(previewReceiptSigningBoundary()));

function boundaryIsCanonicalAllFalse(boundary) {
  if (!boundary || typeof boundary !== "object") return false;
  const keys = Object.keys(boundary);
  if (keys.length !== BOUNDARY_KEYS.length) return false;
  return BOUNDARY_KEYS.every((k) => boundary[k] === false);
}

// Positive eligibility: the input must PROVE it is a preview-stack report.
// `mode === "preview_only"` is the discriminator that keeps execute receipts and
// arbitrary objects out of this adapter (execute receipts sign via the #307 rail).
export function isEligiblePreviewForSigning(preview) {
  if (!preview || typeof preview !== "object") {
    return Object.freeze({ eligible: false, blocked_by: Object.freeze(["preview_not_object"]) });
  }
  const blocked_by = [];
  if (typeof preview.schema !== "string" || !preview.schema.startsWith("bizra.dema.")) {
    blocked_by.push("preview_schema_missing");
  }
  if (preview.mode !== "preview_only") {
    blocked_by.push("preview_mode_required");
  }
  if (previewReceiptExposesPrivateKeyMaterial(preview)) {
    blocked_by.push("private_key_material_in_preview");
  }
  return Object.freeze({
    eligible: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

// Fail-closed plan. Collect every reason the action is blocked; eligible only
// when nothing blocks. Exact GO-phrase byte match — no fuzzy / partial consent.
export function planPreviewReceiptSigning({ consent, input } = {}) {
  const blocked_by = [];
  if (consent !== PREVIEW_RECEIPT_SIGNING_GO_PHRASE) {
    blocked_by.push("consent_phrase_mismatch");
  }
  if (!input || typeof input !== "object") {
    blocked_by.push("input_not_object");
  } else {
    blocked_by.push(...isEligiblePreviewForSigning(input).blocked_by);
  }
  return Object.freeze({
    schema: PREVIEW_RECEIPT_SIGNING_SCHEMA,
    truth_label: PREVIEW_RECEIPT_SIGNING_TRUTH_LABEL,
    consent_ok: !blocked_by.includes("consent_phrase_mismatch"),
    eligible: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

// Canonical, content-addressed UNSIGNED envelope. The whole source preview is
// embedded and the content_hash binds the whole body (preview + markers +
// boundary), so verify re-derives over the body, never a subset. The unsigned
// state is explicit: `signed: false, signature: null`.
export function buildPreviewReceiptSigningPayload(input) {
  const eligibility = isEligiblePreviewForSigning(input);
  if (!eligibility.eligible) {
    throw new Error(`preview_not_eligible:${eligibility.blocked_by.join(",")}`);
  }
  const body = {
    schema: PREVIEW_RECEIPT_SIGNING_SCHEMA,
    truth_label: PREVIEW_RECEIPT_SIGNING_TRUTH_LABEL,
    source_schema: input.schema,
    source_truth_label: typeof input.truth_label === "string" ? input.truth_label : null,
    source_mode: "preview_only",
    preview: input,
    signed: false,
    signature: null,
    boundary: previewReceiptSigningBoundary(),
  };
  const content_hash = `sha256:${sha256(stableStringify(body))}`;
  return deepFreeze({ ...body, content_hash });
}

// Reconstruct the canonical unsigned envelope from any (signed or unsigned)
// envelope: strip signing metadata, restore the unsigned markers, keep the
// stored content_hash OUT (it is recomputed independently).
function reconstructUnsignedBody(envelope) {
  const body = { ...envelope, signed: false, signature: null };
  delete body.content_hash;
  for (const field of SIGNING_METADATA_FIELDS) delete body[field];
  return body;
}

function signatureMetadataComplete(signature) {
  return (
    signature &&
    typeof signature === "object" &&
    signature.algorithm === "ed25519" &&
    typeof signature.value === "string" &&
    signature.value.length > 0 &&
    typeof signature.public_key_fingerprint === "string" &&
    /^[a-f0-9]{64}$/.test(signature.public_key_fingerprint) &&
    typeof signature.public_key_pem === "string" &&
    signature.public_key_pem.includes("BEGIN PUBLIC KEY")
  );
}

// Body-bound re-derivation verifier. Recomputes the whole-body hash and, for
// signed envelopes, verifies the Ed25519 signature over the SIGNING SUBJECT —
// the canonical unsigned envelope (hash included) PLUS the consent block — the
// INDEPENDENT anchor that rejects a forged field even when the forger recomputed
// a self-consistent content_hash. The displayed public-key fingerprint must
// re-derive from the embedded PEM: a signature proves a key signed a subject;
// the fingerprint match proves the displayed identity is that key.
export function verifyPreviewReceiptSigning(envelope, { publicKeyPem } = {}) {
  if (!envelope || typeof envelope !== "object") {
    return { ok: false, reason: "envelope_not_object" };
  }
  if (envelope.schema !== PREVIEW_RECEIPT_SIGNING_SCHEMA) {
    return { ok: false, reason: "schema_mismatch" };
  }
  if (!boundaryIsCanonicalAllFalse(envelope.boundary)) {
    return { ok: false, reason: "boundary_invariant_violated" };
  }
  if (typeof envelope.content_hash !== "string") {
    return { ok: false, reason: "content_hash_missing" };
  }
  const body = reconstructUnsignedBody(envelope);
  const recomputed = `sha256:${sha256(stableStringify(body))}`;
  if (recomputed !== envelope.content_hash) {
    return { ok: false, reason: "content_hash_mismatch" };
  }
  if (envelope.signed === false) {
    if (envelope.signature !== null) {
      return { ok: false, reason: "unsigned_envelope_carries_signature" };
    }
    if ("signed_at" in envelope || "consent" in envelope) {
      return { ok: false, reason: "unsigned_envelope_carries_signing_metadata" };
    }
    return { ok: true, signed: false };
  }
  if (envelope.signed !== true) {
    return { ok: false, reason: "signed_marker_invalid" };
  }
  if (!signatureMetadataComplete(envelope.signature)) {
    return { ok: false, reason: "signature_metadata_incomplete" };
  }
  let derivedFingerprint;
  try {
    derivedFingerprint = publicKeyFingerprintFromPem(envelope.signature.public_key_pem);
  } catch {
    return { ok: false, reason: "public_key_invalid" };
  }
  if (derivedFingerprint !== envelope.signature.public_key_fingerprint) {
    return { ok: false, reason: "public_key_fingerprint_mismatch" };
  }
  if (envelope.consent?.go_phrase_hash !== EXPECTED_SIGN_CONSENT_HASH) {
    return { ok: false, reason: "consent_hash_invalid" };
  }
  if (envelope.consent?.mode !== "exact_sign") {
    return { ok: false, reason: "consent_mode_invalid" };
  }
  const keyPem = publicKeyPem || envelope.signature.public_key_pem;
  // Reconstruct the signing subject exactly as signed: unsigned envelope +
  // content_hash + the stored consent block. A signature made over a subject
  // WITHOUT the consent block (or with a different one) must fail here.
  const signedOver = {
    ...body,
    content_hash: envelope.content_hash,
    consent: envelope.consent,
  };
  const valid = verifyPayload(signedOver, envelope.signature.value, keyPem);
  if (!valid) {
    return { ok: false, reason: "signature_invalid" };
  }
  return { ok: true, signed: true };
}

function blockedSigning(plan, extraBlocks = []) {
  const blocked_by = [...new Set([...(plan?.blocked_by || []), ...extraBlocks])];
  return Object.freeze({
    schema: PREVIEW_RECEIPT_SIGNING_SCHEMA,
    truth_label: PREVIEW_RECEIPT_SIGNING_TRUTH_LABEL,
    signed: false,
    blocked_by: Object.freeze(blocked_by),
    boundary: previewReceiptSigningBoundary(),
  });
}

// Sign a preview receipt through the existing rail. The signature is computed by
// authorship-signature.js signPayload over the SIGNING SUBJECT: the canonical
// unsigned envelope (content_hash included) plus the consent block — so the
// exact-consent assertion is inside the signed bytes, not attached beside them.
// content_hash itself stays the consent-free unsigned-body hash. The displayed
// fingerprint is always re-derived from the PEM; a mismatched caller-supplied
// fingerprint blocks instead of shipping a false identity. Blocked results are
// fail-closed and clearly unsigned.
export function signPreviewReceipt({
  preview,
  consent,
  privateKeyPem,
  publicKeyPem,
  publicKeyFingerprint,
  signedAt = "2026-07-06T00:00:00.000Z",
} = {}) {
  const plan = planPreviewReceiptSigning({ consent, input: preview });
  if (!plan.eligible) {
    return blockedSigning(plan);
  }
  if (!privateKeyPem || !publicKeyPem) {
    return blockedSigning(plan, ["signing_key_material_missing"]);
  }
  let derivedFingerprint;
  try {
    derivedFingerprint = publicKeyFingerprintFromPem(publicKeyPem);
  } catch {
    return blockedSigning(plan, ["public_key_invalid"]);
  }
  if (publicKeyFingerprint && publicKeyFingerprint !== derivedFingerprint) {
    return blockedSigning(plan, ["public_key_fingerprint_mismatch"]);
  }
  const unsigned = buildPreviewReceiptSigningPayload(preview);
  const consentBlock = {
    go_phrase_hash: EXPECTED_SIGN_CONSENT_HASH,
    mode: "exact_sign",
  };
  const signatureValue = signPayload(
    { ...unsigned, consent: consentBlock },
    privateKeyPem,
  );
  return deepFreeze({
    ...unsigned,
    signed: true,
    signed_at: signedAt,
    signature: {
      algorithm: "ed25519",
      value: signatureValue,
      public_key_fingerprint: derivedFingerprint,
      public_key_pem: publicKeyPem,
    },
    consent: consentBlock,
  });
}

// Key-store variant: same rail, operator keys under DEMA_HOME. Loaders are
// injected (defaults are the #307 authorship key-store readers).
export async function signPreviewReceiptWithKeyStore({
  preview,
  consent,
  demaHome,
  loadActiveKeyPairFn = loadActiveKeyPair,
  signedAt,
} = {}) {
  const plan = planPreviewReceiptSigning({ consent, input: preview });
  if (!plan.eligible) {
    return blockedSigning(plan);
  }
  const activePair = await loadActiveKeyPairFn(demaHome);
  const privateKeyPem = activePair?.ok ? activePair.private_key_pem : null;
  const publicKeyPem = activePair?.ok ? activePair.public_key_pem : null;
  if (!privateKeyPem || !publicKeyPem) {
    return blockedSigning(plan, ["key_store_unavailable"]);
  }
  return signPreviewReceipt({ preview, consent, privateKeyPem, publicKeyPem, signedAt });
}

export function previewReceiptExposesPrivateKeyMaterial(value) {
  const serialized = stableStringify(value);
  return (
    /BEGIN PRIVATE KEY/i.test(serialized) ||
    /private_key_pem/i.test(serialized) ||
    /"private_key"/i.test(serialized)
  );
}

// Orchestrator the review gate consumes. Runs the whole proof loop:
// plan -> unsigned envelope (marked unsigned) -> sign -> verify -> hash-stability
// -> tamper-reject -> forge-and-recompute launder-reject -> fingerprint-swap
// reject -> consent-swap reject -> key-leak scan.
export function runPreviewReceiptSigning({ consent, input, generateKeypair, signedAt } = {}) {
  const blocked_by = [];
  const plan = planPreviewReceiptSigning({ consent, input });
  if (!plan.eligible) {
    blocked_by.push(...plan.blocked_by);
  }

  let unsigned = null;
  let signed = null;
  let unsigned_marked_unsigned = false;
  let signed_has_signature_metadata = false;
  let verify_signed_ok = false;
  let hash_stable = false;
  let tamper_hash_rejected = false;
  let launder_rejected = false;
  let fingerprint_tamper_rejected = false;
  let consent_tamper_rejected = false;

  if (blocked_by.length === 0) {
    unsigned = buildPreviewReceiptSigningPayload(input);
    const unsignedVerdict = verifyPreviewReceiptSigning(unsigned);
    unsigned_marked_unsigned =
      unsignedVerdict.ok === true &&
      unsignedVerdict.signed === false &&
      unsigned.signed === false &&
      unsigned.signature === null;
    if (!unsigned_marked_unsigned) {
      blocked_by.push("unsigned_envelope_not_marked_unsigned");
    }

    hash_stable =
      buildPreviewReceiptSigningPayload(input).content_hash === unsigned.content_hash;
    if (!hash_stable) blocked_by.push("content_hash_not_stable");

    const keys = typeof generateKeypair === "function" ? generateKeypair() : null;
    if (!keys?.private_key_pem || !keys?.public_key_pem) {
      blocked_by.push("signing_keypair_missing");
    } else {
      signed = signPreviewReceipt({
        preview: input,
        consent,
        privateKeyPem: keys.private_key_pem,
        publicKeyPem: keys.public_key_pem,
        publicKeyFingerprint: keys.public_key_fingerprint,
        signedAt,
      });
      if (signed.signed !== true) {
        blocked_by.push(...(signed.blocked_by || []));
      } else {
        signed_has_signature_metadata = signatureMetadataComplete(signed.signature);
        if (!signed_has_signature_metadata) {
          blocked_by.push("signature_metadata_incomplete");
        }
        if (signed.content_hash !== unsigned.content_hash) {
          blocked_by.push("signed_content_hash_diverged");
        }

        const signedVerdict = verifyPreviewReceiptSigning(signed, {
          publicKeyPem: keys.public_key_pem,
        });
        verify_signed_ok = signedVerdict.ok === true && signedVerdict.signed === true;
        if (!verify_signed_ok) blocked_by.push(`verify:${signedVerdict.reason}`);

        const tamperedHash = {
          ...signed,
          content_hash: `sha256:${sha256("tampered")}`,
        };
        tamper_hash_rejected =
          verifyPreviewReceiptSigning(tamperedHash).ok === false;
        if (!tamper_hash_rejected) blocked_by.push("tamper_hash_not_rejected");

        // Launder attempt: forge a field AND recompute a self-consistent
        // content_hash. The signature anchor must still reject it.
        const forgedBody = reconstructUnsignedBody({
          ...signed,
          source_truth_label: "FORGED",
        });
        const forged = {
          ...signed,
          source_truth_label: "FORGED",
          content_hash: `sha256:${sha256(stableStringify(forgedBody))}`,
        };
        launder_rejected = verifyPreviewReceiptSigning(forged).ok === false;
        if (!launder_rejected) blocked_by.push("forged_and_recomputed_not_rejected");

        // Fingerprint swap: same signature and PEM, different displayed
        // fingerprint — the displayed identity must re-derive from the PEM.
        const fingerprintTamper = {
          ...signed,
          signature: {
            ...signed.signature,
            public_key_fingerprint: sha256("some-other-key"),
          },
        };
        fingerprint_tamper_rejected =
          verifyPreviewReceiptSigning(fingerprintTamper).ok === false;
        if (!fingerprint_tamper_rejected) {
          blocked_by.push("fingerprint_tamper_not_rejected");
        }

        // Consent swap: a different go_phrase_hash must fail even though the
        // signature bytes are untouched — consent is part of the signed subject.
        const consentTamper = {
          ...signed,
          consent: {
            ...signed.consent,
            go_phrase_hash: `sha256:${sha256("some other phrase")}`,
          },
        };
        consent_tamper_rejected =
          verifyPreviewReceiptSigning(consentTamper).ok === false;
        if (!consent_tamper_rejected) {
          blocked_by.push("consent_tamper_not_rejected");
        }

        if (previewReceiptExposesPrivateKeyMaterial(signed)) {
          blocked_by.push("private_key_leaked_in_envelope");
        }
      }
    }
  }

  return deepFreeze({
    ok: blocked_by.length === 0,
    schema: PREVIEW_RECEIPT_SIGNING_SCHEMA,
    truth_label: PREVIEW_RECEIPT_SIGNING_TRUTH_LABEL,
    source_schema: unsigned?.source_schema ?? null,
    content_hash: unsigned?.content_hash ?? null,
    unsigned_marked_unsigned,
    signed_has_signature_metadata,
    verify_signed_ok,
    hash_stable,
    tamper_hash_rejected,
    launder_rejected,
    fingerprint_tamper_rejected,
    consent_tamper_rejected,
    blocked_by: Object.freeze(blocked_by),
    boundary: previewReceiptSigningBoundary(),
    unsigned_envelope: unsigned,
    signed_envelope: signed,
  });
}
