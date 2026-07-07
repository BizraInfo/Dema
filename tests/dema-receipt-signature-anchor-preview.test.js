import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign as edSign } from "node:crypto";

import {
  signReceipt,
  verifySignedReceipt,
  receiptPayloadHash,
  planDemaReceiptSignatureAnchorPreview,
  buildDemaReceiptSignatureAnchorPreviewPayload,
  verifyDemaReceiptSignatureAnchorPreview,
  runDemaReceiptSignatureAnchorPreview,
  DEMA_RECEIPT_SIGNATURE_ANCHOR_PREVIEW_GO_PHRASE,
  DEMA_RECEIPT_SIGNATURE_ANCHOR_PREVIEW_SCHEMA,
} from "../packages/core/src/dema-receipt-signature-anchor-preview.js";
import { runDemaReceiptSignatureAnchorPreviewCheck } from "../scripts/review/dema-receipt-signature-anchor-preview-check.mjs";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const PAYLOAD = { kind: "capability_receipt", capability_id: "X-1A", registry: 41 };
const signed = signReceipt(PAYLOAD, privateKey);

test("a valid signed receipt verifies", () => {
  const r = verifySignedReceipt(signed, publicKey);
  assert.equal(r.ok, true, r.blocked_by.join(", "));
  assert.match(signed.signer_key_id, /^sha256:[0-9a-f]{64}$/);
  assert.equal(signed.signature_alg, "ed25519");
});

test("payload tamper rejects", () => {
  const r = verifySignedReceipt({ ...signed, payload: { ...signed.payload, registry: 9999 } }, publicKey);
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("signature_invalid") || r.blocked_by.includes("payload_hash_mismatch"));
});

test("signature tamper rejects", () => {
  const buf = Buffer.from(signed.signature, "base64");
  buf[0] ^= 0xff;
  const r = verifySignedReceipt({ ...signed, signature: buf.toString("base64") }, publicKey);
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("signature_invalid"));
});

test("signer mismatch rejects (verified against a different public key)", () => {
  const other = generateKeyPairSync("ed25519");
  const r = verifySignedReceipt(signed, other.publicKey);
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("signer_mismatch"));
});

test("canonicalization drift rejects (signature over a non-canonical serialization)", () => {
  const { signature, ...body } = signed;
  const nonCanonical = JSON.stringify(body); // insertion order, not sorted-key canonical
  const driftSig = edSign(null, Buffer.from(nonCanonical, "utf8"), privateKey).toString("base64");
  const r = verifySignedReceipt({ ...body, signature: driftSig }, publicKey);
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("signature_invalid"));
});

test("authority_delta > 0 rejects", () => {
  const r = verifySignedReceipt({ ...signed, authority_delta: 1 }, publicKey);
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("authority_delta_nonzero"));
});

test("grants_action:true rejects", () => {
  assert.ok(verifySignedReceipt({ ...signed, grants_action: true }, publicKey).blocked_by.includes("grants_action_true"));
});

test("mint_allowed:true rejects", () => {
  assert.ok(verifySignedReceipt({ ...signed, mint_allowed: true }, publicKey).blocked_by.includes("mint_allowed_true"));
});

test("boundary false→true tamper rejects", () => {
  const r = verifySignedReceipt({ ...signed, boundary: { ...signed.boundary, token_minted: true } }, publicKey);
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("boundary_not_all_false"));
});

test("an unsigned receipt is not accepted as signed", () => {
  const { signature, ...body } = signed;
  assert.ok(verifySignedReceipt({ ...body, signature: undefined }, publicKey).blocked_by.includes("unsigned_not_accepted"));
  assert.ok(verifySignedReceipt({ ...body, signature: "x", signature_alg: "none" }, publicKey).blocked_by.includes("unsigned_not_accepted"));
});

test("forge-and-recompute laundering rejects — the signature is the independent anchor", () => {
  // Change a field AND fix the payload_hash so content-addressing would be self-consistent…
  const forgedPayload = { ...signed.payload, registry: 9999 };
  const forged = { ...signed, payload: forgedPayload, payload_hash: receiptPayloadHash(forgedPayload) };
  const r = verifySignedReceipt(forged, publicKey);
  assert.equal(r.ok, false);
  // …but the signature (over the original body) still rejects it, and it is NOT a mere hash mismatch:
  assert.ok(r.blocked_by.includes("signature_invalid"));
  assert.ok(!r.blocked_by.includes("payload_hash_mismatch"));
});

test("plan is fail-closed on consent and a missing key/payload", () => {
  assert.ok(planDemaReceiptSignatureAnchorPreview({ consent: "no", input: { payload: PAYLOAD, private_key: privateKey } }).blocked_by.includes("consent_phrase_mismatch"));
  const p = planDemaReceiptSignatureAnchorPreview({ consent: DEMA_RECEIPT_SIGNATURE_ANCHOR_PREVIEW_GO_PHRASE, input: { payload: PAYLOAD } });
  assert.ok(p.blocked_by.includes("missing_private_key"));
});

test("build signs; verify accepts; review gate closes the loop and mints nothing", () => {
  const env = buildDemaReceiptSignatureAnchorPreviewPayload({ payload: PAYLOAD, private_key: privateKey });
  assert.equal(verifyDemaReceiptSignatureAnchorPreview(env, publicKey).ok, true);
  const gate = runDemaReceiptSignatureAnchorPreviewCheck();
  assert.equal(gate.ok, true, gate.blocked_by?.join(", "));
  assert.equal(gate.mint_allowed, false);
  assert.equal(gate.schema, DEMA_RECEIPT_SIGNATURE_ANCHOR_PREVIEW_SCHEMA);
  assert.equal(gate.boundary.token_minted, false);
});
