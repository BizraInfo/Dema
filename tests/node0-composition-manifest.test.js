// NODE0-OSTREE-1A · local Node0 composition manifest
//
// The "smallest honest next step" the OSTree TAD §8 names: a pure-with-key-load
// kernel that builds a signed bizra.dema.node0_composition_manifest.v0.1 from a
// BOUNDED composition snapshot (node ref, block0 linkage, content-addressed
// kernel set, SAT gates, prerequisites) and a verifier that re-derives it. No
// libostree, no daemon, no federation, no deploy surface. Honest-unsealed:
// block0_id may be null and block0_sealed:false — the manifest composes the
// CURRENT node state, sealed or not, and claims nothing it cannot prove.

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateKeyPairSync } from "node:crypto";
import {
  buildNode0CompositionManifest,
  verifyNode0CompositionManifest,
  node0CompositionCommitment,
  NODE0_COMPOSITION_MANIFEST_SCHEMA,
  PROVE_NODE0_COMPOSITION_ACTION_TYPE,
  PROVE_NODE0_COMPOSITION_CONSENT_PHRASE,
} from "../packages/genesis/src/node0-composition-manifest.js";
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

const CREATED = "2026-06-01T14:00:00.000Z";
// Honest-unsealed composition: Block0 is NOT sealable today, so block0_id is
// null and block0_sealed false. SAT gates mirror the frozen CANONICAL_AGENTS.
const COMPOSITION = Object.freeze({
  node0_ref: "bizra/node0/main",
  block0_id: null,
  block0_sealed: false,
  receipt_chain_root: null,
  kernels: [
    { name: "block0-judge-from-proofs", source_hash: sha256("k:judge") },
    {
      name: "block0-prerequisite-status-collector",
      source_hash: sha256("k:collector"),
    },
  ],
  sat_gates: [
    "sat.verifier",
    "sat.compliance",
    "sat.resource",
    "sat.economist",
    "sat.evolution",
  ],
  collectable_prerequisites_derived: 3,
});

async function freshHome() {
  return mkdtemp(join(tmpdir(), "dema-node0-ostree-"));
}

async function makeConsent(home, targetHash, overrides = {}) {
  const cp = await buildConsentProof({
    phrase: overrides.phrase ?? PROVE_NODE0_COMPOSITION_CONSENT_PHRASE,
    actionScope: {
      action_type: overrides.action_type ?? PROVE_NODE0_COMPOSITION_ACTION_TYPE,
      target_hash: overrides.target_hash ?? targetHash,
    },
    demaHome: home,
    nonce: overrides.nonce ?? "n0comp01".repeat(8),
    createdAtIso: "2026-06-01T13:59:00.000Z",
    expiresAtIso: "2026-06-01T14:04:00.000Z",
  });
  assert.equal(cp.built, true, "test setup: consent must build");
  return cp.consent_proof;
}

async function buildManifest(home, opts = {}) {
  await initAuthorshipKey({ consent: KEY_INIT_CONSENT_PHRASE, demaHome: home });
  const pubkeyPem = await loadPublicKey(home);
  const composition = opts.composition ?? COMPOSITION;
  const id = node0CompositionCommitment({
    operatorPubkeyPem: pubkeyPem,
    composition,
    createdAtIso: CREATED,
  });
  const consentProof = await makeConsent(home, id, opts.consent ?? {});
  const r = await buildNode0CompositionManifest({
    demaHome: home,
    consentProof,
    composition,
    createdAtIso: CREATED,
  });
  return { r, pubkeyPem, id };
}

describe("NODE0-OSTREE-1A · buildNode0CompositionManifest / verify", () => {
  it("happy: signs a bounded composition; external verify succeeds; honest-unsealed", async () => {
    const home = await freshHome();
    try {
      const { r, pubkeyPem, id } = await buildManifest(home);
      assert.equal(r.built, true, r.error);
      assert.equal(r.manifest.schema, NODE0_COMPOSITION_MANIFEST_SCHEMA);
      assert.equal(r.manifest.node0_composition_id, id);
      assert.equal(
        r.manifest.composition_hash,
        sha256(stableStringify(COMPOSITION)),
      );
      assert.deepEqual(r.manifest.composition, COMPOSITION);
      assert.equal(r.manifest.composition.block0_sealed, false);
      assert.equal(r.manifest.composition.block0_id, null);
      assert.match(r.node0_composition_proof_hash, /^[a-f0-9]{64}$/);
      assert.equal(r.boundary.token_minted_to_humans, false);
      assert.equal(r.boundary.public_network_used, false);
      assert.equal(r.boundary.federation_used, false);

      const v = verifyNode0CompositionManifest({
        manifest: r.manifest,
        operatorPubkeyPem: pubkeyPem,
      });
      assert.equal(v.verified, true, v.reason);
      assert.equal(
        v.node0_composition_proof_hash,
        r.node0_composition_proof_hash,
      );
      assert.ok(Object.isFrozen(r.manifest));
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("determinism: same consent + same composition → same proof hash", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const pubkeyPem = await loadPublicKey(home);
      const id = node0CompositionCommitment({
        operatorPubkeyPem: pubkeyPem,
        composition: COMPOSITION,
        createdAtIso: CREATED,
      });
      const consentProof = await makeConsent(home, id);
      const a = await buildNode0CompositionManifest({
        demaHome: home,
        consentProof,
        composition: COMPOSITION,
        createdAtIso: CREATED,
      });
      const b = await buildNode0CompositionManifest({
        demaHome: home,
        consentProof,
        composition: COMPOSITION,
        createdAtIso: CREATED,
      });
      assert.equal(a.built, true, a.error);
      assert.equal(
        b.node0_composition_proof_hash,
        a.node0_composition_proof_hash,
      );
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed build: missing consent / wrong action / wrong target / wrong phrase / invalid composition", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const pubkeyPem = await loadPublicKey(home);
      const id = node0CompositionCommitment({
        operatorPubkeyPem: pubkeyPem,
        composition: COMPOSITION,
        createdAtIso: CREATED,
      });

      const noConsent = await buildNode0CompositionManifest({
        demaHome: home,
        composition: COMPOSITION,
        createdAtIso: CREATED,
      });
      assert.equal(noConsent.error, "consent_proof_required");

      const badComposition = await buildNode0CompositionManifest({
        demaHome: home,
        consentProof: await makeConsent(home, id),
        composition: { fn: () => 1 },
        createdAtIso: CREATED,
      });
      assert.equal(badComposition.error, "composition_invalid");

      const wrongAction = await buildNode0CompositionManifest({
        demaHome: home,
        consentProof: await makeConsent(home, id, {
          action_type: "SEAL_BLOCK0",
        }),
        composition: COMPOSITION,
        createdAtIso: CREATED,
      });
      assert.equal(wrongAction.error, "consent_scope_mismatch");

      const wrongTarget = await buildNode0CompositionManifest({
        demaHome: home,
        consentProof: await makeConsent(home, id, {
          target_hash: "f".repeat(64),
        }),
        composition: COMPOSITION,
        createdAtIso: CREATED,
      });
      assert.equal(wrongTarget.error, "consent_scope_mismatch");

      const wrongPhrase = await buildNode0CompositionManifest({
        demaHome: home,
        consentProof: await makeConsent(home, id, {
          phrase: "GO: whatever",
          nonce: "n0comp02".repeat(8),
        }),
        composition: COMPOSITION,
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
      const { r } = await buildManifest(home);
      const foreign = generateEd25519Keypair();
      assert.equal(
        verifyNode0CompositionManifest({
          manifest: r.manifest,
          operatorPubkeyPem: foreign.public_key_pem,
        }).reason,
        "operator_key_mismatch",
      );
      const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 });
      assert.equal(
        verifyNode0CompositionManifest({
          manifest: r.manifest,
          operatorPubkeyPem: rsa.publicKey.export({
            type: "spki",
            format: "pem",
          }),
        }).reason,
        "operator_key_not_ed25519",
      );
      assert.equal(
        verifyNode0CompositionManifest({
          manifest: r.manifest,
          operatorPubkeyPem:
            "-----BEGIN PUBLIC KEY-----\nnope\n-----END PUBLIC KEY-----",
        }).reason,
        "external_pubkey_required",
      );
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("verify fail-closed: tampered composition / hash / id / proof_hash / boundary / unexpected field", async () => {
    const home = await freshHome();
    try {
      const { r, pubkeyPem } = await buildManifest(home);
      const v = (manifest) =>
        verifyNode0CompositionManifest({
          manifest,
          operatorPubkeyPem: pubkeyPem,
        }).reason;
      assert.equal(
        v({
          ...r.manifest,
          composition: { ...r.manifest.composition, node0_ref: "evil" },
        }),
        "composition_hash_mismatch",
      );
      assert.equal(
        v({ ...r.manifest, composition_hash: "a".repeat(64) }),
        "composition_hash_mismatch",
      );
      assert.equal(
        v({ ...r.manifest, node0_composition_id: sha256("x") }),
        "node0_composition_id_mismatch",
      );
      assert.equal(
        v({ ...r.manifest, node0_composition_proof_hash: "b".repeat(64) }),
        "node0_composition_proof_hash_mismatch",
      );
      assert.equal(
        v({
          ...r.manifest,
          claim_boundary: {
            ...r.manifest.claim_boundary,
            federation_used: true,
          },
        }),
        "claim_boundary_violation",
      );
      assert.equal(
        v({
          ...r.manifest,
          claim_boundary: { ...r.manifest.claim_boundary, sneaky: true },
        }),
        "claim_boundary_unexpected_field",
      );
      assert.equal(
        v({ ...r.manifest, extra_top_level: true }),
        "manifest_unexpected_field",
      );
      assert.equal(
        v({ ...r.manifest, consent_proof_hash: "not-a-hash" }),
        "consent_proof_hash_invalid",
      );
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("a re-signed tamper of composition_hash still fails (id re-derivation)", async () => {
    const home = await freshHome();
    try {
      const { r, pubkeyPem } = await buildManifest(home);
      const privateKeyPem = await loadPrivateKey(home);
      const {
        node0_composition_signature_b64,
        node0_composition_proof_hash,
        ...body
      } = r.manifest;
      const newComposition = {
        ...body.composition,
        node0_ref: "bizra/node0/forged",
      };
      const tamperedBody = {
        ...body,
        composition: newComposition,
        composition_hash: sha256(stableStringify(newComposition)),
      };
      const forged = {
        ...tamperedBody,
        node0_composition_signature_b64: signPayload(
          tamperedBody,
          privateKeyPem,
        ),
        node0_composition_proof_hash: sha256(stableStringify(tamperedBody)),
      };
      assert.equal(
        verifyNode0CompositionManifest({
          manifest: forged,
          operatorPubkeyPem: pubkeyPem,
        }).reason,
        "node0_composition_id_mismatch",
      );
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("manifest carries no private-key material", async () => {
    const home = await freshHome();
    try {
      const { r } = await buildManifest(home);
      const s = JSON.stringify(r);
      for (const f of ["PRIVATE KEY", '"private_key":', '"private_key_pem":']) {
        assert.equal(s.includes(f), false, f);
      }
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});
