// DEMA-REALM-STATE-1A · local Dema Realm state proof
//
// Converts the Block0 slot dema_realm_state_proof_hash from NAMED_ONLY to
// PRODUCER_LIVE-capable. A pure-with-key-load proof: the operator declares a
// BOUNDED, local-only Realm-state snapshot (the read-only counters that
// gatherDemaRealmStatus measures off disk), signs it with the Ed25519 key, and
// binds it to explicit consent. It claims NO live RPG world, NO persistent
// multiplayer realm, NO runtime-backed council, NO working cockpit beyond the
// read-only status, NO federation, NO market value, NO token.

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateKeyPairSync } from "node:crypto";
import {
  buildDemaRealmStateProof,
  verifyDemaRealmStateProof,
  demaRealmStateCommitment,
  DEMA_REALM_STATE_PROOF_SCHEMA,
  PROVE_DEMA_REALM_STATE_ACTION_TYPE,
  PROVE_DEMA_REALM_STATE_CONSENT_PHRASE,
} from "../packages/genesis/src/dema-realm-state-proof.js";
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

const CREATED = "2026-06-01T11:00:00.000Z";
// A representative gatherDemaRealmStatus() snapshot (volatile rendered_at_iso
// dropped; the producer injects created_at_iso instead — no wall clock).
const REALM_STATE = Object.freeze({
  identity_status: "VERIFIED",
  authorship_receipts_count: 3,
  urp_indexes_count: 1,
  checkpoint_present: true,
  last_checkpoint_label: "URP-STATUS-1A sealed",
  timeline_events_count: 5,
});

async function freshHome() {
  return mkdtemp(join(tmpdir(), "dema-realm-state-"));
}

async function makeConsent(home, targetHash, overrides = {}) {
  const cp = await buildConsentProof({
    phrase: overrides.phrase ?? PROVE_DEMA_REALM_STATE_CONSENT_PHRASE,
    actionScope: {
      action_type: overrides.action_type ?? PROVE_DEMA_REALM_STATE_ACTION_TYPE,
      target_hash: overrides.target_hash ?? targetHash,
    },
    demaHome: home,
    nonce: overrides.nonce ?? "realm001".repeat(8),
    createdAtIso: "2026-06-01T10:59:00.000Z",
    expiresAtIso: "2026-06-01T11:04:00.000Z",
  });
  assert.equal(cp.built, true, "test setup: consent must build");
  return cp.consent_proof;
}

async function buildProof(home, opts = {}) {
  await initAuthorshipKey({ consent: KEY_INIT_CONSENT_PHRASE, demaHome: home });
  const pubkeyPem = await loadPublicKey(home);
  const realmState = opts.realmState ?? REALM_STATE;
  const id = demaRealmStateCommitment({
    operatorPubkeyPem: pubkeyPem,
    realmState,
    createdAtIso: CREATED,
  });
  const consentProof = await makeConsent(home, id, opts.consent ?? {});
  const r = await buildDemaRealmStateProof({
    demaHome: home,
    consentProof,
    realmState,
    createdAtIso: CREATED,
  });
  return { r, pubkeyPem, id };
}

describe("DEMA-REALM-STATE-1A · buildDemaRealmStateProof / verify", () => {
  it("happy: signs a bounded realm-state snapshot; external verify succeeds", async () => {
    const home = await freshHome();
    try {
      const { r, pubkeyPem, id } = await buildProof(home);
      assert.equal(r.built, true, r.error);
      assert.equal(r.proof.schema, DEMA_REALM_STATE_PROOF_SCHEMA);
      assert.equal(r.proof.dema_realm_state_id, id);
      assert.equal(
        r.proof.realm_state_hash,
        sha256(stableStringify(REALM_STATE)),
      );
      assert.deepEqual(r.proof.realm_state, REALM_STATE);
      assert.match(r.dema_realm_state_proof_hash, /^[a-f0-9]{64}$/);
      assert.equal(r.boundary.live_rpg_world_claimed, false);
      assert.equal(r.boundary.runtime_backed_council_claimed, false);

      const v = verifyDemaRealmStateProof({
        proof: r.proof,
        operatorPubkeyPem: pubkeyPem,
      });
      assert.equal(v.verified, true, v.reason);
      assert.equal(
        v.dema_realm_state_proof_hash,
        r.dema_realm_state_proof_hash,
      );
      assert.ok(Object.isFrozen(r.proof));
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("determinism: same consent + same state → same proof hash", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const pubkeyPem = await loadPublicKey(home);
      const id = demaRealmStateCommitment({
        operatorPubkeyPem: pubkeyPem,
        realmState: REALM_STATE,
        createdAtIso: CREATED,
      });
      const consentProof = await makeConsent(home, id);
      const a = await buildDemaRealmStateProof({
        demaHome: home,
        consentProof,
        realmState: REALM_STATE,
        createdAtIso: CREATED,
      });
      const b = await buildDemaRealmStateProof({
        demaHome: home,
        consentProof,
        realmState: REALM_STATE,
        createdAtIso: CREATED,
      });
      assert.equal(a.built, true, a.error);
      assert.equal(
        b.dema_realm_state_proof_hash,
        a.dema_realm_state_proof_hash,
      );
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: missing consent / wrong action_type / wrong target / wrong phrase / invalid state", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const pubkeyPem = await loadPublicKey(home);
      const id = demaRealmStateCommitment({
        operatorPubkeyPem: pubkeyPem,
        realmState: REALM_STATE,
        createdAtIso: CREATED,
      });

      const noConsent = await buildDemaRealmStateProof({
        demaHome: home,
        realmState: REALM_STATE,
        createdAtIso: CREATED,
      });
      assert.equal(noConsent.error, "consent_proof_required");

      const badState = await buildDemaRealmStateProof({
        demaHome: home,
        consentProof: await makeConsent(home, id),
        realmState: { fn: () => 1 }, // not JSON-safe
        createdAtIso: CREATED,
      });
      assert.equal(badState.error, "realm_state_invalid");

      const wrongAction = await buildDemaRealmStateProof({
        demaHome: home,
        consentProof: await makeConsent(home, id, {
          action_type: "MINT_LEDGER_ENTRY",
        }),
        realmState: REALM_STATE,
        createdAtIso: CREATED,
      });
      assert.equal(wrongAction.error, "consent_scope_mismatch");

      const wrongTarget = await buildDemaRealmStateProof({
        demaHome: home,
        consentProof: await makeConsent(home, id, {
          target_hash: "f".repeat(64),
        }),
        realmState: REALM_STATE,
        createdAtIso: CREATED,
      });
      assert.equal(wrongTarget.error, "consent_scope_mismatch");

      const wrongPhrase = await buildDemaRealmStateProof({
        demaHome: home,
        consentProof: await makeConsent(home, id, {
          phrase: "GO: whatever",
          nonce: "realm002".repeat(8),
        }),
        realmState: REALM_STATE,
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
        verifyDemaRealmStateProof({
          proof: r.proof,
          operatorPubkeyPem: foreign.public_key_pem,
        }).reason,
        "operator_key_mismatch",
      );
      const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 });
      assert.equal(
        verifyDemaRealmStateProof({
          proof: r.proof,
          operatorPubkeyPem: rsa.publicKey.export({
            type: "spki",
            format: "pem",
          }),
        }).reason,
        "operator_key_not_ed25519",
      );
      assert.equal(
        verifyDemaRealmStateProof({
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

  it("verify fail-closed: tampered state / hash / id / proof_hash / boundary / unexpected field", async () => {
    const home = await freshHome();
    try {
      const { r, pubkeyPem } = await buildProof(home);
      const v = (proof) =>
        verifyDemaRealmStateProof({ proof, operatorPubkeyPem: pubkeyPem })
          .reason;
      assert.equal(
        v({
          ...r.proof,
          realm_state: {
            ...r.proof.realm_state,
            authorship_receipts_count: 999,
          },
        }),
        "realm_state_hash_mismatch",
      );
      assert.equal(
        v({ ...r.proof, realm_state_hash: "a".repeat(64) }),
        "realm_state_hash_mismatch",
      );
      assert.equal(
        v({ ...r.proof, dema_realm_state_id: sha256("x") }),
        "dema_realm_state_id_mismatch",
      );
      assert.equal(
        v({ ...r.proof, dema_realm_state_proof_hash: "b".repeat(64) }),
        "dema_realm_state_proof_hash_mismatch",
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

  it("a re-signed tamper of realm_state_hash still fails (id re-derivation)", async () => {
    const home = await freshHome();
    try {
      const { r, pubkeyPem } = await buildProof(home);
      const privateKeyPem = await loadPrivateKey(home);
      const {
        dema_realm_state_signature_b64,
        dema_realm_state_proof_hash,
        ...body
      } = r.proof;
      // change the embedded state + its hash + re-sign + re-hash, but the id
      // commitment was over the ORIGINAL state hash → id re-derivation fails.
      const newState = { ...body.realm_state, authorship_receipts_count: 64 };
      const tamperedBody = {
        ...body,
        realm_state: newState,
        realm_state_hash: sha256(stableStringify(newState)),
      };
      const forged = {
        ...tamperedBody,
        dema_realm_state_signature_b64: signPayload(
          tamperedBody,
          privateKeyPem,
        ),
        dema_realm_state_proof_hash: sha256(stableStringify(tamperedBody)),
      };
      assert.equal(
        verifyDemaRealmStateProof({
          proof: forged,
          operatorPubkeyPem: pubkeyPem,
        }).reason,
        "dema_realm_state_id_mismatch",
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
