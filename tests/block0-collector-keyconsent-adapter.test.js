// KEYCONSENT-ADAPT · Block0 keyconsent_integration slot adapter (kind:"attestation")
//
// keyconsent_integration is NOT a hash slot — the manifest commits
// keyconsent_integration_complete (bool) + keyconsent_truth_labels (array). The
// proof is a FUNCTIONAL attestation (buildKeyconsentIntegrationProof exercises
// the real consent gate). The adapter verifies the signed attestation (complete
// + all checks true); the judge composite-binds the bool + the labels array.

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectBlock0PrerequisiteStatus } from "../packages/genesis/src/block0-prerequisite-status-collector.js";
import { judgeBlock0FromProofs } from "../packages/genesis/src/block0-judge-from-proofs.js";
import { buildKeyconsentIntegrationProof } from "../packages/genesis/src/keyconsent-integration-proof.js";
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

const CREATED = "2026-06-01T19:00:00.000Z";
const H = (s) => sha256(`keyconsent-fixture:${s}`);
const SLOT = "keyconsent_integration";

async function freshHome() {
  return mkdtemp(join(tmpdir(), "dema-keyconsent-"));
}
async function keyHome() {
  const home = await freshHome();
  await initAuthorshipKey({ consent: KEY_INIT_CONSENT_PHRASE, demaHome: home });
  return { home, pubkeyPem: await loadPublicKey(home) };
}

describe("KEYCONSENT-ADAPT · keyconsent_integration attestation adapter", () => {
  it("happy: a functional keyconsent attestation → PRODUCER_LIVE", async () => {
    const { home, pubkeyPem } = await keyHome();
    try {
      const k = await buildKeyconsentIntegrationProof({
        demaHome: home,
        createdAtIso: CREATED,
      });
      assert.equal(k.built, true, k.error);
      assert.equal(k.keyconsent_integration_complete, true);
      const r = collectBlock0PrerequisiteStatus({
        proofs: { [SLOT]: k.proof },
        operatorPubkeyPem: pubkeyPem,
      });
      assert.equal(r.collected, true, r.error);
      assert.equal(r.status_map[SLOT], "PRODUCER_LIVE");
      assert.equal(r.producer_live_count, 1);
      assert.deepEqual(
        r.slot_verification[SLOT].keyconsent_truth_labels,
        k.proof.keyconsent_truth_labels,
      );
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: tampered attestation (complete flipped) → NAMED_ONLY", async () => {
    const { home, pubkeyPem } = await keyHome();
    try {
      const k = await buildKeyconsentIntegrationProof({
        demaHome: home,
        createdAtIso: CREATED,
      });
      const tampered = { ...k.proof, keyconsent_integration_complete: false };
      const r = collectBlock0PrerequisiteStatus({
        proofs: { [SLOT]: tampered },
        operatorPubkeyPem: pubkeyPem,
      });
      assert.equal(r.status_map[SLOT], "NAMED_ONLY");
      assert.equal(r.slot_verification[SLOT].verified, false);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: wrong external pubkey → NAMED_ONLY", async () => {
    const { home } = await keyHome();
    const other = await freshHome();
    try {
      const k = await buildKeyconsentIntegrationProof({
        demaHome: home,
        createdAtIso: CREATED,
      });
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: other,
      });
      const foreign = await loadPublicKey(other);
      const r = collectBlock0PrerequisiteStatus({
        proofs: { [SLOT]: k.proof },
        operatorPubkeyPem: foreign,
      });
      assert.equal(r.status_map[SLOT], "NAMED_ONLY");
    } finally {
      await rm(home, { recursive: true, force: true });
      await rm(other, { recursive: true, force: true });
    }
  });

  it("judge: manifest committing matching complete+labels → bound; mismatched labels → NAMED_ONLY", async () => {
    const { home, pubkeyPem } = await keyHome();
    try {
      const k = await buildKeyconsentIntegrationProof({
        demaHome: home,
        createdAtIso: CREATED,
      });
      const claim_boundary = {
        public_network_launched: false,
        public_market_value_claimed: false,
        legal_certification_claimed: false,
        shariah_certification_claimed: false,
        node1_enabled: false,
        federation_used: false,
        token_minted_to_humans: false,
      };
      const buildManifest = async (kcLabels, seed) => {
        const prerequisites = {
          keyconsent_integration_complete: true,
          keyconsent_truth_labels: kcLabels,
          canonical_receipt_ledger_root_hash: H("canon"),
          node0_identity_proof_hash: H("node0"),
          dema_realm_state_proof_hash: H("realm"),
          pat_profile_proof_hashes: [0, 1, 2, 3, 4, 5, 6].map((i) =>
            H(`pat${i}`),
          ),
          sat_profile_proof_hashes: [0, 1, 2, 3, 4].map((i) => H(`sat${i}`)),
          urp_resource_status_proof_hash: H("urp"),
          genesis_local_token_ledger_root_hash: H("econ"),
          poi_rule_id: "consent_proof_replay_verification.v0.1",
          poi_rule_version: "0.1.0",
          full_flywheel_run_receipt_hash: H("flywheel"),
          performance_baseline_proof_hash: H("perf"),
          house_of_wisdom_first_lesson_proof_hash: H("how"),
        };
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
          createdAtIso: "2026-06-01T18:59:00.000Z",
          expiresAtIso: "2026-06-01T19:04:00.000Z",
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

      const good = await buildManifest(
        k.proof.keyconsent_truth_labels,
        "kcgood00",
      );
      const rGood = judgeBlock0FromProofs({
        manifest: good,
        operatorPubkeyPem: pubkeyPem,
        proofs: { [SLOT]: k.proof },
      });
      assert.equal(rGood.slot_binding[SLOT].bound, true);
      assert.equal(rGood.judged_status_map[SLOT], "PRODUCER_LIVE");
      assert.equal(rGood.sealable, false);

      const bad = await buildManifest(["WRONG:label"], "kcbad000");
      const rBad = judgeBlock0FromProofs({
        manifest: bad,
        operatorPubkeyPem: pubkeyPem,
        proofs: { [SLOT]: k.proof },
      });
      assert.equal(rBad.slot_binding[SLOT].bound, false);
      assert.equal(rBad.judged_status_map[SLOT], "NAMED_ONLY");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});
