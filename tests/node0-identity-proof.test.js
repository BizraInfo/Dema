// NODE0-IDENTITY-1A · local Node0 identity proof
//
// Converts the Block0 slot node0_identity_proof_hash from NAMED_ONLY to
// PRODUCER_LIVE. A pure-with-key-load proof binding THIS local Node0 identity to
// the operator's Ed25519 key under explicit PROVE_NODE0_IDENTITY consent.
// It claims NOTHING about legal/biometric/federation/public-network identity.

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateKeyPairSync } from "node:crypto";
import {
  buildNode0IdentityProof,
  verifyNode0IdentityProof,
  node0IdentityCommitment,
  NODE0_IDENTITY_PROOF_SCHEMA,
  PROVE_NODE0_IDENTITY_ACTION_TYPE,
  PROVE_NODE0_IDENTITY_CONSENT_PHRASE,
} from "../packages/genesis/src/node0-identity-proof.js";
import { buildConsentProof } from "../packages/receipts/src/consent-proof.js";
import {
  generateEd25519Keypair,
  signPayload,
} from "../packages/receipts/src/authorship-signature.js";
import {
  initAuthorshipKey,
  KEY_INIT_CONSENT_PHRASE,
  loadPublicKey,
  loadPrivateKey,
} from "../packages/receipts/src/authorship-key-store.js";
import {
  sha256,
  stableStringify,
} from "../packages/consent/src/consent-common.js";

const CREATED = "2026-06-01T09:00:00.000Z";

async function freshHome() {
  return mkdtemp(join(tmpdir(), "dema-node0-id-"));
}

async function makeConsent(home, targetHash, overrides = {}) {
  const cp = await buildConsentProof({
    phrase: overrides.phrase ?? PROVE_NODE0_IDENTITY_CONSENT_PHRASE,
    actionScope: {
      action_type: overrides.action_type ?? PROVE_NODE0_IDENTITY_ACTION_TYPE,
      target_hash: overrides.target_hash ?? targetHash,
    },
    demaHome: home,
    nonce: overrides.nonce ?? "n0id0001".repeat(8),
    createdAtIso: "2026-06-01T08:59:00.000Z",
    expiresAtIso: "2026-06-01T09:04:00.000Z",
  });
  assert.equal(cp.built, true, "test setup: consent must build");
  return cp.consent_proof;
}

async function buildProof(home, consentOverrides = {}) {
  await initAuthorshipKey({ consent: KEY_INIT_CONSENT_PHRASE, demaHome: home });
  const pubkeyPem = await loadPublicKey(home);
  const id = node0IdentityCommitment({
    operatorPubkeyPem: pubkeyPem,
    createdAtIso: CREATED,
  });
  const consentProof = await makeConsent(home, id, consentOverrides);
  const r = await buildNode0IdentityProof({
    demaHome: home,
    consentProof,
    createdAtIso: CREATED,
  });
  return { r, pubkeyPem, id };
}

describe("NODE0-IDENTITY-1A · buildNode0IdentityProof / verify", () => {
  it("happy: builds a proof bound to the operator key; external verify succeeds", async () => {
    const home = await freshHome();
    try {
      const { r, pubkeyPem, id } = await buildProof(home);
      assert.equal(r.built, true, r.error);
      assert.equal(r.proof.schema, NODE0_IDENTITY_PROOF_SCHEMA);
      assert.equal(r.proof.node0_identity_id, id);
      assert.equal(
        r.proof.genesis_node_id,
        r.proof.operator_public_key_fingerprint,
      );
      assert.equal(
        r.proof.genesis_human_id,
        r.proof.operator_public_key_fingerprint,
      );
      assert.match(r.node0_identity_proof_hash, /^[a-f0-9]{64}$/);
      assert.equal(r.boundary.legal_identity_claimed, false);
      assert.equal(r.boundary.federation_used, false);

      const v = verifyNode0IdentityProof({
        proof: r.proof,
        operatorPubkeyPem: pubkeyPem,
      });
      assert.equal(v.verified, true, v.reason);
      assert.equal(v.node0_identity_proof_hash, r.node0_identity_proof_hash);
      assert.ok(Object.isFrozen(r.proof));
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("determinism: same inputs (same consent) → same node0_identity_proof_hash", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const pubkeyPem = await loadPublicKey(home);
      const id = node0IdentityCommitment({
        operatorPubkeyPem: pubkeyPem,
        createdAtIso: CREATED,
      });
      const consentProof = await makeConsent(home, id);
      const a = await buildNode0IdentityProof({
        demaHome: home,
        consentProof,
        createdAtIso: CREATED,
      });
      const b = await buildNode0IdentityProof({
        demaHome: home,
        consentProof,
        createdAtIso: CREATED,
      });
      assert.equal(a.built, true, a.error);
      assert.equal(b.node0_identity_proof_hash, a.node0_identity_proof_hash);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: missing consent / wrong action_type / wrong target_hash", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const pubkeyPem = await loadPublicKey(home);
      const id = node0IdentityCommitment({
        operatorPubkeyPem: pubkeyPem,
        createdAtIso: CREATED,
      });

      const noConsent = await buildNode0IdentityProof({
        demaHome: home,
        createdAtIso: CREATED,
      });
      assert.equal(noConsent.built, false);
      assert.equal(noConsent.error, "consent_proof_required");

      const wrongAction = await buildNode0IdentityProof({
        demaHome: home,
        consentProof: await makeConsent(home, id, {
          action_type: "MINT_LEDGER_ENTRY",
        }),
        createdAtIso: CREATED,
      });
      assert.equal(wrongAction.built, false);
      assert.equal(wrongAction.error, "consent_scope_mismatch");

      const wrongTarget = await buildNode0IdentityProof({
        demaHome: home,
        consentProof: await makeConsent(home, id, {
          target_hash: "f".repeat(64),
        }),
        createdAtIso: CREATED,
      });
      assert.equal(wrongTarget.built, false);
      assert.equal(wrongTarget.error, "consent_scope_mismatch");

      const wrongPhrase = await buildNode0IdentityProof({
        demaHome: home,
        consentProof: await makeConsent(home, id, {
          phrase: "GO: whatever",
          nonce: "n0id0003".repeat(8),
        }),
        createdAtIso: CREATED,
      });
      assert.equal(wrongPhrase.built, false);
      assert.equal(wrongPhrase.error, "consent_phrase_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("verify fail-closed: foreign key / RSA key / malformed key", async () => {
    const home = await freshHome();
    try {
      const { r } = await buildProof(home);
      const foreign = generateEd25519Keypair();
      assert.equal(
        verifyNode0IdentityProof({
          proof: r.proof,
          operatorPubkeyPem: foreign.public_key_pem,
        }).reason,
        "operator_key_mismatch",
      );
      const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 });
      assert.equal(
        verifyNode0IdentityProof({
          proof: r.proof,
          operatorPubkeyPem: rsa.publicKey.export({
            type: "spki",
            format: "pem",
          }),
        }).reason,
        "operator_key_not_ed25519",
      );
      assert.equal(
        verifyNode0IdentityProof({
          proof: r.proof,
          operatorPubkeyPem:
            "-----BEGIN PUBLIC KEY-----\nnope\n-----END PUBLIC KEY-----",
        }).reason,
        "external_pubkey_required",
      );
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("verify fail-closed: tampered genesis_node_id / node0_identity_id / proof_hash / boundary", async () => {
    const home = await freshHome();
    try {
      const { r, pubkeyPem } = await buildProof(home);
      const v = (proof) =>
        verifyNode0IdentityProof({ proof, operatorPubkeyPem: pubkeyPem })
          .reason;
      assert.equal(
        v({ ...r.proof, genesis_node_id: "a".repeat(64) }),
        "genesis_node_id_mismatch",
      );
      assert.equal(
        v({ ...r.proof, node0_identity_id: sha256("x") }),
        "node0_identity_id_mismatch",
      );
      assert.equal(
        v({ ...r.proof, node0_identity_proof_hash: "b".repeat(64) }),
        "node0_identity_proof_hash_mismatch",
      );
      assert.equal(
        v({
          ...r.proof,
          claim_boundary: {
            ...r.proof.claim_boundary,
            legal_identity_claimed: true,
          },
        }),
        "claim_boundary_violation",
      );
      assert.equal(
        v({
          ...r.proof,
          claim_boundary: { ...r.proof.claim_boundary, sneaky_flag: true },
        }),
        "claim_boundary_unexpected_field",
      );
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("a re-signed tamper still fails (signature over the canonical body)", async () => {
    const home = await freshHome();
    try {
      const { r, pubkeyPem } = await buildProof(home);
      // tamper genesis_human_id and re-sign + re-hash with the operator key
      const privateKeyPem = await loadPrivateKey(home);
      const {
        node0_identity_signature_b64,
        node0_identity_proof_hash,
        ...body
      } = r.proof;
      const tamperedBody = { ...body, genesis_human_id: "c".repeat(64) };
      const forged = {
        ...tamperedBody,
        node0_identity_signature_b64: signPayload(tamperedBody, privateKeyPem),
        node0_identity_proof_hash: sha256(stableStringify(tamperedBody)),
      };
      // genesis_human_id no longer == fingerprint → caught by the structural rule
      assert.equal(
        verifyNode0IdentityProof({
          proof: forged,
          operatorPubkeyPem: pubkeyPem,
        }).reason,
        "genesis_human_id_mismatch",
      );
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("proof carries no private-key material", async () => {
    const home = await freshHome();
    try {
      const { r } = await buildProof(home);
      const s = JSON.stringify(r);
      for (const f of ["PRIVATE KEY", '"private_key":', '"private_key_pem":']) {
        assert.equal(s.includes(f), false, f);
      }
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});
