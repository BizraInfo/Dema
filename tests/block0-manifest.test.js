// BLOCK0-1A · Genesis Block0 manifest generator tests
//
// Covers all 9 DOD criteria from the BLOCK0_0_PREFLIGHT.md §9.
// Pure-with-key-load kernel: external pubkey only, no public network,
// no federation, no public market claim, no certification, no token mint.
//
// Schema reference: docs/security/BLOCK0_0_PREFLIGHT.md §3.

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildBlock0Manifest,
  BLOCK0_MANIFEST_SCHEMA,
  BLOCK0_ACTION_TYPE,
} from "../packages/genesis/src/block0-manifest.js";
import { buildConsentProof } from "../packages/receipts/src/consent-proof.js";
import {
  initAuthorshipKey,
  KEY_INIT_CONSENT_PHRASE,
} from "../packages/receipts/src/authorship-key-store.js";
import {
  sha256,
  stableStringify,
} from "../packages/consent/src/consent-common.js";

const FIXED_CREATED = "2026-05-30T08:00:00.000Z";
const FIXED_NONCE = "deadbeef".repeat(8);

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_C = "c".repeat(64);
const HASH_D = "d".repeat(64);
const HASH_E = "e".repeat(64);
const HASH_F = "f".repeat(64);
const HASH_0 = "0".repeat(64);
const HASH_1 = "1".repeat(64);
const HASH_2 = "2".repeat(64);
const HASH_3 = "3".repeat(64);
const HASH_4 = "4".repeat(64);
const HASH_5 = "5".repeat(64);
const HASH_6 = "6".repeat(64);
const HASH_7 = "7".repeat(64);
const HASH_8 = "8".repeat(64);
const HASH_9 = "9".repeat(64);

function makeValidPrerequisites(overrides = {}) {
  return {
    keyconsent_integration_complete: true,
    keyconsent_truth_labels: ["MEASURED:kernel", "WIRED:integration"],
    canonical_receipt_ledger_root_hash: HASH_A,
    node0_identity_proof_hash: HASH_B,
    dema_realm_state_proof_hash: HASH_C,
    pat_profile_proof_hashes: [
      HASH_0,
      HASH_1,
      HASH_2,
      HASH_3,
      HASH_4,
      HASH_5,
      HASH_6,
    ],
    sat_profile_proof_hashes: [HASH_7, HASH_8, HASH_9, HASH_D, HASH_E],
    urp_resource_status_proof_hash: HASH_F,
    genesis_local_token_ledger_root_hash: HASH_A,
    poi_rule_id: "consent_proof_replay_verification.v0.1",
    poi_rule_version: "0.1.0",
    full_flywheel_run_receipt_hash: HASH_B,
    performance_baseline_proof_hash: HASH_C,
    house_of_wisdom_first_lesson_proof_hash: HASH_D,
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

async function freshHome() {
  return await mkdtemp(join(tmpdir(), "dema-block0-test-"));
}

async function buildSealBlock0ConsentProof(home, prerequisites) {
  // Bind consent to the manifest body via SEAL_BLOCK0 action type.
  // target_hash binds the consent to the prerequisites+claim_boundary set.
  const bodyForTarget = stableStringify({
    prerequisites,
    claim_boundary: VALID_CLAIM_BOUNDARY,
    created_at_iso: FIXED_CREATED,
  });
  const targetHash = sha256(bodyForTarget);
  const cp = await buildConsentProof({
    phrase: "SIGN AUTHORSHIP RECEIPT",
    actionScope: {
      action_type: BLOCK0_ACTION_TYPE,
      target_hash: targetHash,
    },
    demaHome: home,
    nonce: FIXED_NONCE,
    createdAtIso: "2026-05-30T07:59:00.000Z",
    expiresAtIso: "2026-05-30T08:04:00.000Z",
  });
  assert.equal(cp.built, true, "test setup: consent proof must build");
  return cp.consent_proof;
}

describe("BLOCK0-1A · buildBlock0Manifest", () => {
  it("DOD-1 happy: 12 prereqs + claim_boundary all-false → built:true frozen envelope", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const prerequisites = makeValidPrerequisites();
      const consentProof = await buildSealBlock0ConsentProof(
        home,
        prerequisites,
      );
      const r = await buildBlock0Manifest({
        prerequisites,
        consentProof,
        demaHome: home,
        createdAtIso: FIXED_CREATED,
      });
      assert.equal(r.built, true, `expected built:true, got ${r.error}`);
      assert.equal(r.manifest.schema, BLOCK0_MANIFEST_SCHEMA);
      assert.equal(r.manifest.prev_hash, null);
      assert.equal(r.manifest.created_at_iso, FIXED_CREATED);
      assert.ok(Object.isFrozen(r), "result must be frozen");
      assert.ok(Object.isFrozen(r.manifest), "manifest must be frozen");
      assert.ok(
        Object.isFrozen(r.manifest.claim_boundary),
        "claim_boundary must be frozen",
      );
      // All boundary fields preserved verbatim.
      for (const k of Object.keys(VALID_CLAIM_BOUNDARY)) {
        assert.equal(r.manifest.claim_boundary[k], false);
      }
      // block0_id, block0_proof_hash, block0_signature_b64 derived.
      assert.ok(/^[a-f0-9]{64}$/.test(r.manifest.block0_id));
      assert.ok(/^[a-f0-9]{64}$/.test(r.manifest.block0_proof_hash));
      assert.ok(/^[a-f0-9]{64}$/.test(r.manifest.genesis_node_id));
      assert.ok(/^[a-f0-9]{64}$/.test(r.manifest.genesis_human_id));
      assert.ok(
        /^[a-f0-9]{64}$/.test(r.manifest.operator_public_key_fingerprint),
      );
      assert.ok(
        typeof r.manifest.block0_signature_b64 === "string" &&
          r.manifest.block0_signature_b64.length > 0,
      );
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-2 missing canonical_receipt_ledger_root_hash → prerequisite_canonical_receipt_ledger_root_hash_missing", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const full = makeValidPrerequisites();
      // Build consent against the full set first; then strip the field
      // so the missing-prereq failure is the FIRST gate hit (not the
      // consent-scope gate). Consent scope binds to the full body so
      // tampering with prereqs alone would surface boundary failure
      // first only if we re-derived scope; here we exercise the
      // pre-consent structural check.
      const consentProof = await buildSealBlock0ConsentProof(home, full);
      const broken = { ...full };
      delete broken.canonical_receipt_ledger_root_hash;
      const r = await buildBlock0Manifest({
        prerequisites: broken,
        consentProof,
        demaHome: home,
        createdAtIso: FIXED_CREATED,
      });
      assert.equal(r.built, false);
      assert.equal(
        r.error,
        "prerequisite_canonical_receipt_ledger_root_hash_missing",
      );
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-3 pat_profile_proof_hashes length === 6 → pat_profile_count_invalid", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const prerequisites = makeValidPrerequisites({
        pat_profile_proof_hashes: [
          HASH_0,
          HASH_1,
          HASH_2,
          HASH_3,
          HASH_4,
          HASH_5,
        ], // 6, not 7
      });
      const consentProof = await buildSealBlock0ConsentProof(
        home,
        prerequisites,
      );
      const r = await buildBlock0Manifest({
        prerequisites,
        consentProof,
        demaHome: home,
        createdAtIso: FIXED_CREATED,
      });
      assert.equal(r.built, false);
      assert.equal(r.error, "pat_profile_count_invalid");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-4 sat_profile_proof_hashes length === 4 → sat_profile_count_invalid", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const prerequisites = makeValidPrerequisites({
        sat_profile_proof_hashes: [HASH_7, HASH_8, HASH_9, HASH_D], // 4, not 5
      });
      const consentProof = await buildSealBlock0ConsentProof(
        home,
        prerequisites,
      );
      const r = await buildBlock0Manifest({
        prerequisites,
        consentProof,
        demaHome: home,
        createdAtIso: FIXED_CREATED,
      });
      assert.equal(r.built, false);
      assert.equal(r.error, "sat_profile_count_invalid");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-5 node0_identity_proof_hash not sha256 hex → prerequisite_node0_identity_proof_hash_hash_invalid", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const prerequisites = makeValidPrerequisites({
        node0_identity_proof_hash: "INVALID",
      });
      const consentProof = await buildSealBlock0ConsentProof(
        home,
        prerequisites,
      );
      const r = await buildBlock0Manifest({
        prerequisites,
        consentProof,
        demaHome: home,
        createdAtIso: FIXED_CREATED,
      });
      assert.equal(r.built, false);
      assert.equal(
        r.error,
        "prerequisite_node0_identity_proof_hash_hash_invalid",
      );
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-6 keyconsent_integration_complete === false → keyconsent_integration_required", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const prerequisites = makeValidPrerequisites({
        keyconsent_integration_complete: false,
      });
      const consentProof = await buildSealBlock0ConsentProof(
        home,
        prerequisites,
      );
      const r = await buildBlock0Manifest({
        prerequisites,
        consentProof,
        demaHome: home,
        createdAtIso: FIXED_CREATED,
      });
      assert.equal(r.built, false);
      assert.equal(r.error, "keyconsent_integration_required");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-7 consent_proof action_type ≠ SEAL_BLOCK0 → consent_scope_mismatch", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const prerequisites = makeValidPrerequisites();
      // Build a consent proof against a DIFFERENT action type.
      const cp = await buildConsentProof({
        phrase: "SIGN AUTHORSHIP RECEIPT",
        actionScope: {
          action_type: "MINT_VERDICT_RECEIPT",
          target_hash: HASH_A,
        },
        demaHome: home,
        nonce: FIXED_NONCE,
        createdAtIso: "2026-05-30T07:59:00.000Z",
        expiresAtIso: "2026-05-30T08:04:00.000Z",
      });
      assert.equal(cp.built, true);
      const r = await buildBlock0Manifest({
        prerequisites,
        consentProof: cp.consent_proof,
        demaHome: home,
        createdAtIso: FIXED_CREATED,
      });
      assert.equal(r.built, false);
      assert.equal(r.error, "consent_scope_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-8 claim_boundary public_network_launched === true → claim_boundary_violation", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const prerequisites = makeValidPrerequisites();
      const consentProof = await buildSealBlock0ConsentProof(
        home,
        prerequisites,
      );
      // Pass a claim_boundary that violates the mandatory-false rule.
      const r = await buildBlock0Manifest({
        prerequisites,
        consentProof,
        demaHome: home,
        createdAtIso: FIXED_CREATED,
        claimBoundary: {
          ...VALID_CLAIM_BOUNDARY,
          public_network_launched: true,
        },
      });
      assert.equal(r.built, false);
      assert.equal(r.error, "claim_boundary_violation");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-9 no PRIVATE KEY material in envelope", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const prerequisites = makeValidPrerequisites();
      const consentProof = await buildSealBlock0ConsentProof(
        home,
        prerequisites,
      );
      const r = await buildBlock0Manifest({
        prerequisites,
        consentProof,
        demaHome: home,
        createdAtIso: FIXED_CREATED,
      });
      assert.equal(r.built, true);
      const envStr = JSON.stringify(r);
      assert.ok(
        !envStr.includes("BEGIN PRIVATE KEY"),
        "envelope must not contain BEGIN PRIVATE KEY marker",
      );
      assert.ok(
        !envStr.includes("PRIVATE KEY"),
        "envelope must not contain any PRIVATE KEY marker",
      );
      assert.equal(r.manifest.private_key, undefined);
      assert.equal(r.manifest.private_key_pem, undefined);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});
