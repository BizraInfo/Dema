import test from "node:test";
import assert from "node:assert/strict";

import { generateEd25519Keypair } from "../packages/receipts/src/authorship-signature.js";
import { buildNode0ProofChainLinkPayload } from "../packages/core/src/node0-proof-chain-link.js";
import {
  planSignedChainHead,
  buildSignedChainHeadPayload,
  signChainHead,
  verifySignedChainHead,
  signedChainHeadBindsChain,
  attestationExposesPrivateKeyMaterial,
  runNode0SignedChainHead,
  NODE0_SIGNED_CHAIN_HEAD_SCHEMA,
  NODE0_SIGNED_CHAIN_HEAD_TRUTH_LABEL,
  NODE0_SIGNED_CHAIN_HEAD_GO_PHRASE,
} from "../packages/core/src/node0-signed-chain-head.js";
import { runNode0SignedChainHeadCheck } from "../scripts/review/node0-signed-chain-head-check.mjs";

const RECEIPTS = [
  `sha256:${"1".repeat(64)}`,
  `sha256:${"2".repeat(64)}`,
  `sha256:${"3".repeat(64)}`,
];

const chain = () => buildNode0ProofChainLinkPayload(RECEIPTS);
const keys = () => generateEd25519Keypair();

function sign(c = chain(), k = keys()) {
  return signChainHead({
    chain: c,
    consent: NODE0_SIGNED_CHAIN_HEAD_GO_PHRASE,
    privateKeyPem: k.private_key_pem,
    publicKeyPem: k.public_key_pem,
    publicKeyFingerprint: k.public_key_fingerprint,
  });
}

test("plan is fail-closed without the exact consent phrase", () => {
  const plan = planSignedChainHead({ consent: "wrong", chain: chain() });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("consent_phrase_mismatch"));
});

test("plan rejects a non-chain or an unverifiable chain", () => {
  assert.ok(
    planSignedChainHead({
      consent: NODE0_SIGNED_CHAIN_HEAD_GO_PHRASE,
      chain: { schema: "nope" },
    }).blocked_by.includes("chain_schema_mismatch"),
  );
  const broken = { ...chain(), head_hash: `sha256:${"0".repeat(64)}` };
  assert.ok(
    planSignedChainHead({
      consent: NODE0_SIGNED_CHAIN_HEAD_GO_PHRASE,
      chain: broken,
    }).blocked_by.includes("chain_verify_failed"),
  );
});

test("head payload binds head_hash, link_count, and chain content address", () => {
  const c = chain();
  const payload = buildSignedChainHeadPayload(c);
  assert.equal(payload.head_hash, c.head_hash);
  assert.equal(payload.link_count, c.links.length);
  assert.equal(payload.chain_content_hash, c.content_hash);
});

test("signs the chain head into a verifiable attestation envelope", () => {
  const att = sign();
  assert.equal(att.signed, true);
  assert.equal(att.schema, NODE0_SIGNED_CHAIN_HEAD_SCHEMA);
  assert.equal(att.signature.algorithm, "ed25519");
});

test("verifies the signed head with the public key only", () => {
  const k = keys();
  const att = sign(chain(), k);
  assert.equal(verifySignedChainHead(att, { publicKeyPem: k.public_key_pem }).ok, true);
});

test("verify fails with the wrong public key", () => {
  const att = sign();
  const wrong = keys();
  const v = verifySignedChainHead(att, { publicKeyPem: wrong.public_key_pem });
  assert.equal(v.ok, false);
  assert.equal(v.reason, "signature_invalid");
});

test("attestation binds the exact chain it signed", () => {
  const c = chain();
  const att = sign(c);
  assert.equal(signedChainHeadBindsChain(c, att).ok, true);
});

test("bind fails for a tampered/reordered chain (different head)", () => {
  const att = sign(chain());
  const tampered = buildNode0ProofChainLinkPayload([
    `sha256:${"9".repeat(64)}`,
    ...RECEIPTS.slice(1),
  ]);
  const bind = signedChainHeadBindsChain(tampered, att);
  assert.equal(bind.ok, false);
  assert.equal(bind.reason, "head_hash_bind_failed");
});

test("refuses signing without exact consent", () => {
  const k = keys();
  const att = signChainHead({
    chain: chain(),
    consent: "go: sign proof chain head attestation",
    privateKeyPem: k.private_key_pem,
    publicKeyPem: k.public_key_pem,
  });
  assert.equal(att.signed, false);
  assert.ok(att.blocked_by.includes("consent_phrase_mismatch"));
});

test("attestation never exposes private key material", () => {
  const att = sign();
  assert.equal(attestationExposesPrivateKeyMaterial(att), false);
  assert.doesNotMatch(JSON.stringify(att), /BEGIN PRIVATE KEY/);
});

test("review gate closes the loop: build chain -> sign -> verify -> bind -> tamper-reject", () => {
  const result = runNode0SignedChainHeadCheck();
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.attestation_signed, true);
  assert.equal(result.verify_ok, true);
  assert.equal(result.bind_ok, true);
  assert.equal(result.tamper_chain_bind_rejected, true);
});

test("orchestrator boundary: signing authority is not execution authority", () => {
  const result = runNode0SignedChainHead({
    generateKeypair: generateEd25519Keypair,
  });
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.truth_label, NODE0_SIGNED_CHAIN_HEAD_TRUTH_LABEL);
  assert.equal(result.boundary.execution_authority_granted, false);
  assert.equal(result.boundary.persistent_key_custody, false);
  assert.equal(result.boundary.private_key_exposed, false);
});
