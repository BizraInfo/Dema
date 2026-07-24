import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  AUTHORSHIP_TRUST_SNAPSHOT_SCHEMA,
  verifyAuthorshipReceipt,
  verifyAuthorshipReceiptFile,
  verifyAuthorshipReceiptIntegrity,
  verifyAuthorshipReceiptIntegrityFile,
} from "../packages/receipts/src/authorship-verify.js";
import {
  buildSignedAuthorshipReceipt,
  generateEd25519Keypair,
  sha256,
  signPayload,
} from "../packages/receipts/src/authorship-signature.js";

const ARTIFACT_SHA256 = sha256("authorship trust fixture");
const FROZEN_PUBLIC_KEY_PEM =
  "-----BEGIN PUBLIC KEY-----\n" +
  "MCowBQYDK2VwAyEAfHbj8Jr4R5QsLNPwYCVkbE2HYMHNnX5Cc76TAI62z44=\n" +
  "-----END PUBLIC KEY-----\n";
const FROZEN_FINGERPRINT =
  "0f3c43c3184e707a552075eeebcee2b5f753631da4a44d0cb257e6e8e62517e8";
const FROZEN_RECEIPT = Object.freeze({
  schema: "bizra.dema.authorship_signature.v0.1",
  author: Object.freeze({
    node: "Node0",
    key_type: "ed25519",
    public_key_fingerprint: FROZEN_FINGERPRINT,
  }),
  artifact: Object.freeze({
    path: "fixtures/frozen-authorship-history.txt",
    sha256:
      "47b212e05a0dc0b277b31c9109e247318bcc869893a5bf7001ddf8419c5395f6",
  }),
  boundary: Object.freeze({
    network_used: false,
    legal_identity_asserted: false,
    production_claimed: false,
  }),
  truth_label: "LOCAL_AUTHORSHIP_ATTESTED",
  signature: Object.freeze({
    algorithm: "ed25519",
    value:
      "w4m1BaB6c3c4Q1xcMJ2HVGbekoUq2MyDwUgm7AwzWYav74tqGJOcAn/8hFixVE/aqiLmNRLrqn0djDDdRA4dAg==",
    public_key_pem: FROZEN_PUBLIC_KEY_PEM,
  }),
});
const FROZEN_TRUST = Object.freeze({
  schema: AUTHORSHIP_TRUST_SNAPSHOT_SCHEMA,
  active_public_key_pem: FROZEN_PUBLIC_KEY_PEM,
  active_fingerprint: FROZEN_FINGERPRINT,
  retired_fingerprints: Object.freeze([]),
});

function buildReceipt(keys, fingerprint = keys.public_key_fingerprint) {
  return buildSignedAuthorshipReceipt({
    artifact_path: "fixtures/trust-bound-artifact.txt",
    artifact_sha256: ARTIFACT_SHA256,
    private_key_pem: keys.private_key_pem,
    public_key_pem: keys.public_key_pem,
    public_key_fingerprint: fingerprint,
  });
}

function trustSnapshot(active, retiredFingerprints = []) {
  return Object.freeze({
    schema: AUTHORSHIP_TRUST_SNAPSHOT_SCHEMA,
    active_public_key_pem: active.public_key_pem,
    active_fingerprint: active.public_key_fingerprint,
    retired_fingerprints: Object.freeze([...retiredFingerprints]),
  });
}

describe("authorship signer trust", () => {
  it("keeps the historical fingerprint formula and signature contract frozen", () => {
    const strict = verifyAuthorshipReceipt(FROZEN_RECEIPT, FROZEN_TRUST);
    const integrity = verifyAuthorshipReceiptIntegrity(FROZEN_RECEIPT);

    assert.equal(strict.verified, true);
    assert.equal(strict.embedded_fingerprint, FROZEN_FINGERPRINT);
    assert.equal(strict.verification_scope, "ACTIVE_SIGNER_TRUST");
    assert.equal(integrity.verified, true);
    assert.equal(integrity.verification_scope, "SIGNATURE_INTEGRITY_ONLY");
    assert.doesNotMatch(
      JSON.stringify({ FROZEN_RECEIPT, FROZEN_TRUST }),
      /PRIVATE KEY/,
    );
  });

  it("accepts a receipt signed by the externally trusted active key", () => {
    const active = generateEd25519Keypair();
    const result = verifyAuthorshipReceipt(
      buildReceipt(active),
      trustSnapshot(active),
    );

    assert.equal(result.verified, true);
    assert.equal(result.verdict, "VERIFIED");
    assert.equal(result.trust_state, "ACTIVE_TRUSTED");
    assert.equal(result.signer_fingerprint, active.public_key_fingerprint);
    assert.equal(result.claimed_fingerprint, active.public_key_fingerprint);
    assert.equal(result.embedded_fingerprint, active.public_key_fingerprint);
    assert.equal(result.trusted_fingerprint, active.public_key_fingerprint);
  });

  it("rejects a receipt signed by a retired key", () => {
    const retired = generateEd25519Keypair();
    const active = generateEd25519Keypair();
    const result = verifyAuthorshipReceipt(
      buildReceipt(retired),
      trustSnapshot(active, [retired.public_key_fingerprint]),
    );

    assert.equal(result.verified, false);
    assert.equal(result.error, "signer_retired");
    assert.equal(result.trust_state, "RETIRED");
  });

  it("does not label a bad signature as a retired signer", () => {
    const retired = generateEd25519Keypair();
    const active = generateEd25519Keypair();
    const receipt = structuredClone(buildReceipt(retired));
    receipt.signature.value = Buffer.alloc(64).toString("base64");

    const result = verifyAuthorshipReceipt(
      receipt,
      trustSnapshot(active, [retired.public_key_fingerprint]),
    );

    assert.equal(result.verified, false);
    assert.equal(result.error, "signature_invalid");
  });

  it("rejects a rogue self-signed receipt even when its embedded key verifies", () => {
    const active = generateEd25519Keypair();
    const rogue = generateEd25519Keypair();
    const result = verifyAuthorshipReceipt(
      buildReceipt(rogue),
      trustSnapshot(active),
    );

    assert.equal(result.verified, false);
    assert.equal(result.error, "signer_not_trusted");
    assert.equal(result.trust_state, "UNTRUSTED");
  });

  it("rejects a claimed fingerprint that does not match the embedded signer", () => {
    const active = generateEd25519Keypair();
    const rogue = generateEd25519Keypair();
    const result = verifyAuthorshipReceipt(
      buildReceipt(rogue, active.public_key_fingerprint),
      trustSnapshot(active),
    );

    assert.equal(result.verified, false);
    assert.equal(result.error, "public_key_fingerprint_mismatch");
  });

  it("rejects the wrong externally trusted key", () => {
    const signer = generateEd25519Keypair();
    const wrongTrust = generateEd25519Keypair();
    const result = verifyAuthorshipReceipt(
      buildReceipt(signer),
      trustSnapshot(wrongTrust),
    );

    assert.equal(result.verified, false);
    assert.equal(result.error, "signer_not_trusted");
  });

  it("fails closed when no external trust snapshot is supplied", () => {
    const signer = generateEd25519Keypair();
    const result = verifyAuthorshipReceipt(buildReceipt(signer));

    assert.equal(result.verified, false);
    assert.equal(result.error, "external_trust_required");
    assert.equal(result.claimed_fingerprint, signer.public_key_fingerprint);
    assert.equal(result.embedded_fingerprint, signer.public_key_fingerprint);
    assert.equal(result.trusted_fingerprint, null);
  });

  it("checks missing trust before comparing claimed and embedded fingerprints", () => {
    const signer = generateEd25519Keypair();
    const other = generateEd25519Keypair();
    const result = verifyAuthorshipReceipt(
      buildReceipt(signer, other.public_key_fingerprint),
    );

    assert.equal(result.verified, false);
    assert.equal(result.error, "external_trust_required");
  });

  it("rejects an externally claimed active fingerprint that does not match its key", () => {
    const active = generateEd25519Keypair();
    const other = generateEd25519Keypair();
    const invalidTrust = Object.freeze({
      ...trustSnapshot(active),
      active_fingerprint: other.public_key_fingerprint,
    });
    const result = verifyAuthorshipReceipt(
      buildReceipt(active),
      invalidTrust,
    );

    assert.equal(result.verified, false);
    assert.equal(result.error, "external_trust_invalid");
  });

  it("rejects private PEM material in the embedded public-key slot", () => {
    const active = generateEd25519Keypair();
    const receipt = structuredClone(buildReceipt(active));
    receipt.signature.public_key_pem = active.private_key_pem;

    const result = verifyAuthorshipReceipt(receipt, trustSnapshot(active));

    assert.equal(result.verified, false);
    assert.equal(result.error, "embedded_public_key_invalid");
    assert.equal(result.claimed_fingerprint, active.public_key_fingerprint);
    assert.equal(result.embedded_fingerprint, null);
    assert.equal(result.trusted_fingerprint, active.public_key_fingerprint);
  });

  it("rejects private PEM material in the externally trusted public-key slot", () => {
    const active = generateEd25519Keypair();
    const privateTrust = Object.freeze({
      ...trustSnapshot(active),
      active_public_key_pem: active.private_key_pem,
    });

    const result = verifyAuthorshipReceipt(buildReceipt(active), privateTrust);

    assert.equal(result.verified, false);
    assert.equal(result.error, "external_trust_invalid");
  });

  it("rejects extra fields on the external trust snapshot", () => {
    const active = generateEd25519Keypair();
    const secretBearingTrust = Object.freeze({
      ...trustSnapshot(active),
      private_key_pem: active.private_key_pem,
    });

    const result = verifyAuthorshipReceipt(
      buildReceipt(active),
      secretBearingTrust,
    );

    assert.equal(result.verified, false);
    assert.equal(result.error, "external_trust_invalid");
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE KEY/);
  });

  it("does not echo an arbitrary secret-bearing trust-loader error", () => {
    const active = generateEd25519Keypair();
    const result = verifyAuthorshipReceipt(buildReceipt(active), {
      error: active.private_key_pem,
    });

    assert.equal(result.verified, false);
    assert.equal(result.error, "external_trust_invalid");
    assert.equal(result.external_trust_error, null);
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE KEY/);
  });

  it("rejects payload tampering with the trusted key", () => {
    const active = generateEd25519Keypair();
    const receipt = structuredClone(buildReceipt(active));
    receipt.artifact.sha256 = "0".repeat(64);
    const result = verifyAuthorshipReceipt(receipt, trustSnapshot(active));

    assert.equal(result.verified, false);
    assert.equal(result.error, "signature_invalid");
  });

  it("file verification applies the same external trust boundary", async () => {
    const active = generateEd25519Keypair();
    const dir = mkdtempSync(join(tmpdir(), "dema-authorship-trust-"));
    const receiptPath = join(dir, "authorship.json");
    writeFileSync(receiptPath, JSON.stringify(buildReceipt(active)));

    const missingTrust = await verifyAuthorshipReceiptFile(receiptPath);
    assert.equal(missingTrust.verified, false);
    assert.equal(missingTrust.error, "external_trust_required");

    const verified = await verifyAuthorshipReceiptFile(
      receiptPath,
      trustSnapshot(active),
    );
    assert.equal(verified.verified, true);
    assert.equal(verified.receipt_path, receiptPath);
  });

  it("returns a structured failure for parsed JSON that is not a receipt", async () => {
    const dir = mkdtempSync(join(tmpdir(), "dema-authorship-invalid-json-"));
    const receiptPath = join(dir, "authorship.json");
    writeFileSync(receiptPath, "null");

    const result = await verifyAuthorshipReceiptFile(receiptPath);

    assert.equal(result.verified, false);
    assert.equal(result.error, "not_valid_authorship_receipt");
  });

  it("never reports private-key loading or mutation", () => {
    const active = generateEd25519Keypair();
    const result = verifyAuthorshipReceipt(
      buildReceipt(active),
      trustSnapshot(active),
    );

    assert.equal(result.boundary.private_key_loaded, false);
    assert.equal(result.boundary.mutation_performed, false);
    assert.equal(result.boundary.network_used, false);
  });

  it("projects canonical receipt fields without echoing hostile extras", () => {
    const active = generateEd25519Keypair();
    const source = structuredClone(buildReceipt(active));
    const { signature, ...payload } = source;
    payload.author.private_key_pem = active.private_key_pem;
    payload.artifact.private_key_pem = active.private_key_pem;
    const receipt = {
      ...payload,
      signature: {
        ...signature,
        value: signPayload(payload, active.private_key_pem),
      },
    };

    const result = verifyAuthorshipReceipt(receipt, trustSnapshot(active));

    assert.equal(result.verified, true);
    assert.deepEqual(Object.keys(result.author).sort(), [
      "key_type",
      "node",
      "public_key_fingerprint",
    ]);
    assert.deepEqual(Object.keys(result.artifact).sort(), ["path", "sha256"]);
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE KEY/);
  });

  it("omits malformed secret-bearing leaf values from every verifier result", () => {
    const active = generateEd25519Keypair();
    const receipt = structuredClone(buildReceipt(active));
    receipt.author.node = { private_key_pem: active.private_key_pem };
    receipt.author.public_key_fingerprint = active.private_key_pem;
    receipt.artifact.path = active.private_key_pem;

    const strict = verifyAuthorshipReceipt(receipt, trustSnapshot(active));
    const integrity = verifyAuthorshipReceiptIntegrity(receipt);

    assert.equal(strict.verified, false);
    assert.equal(integrity.verified, false);
    assert.equal(strict.author.node, undefined);
    assert.equal(strict.artifact.path, undefined);
    assert.equal(strict.claimed_fingerprint, null);
    assert.equal(integrity.author.node, undefined);
    assert.equal(integrity.artifact.path, undefined);
    assert.equal(integrity.claimed_fingerprint, null);
    assert.doesNotMatch(JSON.stringify(strict), /PRIVATE KEY/);
    assert.doesNotMatch(JSON.stringify(integrity), /PRIVATE KEY/);
  });
});

describe("authorship signature integrity compatibility boundary", () => {
  it("verifies portable signature integrity without claiming signer trust", () => {
    const signer = generateEd25519Keypair();
    const result = verifyAuthorshipReceiptIntegrity(buildReceipt(signer));

    assert.equal(result.verified, true);
    assert.equal(result.verdict, "VERIFIED");
    assert.equal(result.verification_scope, "SIGNATURE_INTEGRITY_ONLY");
    assert.equal(result.trust_state, "NOT_EVALUATED");
    assert.equal(result.trusted_fingerprint, null);
    assert.equal(result.claimed_fingerprint, signer.public_key_fingerprint);
    assert.equal(result.embedded_fingerprint, signer.public_key_fingerprint);
  });

  it("exposes the same integrity-only scope for file verification", async () => {
    const signer = generateEd25519Keypair();
    const dir = mkdtempSync(join(tmpdir(), "dema-authorship-integrity-"));
    const receiptPath = join(dir, "authorship.json");
    writeFileSync(receiptPath, JSON.stringify(buildReceipt(signer)));

    const result = await verifyAuthorshipReceiptIntegrityFile(receiptPath);

    assert.equal(result.verified, true);
    assert.equal(result.verification_scope, "SIGNATURE_INTEGRITY_ONLY");
    assert.equal(result.receipt_path, receiptPath);
  });
});
