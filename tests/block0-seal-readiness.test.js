// BLOCK0-SEAL-READINESS · the capstone: all 12 prerequisite slots, built from
// REAL signed proofs, collected + judged → sealable:true.
//
// This proves Block0 is 12/12 SEALABLE (capable of being sealed) — NOT that it
// is sealed. The genesis seal itself is a separate, operator-only act. Every
// slot here is a real proof through its honest adapter (scalar_hash / hash_list /
// chain_root / rule_id / attestation), each within its declared boundary; two
// slots are honestly-scoped (poi = canonical rule identity; full_flywheel_run =
// CORE loop with transparent excluded phases).

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { judgeBlock0FromProofs } from "../packages/genesis/src/block0-judge-from-proofs.js";
import { collectBlock0PrerequisiteStatus } from "../packages/genesis/src/block0-prerequisite-status-collector.js";
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
import {
  buildBaseline,
  PERF_BASELINE_ACTION_TYPE,
} from "../packages/perf/src/perf-baseline.js";
import {
  buildLesson,
  APPROVE_LESSON_ACTION_TYPE,
} from "../packages/learn/src/how-lesson-writer.js";
import {
  buildAgentProfile,
  CANONICAL_AGENTS,
  AGENT_PROFILE_SCHEMA,
  MUTATE_AGENT_PROFILE_ACTION_TYPE,
} from "../packages/agents/src/agent-profile-registry.js";
import {
  buildCanonicalReceipt,
  CANONICAL_RECEIPT_CONSENT_PHRASE,
} from "../packages/receipts/src/canonical-receipt.js";
import { buildLedgerEntry } from "../packages/econ/src/dual-token-ledger.js";
import { buildKeyconsentIntegrationProof } from "../packages/genesis/src/keyconsent-integration-proof.js";
import { buildCoreFlywheelRunReceipt } from "../packages/genesis/src/core-flywheel-run-proof.js";
import { runOneTaskFlywheel } from "../packages/flywheel/src/flywheel-one-task.js";
import { GUARDED_CLAIM_CONSENT_PHRASE } from "../packages/receipts/src/assumption-guarded-claim.js";
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

const CREATED = "2026-06-02T09:00:00.000Z";
const C_CREATED = "2026-06-02T08:59:00.000Z";
const C_EXPIRES = "2026-06-02T09:04:00.000Z";
const RESOURCE_STATUS = Object.freeze({
  cpu_count: 8,
  share_status: "local-only",
});
const REALM_STATE = Object.freeze({ identity_status: "VERIFIED" });
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
const A_ENVELOPE = Object.freeze({
  claim_state: "A",
  assumption: "Task X is complete.",
  ground: "tests/x.test.js passed 9/9.",
  boundary: "Invalid if x.test.js regresses.",
  rejectable: true,
});

let nonceCounter = 0;
function nextNonce() {
  nonceCounter += 1;
  return sha256(`seal-readiness-nonce:${nonceCounter}`).slice(0, 64);
}
async function consent(home, phrase, action_type, target_hash) {
  const cp = await buildConsentProof({
    phrase,
    actionScope: { action_type, target_hash },
    demaHome: home,
    nonce: nextNonce(),
    createdAtIso: C_CREATED,
    expiresAtIso: C_EXPIRES,
  });
  assert.equal(cp.built, true, `consent ${phrase}: ${cp.error}`);
  return cp.consent_proof;
}
function agentProjectedBody(agent) {
  const { agent_id, agent_class, agent_role } = agent;
  return {
    schema: AGENT_PROFILE_SCHEMA,
    agent_id,
    agent_class,
    agent_role,
    stable_profile_hash: sha256(
      stableStringify({
        schema: AGENT_PROFILE_SCHEMA,
        agent_id,
        agent_class,
        agent_role,
        created_at_iso: CREATED,
      }),
    ),
    skills: [],
    xp: 0,
    wallet_id: "",
    service_catalog: [],
    memory_log_path: `agents/${agent_id}/memory.log`,
    event_log_path: `agents/${agent_id}/events.log`,
    proof_references: [],
    failure_patterns: [],
    performance_contribution_score: 0,
    current_task_ownership: null,
    created_at_iso: CREATED,
  };
}
async function buildProfile(home, agent) {
  const body = agentProjectedBody(agent);
  const cp = await consent(
    home,
    "SIGN AUTHORSHIP RECEIPT",
    MUTATE_AGENT_PROFILE_ACTION_TYPE,
    sha256(stableStringify(body)),
  );
  const r = await buildAgentProfile({
    agent_id: agent.agent_id,
    agent_class: agent.agent_class,
    agent_role: agent.agent_role,
    skills: [],
    xp: 0,
    wallet_id: "",
    service_catalog: [],
    memory_log_path: `agents/${agent.agent_id}/memory.log`,
    event_log_path: `agents/${agent.agent_id}/events.log`,
    proof_references: [],
    failure_patterns: [],
    performance_contribution_score: 0,
    current_task_ownership: null,
    consentProof: cp,
    demaHome: home,
    createdAtIso: CREATED,
  });
  assert.equal(r.built, true, `profile ${agent.agent_id}: ${r.error}`);
  return r.profile;
}

// Build all 12 real proofs in one operator home; return {proofs, manifest, pubkeyPem}.
async function buildSealableWorld(home) {
  await initAuthorshipKey({ consent: KEY_INIT_CONSENT_PHRASE, demaHome: home });
  const pubkeyPem = await loadPublicKey(home);

  // node0 / urp / realm
  const node0Id = node0IdentityCommitment({
    operatorPubkeyPem: pubkeyPem,
    createdAtIso: CREATED,
  });
  const node0 = await buildNode0IdentityProof({
    demaHome: home,
    consentProof: await consent(
      home,
      PROVE_NODE0_IDENTITY_CONSENT_PHRASE,
      PROVE_NODE0_IDENTITY_ACTION_TYPE,
      node0Id,
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
    consentProof: await consent(
      home,
      PROVE_URP_RESOURCE_STATUS_CONSENT_PHRASE,
      PROVE_URP_RESOURCE_STATUS_ACTION_TYPE,
      urpId,
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
    consentProof: await consent(
      home,
      PROVE_DEMA_REALM_STATE_CONSENT_PHRASE,
      PROVE_DEMA_REALM_STATE_ACTION_TYPE,
      realmId,
    ),
    realmState: REALM_STATE,
    createdAtIso: CREATED,
  });
  assert.equal(node0.built && urp.built && realm.built, true);

  // perf baseline
  const baselineTarget = sha256(
    stableStringify({
      baseline_metrics: METRICS,
      measurement_context: CONTEXT,
    }),
  );
  const baseline = await buildBaseline({
    baseline_metrics: METRICS,
    measurement_context: CONTEXT,
    consentProof: await consent(
      home,
      "SIGN AUTHORSHIP RECEIPT",
      PERF_BASELINE_ACTION_TYPE,
      baselineTarget,
    ),
    demaHome: home,
    createdAtIso: CREATED,
  });
  assert.equal(baseline.built, true, baseline.error);

  // house of wisdom lesson (ONE approval consent, reused for hash + proof)
  const lessonApproval = await consent(
    home,
    "APPROVE LESSON",
    APPROVE_LESSON_ACTION_TYPE,
    sha256(LESSON_TEXT),
  );
  const lesson = await buildLesson({
    experience_receipt_hash: "a".repeat(64),
    reflection_text: "noticed a pause before approving.",
    sat_review_receipt_hash: "b".repeat(64),
    mumu_approval_consent_proof_hash: lessonApproval.consent_proof_hash,
    lesson_text: LESSON_TEXT,
    policy_or_skill_target: "policy.refusal.fetch_and_execute",
    mumuApprovalConsentProof: lessonApproval,
    demaHome: home,
    createdAtIso: CREATED,
  });
  assert.equal(lesson.built, true, lesson.error);

  // PAT-7 + SAT-5 profiles
  const pat = [];
  for (const a of CANONICAL_AGENTS.filter((x) => x.agent_class === "PAT"))
    pat.push(await buildProfile(home, a));
  const sat = [];
  for (const a of CANONICAL_AGENTS.filter((x) => x.agent_class === "SAT"))
    sat.push(await buildProfile(home, a));

  // canonical receipt chain
  const r0 = await buildCanonicalReceipt({
    canonicalBody: { step: 0 },
    prevHash: null,
    truthLabel: "MEASURED_LOCAL",
    whatProves: "x",
    whatDoesNotProve: "y",
    consent: CANONICAL_RECEIPT_CONSENT_PHRASE,
    demaHome: home,
    now: CREATED,
  });
  const r1 = await buildCanonicalReceipt({
    canonicalBody: { step: 1 },
    prevHash: r0.receipt.receipt_id,
    truthLabel: "MEASURED_LOCAL",
    whatProves: "x",
    whatDoesNotProve: "y",
    consent: CANONICAL_RECEIPT_CONSENT_PHRASE,
    demaHome: home,
    now: CREATED,
  });
  const receipts = [r0.receipt, r1.receipt];

  // token ledger chain
  const tokenConsent = await consent(
    home,
    "MINT LEDGER ENTRY",
    "MINT_LEDGER_ENTRY",
    "f".repeat(64),
  );
  const e0 = await buildLedgerEntry({
    entry_type: "RESOURCE_DEBIT",
    token_class: "RESOURCE",
    amount: 5,
    evidence_receipt_hashes: ["a".repeat(64)],
    prev_hash: null,
    consentProof: tokenConsent,
    demaHome: home,
    createdAtIso: CREATED,
  });
  const e1 = await buildLedgerEntry({
    entry_type: "RESOURCE_DEBIT",
    token_class: "RESOURCE",
    amount: 7,
    evidence_receipt_hashes: ["b".repeat(64)],
    prev_hash: e0.entry_hash,
    consentProof: tokenConsent,
    demaHome: home,
    createdAtIso: CREATED,
  });
  const tokens = [e0, e1];

  // keyconsent + flywheel
  const kc = await buildKeyconsentIntegrationProof({
    demaHome: home,
    createdAtIso: CREATED,
  });
  assert.equal(kc.built, true, kc.error);
  const oneTask = await runOneTaskFlywheel({
    task: "seal-readiness core run",
    envelope: A_ENVELOPE,
    consent: GUARDED_CLAIM_CONSENT_PHRASE,
    demaHome: home,
    now: CREATED,
  });
  assert.equal(oneTask.completed, true, oneTask.error || oneTask.stage);
  const fly = await buildCoreFlywheelRunReceipt({
    phases: { action_score: oneTask.flywheel_receipt },
    demaHome: home,
    createdAtIso: CREATED,
  });
  assert.equal(fly.built, true, fly.error);

  // Collect to derive the canonical-ordered list hashes for the manifest.
  const collected = collectBlock0PrerequisiteStatus({
    proofs: { pat_profile_proof_hashes: pat, sat_profile_proof_hashes: sat },
    operatorPubkeyPem: pubkeyPem,
  });
  const patHashes =
    collected.slot_verification.pat_profile_proof_hashes.proof_hashes;
  const satHashes =
    collected.slot_verification.sat_profile_proof_hashes.proof_hashes;

  // Build the manifest committing every slot's real output.
  const prerequisites = {
    keyconsent_integration_complete: kc.proof.keyconsent_integration_complete,
    keyconsent_truth_labels: kc.proof.keyconsent_truth_labels,
    canonical_receipt_ledger_root_hash: collectBlock0PrerequisiteStatus({
      proofs: { canonical_receipt_ledger_root_hash: receipts },
      operatorPubkeyPem: pubkeyPem,
    }).slot_verification.canonical_receipt_ledger_root_hash.root_hash,
    node0_identity_proof_hash: node0.proof.node0_identity_proof_hash,
    dema_realm_state_proof_hash: realm.proof.dema_realm_state_proof_hash,
    pat_profile_proof_hashes: patHashes,
    sat_profile_proof_hashes: satHashes,
    urp_resource_status_proof_hash: urp.proof.urp_resource_status_proof_hash,
    genesis_local_token_ledger_root_hash: tokens[tokens.length - 1].entry_hash,
    poi_rule_id: POI_RULE_ID,
    poi_rule_version: "0.1.0",
    full_flywheel_run_receipt_hash: fly.full_flywheel_run_receipt_hash,
    performance_baseline_proof_hash: baseline.baseline.baseline_proof_hash,
    house_of_wisdom_first_lesson_proof_hash: lesson.lesson.lesson_proof_hash,
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
    stableStringify({ prerequisites, claim_boundary, created_at_iso: CREATED }),
  );
  const seal = await consent(
    home,
    "SEAL BLOCK0",
    BLOCK0_ACTION_TYPE,
    targetHash,
  );
  const m = await buildBlock0Manifest({
    prerequisites,
    claimBoundary: claim_boundary,
    consentProof: seal,
    demaHome: home,
    createdAtIso: CREATED,
  });
  assert.equal(m.built, true, `manifest must build: ${m.error}`);

  const proofs = {
    node0_identity_proof_hash: node0.proof,
    urp_resource_status_proof_hash: urp.proof,
    dema_realm_state_proof_hash: realm.proof,
    performance_baseline_proof_hash: baseline.baseline,
    house_of_wisdom_first_lesson_proof_hash: lesson.lesson,
    pat_profile_proof_hashes: pat,
    sat_profile_proof_hashes: sat,
    canonical_receipt_ledger_root_hash: receipts,
    genesis_local_token_ledger_root_hash: tokens,
    poi_rule: { poi_rule_id: POI_RULE_ID, poi_rule_version: "0.1.0" },
    keyconsent_integration: kc.proof,
    full_flywheel_run_receipt_hash: fly.proof,
  };
  return { pubkeyPem, manifest: m.manifest, proofs };
}

describe("BLOCK0-SEAL-READINESS · 12/12 sealable from real proofs", () => {
  it("all 12 slots bind from real proofs → verified:true, sealable:TRUE", async () => {
    const home = await mkdtemp(join(tmpdir(), "dema-seal-ready-"));
    try {
      const { pubkeyPem, manifest, proofs } = await buildSealableWorld(home);
      const r = judgeBlock0FromProofs({
        manifest,
        operatorPubkeyPem: pubkeyPem,
        proofs,
      });
      assert.equal(r.judged, true, r.error);
      assert.equal(r.verification.verified, true, r.verification.reason);
      assert.equal(r.bound_live_count, 12);
      assert.equal(r.verification.producer_live_count, 12);
      assert.equal(r.sealable, true); // 12/12 SEALABLE (not sealed)
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("adversarial: tampering one proof drops sealable to false", async () => {
    const home = await mkdtemp(join(tmpdir(), "dema-seal-ready-"));
    try {
      const { pubkeyPem, manifest, proofs } = await buildSealableWorld(home);
      const broken = {
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
        proofs: broken,
      });
      assert.equal(r.sealable, false);
      assert.equal(
        r.judged_status_map.urp_resource_status_proof_hash,
        "NAMED_ONLY",
      );
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("adversarial: a missing slot drops sealable to false", async () => {
    const home = await mkdtemp(join(tmpdir(), "dema-seal-ready-"));
    try {
      const { pubkeyPem, manifest, proofs } = await buildSealableWorld(home);
      const { poi_rule, ...missingPoi } = proofs;
      const r = judgeBlock0FromProofs({
        manifest,
        operatorPubkeyPem: pubkeyPem,
        proofs: missingPoi,
      });
      assert.equal(r.sealable, false);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});
