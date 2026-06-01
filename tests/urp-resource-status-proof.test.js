// URP-STATUS-1A · local URP resource-status proof
//
// Converts the Block0 slot urp_resource_status_proof_hash from NAMED_ONLY to
// PRODUCER_LIVE-capable. A pure-with-key-load proof: the operator declares a
// BOUNDED, local-only resource-status snapshot, signs it with the Ed25519 key,
// and binds it to explicit consent. It claims no public marketplace, no
// availability guarantee, no federation, no market value, no token, no SLA.

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateKeyPairSync } from "node:crypto";
import {
  buildUrpResourceStatusProof,
  verifyUrpResourceStatusProof,
  urpResourceStatusCommitment,
  URP_RESOURCE_STATUS_PROOF_SCHEMA,
  PROVE_URP_RESOURCE_STATUS_ACTION_TYPE,
  PROVE_URP_RESOURCE_STATUS_CONSENT_PHRASE,
} from "../packages/genesis/src/urp-resource-status-proof.js";
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

const CREATED = "2026-06-01T10:00:00.000Z";
const RESOURCE_STATUS = Object.freeze({
  cpu_count: 8,
  ram_bytes: 16000000000,
  storage_bytes: 500000000000,
  gpu_present: false,
  device_count: 2,
  share_status: "local-only",
});

async function freshHome() {
  return mkdtemp(join(tmpdir(), "dema-urp-status-"));
}

async function makeConsent(home, targetHash, overrides = {}) {
  const cp = await buildConsentProof({
    phrase: overrides.phrase ?? PROVE_URP_RESOURCE_STATUS_CONSENT_PHRASE,
    actionScope: {
      action_type:
        overrides.action_type ?? PROVE_URP_RESOURCE_STATUS_ACTION_TYPE,
      target_hash: overrides.target_hash ?? targetHash,
    },
    demaHome: home,
    nonce: overrides.nonce ?? "urps0001".repeat(8),
    createdAtIso: "2026-06-01T09:59:00.000Z",
    expiresAtIso: "2026-06-01T10:04:00.000Z",
  });
  assert.equal(cp.built, true, "test setup: consent must build");
  return cp.consent_proof;
}

async function buildProof(home, opts = {}) {
  await initAuthorshipKey({ consent: KEY_INIT_CONSENT_PHRASE, demaHome: home });
  const pubkeyPem = await loadPublicKey(home);
  const resourceStatus = opts.resourceStatus ?? RESOURCE_STATUS;
  const id = urpResourceStatusCommitment({
    operatorPubkeyPem: pubkeyPem,
    resourceStatus,
    createdAtIso: CREATED,
  });
  const consentProof = await makeConsent(home, id, opts.consent ?? {});
  const r = await buildUrpResourceStatusProof({
    demaHome: home,
    consentProof,
    resourceStatus,
    createdAtIso: CREATED,
  });
  return { r, pubkeyPem, id };
}

describe("URP-STATUS-1A · buildUrpResourceStatusProof / verify", () => {
  it("happy: signs a bounded resource snapshot; external verify succeeds", async () => {
    const home = await freshHome();
    try {
      const { r, pubkeyPem, id } = await buildProof(home);
      assert.equal(r.built, true, r.error);
      assert.equal(r.proof.schema, URP_RESOURCE_STATUS_PROOF_SCHEMA);
      assert.equal(r.proof.urp_resource_status_id, id);
      assert.equal(
        r.proof.resource_status_hash,
        sha256(stableStringify(RESOURCE_STATUS)),
      );
      assert.deepEqual(r.proof.resource_status, RESOURCE_STATUS);
      assert.match(r.urp_resource_status_proof_hash, /^[a-f0-9]{64}$/);
      assert.equal(r.boundary.public_compute_marketplace_claimed, false);
      assert.equal(r.boundary.federation_used, false);

      const v = verifyUrpResourceStatusProof({
        proof: r.proof,
        operatorPubkeyPem: pubkeyPem,
      });
      assert.equal(v.verified, true, v.reason);
      assert.equal(
        v.urp_resource_status_proof_hash,
        r.urp_resource_status_proof_hash,
      );
      assert.ok(Object.isFrozen(r.proof));
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("determinism: same consent + same status → same proof hash", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const pubkeyPem = await loadPublicKey(home);
      const id = urpResourceStatusCommitment({
        operatorPubkeyPem: pubkeyPem,
        resourceStatus: RESOURCE_STATUS,
        createdAtIso: CREATED,
      });
      const consentProof = await makeConsent(home, id);
      const a = await buildUrpResourceStatusProof({
        demaHome: home,
        consentProof,
        resourceStatus: RESOURCE_STATUS,
        createdAtIso: CREATED,
      });
      const b = await buildUrpResourceStatusProof({
        demaHome: home,
        consentProof,
        resourceStatus: RESOURCE_STATUS,
        createdAtIso: CREATED,
      });
      assert.equal(a.built, true, a.error);
      assert.equal(
        b.urp_resource_status_proof_hash,
        a.urp_resource_status_proof_hash,
      );
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: missing consent / wrong action_type / wrong target / wrong phrase / invalid status", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const pubkeyPem = await loadPublicKey(home);
      const id = urpResourceStatusCommitment({
        operatorPubkeyPem: pubkeyPem,
        resourceStatus: RESOURCE_STATUS,
        createdAtIso: CREATED,
      });

      const noConsent = await buildUrpResourceStatusProof({
        demaHome: home,
        resourceStatus: RESOURCE_STATUS,
        createdAtIso: CREATED,
      });
      assert.equal(noConsent.error, "consent_proof_required");

      const badStatus = await buildUrpResourceStatusProof({
        demaHome: home,
        consentProof: await makeConsent(home, id),
        resourceStatus: { fn: () => 1 }, // not JSON-safe
        createdAtIso: CREATED,
      });
      assert.equal(badStatus.error, "resource_status_invalid");

      const wrongAction = await buildUrpResourceStatusProof({
        demaHome: home,
        consentProof: await makeConsent(home, id, {
          action_type: "MINT_LEDGER_ENTRY",
        }),
        resourceStatus: RESOURCE_STATUS,
        createdAtIso: CREATED,
      });
      assert.equal(wrongAction.error, "consent_scope_mismatch");

      const wrongTarget = await buildUrpResourceStatusProof({
        demaHome: home,
        consentProof: await makeConsent(home, id, {
          target_hash: "f".repeat(64),
        }),
        resourceStatus: RESOURCE_STATUS,
        createdAtIso: CREATED,
      });
      assert.equal(wrongTarget.error, "consent_scope_mismatch");

      const wrongPhrase = await buildUrpResourceStatusProof({
        demaHome: home,
        consentProof: await makeConsent(home, id, {
          phrase: "GO: whatever",
          nonce: "urps0002".repeat(8),
        }),
        resourceStatus: RESOURCE_STATUS,
        createdAtIso: CREATED,
      });
      assert.equal(wrongPhrase.error, "consent_phrase_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("verify fail-closed: foreign / RSA / malformed key", async () => {
    const home = await freshHome();
    try {
      const { r } = await buildProof(home);
      const foreign = generateEd25519Keypair();
      assert.equal(
        verifyUrpResourceStatusProof({
          proof: r.proof,
          operatorPubkeyPem: foreign.public_key_pem,
        }).reason,
        "operator_key_mismatch",
      );
      const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 });
      assert.equal(
        verifyUrpResourceStatusProof({
          proof: r.proof,
          operatorPubkeyPem: rsa.publicKey.export({
            type: "spki",
            format: "pem",
          }),
        }).reason,
        "operator_key_not_ed25519",
      );
      assert.equal(
        verifyUrpResourceStatusProof({
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

  it("verify fail-closed: tampered status / hash / id / proof_hash / boundary / unexpected field", async () => {
    const home = await freshHome();
    try {
      const { r, pubkeyPem } = await buildProof(home);
      const v = (proof) =>
        verifyUrpResourceStatusProof({ proof, operatorPubkeyPem: pubkeyPem })
          .reason;
      assert.equal(
        v({
          ...r.proof,
          resource_status: { ...r.proof.resource_status, cpu_count: 999 },
        }),
        "resource_status_hash_mismatch",
      );
      assert.equal(
        v({ ...r.proof, resource_status_hash: "a".repeat(64) }),
        "resource_status_hash_mismatch",
      );
      assert.equal(
        v({ ...r.proof, urp_resource_status_id: sha256("x") }),
        "urp_resource_status_id_mismatch",
      );
      assert.equal(
        v({ ...r.proof, urp_resource_status_proof_hash: "b".repeat(64) }),
        "urp_resource_status_proof_hash_mismatch",
      );
      assert.equal(
        v({
          ...r.proof,
          claim_boundary: { ...r.proof.claim_boundary, federation_used: true },
        }),
        "claim_boundary_violation",
      );
      assert.equal(
        v({
          ...r.proof,
          claim_boundary: { ...r.proof.claim_boundary, sneaky: true },
        }),
        "claim_boundary_unexpected_field",
      );
      assert.equal(
        v({ ...r.proof, extra_top_level: true }),
        "proof_unexpected_field",
      );
      assert.equal(
        v({ ...r.proof, consent_proof_hash: "not-a-hash" }),
        "consent_proof_hash_invalid",
      );
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("a re-signed tamper of resource_status_hash still fails (id re-derivation)", async () => {
    const home = await freshHome();
    try {
      const { r, pubkeyPem } = await buildProof(home);
      const privateKeyPem = await loadPrivateKey(home);
      const {
        urp_resource_status_signature_b64,
        urp_resource_status_proof_hash,
        ...body
      } = r.proof;
      // change the embedded status + its hash + re-sign + re-hash, but the id
      // commitment no longer matches the (unchanged) created_at/fingerprint path
      const newStatus = { ...body.resource_status, cpu_count: 64 };
      const tamperedBody = {
        ...body,
        resource_status: newStatus,
        resource_status_hash: sha256(stableStringify(newStatus)),
      };
      const forged = {
        ...tamperedBody,
        urp_resource_status_signature_b64: signPayload(
          tamperedBody,
          privateKeyPem,
        ),
        urp_resource_status_proof_hash: sha256(stableStringify(tamperedBody)),
      };
      // resource_status_hash now matches the new status, but urp_resource_status_id
      // was committed over the ORIGINAL status hash → id re-derivation fails.
      assert.equal(
        verifyUrpResourceStatusProof({
          proof: forged,
          operatorPubkeyPem: pubkeyPem,
        }).reason,
        "urp_resource_status_id_mismatch",
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
