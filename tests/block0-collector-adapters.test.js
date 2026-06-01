// COLLECTOR-2A · adapt additional Block0 proof slots into the collector
//
// Discovery (2026-06-01) found 6 PRODUCER_EXISTS_NOT_COLLECTED slots: their
// signed producers + external-pubkey verifiers already exist, but their verifier
// signatures are ({domainObj, pubkeyPem}) — not the collector contract
// ({proof, operatorPubkeyPem}) — and their proof_hash field name ≠ the slot name.
// COLLECTOR-2A adds a uniform SLOT_ADAPTERS interface so the collect → hash-bind
// → judge chain can consume them. First adapter-ready slots:
//   - performance_baseline_proof_hash  via verifyBaseline   (baseline_proof_hash)
//   - house_of_wisdom_first_lesson_proof_hash via verifyLesson (lesson_proof_hash)
// Token-ledger is EXCLUDED (root over a chain, not a single entry's hash).

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectBlock0PrerequisiteStatus } from "../packages/genesis/src/block0-prerequisite-status-collector.js";
import { judgeBlock0FromProofs } from "../packages/genesis/src/block0-judge-from-proofs.js";
import {
  buildBaseline,
  PERF_BASELINE_ACTION_TYPE,
} from "../packages/perf/src/perf-baseline.js";
import {
  buildLesson,
  APPROVE_LESSON_ACTION_TYPE,
} from "../packages/learn/src/how-lesson-writer.js";
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

const CREATED = "2026-06-01T15:00:00.000Z";
const C_CREATED = "2026-06-01T14:59:00.000Z";
const C_EXPIRES = "2026-06-01T15:04:00.000Z";
const H = (s) => sha256(`collector-2a-fixture:${s}`);

const METRICS = Object.freeze({
  dema_boot_latency_ms: 120.5,
  mission_selection_latency_ms: 14.2,
  consent_proof_build_latency_ms: 9.1,
  consent_proof_verify_latency_ms: 6.7,
  receipt_write_latency_ms: 3.4,
  verification_latency_ms: 22.8,
  test_check_runtime_ms: 54058,
  memory_rss_mb: 88.1,
  cpu_utilization_pct: 12.5,
  gpu_utilization_pct: 0,
  disk_usage_mb: 412.6,
  token_settlement_time_ms: 0,
  poi_scoring_time_ms: 0,
  regression_count: 0,
});
const CONTEXT = Object.freeze({
  host_fingerprint: "a".repeat(64),
  node_version: "v22.4.0",
  run_count: 5,
  env_hash: "b".repeat(64),
});
const LESSON_TEXT = "When in doubt, halt and request explicit consent.";

async function freshHome() {
  return mkdtemp(join(tmpdir(), "dema-collector-2a-"));
}

async function consent(home, phrase, action_type, target_hash, nonceSeed) {
  const cp = await buildConsentProof({
    phrase,
    actionScope: { action_type, target_hash },
    demaHome: home,
    nonce: nonceSeed.repeat(8),
    createdAtIso: C_CREATED,
    expiresAtIso: C_EXPIRES,
  });
  assert.equal(cp.built, true, "test setup: consent must build");
  return cp.consent_proof;
}

// Build a real signed perf-baseline proof + a real signed House-of-Wisdom
// lesson proof in one operator home.
async function buildAdapterProofs(home) {
  await initAuthorshipKey({ consent: KEY_INIT_CONSENT_PHRASE, demaHome: home });
  const pubkeyPem = await loadPublicKey(home);

  const baselineTarget = sha256(
    stableStringify({
      baseline_metrics: METRICS,
      measurement_context: CONTEXT,
    }),
  );
  const baselineRes = await buildBaseline({
    baseline_metrics: METRICS,
    measurement_context: CONTEXT,
    consentProof: await consent(
      home,
      "SIGN AUTHORSHIP RECEIPT",
      PERF_BASELINE_ACTION_TYPE,
      baselineTarget,
      "perfba01",
    ),
    demaHome: home,
    createdAtIso: CREATED,
  });
  assert.equal(baselineRes.built, true, baselineRes.error);

  const lessonHash = sha256(LESSON_TEXT);
  const approval = await consent(
    home,
    "APPROVE LESSON",
    APPROVE_LESSON_ACTION_TYPE,
    lessonHash,
    "lesson01",
  );
  const lessonRes = await buildLesson({
    experience_receipt_hash: "a".repeat(64),
    reflection_text: "I noticed the operator paused before approving.",
    sat_review_receipt_hash: "b".repeat(64),
    mumu_approval_consent_proof_hash: approval.consent_proof_hash,
    lesson_text: LESSON_TEXT,
    policy_or_skill_target: "policy.refusal.fetch_and_execute",
    mumuApprovalConsentProof: approval,
    demaHome: home,
    createdAtIso: CREATED,
  });
  assert.equal(lessonRes.built, true, lessonRes.error);

  return {
    pubkeyPem,
    baseline: baselineRes.baseline,
    lesson: lessonRes.lesson,
  };
}

const PERF_SLOT = "performance_baseline_proof_hash";
const LESSON_SLOT = "house_of_wisdom_first_lesson_proof_hash";

describe("COLLECTOR-2A · adapter slots (perf-baseline, house-of-wisdom lesson)", () => {
  it("collector marks both adapter-ready slots PRODUCER_LIVE from real signed proofs", async () => {
    const home = await freshHome();
    try {
      const { pubkeyPem, baseline, lesson } = await buildAdapterProofs(home);
      const r = collectBlock0PrerequisiteStatus({
        proofs: { [PERF_SLOT]: baseline, [LESSON_SLOT]: lesson },
        operatorPubkeyPem: pubkeyPem,
      });
      assert.equal(r.collected, true, r.error);
      assert.equal(r.status_map[PERF_SLOT], "PRODUCER_LIVE");
      assert.equal(r.status_map[LESSON_SLOT], "PRODUCER_LIVE");
      assert.equal(r.producer_live_count, 2);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: tampered baseline → NAMED_ONLY, not live", async () => {
    const home = await freshHome();
    try {
      const { pubkeyPem, baseline, lesson } = await buildAdapterProofs(home);
      const tampered = {
        ...baseline,
        baseline_metrics: {
          ...baseline.baseline_metrics,
          regression_count: 99,
        },
      };
      const r = collectBlock0PrerequisiteStatus({
        proofs: { [PERF_SLOT]: tampered, [LESSON_SLOT]: lesson },
        operatorPubkeyPem: pubkeyPem,
      });
      assert.equal(r.status_map[PERF_SLOT], "NAMED_ONLY");
      assert.equal(r.slot_verification[PERF_SLOT].verified, false);
      assert.equal(r.producer_live_count, 1);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: wrong external pubkey → both NAMED_ONLY", async () => {
    const home = await freshHome();
    const other = await freshHome();
    try {
      const { baseline, lesson } = await buildAdapterProofs(home);
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: other,
      });
      const foreign = await loadPublicKey(other);
      const r = collectBlock0PrerequisiteStatus({
        proofs: { [PERF_SLOT]: baseline, [LESSON_SLOT]: lesson },
        operatorPubkeyPem: foreign,
      });
      assert.equal(r.producer_live_count, 0);
      assert.equal(r.status_map[PERF_SLOT], "NAMED_ONLY");
    } finally {
      await rm(home, { recursive: true, force: true });
      await rm(other, { recursive: true, force: true });
    }
  });

  it("judge hash-bind: manifest committing baseline_proof_hash + lesson_proof_hash → both bound PRODUCER_LIVE", async () => {
    const home = await freshHome();
    try {
      const { pubkeyPem, baseline, lesson } = await buildAdapterProofs(home);
      const prerequisites = {
        keyconsent_integration_complete: true,
        keyconsent_truth_labels: ["MEASURED:kernel", "WIRED:integration"],
        canonical_receipt_ledger_root_hash: H("canonical"),
        node0_identity_proof_hash: H("node0id"),
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
        // the two adapter slots commit the proofs' OWN hash fields
        performance_baseline_proof_hash: baseline.baseline_proof_hash,
        house_of_wisdom_first_lesson_proof_hash: lesson.lesson_proof_hash,
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
      const targetHash = sha256(
        stableStringify({
          prerequisites,
          claim_boundary,
          created_at_iso: CREATED,
        }),
      );
      const seal = await consent(
        home,
        "SEAL BLOCK0",
        BLOCK0_ACTION_TYPE,
        targetHash,
        "sealb201",
      );
      const m = await buildBlock0Manifest({
        prerequisites,
        claimBoundary: claim_boundary,
        consentProof: seal,
        demaHome: home,
        createdAtIso: CREATED,
      });
      assert.equal(m.built, true, `manifest must build: ${m.error}`);

      const r = judgeBlock0FromProofs({
        manifest: m.manifest,
        operatorPubkeyPem: pubkeyPem,
        proofs: { [PERF_SLOT]: baseline, [LESSON_SLOT]: lesson },
      });
      assert.equal(r.judged, true, r.error);
      assert.equal(r.slot_binding[PERF_SLOT].bound, true);
      assert.equal(r.slot_binding[LESSON_SLOT].bound, true);
      assert.equal(r.judged_status_map[PERF_SLOT], "PRODUCER_LIVE");
      assert.equal(r.judged_status_map[LESSON_SLOT], "PRODUCER_LIVE");
      assert.equal(r.bound_live_count, 2);
      assert.equal(r.sealable, false); // still 2/12 — honest
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});
