import test from "node:test";
import assert from "node:assert/strict";
import * as nodeFs from "node:fs";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";

import {
  generateEd25519Keypair,
  signPayload,
  sha256,
} from "../packages/receipts/src/authorship-signature.js";
import {
  initAuthorshipKey,
  KEY_INIT_CONSENT_PHRASE,
} from "../packages/receipts/src/authorship-key-store.js";
import {
  planReversibleRename,
  executeReversibleRename,
  verifyExecuteReceipt,
  recomputeReceiptContentHash,
  NODE0_REVERSIBLE_EXECUTE_GO_PHRASE,
  NODE0_REVERSIBLE_EXECUTE_ACTION_TYPE,
  NODE0_REVERSIBLE_EXECUTE_GATE_PROBE,
} from "../packages/core/src/node0-reversible-execute-gate.js";
import {
  signExecuteReceiptAttestation,
  signExecuteReceiptAttestationWithKeyStore,
  verifyExecuteReceiptAttestation,
  attestationBindsExecuteReceipt,
  attestationExposesPrivateKeyMaterial,
  planReceiptSigning,
  NODE0_RECEIPT_SIGNING_GO_PHRASE,
  NODE0_RECEIPT_SIGNING_ED25519_SCHEMA,
  runNode0ReceiptSigningEd25519,
} from "../packages/core/src/node0-receipt-signing-ed25519.js";
import { runNode0ReceiptSigningEd25519Check } from "../scripts/review/node0-receipt-signing-ed25519-check.mjs";

const NOW = "2026-06-28T18:00:00.000Z";
const REPO_ROOT = resolve(import.meta.dirname, "..");

function freshSandbox() {
  const root = mkdtempSync(join(tmpdir(), "node0-receipt-sign-"));
  writeFileSync(join(root, NODE0_REVERSIBLE_EXECUTE_GATE_PROBE), "loop probe payload\n");
  return root;
}

function executeReceipt(root) {
  const plan = planReversibleRename({
    sandboxRoot: root,
    fileName: NODE0_REVERSIBLE_EXECUTE_GATE_PROBE,
    newName: "node0-governed-action-candidate.txt",
    goPhrase: NODE0_REVERSIBLE_EXECUTE_GO_PHRASE,
    actionType: NODE0_REVERSIBLE_EXECUTE_ACTION_TYPE,
  });
  assert.equal(plan.eligible, true, plan.blocked_by?.join(", "));
  const receipt = executeReversibleRename({ plan, fs: nodeFs, now: NOW });
  assert.equal(receipt.executed, true, receipt.blocked_by?.join(", "));
  return receipt;
}

function freshKeypair() {
  return generateEd25519Keypair();
}

// 1. signs a #306 sandbox execute receipt
test("signs a sandbox execute receipt into an attestation envelope", () => {
  const root = freshSandbox();
  try {
    const receipt = executeReceipt(root);
    const keys = freshKeypair();
    const attestation = signExecuteReceiptAttestation({
      receipt,
      consent: NODE0_RECEIPT_SIGNING_GO_PHRASE,
      privateKeyPem: keys.private_key_pem,
      publicKeyPem: keys.public_key_pem,
      publicKeyFingerprint: keys.public_key_fingerprint,
      signedAt: NOW,
    });
    assert.equal(attestation.signed, true);
    assert.equal(attestation.schema, NODE0_RECEIPT_SIGNING_ED25519_SCHEMA);
    assert.equal(attestation.payload.content_hash, receipt.content_hash);
    assert.equal(attestation.payload.state_hash, receipt.state_hash);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// 2. verifies signature using public key only
test("verifies attestation with public key only", () => {
  const root = freshSandbox();
  try {
    const receipt = executeReceipt(root);
    const keys = freshKeypair();
    const attestation = signExecuteReceiptAttestation({
      receipt,
      consent: NODE0_RECEIPT_SIGNING_GO_PHRASE,
      privateKeyPem: keys.private_key_pem,
      publicKeyPem: keys.public_key_pem,
      publicKeyFingerprint: keys.public_key_fingerprint,
    });
    const stripped = {
      ...attestation,
      signature: Object.freeze({
        algorithm: attestation.signature.algorithm,
        value: attestation.signature.value,
        public_key_fingerprint: attestation.signature.public_key_fingerprint,
        public_key_pem: attestation.signature.public_key_pem,
      }),
    };
    const verified = verifyExecuteReceiptAttestation(stripped, {
      publicKeyPem: keys.public_key_pem,
    });
    assert.equal(verified.ok, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// 3. fails if receipt content_hash changes
test("bind fails when receipt content_hash is tampered", () => {
  const root = freshSandbox();
  try {
    const receipt = executeReceipt(root);
    const keys = freshKeypair();
    const attestation = signExecuteReceiptAttestation({
      receipt,
      consent: NODE0_RECEIPT_SIGNING_GO_PHRASE,
      privateKeyPem: keys.private_key_pem,
      publicKeyPem: keys.public_key_pem,
    });
    const tampered = { ...receipt, content_hash: "sha256:deadbeef" };
    const bind = attestationBindsExecuteReceipt(tampered, attestation);
    assert.equal(bind.ok, false);
    assert.equal(bind.reason, "content_hash_bind_failed");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// 4. fails if state_hash changes
test("bind fails when receipt state_hash is tampered", () => {
  const root = freshSandbox();
  try {
    const receipt = executeReceipt(root);
    const keys = freshKeypair();
    const attestation = signExecuteReceiptAttestation({
      receipt,
      consent: NODE0_RECEIPT_SIGNING_GO_PHRASE,
      privateKeyPem: keys.private_key_pem,
      publicKeyPem: keys.public_key_pem,
    });
    const tampered = { ...receipt, state_hash: "sha256:deadbeef" };
    const bind = attestationBindsExecuteReceipt(tampered, attestation);
    assert.equal(bind.ok, false);
    assert.equal(bind.reason, "state_hash_bind_failed");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// 5. fails if receipt body changes but hash is forged
test("bind fails when body is forged to match a recomputed content_hash", () => {
  const root = freshSandbox();
  try {
    const receipt = executeReceipt(root);
    const keys = freshKeypair();
    const attestation = signExecuteReceiptAttestation({
      receipt,
      consent: NODE0_RECEIPT_SIGNING_GO_PHRASE,
      privateKeyPem: keys.private_key_pem,
      publicKeyPem: keys.public_key_pem,
    });
    const forgedBody = { ...receipt, from: "forged-name.txt" };
    forgedBody.content_hash = recomputeReceiptContentHash(forgedBody);
    const bind = attestationBindsExecuteReceipt(forgedBody, attestation);
    assert.equal(bind.ok, false);
    assert.equal(bind.reason, "content_hash_bind_failed");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// 6. fails with wrong public key
test("verify fails with wrong public key", () => {
  const root = freshSandbox();
  try {
    const receipt = executeReceipt(root);
    const keys = freshKeypair();
    const wrong = freshKeypair();
    const attestation = signExecuteReceiptAttestation({
      receipt,
      consent: NODE0_RECEIPT_SIGNING_GO_PHRASE,
      privateKeyPem: keys.private_key_pem,
      publicKeyPem: keys.public_key_pem,
    });
    const verified = verifyExecuteReceiptAttestation(attestation, {
      publicKeyPem: wrong.public_key_pem,
    });
    assert.equal(verified.ok, false);
    // Parity round: the wrong key is caught at the fingerprint re-derivation
    // step — the displayed fingerprint does not re-derive from the wrong key.
    assert.equal(verified.reason, "public_key_fingerprint_mismatch");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// 7. refuses signing without exact consent phrase
test("refuses signing without exact consent phrase", () => {
  const root = freshSandbox();
  try {
    const receipt = executeReceipt(root);
    const keys = freshKeypair();
    const plan = planReceiptSigning({
      receipt,
      consent: "go: sign sandbox execute receipt attestation",
    });
    assert.equal(plan.eligible, false);
    assert.ok(plan.blocked_by.includes("consent_phrase_mismatch"));
    const attestation = signExecuteReceiptAttestation({
      receipt,
      consent: "go: sign sandbox execute receipt attestation",
      privateKeyPem: keys.private_key_pem,
      publicKeyPem: keys.public_key_pem,
    });
    assert.equal(attestation.signed, false);
    assert.ok(attestation.blocked_by.includes("consent_phrase_mismatch"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// 8. does not expose private key in attestation envelope
test("attestation envelope never exposes private key material", () => {
  const root = freshSandbox();
  try {
    const receipt = executeReceipt(root);
    const keys = freshKeypair();
    const attestation = signExecuteReceiptAttestation({
      receipt,
      consent: NODE0_RECEIPT_SIGNING_GO_PHRASE,
      privateKeyPem: keys.private_key_pem,
      publicKeyPem: keys.public_key_pem,
    });
    assert.equal(attestationExposesPrivateKeyMaterial(attestation), false);
    assert.doesNotMatch(JSON.stringify(attestation), /BEGIN PRIVATE KEY/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// 9. key material path is outside repo and under consented key-store boundary
test("key-store signing keeps keys outside repo under consented DEMA_HOME", async () => {
  const root = freshSandbox();
  const demaHome = mkdtempSync(join(tmpdir(), "dema-home-sign-"));
  try {
    const receipt = executeReceipt(root);
    const init = await initAuthorshipKey({
      consent: KEY_INIT_CONSENT_PHRASE,
      demaHome,
      force: true,
    });
    assert.equal(init.initialized, true);
    assert.ok(
      resolve(init.private_key_path).startsWith(resolve(demaHome)),
      "private key must live under consented DEMA_HOME",
    );
    assert.ok(
      !resolve(init.private_key_path).startsWith(REPO_ROOT),
      "private key must not live inside repo",
    );
    const attestation = await signExecuteReceiptAttestationWithKeyStore({
      receipt,
      consent: NODE0_RECEIPT_SIGNING_GO_PHRASE,
      demaHome,
    });
    assert.equal(attestation.signed, true);
    assert.equal(
      verifyExecuteReceiptAttestation(attestation, {
        publicKeyPem: attestation.signature.public_key_pem,
      }).ok,
      true,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(demaHome, { recursive: true, force: true });
  }
});

// 10. unsigned #306 receipt remains valid integrity receipt but not attestation
test("unsigned execute receipt stays integrity-valid without attestation", () => {
  const root = freshSandbox();
  try {
    const receipt = executeReceipt(root);
    const integrity = verifyExecuteReceipt(receipt, { fs: nodeFs });
    assert.equal(integrity.ok, true);
    const plan = planReceiptSigning({ receipt, consent: NODE0_RECEIPT_SIGNING_GO_PHRASE });
    assert.equal(plan.eligible, true);
    assert.equal(receipt.signed, undefined);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// 11. review gate emits ok:true only after sign + verify + tamper-fail
test("review gate passes sign verify and tamper rejection", () => {
  const result = runNode0ReceiptSigningEd25519Check();
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.attestation_signed, true);
  assert.equal(result.verify_ok, true);
  assert.equal(result.tamper_content_hash_rejected, true);
  assert.equal(result.tamper_state_hash_rejected, true);
  assert.equal(result.unsigned_integrity_ok, true);
  assert.equal(result.fingerprint_tamper_rejected, true);
  assert.equal(result.consent_tamper_rejected, true);
  assert.equal(result.bare_payload_signature_rejected, true);
});

// 12. orchestrator runNode0ReceiptSigningEd25519 matches review gate contract
test("runNode0ReceiptSigningEd25519 closes the attestation loop", () => {
  const root = freshSandbox();
  try {
    const result = runNode0ReceiptSigningEd25519({
      fs: nodeFs,
      sandboxRoot: root,
      now: NOW,
      generateKeypair: generateEd25519Keypair,
    });
    assert.equal(result.ok, true, result.blocked_by?.join(", "));
    assert.equal(result.boundary?.execution_authority_granted, undefined);
    assert.equal(result.attestation?.boundary?.execution_authority_granted, false);
    assert.equal(result.fingerprint_tamper_rejected, true);
    assert.equal(result.consent_tamper_rejected, true);
    assert.equal(result.bare_payload_signature_rejected, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// --- NODE0-RECEIPT-SIGNING-PARITY-1A ---
// Parity with PREVIEW-RECEIPT-SIGNING-1A semantics: the consent assertion lives
// inside the signed payload, and the displayed fingerprint must re-derive from
// the key that actually verifies the signature.

function signedAttestation(receipt, keys) {
  return signExecuteReceiptAttestation({
    receipt,
    consent: NODE0_RECEIPT_SIGNING_GO_PHRASE,
    privateKeyPem: keys.private_key_pem,
    publicKeyPem: keys.public_key_pem,
    publicKeyFingerprint: keys.public_key_fingerprint,
    signedAt: NOW,
  });
}

const EXPECTED_GO_HASH = `sha256:${sha256(NODE0_RECEIPT_SIGNING_GO_PHRASE)}`;

// 13. consent assertion is inside the signed payload
test("consent go_phrase_hash lives inside the signed payload", () => {
  const root = freshSandbox();
  try {
    const attestation = signedAttestation(executeReceipt(root), freshKeypair());
    assert.equal(attestation.signed, true);
    assert.equal(attestation.payload.consent.go_phrase_hash, EXPECTED_GO_HASH);
    assert.equal(attestation.payload.consent.mode, "exact_sign");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// 14. swapped displayed fingerprint fails
test("verify rejects a swapped public-key fingerprint", () => {
  const root = freshSandbox();
  try {
    const keys = freshKeypair();
    const attestation = signedAttestation(executeReceipt(root), keys);
    const swapped = {
      ...attestation,
      signature: {
        ...attestation.signature,
        public_key_fingerprint: generateEd25519Keypair().public_key_fingerprint,
      },
    };
    const verified = verifyExecuteReceiptAttestation(swapped, {
      publicKeyPem: keys.public_key_pem,
    });
    assert.equal(verified.ok, false);
    assert.equal(verified.reason, "public_key_fingerprint_mismatch");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// 15. signing with a mismatched caller-supplied fingerprint blocks fail-closed
test("signing blocks when the supplied fingerprint does not match the PEM", () => {
  const root = freshSandbox();
  try {
    const keys = freshKeypair();
    const blocked = signExecuteReceiptAttestation({
      receipt: executeReceipt(root),
      consent: NODE0_RECEIPT_SIGNING_GO_PHRASE,
      privateKeyPem: keys.private_key_pem,
      publicKeyPem: keys.public_key_pem,
      publicKeyFingerprint: generateEd25519Keypair().public_key_fingerprint,
    });
    assert.equal(blocked.signed, false);
    assert.ok(blocked.blocked_by.includes("public_key_fingerprint_mismatch"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// 16. malformed embedded PEM fails closed, not with a throw
test("verify rejects a malformed embedded public key PEM", () => {
  const root = freshSandbox();
  try {
    const attestation = signedAttestation(executeReceipt(root), freshKeypair());
    const malformed = {
      ...attestation,
      signature: { ...attestation.signature, public_key_pem: "not-a-pem" },
    };
    const verified = verifyExecuteReceiptAttestation(malformed);
    assert.equal(verified.ok, false);
    assert.equal(verified.reason, "public_key_invalid");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// 17. altered outer consent hash fails
test("verify rejects an altered displayed consent hash", () => {
  const root = freshSandbox();
  try {
    const attestation = signedAttestation(executeReceipt(root), freshKeypair());
    const altered = {
      ...attestation,
      consent: { ...attestation.consent, go_phrase_hash: `sha256:${"a".repeat(64)}` },
    };
    const verified = verifyExecuteReceiptAttestation(altered);
    assert.equal(verified.ok, false);
    assert.equal(verified.reason, "consent_hash_invalid");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// 18. removed outer consent fails
test("verify rejects an attestation with the consent block removed", () => {
  const root = freshSandbox();
  try {
    const attestation = signedAttestation(executeReceipt(root), freshKeypair());
    const { consent: _consent, ...withoutConsent } = attestation;
    const verified = verifyExecuteReceiptAttestation(withoutConsent);
    assert.equal(verified.ok, false);
    assert.equal(verified.reason, "consent_hash_invalid");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// 19. a signature over the bare payload (consent attached afterward) fails
test("consent is inside the signed subject — bare-payload signature fails", () => {
  const root = freshSandbox();
  try {
    const keys = freshKeypair();
    const attestation = signedAttestation(executeReceipt(root), keys);
    const { consent: _payloadConsent, ...barePayload } = attestation.payload;
    const bareSignature = signPayload(barePayload, keys.private_key_pem);
    const forged = {
      ...attestation,
      payload: barePayload,
      signature: { ...attestation.signature, value: bareSignature },
    };
    const verified = verifyExecuteReceiptAttestation(forged, {
      publicKeyPem: keys.public_key_pem,
    });
    assert.equal(verified.ok, false);
    assert.equal(verified.reason, "consent_not_in_signed_subject");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// 20. content-hash semantics unchanged: payload still binds the receipt hashes
test("payload content/state hashes still equal the source receipt hashes", () => {
  const root = freshSandbox();
  try {
    const receipt = executeReceipt(root);
    const attestation = signedAttestation(receipt, freshKeypair());
    assert.equal(attestation.payload.content_hash, receipt.content_hash);
    assert.equal(attestation.payload.state_hash, receipt.state_hash);
    assert.equal(attestationBindsExecuteReceipt(receipt, attestation).ok, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
