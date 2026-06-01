// FLYWHEEL-FULL-RUN (core, transparent) · Block0 full_flywheel_run_receipt_hash
//
// Founder ruling: "full run" = the implemented core loop, transparent coverage.
// buildCoreFlywheelRunReceipt composes a REAL runOneTaskFlywheel receipt (the
// action+score spine) into a signed run receipt whose self-hash field IS
// full_flywheel_run_receipt_hash → wired via the existing scalar_hash kind. The
// body transparently lists phases_excluded (mission_select PREVIEW,
// next_mission NOT_IMPLEMENTED). No fabricated phases.

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectBlock0PrerequisiteStatus } from "../packages/genesis/src/block0-prerequisite-status-collector.js";
import { judgeBlock0FromProofs } from "../packages/genesis/src/block0-judge-from-proofs.js";
import { buildCoreFlywheelRunReceipt } from "../packages/genesis/src/core-flywheel-run-proof.js";
import { runOneTaskFlywheel } from "../packages/flywheel/src/flywheel-one-task.js";
import { GUARDED_CLAIM_CONSENT_PHRASE } from "../packages/receipts/src/assumption-guarded-claim.js";
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

const CREATED = "2026-06-02T08:00:00.000Z";
const H = (s) => sha256(`flywheel-run-fixture:${s}`);
const SLOT = "full_flywheel_run_receipt_hash";
const A_ENVELOPE = Object.freeze({
  claim_state: "A",
  assumption: "Task X is complete.",
  ground: "tests/x.test.js passed 9/9.",
  boundary: "Invalid if x.test.js regresses.",
  rejectable: true,
});

async function freshHome() {
  return mkdtemp(join(tmpdir(), "dema-flywheel-run-"));
}

// Build a REAL one-task run + compose it into a core run receipt.
async function buildRealCoreRun(home, createdAtIso = CREATED) {
  await initAuthorshipKey({ consent: KEY_INIT_CONSENT_PHRASE, demaHome: home });
  const pubkeyPem = await loadPublicKey(home);
  const oneTask = await runOneTaskFlywheel({
    task: "ship the core loop",
    envelope: A_ENVELOPE,
    consent: GUARDED_CLAIM_CONSENT_PHRASE,
    demaHome: home,
    now: createdAtIso,
  });
  assert.equal(oneTask.completed, true, oneTask.error || oneTask.stage);
  const run = await buildCoreFlywheelRunReceipt({
    phases: { action_score: oneTask.flywheel_receipt },
    demaHome: home,
    createdAtIso,
  });
  assert.equal(run.built, true, run.error);
  return { pubkeyPem, oneTask, run };
}

describe("FLYWHEEL-FULL-RUN · core flywheel run adapter (full_flywheel_run_receipt_hash)", () => {
  it("happy: a real core run → PRODUCER_LIVE; transparent excluded phases", async () => {
    const home = await freshHome();
    try {
      const { pubkeyPem, run } = await buildRealCoreRun(home);
      // transparency: excluded phases recorded honestly
      const excludedPhases = run.proof.phases_excluded.map((e) => e.phase);
      assert.ok(excludedPhases.includes("mission_select"));
      assert.ok(excludedPhases.includes("next_mission"));
      assert.ok(run.proof.phases_covered.includes("action_score"));

      const r = collectBlock0PrerequisiteStatus({
        proofs: { [SLOT]: run.proof },
        operatorPubkeyPem: pubkeyPem,
      });
      assert.equal(r.collected, true, r.error);
      assert.equal(r.status_map[SLOT], "PRODUCER_LIVE");
      assert.equal(r.producer_live_count, 1);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: tampered run receipt → NAMED_ONLY", async () => {
    const home = await freshHome();
    try {
      const { pubkeyPem, run } = await buildRealCoreRun(home);
      const tampered = {
        ...run.proof,
        phases_covered: [...run.proof.phases_covered, "fabricated"],
      };
      const r = collectBlock0PrerequisiteStatus({
        proofs: { [SLOT]: tampered },
        operatorPubkeyPem: pubkeyPem,
      });
      assert.equal(r.status_map[SLOT], "NAMED_ONLY");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: wrong external pubkey → NAMED_ONLY", async () => {
    const home = await freshHome();
    const other = await freshHome();
    try {
      const { run } = await buildRealCoreRun(home);
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: other,
      });
      const foreign = await loadPublicKey(other);
      const r = collectBlock0PrerequisiteStatus({
        proofs: { [SLOT]: run.proof },
        operatorPubkeyPem: foreign,
      });
      assert.equal(r.status_map[SLOT], "NAMED_ONLY");
    } finally {
      await rm(home, { recursive: true, force: true });
      await rm(other, { recursive: true, force: true });
    }
  });

  it("judge: manifest committing the run hash → bound; wrong hash → NAMED_ONLY", async () => {
    const home = await freshHome();
    try {
      const { pubkeyPem, run } = await buildRealCoreRun(home);
      const claim_boundary = {
        public_network_launched: false,
        public_market_value_claimed: false,
        legal_certification_claimed: false,
        shariah_certification_claimed: false,
        node1_enabled: false,
        federation_used: false,
        token_minted_to_humans: false,
      };
      const buildManifest = async (runHash, seed) => {
        const prerequisites = {
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
          poi_rule_id: "consent_proof_replay_verification.v0.1",
          poi_rule_version: "0.1.0",
          full_flywheel_run_receipt_hash: runHash,
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
          createdAtIso: "2026-06-02T07:59:00.000Z",
          expiresAtIso: "2026-06-02T08:04:00.000Z",
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
        run.full_flywheel_run_receipt_hash,
        "fwgood00",
      );
      const rGood = judgeBlock0FromProofs({
        manifest: good,
        operatorPubkeyPem: pubkeyPem,
        proofs: { [SLOT]: run.proof },
      });
      assert.equal(rGood.slot_binding[SLOT].bound, true);
      assert.equal(rGood.judged_status_map[SLOT], "PRODUCER_LIVE");
      assert.equal(rGood.sealable, false);

      const bad = await buildManifest(H("wrong-run"), "fwbad000");
      const rBad = judgeBlock0FromProofs({
        manifest: bad,
        operatorPubkeyPem: pubkeyPem,
        proofs: { [SLOT]: run.proof },
      });
      assert.equal(rBad.judged_status_map[SLOT], "NAMED_ONLY");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});
