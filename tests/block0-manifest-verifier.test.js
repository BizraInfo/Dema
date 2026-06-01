// BLOCK0-1B · pure Block0 manifest verifier
//
// The judge, not the generator. verifyBlock0Manifest re-derives the manifest's
// content address, verifies its signature under the EXTERNAL operator pubkey,
// validates all 12 prerequisite slots + claim boundary, and decides SEALABILITY
// from an EXPLICIT prerequisiteStatusMap — it never scans the repo and never
// recomputes producer outputs (that is a later collector slice). Truth before
// completion: a structurally-valid manifest over not-yet-sealed prerequisites
// returns verified:true, sealable:false.

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  verifyBlock0Manifest,
  BLOCK0_MANIFEST_VERIFICATION_SCHEMA,
  BLOCK0_PREREQUISITE_SLOTS,
} from "../packages/genesis/src/block0-manifest-verifier.js";
import {
  buildBlock0Manifest,
  BLOCK0_ACTION_TYPE,
} from "../packages/genesis/src/block0-manifest.js";
import { buildConsentProof } from "../packages/receipts/src/consent-proof.js";
import { generateEd25519Keypair } from "../packages/receipts/src/authorship-signature.js";
import {
  initAuthorshipKey,
  KEY_INIT_CONSENT_PHRASE,
} from "../packages/receipts/src/authorship-key-store.js";
import {
  sha256,
  stableStringify,
} from "../packages/consent/src/consent-common.js";

const CREATED = "2026-06-01T08:00:00.000Z";
const H = (s) => sha256(`block0-verifier-fixture:${s}`); // real sha256, not a sentinel

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

const VALID_CLAIM_BOUNDARY = Object.freeze({
  public_network_launched: false,
  public_market_value_claimed: false,
  legal_certification_claimed: false,
  shariah_certification_claimed: false,
  node1_enabled: false,
  federation_used: false,
  token_minted_to_humans: false,
});

const ALL_LIVE = Object.freeze(
  Object.fromEntries(
    BLOCK0_PREREQUISITE_SLOTS.map((s) => [s, "PRODUCER_LIVE"]),
  ),
);

// The status map matching the real disk discovery: 7 live, 2 partial, 3 named.
const DISCOVERED = Object.freeze({
  canonical_receipt_ledger_root_hash: "PRODUCER_LIVE",
  node0_identity_proof_hash: "NAMED_ONLY",
  dema_realm_state_proof_hash: "NAMED_ONLY",
  urp_resource_status_proof_hash: "NAMED_ONLY",
  genesis_local_token_ledger_root_hash: "PRODUCER_LIVE",
  full_flywheel_run_receipt_hash: "PARTIAL",
  performance_baseline_proof_hash: "PRODUCER_LIVE",
  house_of_wisdom_first_lesson_proof_hash: "PARTIAL",
  pat_profile_proof_hashes: "PRODUCER_LIVE",
  sat_profile_proof_hashes: "PRODUCER_LIVE",
  keyconsent_integration: "PRODUCER_LIVE",
  poi_rule: "PRODUCER_LIVE",
});

async function freshHome() {
  return mkdtemp(join(tmpdir(), "dema-block0-verify-"));
}

async function buildValidManifest(home, prerequisites = validPrerequisites()) {
  await initAuthorshipKey({ consent: KEY_INIT_CONSENT_PHRASE, demaHome: home });
  const targetHash = sha256(
    stableStringify({
      prerequisites,
      claim_boundary: VALID_CLAIM_BOUNDARY,
      created_at_iso: CREATED,
    }),
  );
  const cp = await buildConsentProof({
    phrase: "SEAL BLOCK0",
    actionScope: { action_type: BLOCK0_ACTION_TYPE, target_hash: targetHash },
    demaHome: home,
    nonce: "b0verif0".repeat(8),
    createdAtIso: "2026-06-01T07:59:00.000Z",
    expiresAtIso: "2026-06-01T08:04:00.000Z",
  });
  assert.equal(cp.built, true, "test setup: consent proof must build");
  const r = await buildBlock0Manifest({
    prerequisites,
    claimBoundary: VALID_CLAIM_BOUNDARY,
    consentProof: cp.consent_proof,
    demaHome: home,
    createdAtIso: CREATED,
  });
  assert.equal(r.built, true, `test setup: manifest must build: ${r.error}`);
  return { manifest: r.manifest, pubkeyPem: r.signer_public_key_pem };
}

describe("BLOCK0-1B · verifyBlock0Manifest", () => {
  it("TRUTH BEFORE COMPLETION: valid manifest + discovered status → verified:true, sealable:false (7/2/3)", async () => {
    const home = await freshHome();
    try {
      const { manifest, pubkeyPem } = await buildValidManifest(home);
      const r = verifyBlock0Manifest({
        manifest,
        operatorPubkeyPem: pubkeyPem,
        prerequisiteStatusMap: DISCOVERED,
      });
      assert.equal(r.schema, BLOCK0_MANIFEST_VERIFICATION_SCHEMA);
      assert.equal(r.verified, true);
      assert.equal(r.sealable, false);
      assert.equal(r.truth_label, "BLOCK0_NOT_SEALABLE");
      assert.equal(r.producer_live_count, 7);
      assert.equal(r.partial_count, 2);
      assert.equal(r.named_only_count, 3);
      assert.equal(r.blocking_reasons.length, 5);
      assert.equal(r.boundary.public_economic_claim_made, false);
      assert.ok(Object.isFrozen(r));
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("valid manifest + all-PRODUCER_LIVE status → verified:true, sealable:true", async () => {
    const home = await freshHome();
    try {
      const { manifest, pubkeyPem } = await buildValidManifest(home);
      const r = verifyBlock0Manifest({
        manifest,
        operatorPubkeyPem: pubkeyPem,
        prerequisiteStatusMap: ALL_LIVE,
      });
      assert.equal(r.verified, true);
      assert.equal(r.sealable, true);
      assert.equal(r.truth_label, "BLOCK0_SEALABLE");
      assert.equal(r.producer_live_count, 12);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("missing prerequisiteStatusMap → verified:true, sealable:false, prerequisite_status_missing", async () => {
    const home = await freshHome();
    try {
      const { manifest, pubkeyPem } = await buildValidManifest(home);
      const r = verifyBlock0Manifest({
        manifest,
        operatorPubkeyPem: pubkeyPem,
      });
      assert.equal(r.verified, true);
      assert.equal(r.sealable, false);
      assert.equal(r.reason, "prerequisite_status_missing");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: missing manifest / wrong schema", () => {
    assert.equal(verifyBlock0Manifest({}).reason, "manifest_required");
    assert.equal(
      verifyBlock0Manifest({
        manifest: { schema: "x" },
        operatorPubkeyPem: "k",
      }).reason,
      "schema_mismatch",
    );
  });

  it("fail-closed: missing slot / malformed hash / placeholder hash", async () => {
    const home = await freshHome();
    try {
      const { manifest, pubkeyPem } = await buildValidManifest(home);
      // missing slot
      const m1 = { ...manifest };
      delete m1.performance_baseline_proof_hash;
      assert.match(
        verifyBlock0Manifest({ manifest: m1, operatorPubkeyPem: pubkeyPem })
          .reason,
        /missing/,
      );
      // malformed hash
      const m2 = { ...manifest, node0_identity_proof_hash: "not-a-hash" };
      assert.match(
        verifyBlock0Manifest({ manifest: m2, operatorPubkeyPem: pubkeyPem })
          .reason,
        /hash/,
      );
      // placeholder (all-zero sentinel) — built via a valid manifest
      const ph = await buildValidManifest(
        home,
        validPrerequisites({ dema_realm_state_proof_hash: "0".repeat(64) }),
      );
      assert.equal(
        verifyBlock0Manifest({
          manifest: ph.manifest,
          operatorPubkeyPem: ph.pubkeyPem,
        }).reason,
        "placeholder_hash",
      );
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: bad proof hash / bad signature / wrong operator key / boundary violation", async () => {
    const home = await freshHome();
    try {
      const { manifest, pubkeyPem } = await buildValidManifest(home);
      assert.equal(
        verifyBlock0Manifest({
          manifest: { ...manifest, block0_proof_hash: "f".repeat(64) },
          operatorPubkeyPem: pubkeyPem,
        }).reason,
        "block0_proof_hash_mismatch",
      );
      assert.equal(
        verifyBlock0Manifest({
          manifest: { ...manifest, block0_signature_b64: "AAAA" },
          operatorPubkeyPem: pubkeyPem,
        }).reason,
        "block0_signature_invalid",
      );
      const foreign = generateEd25519Keypair();
      assert.equal(
        verifyBlock0Manifest({
          manifest,
          operatorPubkeyPem: foreign.public_key_pem,
        }).reason,
        "operator_key_mismatch",
      );
      assert.equal(
        verifyBlock0Manifest({
          manifest: {
            ...manifest,
            claim_boundary: {
              ...manifest.claim_boundary,
              federation_used: true,
            },
          },
          operatorPubkeyPem: pubkeyPem,
        }).reason,
        "claim_boundary_violation",
      );
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("both success and failure envelopes carry the boundary block", async () => {
    const home = await freshHome();
    try {
      const { manifest, pubkeyPem } = await buildValidManifest(home);
      const ok = verifyBlock0Manifest({
        manifest,
        operatorPubkeyPem: pubkeyPem,
        prerequisiteStatusMap: ALL_LIVE,
      });
      const bad = verifyBlock0Manifest({});
      for (const r of [ok, bad]) {
        assert.equal(r.boundary.local_only, true);
        assert.equal(r.boundary.network_used, false);
        assert.equal(r.boundary.federation_used, false);
        assert.equal(r.boundary.public_economic_claim_made, false);
      }
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});
