// POI-RULE-ADAPT · Block0 poi_rule slot adapter (kind:"rule_id")
//
// poi_rule is NOT a hash slot. The manifest commits poi_rule_id + poi_rule_version
// (two strings). Honest verification = the supplied (id, version) resolves to a
// RECOGNIZED canonical rule whose evaluate() is executable — a registry check
// sourced from the REAL rule module, not a rubber-stamp on the boolean. The judge
// binds the COMPOSITE fields manifest.poi_rule_id/version === proof's.
//
// PROOF BOUNDARY: proves the node's declared PoI rule identity is a canonical,
// loadable, deterministic-by-construction rule. Does NOT prove any impact score,
// reward, or public economy — local proof-economy only.

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectBlock0PrerequisiteStatus } from "../packages/genesis/src/block0-prerequisite-status-collector.js";
import { judgeBlock0FromProofs } from "../packages/genesis/src/block0-judge-from-proofs.js";
import { RULE_ID as POI_RULE_ID } from "../packages/rules/src/rule-consent-replay-verification.v0.1.js";
import {
  buildBlock0Manifest,
  BLOCK0_ACTION_TYPE,
} from "../packages/genesis/src/block0-manifest.js";
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

const CREATED = "2026-06-01T18:00:00.000Z";
const H = (s) => sha256(`poi-rule-fixture:${s}`);
const SLOT = "poi_rule";
const POI_RULE_VERSION = "0.1.0";
const VALID_POI = Object.freeze({
  poi_rule_id: POI_RULE_ID,
  poi_rule_version: POI_RULE_VERSION,
});

async function freshHome() {
  return mkdtemp(join(tmpdir(), "dema-poi-rule-"));
}

async function keyHome() {
  const home = await freshHome();
  await initAuthorshipKey({ consent: KEY_INIT_CONSENT_PHRASE, demaHome: home });
  return { home, pubkeyPem: await loadPublicKey(home) };
}

describe("POI-RULE-ADAPT · poi_rule rule_id adapter", () => {
  it("happy: a recognized canonical poi rule → PRODUCER_LIVE", async () => {
    const { home, pubkeyPem } = await keyHome();
    try {
      const r = collectBlock0PrerequisiteStatus({
        proofs: { [SLOT]: VALID_POI },
        operatorPubkeyPem: pubkeyPem,
      });
      assert.equal(r.collected, true, r.error);
      assert.equal(r.status_map[SLOT], "PRODUCER_LIVE");
      assert.equal(r.producer_live_count, 1);
      assert.equal(r.slot_verification[SLOT].rule_id, POI_RULE_ID);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: unrecognized rule id → NAMED_ONLY", async () => {
    const { home, pubkeyPem } = await keyHome();
    try {
      const r = collectBlock0PrerequisiteStatus({
        proofs: {
          [SLOT]: { poi_rule_id: "made.up.rule", poi_rule_version: "0.1.0" },
        },
        operatorPubkeyPem: pubkeyPem,
      });
      assert.equal(r.status_map[SLOT], "NAMED_ONLY");
      assert.equal(r.slot_verification[SLOT].verified, false);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: recognized id but wrong version → NAMED_ONLY", async () => {
    const { home, pubkeyPem } = await keyHome();
    try {
      const r = collectBlock0PrerequisiteStatus({
        proofs: {
          [SLOT]: { poi_rule_id: POI_RULE_ID, poi_rule_version: "9.9.9" },
        },
        operatorPubkeyPem: pubkeyPem,
      });
      assert.equal(r.status_map[SLOT], "NAMED_ONLY");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: malformed proof (not an object) → NAMED_ONLY", async () => {
    const { home, pubkeyPem } = await keyHome();
    try {
      const r = collectBlock0PrerequisiteStatus({
        proofs: { [SLOT]: "not-an-object" },
        operatorPubkeyPem: pubkeyPem,
      });
      assert.equal(r.status_map[SLOT], "NAMED_ONLY");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("judge: manifest committing matching id+version → bound PRODUCER_LIVE; mismatch → NAMED_ONLY", async () => {
    const { home, pubkeyPem } = await keyHome();
    try {
      const prereqBase = {
        keyconsent_integration_complete: true,
        keyconsent_truth_labels: ["MEASURED:kernel"],
        canonical_receipt_ledger_root_hash: H("canon"),
        node0_identity_proof_hash: H("node0"),
        dema_realm_state_proof_hash: H("realm"),
        pat_profile_proof_hashes: [0, 1, 2, 3, 4, 5, 6].map((i) =>
          H(`pat${i}`),
        ),
        sat_profile_proof_hashes: [0, 1, 2, 3, 4].map((i) => H(`sat${i}`)),
        urp_resource_status_proof_hash: H("urp"),
        genesis_local_token_ledger_root_hash: H("econ"),
        poi_rule_id: POI_RULE_ID,
        poi_rule_version: POI_RULE_VERSION,
        full_flywheel_run_receipt_hash: H("flywheel"),
        performance_baseline_proof_hash: H("perf"),
        house_of_wisdom_first_lesson_proof_hash: H("how"),
      };
      const claim_boundary = {
        public_network_launched: false,
        public_market_value_claimed: false,
        legal_certification_claimed: false,
        shariah_certification_claimed: false,
        node1_enabled: false,
        federation_used: false,
        token_minted_to_humans: false,
      };
      const buildManifest = async (prerequisites, seed) => {
        const targetHash = sha256(
          stableStringify({
            prerequisites,
            claim_boundary,
            created_at_iso: CREATED,
          }),
        );
        const seal = await buildConsentProof({
          phrase: "SEAL BLOCK0",
          actionScope: {
            action_type: BLOCK0_ACTION_TYPE,
            target_hash: targetHash,
          },
          demaHome: home,
          nonce: seed.repeat(8),
          createdAtIso: "2026-06-01T17:59:00.000Z",
          expiresAtIso: "2026-06-01T18:04:00.000Z",
        });
        const m = await buildBlock0Manifest({
          prerequisites,
          claimBoundary: claim_boundary,
          consentProof: seal.consent_proof,
          demaHome: home,
          createdAtIso: CREATED,
        });
        assert.equal(m.built, true, `manifest must build: ${m.error}`);
        return m.manifest;
      };

      const good = await buildManifest(prereqBase, "poigood0");
      const rGood = judgeBlock0FromProofs({
        manifest: good,
        operatorPubkeyPem: pubkeyPem,
        proofs: { [SLOT]: VALID_POI },
      });
      assert.equal(rGood.slot_binding[SLOT].bound, true);
      assert.equal(rGood.judged_status_map[SLOT], "PRODUCER_LIVE");
      assert.equal(rGood.sealable, false); // still partial

      // manifest commits a DIFFERENT version than the (recognized) proof → unbound
      const bad = await buildManifest(
        { ...prereqBase, poi_rule_version: "0.1.0" },
        "poibad00",
      );
      const rBad = judgeBlock0FromProofs({
        manifest: bad,
        operatorPubkeyPem: pubkeyPem,
        proofs: {
          [SLOT]: { poi_rule_id: POI_RULE_ID, poi_rule_version: "0.1.0-other" },
        },
      });
      // proof version unrecognized → collector NAMED_ONLY → not bound
      assert.equal(rBad.judged_status_map[SLOT], "NAMED_ONLY");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});
