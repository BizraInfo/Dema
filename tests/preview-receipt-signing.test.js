import test from "node:test";
import assert from "node:assert/strict";

import {
  planPreviewReceiptSigning,
  buildPreviewReceiptSigningPayload,
  verifyPreviewReceiptSigning,
  signPreviewReceipt,
  signPreviewReceiptWithKeyStore,
  runPreviewReceiptSigning,
  previewReceiptSigningBoundary,
  previewReceiptExposesPrivateKeyMaterial,
  PREVIEW_RECEIPT_SIGNING_SCHEMA,
  PREVIEW_RECEIPT_SIGNING_TRUTH_LABEL,
  PREVIEW_RECEIPT_SIGNING_GO_PHRASE,
} from "../packages/core/src/preview-receipt-signing.js";
import {
  generateEd25519Keypair,
  signPayload,
} from "../packages/receipts/src/authorship-signature.js";
import { buildPeakSelfLoopPreview } from "../packages/core/src/peak-self-loop-preview.js";
import { runPreviewReceiptSigningCheck } from "../scripts/review/preview-receipt-signing-check.mjs";

// PREVIEW-RECEIPT-SIGNING-1A proof contract:
//   1. unsigned preview receipt stays clearly marked unsigned
//   2. signed preview receipt carries complete signature metadata
//   3. canonical payload hash is stable across rebuilds
//   4. tampered payloads fail verification (incl. forge-and-recompute launder)
//   5. boundary stays all-false — no autonomy, mint, network, or public-safe claim

const FIXTURE_PREVIEW = Object.freeze({
  schema: "bizra.dema.example_preview.v0.1",
  mode: "preview_only",
  truth_label: "NODE0_LOCAL_SEED",
  body: Object.freeze({ finding: "preview-stack receipt fixture", rank: 1 }),
});

const KEYS = generateEd25519Keypair();

test("plan is fail-closed without the exact consent phrase", () => {
  const plan = planPreviewReceiptSigning({ consent: "wrong", input: FIXTURE_PREVIEW });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("consent_phrase_mismatch"));
});

test("plan is eligible with exact consent and well-formed input", () => {
  const plan = planPreviewReceiptSigning({
    consent: PREVIEW_RECEIPT_SIGNING_GO_PHRASE,
    input: FIXTURE_PREVIEW,
  });
  assert.equal(plan.eligible, true, plan.blocked_by.join(", "));
});

test("plan rejects non-preview input — execute receipts do not pass this adapter", () => {
  const executeShaped = {
    schema: "bizra.dema.node0_reversible_execute_receipt.v0.1",
    executed: true,
  };
  const plan = planPreviewReceiptSigning({
    consent: PREVIEW_RECEIPT_SIGNING_GO_PHRASE,
    input: executeShaped,
  });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("preview_mode_required"));
});

test("plan rejects a preview carrying private key material", () => {
  const leaky = { ...FIXTURE_PREVIEW, private_key: "oops" };
  const plan = planPreviewReceiptSigning({
    consent: PREVIEW_RECEIPT_SIGNING_GO_PHRASE,
    input: leaky,
  });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("private_key_material_in_preview"));
});

test("payload is content-addressed and carries an all-false boundary", () => {
  const payload = buildPreviewReceiptSigningPayload(FIXTURE_PREVIEW);
  assert.equal(payload.schema, PREVIEW_RECEIPT_SIGNING_SCHEMA);
  assert.equal(payload.truth_label, PREVIEW_RECEIPT_SIGNING_TRUTH_LABEL);
  assert.match(payload.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.deepEqual(payload.boundary, previewReceiptSigningBoundary());
  for (const [key, value] of Object.entries(payload.boundary)) {
    assert.equal(value, false, `boundary.${key} must be false`);
  }
  assert.equal(payload.boundary.public_safe_claim, false);
});

test("unsigned preview receipt is clearly marked unsigned", () => {
  const payload = buildPreviewReceiptSigningPayload(FIXTURE_PREVIEW);
  assert.equal(payload.signed, false);
  assert.equal(payload.signature, null);
  const verdict = verifyPreviewReceiptSigning(payload);
  assert.equal(verdict.ok, true, verdict.reason);
  assert.equal(verdict.signed, false);
});

test("canonical payload hash is stable across rebuilds", () => {
  const a = buildPreviewReceiptSigningPayload(FIXTURE_PREVIEW);
  const b = buildPreviewReceiptSigningPayload(FIXTURE_PREVIEW);
  assert.equal(a.content_hash, b.content_hash);
});

test("signed preview receipt includes complete signature metadata and verifies", () => {
  const signed = signPreviewReceipt({
    preview: FIXTURE_PREVIEW,
    consent: PREVIEW_RECEIPT_SIGNING_GO_PHRASE,
    privateKeyPem: KEYS.private_key_pem,
    publicKeyPem: KEYS.public_key_pem,
    publicKeyFingerprint: KEYS.public_key_fingerprint,
  });
  assert.equal(signed.signed, true);
  assert.equal(signed.signature.algorithm, "ed25519");
  assert.ok(signed.signature.value.length > 0);
  assert.match(signed.signature.public_key_fingerprint, /^[a-f0-9]{64}$/);
  assert.ok(signed.signature.public_key_pem.includes("BEGIN PUBLIC KEY"));
  const verdict = verifyPreviewReceiptSigning(signed, { publicKeyPem: KEYS.public_key_pem });
  assert.equal(verdict.ok, true, verdict.reason);
  assert.equal(verdict.signed, true);
  // Signing does not change the canonical content hash.
  const unsigned = buildPreviewReceiptSigningPayload(FIXTURE_PREVIEW);
  assert.equal(signed.content_hash, unsigned.content_hash);
});

test("signing without exact consent stays unsigned and fail-closed", () => {
  const blocked = signPreviewReceipt({
    preview: FIXTURE_PREVIEW,
    consent: "GO sign preview-stack receipt",
    privateKeyPem: KEYS.private_key_pem,
    publicKeyPem: KEYS.public_key_pem,
  });
  assert.equal(blocked.signed, false);
  assert.ok(blocked.blocked_by.includes("consent_phrase_mismatch"));
});

test("key-store signing path blocks when the store is unavailable", async () => {
  const blocked = await signPreviewReceiptWithKeyStore({
    preview: FIXTURE_PREVIEW,
    consent: PREVIEW_RECEIPT_SIGNING_GO_PHRASE,
    loadActiveKeyPairFn: async () => null,
  });
  assert.equal(blocked.signed, false);
  assert.ok(blocked.blocked_by.includes("key_store_unavailable"));
});

test("key-store signing path signs through the injected loader — the injection point is live", async () => {
  // Positive control for the test above. Measured 2026-08-20: this test's
  // predecessor injected loader names the kernel never read (loadPrivateKeyFn /
  // loadPublicKeyFn), so the nulls were silently discarded and the DEFAULT
  // loader ran instead — green only on machines with no real key store, RED on
  // the operator's machine, where it signed with the real active key. A blocked
  // assertion alone cannot distinguish "injection worked" from "no key existed";
  // signing through the same parameter proves the boundary is actually reached.
  const signed = await signPreviewReceiptWithKeyStore({
    preview: FIXTURE_PREVIEW,
    consent: PREVIEW_RECEIPT_SIGNING_GO_PHRASE,
    loadActiveKeyPairFn: async () => ({
      ok: true,
      private_key_pem: KEYS.private_key_pem,
      public_key_pem: KEYS.public_key_pem,
    }),
  });
  assert.equal(signed.signed, true);
  assert.equal(signed.signature.algorithm, "ed25519");
});

test("key-store signing path refuses unknown options instead of silently ignoring them", async () => {
  // The defect class this kills: a caller who believes they disabled key
  // loading must get a refusal — never a real signature minted with the real
  // operator key store behind their back.
  const refused = await signPreviewReceiptWithKeyStore({
    preview: FIXTURE_PREVIEW,
    consent: PREVIEW_RECEIPT_SIGNING_GO_PHRASE,
    loadPrivateKeyFn: async () => null,
  });
  assert.equal(refused.signed, false);
  assert.ok(refused.blocked_by.includes("unrecognized_option:loadPrivateKeyFn"));
});

test("verify rejects a tampered content_hash", () => {
  const payload = buildPreviewReceiptSigningPayload(FIXTURE_PREVIEW);
  const tampered = { ...payload, content_hash: `sha256:${"0".repeat(64)}` };
  assert.equal(verifyPreviewReceiptSigning(tampered).ok, false);
});

test("verify rejects a field change that did not update the content_hash", () => {
  const payload = buildPreviewReceiptSigningPayload(FIXTURE_PREVIEW);
  const forged = { ...payload, source_truth_label: "FORGED" };
  assert.equal(verifyPreviewReceiptSigning(forged).ok, false);
});

test("signature anchor rejects a forged field even with a recomputed content_hash", () => {
  const signed = signPreviewReceipt({
    preview: FIXTURE_PREVIEW,
    consent: PREVIEW_RECEIPT_SIGNING_GO_PHRASE,
    privateKeyPem: KEYS.private_key_pem,
    publicKeyPem: KEYS.public_key_pem,
  });
  // Launder attempt: forge the field AND make the body self-consistent by
  // recomputing its hash through the builder on a laundered preview.
  const launderedPreview = {
    ...FIXTURE_PREVIEW,
    body: { ...FIXTURE_PREVIEW.body, finding: "FORGED" },
  };
  const laundered = {
    ...signed,
    preview: launderedPreview,
    content_hash: buildPreviewReceiptSigningPayload(launderedPreview).content_hash,
  };
  const verdict = verifyPreviewReceiptSigning(laundered, {
    publicKeyPem: KEYS.public_key_pem,
  });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.reason, "signature_invalid");
});

test("verify rejects a swapped public-key fingerprint (identity must re-derive from PEM)", () => {
  const signed = signPreviewReceipt({
    preview: FIXTURE_PREVIEW,
    consent: PREVIEW_RECEIPT_SIGNING_GO_PHRASE,
    privateKeyPem: KEYS.private_key_pem,
    publicKeyPem: KEYS.public_key_pem,
  });
  const otherFingerprint = generateEd25519Keypair().public_key_fingerprint;
  const swapped = {
    ...signed,
    signature: { ...signed.signature, public_key_fingerprint: otherFingerprint },
  };
  const verdict = verifyPreviewReceiptSigning(swapped);
  assert.equal(verdict.ok, false);
  assert.equal(verdict.reason, "public_key_fingerprint_mismatch");
});

test("signing with a mismatched caller-supplied fingerprint blocks fail-closed", () => {
  const blocked = signPreviewReceipt({
    preview: FIXTURE_PREVIEW,
    consent: PREVIEW_RECEIPT_SIGNING_GO_PHRASE,
    privateKeyPem: KEYS.private_key_pem,
    publicKeyPem: KEYS.public_key_pem,
    publicKeyFingerprint: generateEd25519Keypair().public_key_fingerprint,
  });
  assert.equal(blocked.signed, false);
  assert.ok(blocked.blocked_by.includes("public_key_fingerprint_mismatch"));
});

test("verify rejects an altered consent go_phrase_hash on a signed envelope", () => {
  const signed = signPreviewReceipt({
    preview: FIXTURE_PREVIEW,
    consent: PREVIEW_RECEIPT_SIGNING_GO_PHRASE,
    privateKeyPem: KEYS.private_key_pem,
    publicKeyPem: KEYS.public_key_pem,
  });
  const altered = {
    ...signed,
    consent: { ...signed.consent, go_phrase_hash: `sha256:${"a".repeat(64)}` },
  };
  const verdict = verifyPreviewReceiptSigning(altered);
  assert.equal(verdict.ok, false);
  assert.equal(verdict.reason, "consent_hash_invalid");
});

test("verify rejects a signed envelope with the consent block removed", () => {
  const signed = signPreviewReceipt({
    preview: FIXTURE_PREVIEW,
    consent: PREVIEW_RECEIPT_SIGNING_GO_PHRASE,
    privateKeyPem: KEYS.private_key_pem,
    publicKeyPem: KEYS.public_key_pem,
  });
  const { consent: _consent, ...withoutConsent } = signed;
  const verdict = verifyPreviewReceiptSigning(withoutConsent);
  assert.equal(verdict.ok, false);
  assert.equal(verdict.reason, "consent_hash_invalid");
});

test("consent is inside the signed subject — a signature over the bare envelope fails", () => {
  // Simulate a signer that signed only the unsigned envelope (no consent block
  // in the signed bytes) but still attaches the correct consent metadata.
  // Verification must reject: the displayed consent assertion was never signed.
  const unsigned = buildPreviewReceiptSigningPayload(FIXTURE_PREVIEW);
  const bareSignature = signPayload(unsigned, KEYS.private_key_pem);
  const validSigned = signPreviewReceipt({
    preview: FIXTURE_PREVIEW,
    consent: PREVIEW_RECEIPT_SIGNING_GO_PHRASE,
    privateKeyPem: KEYS.private_key_pem,
    publicKeyPem: KEYS.public_key_pem,
  });
  const forged = {
    ...unsigned,
    signed: true,
    signed_at: validSigned.signed_at,
    signature: { ...validSigned.signature, value: bareSignature },
    consent: { ...validSigned.consent },
  };
  const verdict = verifyPreviewReceiptSigning(forged, {
    publicKeyPem: KEYS.public_key_pem,
  });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.reason, "signature_invalid");
});

test("unsigned envelope carrying stray signing metadata is rejected", () => {
  const payload = buildPreviewReceiptSigningPayload(FIXTURE_PREVIEW);
  const withStrayConsent = {
    ...payload,
    consent: { go_phrase_hash: `sha256:${"b".repeat(64)}`, mode: "exact_sign" },
  };
  const verdict = verifyPreviewReceiptSigning(withStrayConsent);
  assert.equal(verdict.ok, false);
  assert.equal(verdict.reason, "unsigned_envelope_carries_signing_metadata");
});

test("signed envelope leaks no private key material", () => {
  const signed = signPreviewReceipt({
    preview: FIXTURE_PREVIEW,
    consent: PREVIEW_RECEIPT_SIGNING_GO_PHRASE,
    privateKeyPem: KEYS.private_key_pem,
    publicKeyPem: KEYS.public_key_pem,
  });
  assert.equal(previewReceiptExposesPrivateKeyMaterial(signed), false);
});

test("real peak-self-loop preview signs end-to-end through the rail", () => {
  const preview = buildPeakSelfLoopPreview();
  const result = runPreviewReceiptSigning({
    consent: PREVIEW_RECEIPT_SIGNING_GO_PHRASE,
    input: preview,
    generateKeypair: generateEd25519Keypair,
  });
  assert.equal(result.ok, true, result.blocked_by.join(", "));
  assert.equal(result.source_schema, "bizra.dema.peak_self_loop_preview.v0.1");
  assert.equal(result.unsigned_marked_unsigned, true);
  assert.equal(result.signed_has_signature_metadata, true);
  assert.equal(result.hash_stable, true);
  assert.equal(result.tamper_hash_rejected, true);
  assert.equal(result.launder_rejected, true);
  assert.equal(result.fingerprint_tamper_rejected, true);
  assert.equal(result.consent_tamper_rejected, true);
});

test("review gate closes the loop: build -> sign -> verify -> tamper-reject", () => {
  const result = runPreviewReceiptSigningCheck();
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.schema, PREVIEW_RECEIPT_SIGNING_SCHEMA);
  assert.equal(result.truth_label, PREVIEW_RECEIPT_SIGNING_TRUTH_LABEL);
  assert.equal(result.launder_rejected, true);
  assert.equal(result.fingerprint_tamper_rejected, true);
  assert.equal(result.consent_tamper_rejected, true);
});

test("orchestrator boundary stays all-false (no execution authority)", () => {
  const result = runPreviewReceiptSigning({
    consent: PREVIEW_RECEIPT_SIGNING_GO_PHRASE,
    input: FIXTURE_PREVIEW,
    generateKeypair: generateEd25519Keypair,
  });
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  for (const [key, value] of Object.entries(result.boundary)) {
    assert.equal(value, false, `boundary.${key} must be false`);
  }
});

test("orchestrator without an injected keypair stays fail-closed", () => {
  const result = runPreviewReceiptSigning({
    consent: PREVIEW_RECEIPT_SIGNING_GO_PHRASE,
    input: FIXTURE_PREVIEW,
  });
  assert.equal(result.ok, false);
  assert.ok(result.blocked_by.includes("signing_keypair_missing"));
});
