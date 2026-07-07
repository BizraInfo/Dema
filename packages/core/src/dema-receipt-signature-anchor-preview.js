// DEMA-RECEIPT-SIGNATURE-ANCHOR-PREVIEW-1A — Preview-only signed receipt anchor. Moves receipt
// discipline from content-addressing (self-consistent, forgeable by recompute) to a cryptographic
// signature over the WHOLE canonical envelope body, using Ed25519 with **injected** keys.
//
// The independent anchor is the signature: an attacker who changes a field AND recomputes the hash
// still cannot produce a valid signature without the private key. That is the property content-
// addressing alone could not provide (see the #334 verified-answer cache limitation).
//
// Pure kernel: no fs / network / process / clock / random. Ed25519 is deterministic (RFC 8032); keys
// are INJECTED by the caller (ephemeral preview keys in tests/gate) — the kernel generates no keys and
// binds no live Node0 identity. Boundary all-false · authority_delta 0 · grants_action false ·
// mint_allowed false.

import { createHash, sign as edSign, verify as edVerify, createPublicKey } from "node:crypto";

export const DEMA_RECEIPT_SIGNATURE_ANCHOR_PREVIEW_SCHEMA = "bizra.dema.dema_receipt_signature_anchor_preview.v0.1";
export const DEMA_RECEIPT_SIGNATURE_ANCHOR_PREVIEW_TRUTH_LABEL = "DEMA_RECEIPT_SIGNATURE_ANCHOR_PREVIEW_MEASURED_REPO";
export const DEMA_RECEIPT_SIGNATURE_ANCHOR_PREVIEW_GO_PHRASE = "GO: dema receipt signature anchor preview";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

// Canonical, deterministic serialization (sorted keys). The signer and verifier MUST agree on this;
// a signature made over any other serialization (canonicalization drift) fails verification.
function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function demaReceiptSignatureAnchorPreviewBoundary() {
  return Object.freeze({
    execution_allowed: false,
    daemon_started: false,
    network_used: false,
    token_minted: false,
    wallet_accessed: false,
    live_execution_performed: false,
    file_mutation_performed: false,
    model_invocation_performed: false,
  });
}

// Public helper: the canonical hash of a receipt payload (for callers reconstructing a payload_hash).
export function receiptPayloadHash(payload) {
  return `sha256:${sha256(stableStringify(payload))}`;
}

// Normalize any accepted public-key form to a public KeyObject. An already-public KeyObject passes
// through (createPublicKey rejects those); a private KeyObject or PEM/DER derives/parses the public key.
function toPublicKey(keyLike) {
  if (keyLike && typeof keyLike === "object" && keyLike.type === "public") return keyLike;
  return createPublicKey(keyLike);
}

// Stable id for a public key: sha256 of its SPKI DER. Used to bind an envelope to a signer.
function publicKeyId(publicKeyLike) {
  const pub = toPublicKey(publicKeyLike);
  return `sha256:${sha256(pub.export({ type: "spki", format: "der" }))}`;
}

// ---- Domain: sign / verify (keys injected) ---------------------------------

// Sign a receipt payload with an INJECTED Ed25519 private key. The signature covers the whole
// canonical body (payload + invariant fields), not just the payload.
export function signReceipt(payload, privateKeyLike) {
  const publicKey = createPublicKey(privateKeyLike); // derive signer identity from the private key
  const signer_key_id = `sha256:${sha256(publicKey.export({ type: "spki", format: "der" }))}`;
  const body = {
    schema: DEMA_RECEIPT_SIGNATURE_ANCHOR_PREVIEW_SCHEMA,
    truth_label: DEMA_RECEIPT_SIGNATURE_ANCHOR_PREVIEW_TRUTH_LABEL,
    payload,
    payload_hash: `sha256:${sha256(stableStringify(payload))}`,
    signature_alg: "ed25519",
    signer_key_id,
    authority_delta: 0,
    grants_action: false,
    mint_allowed: false,
    boundary: demaReceiptSignatureAnchorPreviewBoundary(),
  };
  const signature = edSign(null, Buffer.from(stableStringify(body), "utf8"), privateKeyLike).toString("base64");
  return Object.freeze({ ...body, signature });
}

// Verify a signed receipt against a TRUSTED public key (not the envelope's self-asserted key).
export function verifySignedReceipt(envelope, trustedPublicKeyLike) {
  if (!envelope || typeof envelope !== "object") {
    return Object.freeze({ ok: false, blocked_by: Object.freeze(["envelope_not_object"]) });
  }
  const blocked_by = [];
  const { signature, ...body } = envelope;

  // Must actually be signed.
  if (envelope.signature_alg !== "ed25519" || typeof signature !== "string" || signature.length === 0) {
    blocked_by.push("unsigned_not_accepted");
  }
  // Payload-hash internal consistency.
  if (envelope.payload_hash !== `sha256:${sha256(stableStringify(envelope.payload))}`) {
    blocked_by.push("payload_hash_mismatch");
  }
  // Signer must be the trusted key.
  let trustedId = null;
  try {
    trustedId = publicKeyId(trustedPublicKeyLike);
  } catch {
    blocked_by.push("trusted_key_invalid");
  }
  if (trustedId && envelope.signer_key_id !== trustedId) {
    blocked_by.push("signer_mismatch");
  }
  // The signature must verify over the canonical body under the trusted key.
  let sigOk = false;
  if (trustedId && typeof signature === "string") {
    try {
      sigOk = edVerify(null, Buffer.from(stableStringify(body), "utf8"), toPublicKey(trustedPublicKeyLike), Buffer.from(signature, "base64"));
    } catch {
      sigOk = false;
    }
  }
  if (!sigOk) blocked_by.push("signature_invalid");

  // Invariant fields (belt-and-suspenders: rejects a validly-signed-but-bad envelope too).
  if (envelope.authority_delta !== 0) blocked_by.push("authority_delta_nonzero");
  if (envelope.grants_action !== false) blocked_by.push("grants_action_true");
  if (envelope.mint_allowed !== false) blocked_by.push("mint_allowed_true");
  const canonicalKeys = Object.keys(demaReceiptSignatureAnchorPreviewBoundary());
  const pb = envelope.boundary;
  if (!pb || typeof pb !== "object" || Object.keys(pb).length !== canonicalKeys.length || canonicalKeys.some((k) => pb[k] !== false)) {
    blocked_by.push("boundary_not_all_false");
  }

  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: DEMA_RECEIPT_SIGNATURE_ANCHOR_PREVIEW_SCHEMA,
    truth_label: DEMA_RECEIPT_SIGNATURE_ANCHOR_PREVIEW_TRUTH_LABEL,
    signer_key_id: envelope.signer_key_id,
    boundary: demaReceiptSignatureAnchorPreviewBoundary(),
    blocked_by: Object.freeze([...new Set(blocked_by)]),
  });
}

// ---- Scaffold contract (plan / build / verify / run) -----------------------

export function planDemaReceiptSignatureAnchorPreview({ consent, input } = {}) {
  const blocked_by = [];
  if (consent !== DEMA_RECEIPT_SIGNATURE_ANCHOR_PREVIEW_GO_PHRASE) blocked_by.push("consent_phrase_mismatch");
  if (!input || typeof input !== "object") blocked_by.push("input_not_object");
  else {
    if (!input.payload || typeof input.payload !== "object") blocked_by.push("missing_payload");
    if (!input.private_key) blocked_by.push("missing_private_key");
  }
  return Object.freeze({
    schema: DEMA_RECEIPT_SIGNATURE_ANCHOR_PREVIEW_SCHEMA,
    truth_label: DEMA_RECEIPT_SIGNATURE_ANCHOR_PREVIEW_TRUTH_LABEL,
    eligible: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

// Build = sign the payload with the injected private key → a signed envelope.
export function buildDemaReceiptSignatureAnchorPreviewPayload(input) {
  return signReceipt(input.payload, input.private_key);
}

// Verify = the domain verifier (envelope, trusted public key).
export function verifyDemaReceiptSignatureAnchorPreview(envelope, trustedPublicKeyLike) {
  return verifySignedReceipt(envelope, trustedPublicKeyLike);
}

// Orchestrator the gate consumes: plan -> sign -> verify -> forge-and-recompute self-check.
export function runDemaReceiptSignatureAnchorPreview({ consent, input } = {}) {
  const plan = planDemaReceiptSignatureAnchorPreview({ consent, input });
  if (!plan.eligible) {
    return Object.freeze({
      ok: false,
      schema: DEMA_RECEIPT_SIGNATURE_ANCHOR_PREVIEW_SCHEMA,
      truth_label: DEMA_RECEIPT_SIGNATURE_ANCHOR_PREVIEW_TRUTH_LABEL,
      boundary: demaReceiptSignatureAnchorPreviewBoundary(),
      blocked_by: plan.blocked_by,
    });
  }
  const envelope = buildDemaReceiptSignatureAnchorPreviewPayload(input);
  const verdict = verifySignedReceipt(envelope, input.public_key);
  // Forge-and-recompute self-check: tamper a payload field AND fix payload_hash, but keep the old
  // signature. The signature must still reject it (the property content-addressing lacked).
  const forgedPayload = { ...envelope.payload, __forged: true };
  const forged = { ...envelope, payload: forgedPayload, payload_hash: `sha256:${sha256(stableStringify(forgedPayload))}` };
  const forgeCaught = verifySignedReceipt(forged, input.public_key).ok === false;

  const blocked_by = [];
  if (!verdict.ok) blocked_by.push(...verdict.blocked_by);
  if (!forgeCaught) blocked_by.push("forge_and_recompute_not_detected");

  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: DEMA_RECEIPT_SIGNATURE_ANCHOR_PREVIEW_SCHEMA,
    truth_label: DEMA_RECEIPT_SIGNATURE_ANCHOR_PREVIEW_TRUTH_LABEL,
    signer_key_id: envelope.signer_key_id,
    mint_allowed: false,
    boundary: demaReceiptSignatureAnchorPreviewBoundary(),
    blocked_by: Object.freeze(blocked_by),
  });
}
