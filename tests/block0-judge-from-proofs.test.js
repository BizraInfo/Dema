// COLLECTOR-1B · judge Block0 sealability from real producer proofs
//
// The end-to-end honest chain: proofs -> collect (verify) -> per-slot manifest
// hash-bind -> verifyBlock0Manifest. Composes COLLECTOR-1A's derived 3-slot
// status with the BLOCK0-1B judge. NEVER asserts the other 9 slots — they are
// absent from the judged map, so the result is ALWAYS sealable:false today
// (capable != wired != sealable). The hash-bind closes the trust gap: a slot is
// only PRODUCER_LIVE in the judged map if its verified proof's own proof_hash
// equals the hash the manifest committed for that slot.

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  judgeBlock0FromProofs,
  BLOCK0_JUDGED_FROM_PROOFS_SCHEMA,
} from "../packages/genesis/src/block0-judge-from-proofs.js";
import {
  buildBlock0Manifest,
  BLOCK0_ACTION_TYPE,
} from "../packages/genesis/src/block0-manifest.js";
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
import {
  sha256,
  stableStringify,
} from "../packages/consent/src/consent-common.js";

const CREATED = "2026-06-01T13:00:00.000Z";
const H = (s) => sha256(`block0-1b-fixture:${s}`);
const RESOURCE_STATUS = Object.freeze({
  cpu_count: 8,
  share_status: "local-only",
});
const REALM_STATE = Object.freeze({
  identity_status: "VERIFIED",
  checkpoint_present: true,
});

const VALID_CLAIM_BOUNDARY = Object.freeze({
  public_network_launched: false,
  public_market_value_claimed: false,
  legal_certification_claimed: false,
  shariah_certification_claimed: false,
  node1_enabled: false,
  federation_used: false,
  token_minted_to_humans: false,
});

async function freshHome() {
  return mkdtemp(join(tmpdir(), "dema-block0-1b-"));
}

async function mkConsent(home, phrase, action_type, target_hash, nonceSeed) {
  const cp = await buildConsentProof({
    phrase,
    actionScope: { action_type, target_hash },
    demaHome: home,
    nonce: nonceSeed.repeat(8),
    createdAtIso: "2026-06-01T12:59:00.000Z",
    expiresAtIso: "2026-06-01T13:04:00.000Z",
  });
  assert.equal(cp.built, true, "test setup: consent must build");
  return cp.consent_proof;
}

function validPrerequisites(overrides = {}) {
  return {
    keyconsent_integration_complete: true,
    keyconsent_truth_labels: ["MEASURED:kernel", "WIRED:integration"],
    canonical_receipt_ledger_root_hash: H("canonical"),
    node0_identity_proof_hash: H("node0id"),
    dema_realm_state_proof_hash: H("realm"),
    pat_profile_proof_hashes: [0, 1, 2, 3, 4, 5, 6].map((i) => H(`pat${i}`)),
    sat_profile_proof_hashes: [0, 1, 2, 3, 4].map((i) => H(`sat${i}`)),
    urp_resource_status_proof_hash: H("urp"),
    genesis_local_token_ledger_root_hash: H("econ"),
    poi_rule_id: "consent_proof_replay_verification.v0.1",
    poi_rule_version: "0.1.0",
    full_flywheel_run_receipt_hash: H("flywheel"),
    performance_baseline_proof_hash: H("perf"),
    house_of_wisdom_first_lesson_proof_hash: H("how"),
    ...overrides,
  };
}

// Build the 3 real proofs + a Block0 manifest in one home. By default the
// manifest commits the proofs' real proof_hashes for the 3 collectable slots.
async function buildWorld(home, { bindProofs = true } = {}) {
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
      "n0idn001",
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
      "urpst001",
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

  const prerequisites = validPrerequisites(
    bindProofs
      ? {
          node0_identity_proof_hash: node0.proof.node0_identity_proof_hash,
          urp_resource_status_proof_hash:
            urp.proof.urp_resource_status_proof_hash,
          dema_realm_state_proof_hash: realm.proof.dema_realm_state_proof_hash,
        }
      : {},
  );

  const targetHash = sha256(
    stableStringify({
      prerequisites,
      claim_boundary: VALID_CLAIM_BOUNDARY,
      created_at_iso: CREATED,
    }),
  );
  const sealConsent = await mkConsent(
    home,
    "SEAL BLOCK0",
    BLOCK0_ACTION_TYPE,
    targetHash,
    "sealb001",
  );
  const m = await buildBlock0Manifest({
    prerequisites,
    claimBoundary: VALID_CLAIM_BOUNDARY,
    consentProof: sealConsent,
    demaHome: home,
    createdAtIso: CREATED,
  });
  assert.equal(m.built, true, `test setup: manifest must build: ${m.error}`);

  return {
    pubkeyPem,
    manifest: m.manifest,
    proofs: {
      node0_identity_proof_hash: node0.proof,
      urp_resource_status_proof_hash: urp.proof,
      dema_realm_state_proof_hash: realm.proof,
    },
  };
}

describe("COLLECTOR-1B · judgeBlock0FromProofs", () => {
  it("happy: 3 verified+bound proofs → verified:true, sealable:false (only 3/12), zero asserted", async () => {
    const home = await freshHome();
    try {
      const { pubkeyPem, manifest, proofs } = await buildWorld(home);
      const r = judgeBlock0FromProofs({
        manifest,
        operatorPubkeyPem: pubkeyPem,
        proofs,
      });
      assert.equal(r.schema, BLOCK0_JUDGED_FROM_PROOFS_SCHEMA);
      assert.equal(r.judged, true, r.error);
      assert.equal(r.verification.verified, true, r.verification.reason);
      assert.equal(r.sealable, false); // only 3/12 → never sealable today
      assert.equal(r.bound_live_count, 3);
      assert.equal(r.slot_binding.node0_identity_proof_hash.bound, true);
      assert.equal(
        r.judged_status_map.urp_resource_status_proof_hash,
        "PRODUCER_LIVE",
      );
      // honesty invariant: the judged map contains ONLY the 3 collectable slots
      assert.equal(Object.keys(r.judged_status_map).length, 3);
      assert.equal(r.boundary.asserted_slot_marked_live, false);
      assert.ok(Object.isFrozen(r));
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("hash-bind: a manifest that did NOT commit the proofs → slots NAMED_ONLY (manifest_hash_mismatch)", async () => {
    const home = await freshHome();
    try {
      const { pubkeyPem, manifest, proofs } = await buildWorld(home, {
        bindProofs: false,
      });
      const r = judgeBlock0FromProofs({
        manifest,
        operatorPubkeyPem: pubkeyPem,
        proofs,
      });
      assert.equal(r.judged, true, r.error);
      assert.equal(r.bound_live_count, 0);
      assert.equal(r.slot_binding.node0_identity_proof_hash.bound, false);
      assert.equal(
        r.slot_binding.node0_identity_proof_hash.reason,
        "manifest_hash_mismatch",
      );
      assert.equal(r.judged_status_map.node0_identity_proof_hash, "NAMED_ONLY");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("tampered proof → collector NAMED_ONLY flows through to not-bound, not-live", async () => {
    const home = await freshHome();
    try {
      const { pubkeyPem, manifest, proofs } = await buildWorld(home);
      const tampered = {
        ...proofs,
        urp_resource_status_proof_hash: {
          ...proofs.urp_resource_status_proof_hash,
          resource_status: {
            ...proofs.urp_resource_status_proof_hash.resource_status,
            cpu_count: 999,
          },
        },
      };
      const r = judgeBlock0FromProofs({
        manifest,
        operatorPubkeyPem: pubkeyPem,
        proofs: tampered,
      });
      assert.equal(
        r.judged_status_map.urp_resource_status_proof_hash,
        "NAMED_ONLY",
      );
      assert.equal(r.bound_live_count, 2);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("never sealable from 3 alone: even all-live+bound → sealable:false (9 slots absent)", async () => {
    const home = await freshHome();
    try {
      const { pubkeyPem, manifest, proofs } = await buildWorld(home);
      const r = judgeBlock0FromProofs({
        manifest,
        operatorPubkeyPem: pubkeyPem,
        proofs,
      });
      assert.equal(r.sealable, false);
      assert.equal(r.verification.producer_live_count, 3);
      assert.equal(r.verification.named_only_count, 9);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: bad proofs / bad pubkey propagate from the collect stage", async () => {
    const home = await freshHome();
    try {
      const { pubkeyPem, manifest } = await buildWorld(home);
      assert.equal(
        judgeBlock0FromProofs({
          manifest,
          operatorPubkeyPem: pubkeyPem,
          proofs: null,
        }).error,
        "proofs_required",
      );
      assert.equal(
        judgeBlock0FromProofs({
          manifest,
          operatorPubkeyPem: "nope",
          proofs: {},
        }).error,
        "external_pubkey_required",
      );
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("carries no private-key material; no asserted slot ever marked live", async () => {
    const home = await freshHome();
    try {
      const { pubkeyPem, manifest, proofs } = await buildWorld(home);
      const r = judgeBlock0FromProofs({
        manifest,
        operatorPubkeyPem: pubkeyPem,
        proofs,
      });
      const s = JSON.stringify(r);
      for (const f of ["PRIVATE KEY", '"private_key":', '"private_key_pem":']) {
        assert.equal(s.includes(f), false, f);
      }
      for (const slot of Object.keys(r.judged_status_map)) {
        // every slot in the judged map is one of the 3 collectable slots
        assert.ok(
          [
            "node0_identity_proof_hash",
            "urp_resource_status_proof_hash",
            "dema_realm_state_proof_hash",
          ].includes(slot),
          `non-collectable slot leaked into judged map: ${slot}`,
        );
      }
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});
