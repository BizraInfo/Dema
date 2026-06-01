// COLLECTOR-1A · Block0 prerequisite status collector
//
// Turns the prerequisiteStatusMap from a HAND-ASSERTED claim into a DERIVED
// fact — but only for the slots whose genesis producers can actually be run +
// verified locally (node0_identity, urp_resource_status, dema_realm_state). For
// each provided proof, the collector runs the matching verifier and marks the
// slot PRODUCER_LIVE iff verified:true, else NAMED_ONLY. It returns ONLY the
// slots it verified — it NEVER asserts a slot it did not verify, and it NEVER
// scans the repo. The remaining 9 Block0 slots are out of scope (omitted), so a
// downstream verifyBlock0Manifest still treats them as NAMED_ONLY → not sealable.

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  collectBlock0PrerequisiteStatus,
  BLOCK0_PREREQUISITE_STATUS_COLLECTION_SCHEMA,
} from "../packages/genesis/src/block0-prerequisite-status-collector.js";
import {
  buildNode0IdentityProof,
  node0IdentityCommitment,
  PROVE_NODE0_IDENTITY_ACTION_TYPE,
  PROVE_NODE0_IDENTITY_CONSENT_PHRASE,
} from "../packages/genesis/src/node0-identity-proof.js";
import {
  buildUrpResourceStatusProof,
  urpResourceStatusCommitment,
  PROVE_URP_RESOURCE_STATUS_ACTION_TYPE,
  PROVE_URP_RESOURCE_STATUS_CONSENT_PHRASE,
} from "../packages/genesis/src/urp-resource-status-proof.js";
import {
  buildDemaRealmStateProof,
  demaRealmStateCommitment,
  PROVE_DEMA_REALM_STATE_ACTION_TYPE,
  PROVE_DEMA_REALM_STATE_CONSENT_PHRASE,
} from "../packages/genesis/src/dema-realm-state-proof.js";
import { buildConsentProof } from "../packages/receipts/src/consent-proof.js";
import {
  initAuthorshipKey,
  KEY_INIT_CONSENT_PHRASE,
  loadPublicKey,
} from "../packages/receipts/src/authorship-key-store.js";

const CREATED = "2026-06-01T12:00:00.000Z";
const RESOURCE_STATUS = Object.freeze({
  cpu_count: 8,
  share_status: "local-only",
});
const REALM_STATE = Object.freeze({
  identity_status: "VERIFIED",
  authorship_receipts_count: 3,
});

async function freshHome() {
  return mkdtemp(join(tmpdir(), "dema-collector-"));
}

async function mkConsent(home, phrase, action_type, target_hash, nonceSeed) {
  const cp = await buildConsentProof({
    phrase,
    actionScope: { action_type, target_hash },
    demaHome: home,
    nonce: nonceSeed.repeat(8),
    createdAtIso: "2026-06-01T11:59:00.000Z",
    expiresAtIso: "2026-06-01T12:04:00.000Z",
  });
  assert.equal(cp.built, true, "test setup: consent must build");
  return cp.consent_proof;
}

async function buildAllProofs(home) {
  await initAuthorshipKey({ consent: KEY_INIT_CONSENT_PHRASE, demaHome: home });
  const pubkeyPem = await loadPublicKey(home);

  const node0Id = node0IdentityCommitment({
    operatorPubkeyPem: pubkeyPem,
    createdAtIso: CREATED,
  });
  const node0 = await buildNode0IdentityProof({
    demaHome: home,
    consentProof: await mkConsent(
      home,
      PROVE_NODE0_IDENTITY_CONSENT_PHRASE,
      PROVE_NODE0_IDENTITY_ACTION_TYPE,
      node0Id,
      "node0001",
    ),
    createdAtIso: CREATED,
  });

  const urpId = urpResourceStatusCommitment({
    operatorPubkeyPem: pubkeyPem,
    resourceStatus: RESOURCE_STATUS,
    createdAtIso: CREATED,
  });
  const urp = await buildUrpResourceStatusProof({
    demaHome: home,
    consentProof: await mkConsent(
      home,
      PROVE_URP_RESOURCE_STATUS_CONSENT_PHRASE,
      PROVE_URP_RESOURCE_STATUS_ACTION_TYPE,
      urpId,
      "urpc0001",
    ),
    resourceStatus: RESOURCE_STATUS,
    createdAtIso: CREATED,
  });

  const realmId = demaRealmStateCommitment({
    operatorPubkeyPem: pubkeyPem,
    realmState: REALM_STATE,
    createdAtIso: CREATED,
  });
  const realm = await buildDemaRealmStateProof({
    demaHome: home,
    consentProof: await mkConsent(
      home,
      PROVE_DEMA_REALM_STATE_CONSENT_PHRASE,
      PROVE_DEMA_REALM_STATE_ACTION_TYPE,
      realmId,
      "realm001",
    ),
    realmState: REALM_STATE,
    createdAtIso: CREATED,
  });

  assert.equal(node0.built, true, node0.error);
  assert.equal(urp.built, true, urp.error);
  assert.equal(realm.built, true, realm.error);
  return { pubkeyPem, node0: node0.proof, urp: urp.proof, realm: realm.proof };
}

describe("COLLECTOR-1A · collectBlock0PrerequisiteStatus", () => {
  it("happy: 3 verified proofs → 3 PRODUCER_LIVE, derived not asserted", async () => {
    const home = await freshHome();
    try {
      const { pubkeyPem, node0, urp, realm } = await buildAllProofs(home);
      const r = collectBlock0PrerequisiteStatus({
        proofs: {
          node0_identity_proof_hash: node0,
          urp_resource_status_proof_hash: urp,
          dema_realm_state_proof_hash: realm,
        },
        operatorPubkeyPem: pubkeyPem,
      });
      assert.equal(r.collected, true, r.error);
      assert.equal(r.schema, BLOCK0_PREREQUISITE_STATUS_COLLECTION_SCHEMA);
      assert.equal(r.status_map.node0_identity_proof_hash, "PRODUCER_LIVE");
      assert.equal(
        r.status_map.urp_resource_status_proof_hash,
        "PRODUCER_LIVE",
      );
      assert.equal(r.status_map.dema_realm_state_proof_hash, "PRODUCER_LIVE");
      assert.equal(r.producer_live_count, 3);
      assert.equal(r.provided_slot_count, 3);
      assert.equal(r.of_total, 12);
      assert.equal(r.boundary.repo_scanned, false);
      assert.equal(r.boundary.status_asserted_without_verification, false);
      assert.ok(Object.isFrozen(r));
      assert.ok(Object.isFrozen(r.status_map));
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("partial coverage: only provided slots appear; omitted slot is absent (not LIVE)", async () => {
    const home = await freshHome();
    try {
      const { pubkeyPem, node0, urp } = await buildAllProofs(home);
      const r = collectBlock0PrerequisiteStatus({
        proofs: {
          node0_identity_proof_hash: node0,
          urp_resource_status_proof_hash: urp,
        },
        operatorPubkeyPem: pubkeyPem,
      });
      assert.equal(r.collected, true, r.error);
      assert.equal(r.producer_live_count, 2);
      assert.equal(r.provided_slot_count, 2);
      assert.equal(
        Object.prototype.hasOwnProperty.call(
          r.status_map,
          "dema_realm_state_proof_hash",
        ),
        false,
      );
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: a tampered proof → that slot NAMED_ONLY with reason, not counted LIVE", async () => {
    const home = await freshHome();
    try {
      const { pubkeyPem, node0, urp, realm } = await buildAllProofs(home);
      const tamperedUrp = {
        ...urp,
        realm_state: undefined,
        resource_status: { ...urp.resource_status, cpu_count: 999 },
      };
      const r = collectBlock0PrerequisiteStatus({
        proofs: {
          node0_identity_proof_hash: node0,
          urp_resource_status_proof_hash: tamperedUrp,
          dema_realm_state_proof_hash: realm,
        },
        operatorPubkeyPem: pubkeyPem,
      });
      assert.equal(r.collected, true, r.error);
      assert.equal(r.status_map.urp_resource_status_proof_hash, "NAMED_ONLY");
      assert.equal(
        r.slot_verification.urp_resource_status_proof_hash.verified,
        false,
      );
      assert.equal(r.producer_live_count, 2);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: wrong external pubkey → all provided slots NAMED_ONLY, 0 LIVE", async () => {
    const home = await freshHome();
    const other = await freshHome();
    try {
      const { node0, urp, realm } = await buildAllProofs(home);
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: other,
      });
      const foreignPubkey = await loadPublicKey(other);
      const r = collectBlock0PrerequisiteStatus({
        proofs: {
          node0_identity_proof_hash: node0,
          urp_resource_status_proof_hash: urp,
          dema_realm_state_proof_hash: realm,
        },
        operatorPubkeyPem: foreignPubkey,
      });
      assert.equal(r.collected, true, r.error);
      assert.equal(r.producer_live_count, 0);
      assert.equal(r.status_map.node0_identity_proof_hash, "NAMED_ONLY");
      assert.equal(
        r.slot_verification.node0_identity_proof_hash.reason,
        "operator_key_mismatch",
      );
    } finally {
      await rm(home, { recursive: true, force: true });
      await rm(other, { recursive: true, force: true });
    }
  });

  it("cross-slot guard: a node0 proof placed under the urp slot key → NAMED_ONLY (schema mismatch)", async () => {
    const home = await freshHome();
    try {
      const { pubkeyPem, node0 } = await buildAllProofs(home);
      const r = collectBlock0PrerequisiteStatus({
        proofs: { urp_resource_status_proof_hash: node0 },
        operatorPubkeyPem: pubkeyPem,
      });
      assert.equal(r.collected, true, r.error);
      assert.equal(r.status_map.urp_resource_status_proof_hash, "NAMED_ONLY");
      assert.equal(
        r.slot_verification.urp_resource_status_proof_hash.reason,
        "proof_schema_mismatch",
      );
      assert.equal(r.producer_live_count, 0);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed inputs: bad proofs / unknown slot / bad pubkey", async () => {
    const home = await freshHome();
    try {
      const { pubkeyPem, node0 } = await buildAllProofs(home);
      assert.equal(
        collectBlock0PrerequisiteStatus({
          proofs: null,
          operatorPubkeyPem: pubkeyPem,
        }).error,
        "proofs_required",
      );
      assert.equal(
        collectBlock0PrerequisiteStatus({
          proofs: { not_a_block0_slot: node0 },
          operatorPubkeyPem: pubkeyPem,
        }).error,
        "unexpected_proof_slot",
      );
      assert.equal(
        collectBlock0PrerequisiteStatus({
          proofs: { node0_identity_proof_hash: node0 },
          operatorPubkeyPem: "not-a-pem",
        }).error,
        "external_pubkey_required",
      );
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("collection carries no private-key material; never asserts unverified LIVE", async () => {
    const home = await freshHome();
    try {
      const { pubkeyPem, node0, urp, realm } = await buildAllProofs(home);
      const r = collectBlock0PrerequisiteStatus({
        proofs: {
          node0_identity_proof_hash: node0,
          urp_resource_status_proof_hash: urp,
          dema_realm_state_proof_hash: realm,
        },
        operatorPubkeyPem: pubkeyPem,
      });
      const s = JSON.stringify(r);
      for (const f of ["PRIVATE KEY", '"private_key":', '"private_key_pem":']) {
        assert.equal(s.includes(f), false, f);
      }
      // structural invariant: every PRODUCER_LIVE has a verified:true backing.
      for (const [slot, status] of Object.entries(r.status_map)) {
        if (status === "PRODUCER_LIVE") {
          assert.equal(r.slot_verification[slot].verified, true, slot);
        }
      }
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});
