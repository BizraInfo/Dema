// COLLECTOR-2B · foundation list-slot adapters (PAT-7 / SAT-5 profile lists)
//
// Extends the SLOT_ADAPTERS registry from a scalar-only model to support
// kind:"hash_list" slots. The two Block0 profile slots are count-validated
// arrays of profile_proof_hashes:
//   pat_profile_proof_hashes  (7, canonical PAT roster)
//   sat_profile_proof_hashes  (5, canonical SAT roster)
//
// PROOF BOUNDARY (do not overclaim): this collects STATIC profile-list proof —
// canonical presence + signature + roster completeness + manifest binding. It
// does NOT prove SAT runtime isolation, SAT user-inaccessibility, URP custody,
// model binding, memory homes, or active runtime behavior.

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectBlock0PrerequisiteStatus } from "../packages/genesis/src/block0-prerequisite-status-collector.js";
import { judgeBlock0FromProofs } from "../packages/genesis/src/block0-judge-from-proofs.js";
import {
  buildAgentProfile,
  CANONICAL_AGENTS,
  AGENT_PROFILE_SCHEMA,
  MUTATE_AGENT_PROFILE_ACTION_TYPE,
} from "../packages/agents/src/agent-profile-registry.js";
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

const CREATED = "2026-06-01T16:00:00.000Z";
const C_CREATED = "2026-06-01T15:59:00.000Z";
const C_EXPIRES = "2026-06-01T16:04:00.000Z";
const H = (s) => sha256(`collector-2b-fixture:${s}`);

const PAT_SLOT = "pat_profile_proof_hashes";
const SAT_SLOT = "sat_profile_proof_hashes";
const PAT_AGENTS = CANONICAL_AGENTS.filter((a) => a.agent_class === "PAT");
const SAT_AGENTS = CANONICAL_AGENTS.filter((a) => a.agent_class === "SAT");

function nonce(i) {
  return `agnonce${i}`.padEnd(8, "x").slice(0, 8).repeat(8);
}

// Replicates the kernel's signed body shape so consent target_hash binds.
function projectedBody(agent, created_at_iso) {
  const { agent_id, agent_class, agent_role } = agent;
  const stable_profile_hash = sha256(
    stableStringify({
      schema: AGENT_PROFILE_SCHEMA,
      agent_id,
      agent_class,
      agent_role,
      created_at_iso,
    }),
  );
  return {
    schema: AGENT_PROFILE_SCHEMA,
    agent_id,
    agent_class,
    agent_role,
    stable_profile_hash,
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
    created_at_iso,
  };
}

async function buildCanonicalProfile(home, agent, i) {
  const body = projectedBody(agent, CREATED);
  const cp = await buildConsentProof({
    phrase: "SIGN AUTHORSHIP RECEIPT",
    actionScope: {
      action_type: MUTATE_AGENT_PROFILE_ACTION_TYPE,
      target_hash: sha256(stableStringify(body)),
    },
    demaHome: home,
    nonce: nonce(i),
    createdAtIso: C_CREATED,
    expiresAtIso: C_EXPIRES,
  });
  assert.equal(cp.built, true, `consent for ${agent.agent_id}: ${cp.error}`);
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
    consentProof: cp.consent_proof,
    demaHome: home,
    createdAtIso: CREATED,
  });
  assert.equal(r.built, true, `profile for ${agent.agent_id}: ${r.error}`);
  return r.profile;
}

async function buildAllProfiles(home) {
  await initAuthorshipKey({ consent: KEY_INIT_CONSENT_PHRASE, demaHome: home });
  const pubkeyPem = await loadPublicKey(home);
  const pat = [];
  for (let i = 0; i < PAT_AGENTS.length; i++) {
    pat.push(await buildCanonicalProfile(home, PAT_AGENTS[i], i));
  }
  const sat = [];
  for (let i = 0; i < SAT_AGENTS.length; i++) {
    sat.push(await buildCanonicalProfile(home, SAT_AGENTS[i], 100 + i));
  }
  return { pubkeyPem, pat, sat };
}

describe("COLLECTOR-2B · list-slot adapters (PAT-7 / SAT-5)", () => {
  it("happy: canonical PAT-7 + SAT-5 profile lists become PRODUCER_LIVE", async () => {
    const home = await freshHome();
    try {
      const { pubkeyPem, pat, sat } = await buildAllProfiles(home);
      const r = collectBlock0PrerequisiteStatus({
        proofs: { [PAT_SLOT]: pat, [SAT_SLOT]: sat },
        operatorPubkeyPem: pubkeyPem,
      });
      assert.equal(r.collected, true, r.error);
      assert.equal(r.status_map[PAT_SLOT], "PRODUCER_LIVE");
      assert.equal(r.status_map[SAT_SLOT], "PRODUCER_LIVE");
      assert.equal(r.producer_live_count, 2);
      // collected proof_hashes are exposed in canonical order
      assert.equal(r.slot_verification[PAT_SLOT].proof_hashes.length, 7);
      assert.equal(r.slot_verification[SAT_SLOT].proof_hashes.length, 5);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("input order untrusted → output proof_hashes are canonical-ordered", async () => {
    const home = await freshHome();
    try {
      const { pubkeyPem, pat } = await buildAllProfiles(home);
      const canonical = collectBlock0PrerequisiteStatus({
        proofs: { [PAT_SLOT]: pat },
        operatorPubkeyPem: pubkeyPem,
      }).slot_verification[PAT_SLOT].proof_hashes;
      const shuffled = [...pat].reverse();
      const r = collectBlock0PrerequisiteStatus({
        proofs: { [PAT_SLOT]: shuffled },
        operatorPubkeyPem: pubkeyPem,
      });
      assert.equal(r.status_map[PAT_SLOT], "PRODUCER_LIVE");
      assert.deepEqual(r.slot_verification[PAT_SLOT].proof_hashes, canonical);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: missing one PAT profile → NAMED_ONLY", async () => {
    const home = await freshHome();
    try {
      const { pubkeyPem, pat } = await buildAllProfiles(home);
      const r = collectBlock0PrerequisiteStatus({
        proofs: { [PAT_SLOT]: pat.slice(0, 6) },
        operatorPubkeyPem: pubkeyPem,
      });
      assert.equal(r.status_map[PAT_SLOT], "NAMED_ONLY");
      assert.equal(r.slot_verification[PAT_SLOT].verified, false);
      assert.equal(r.producer_live_count, 0);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: duplicate profile (no missing count) → NAMED_ONLY", async () => {
    const home = await freshHome();
    try {
      const { pubkeyPem, pat } = await buildAllProfiles(home);
      const dup = [...pat.slice(0, 6), pat[0]]; // 7 entries but pat[6] missing, pat[0] twice
      const r = collectBlock0PrerequisiteStatus({
        proofs: { [PAT_SLOT]: dup },
        operatorPubkeyPem: pubkeyPem,
      });
      assert.equal(r.status_map[PAT_SLOT], "NAMED_ONLY");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: extra profile (count mismatch) → NAMED_ONLY", async () => {
    const home = await freshHome();
    try {
      const { pubkeyPem, pat, sat } = await buildAllProfiles(home);
      const r = collectBlock0PrerequisiteStatus({
        proofs: { [PAT_SLOT]: [...pat, sat[0]] }, // 8 entries
        operatorPubkeyPem: pubkeyPem,
      });
      assert.equal(r.status_map[PAT_SLOT], "NAMED_ONLY");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: a tampered profile in the list → NAMED_ONLY", async () => {
    const home = await freshHome();
    try {
      const { pubkeyPem, pat } = await buildAllProfiles(home);
      const tampered = [...pat];
      tampered[2] = { ...tampered[2], xp: 999999 };
      const r = collectBlock0PrerequisiteStatus({
        proofs: { [PAT_SLOT]: tampered },
        operatorPubkeyPem: pubkeyPem,
      });
      assert.equal(r.status_map[PAT_SLOT], "NAMED_ONLY");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: wrong external pubkey → both NAMED_ONLY", async () => {
    const home = await freshHome();
    const other = await freshHome();
    try {
      const { pat, sat } = await buildAllProfiles(home);
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: other,
      });
      const foreign = await loadPublicKey(other);
      const r = collectBlock0PrerequisiteStatus({
        proofs: { [PAT_SLOT]: pat, [SAT_SLOT]: sat },
        operatorPubkeyPem: foreign,
      });
      assert.equal(r.producer_live_count, 0);
      assert.equal(r.status_map[PAT_SLOT], "NAMED_ONLY");
    } finally {
      await rm(home, { recursive: true, force: true });
      await rm(other, { recursive: true, force: true });
    }
  });

  it("judge hash-bind: manifest committing canonical-ordered hash arrays → both bound PRODUCER_LIVE", async () => {
    const home = await freshHome();
    try {
      const { pubkeyPem, pat, sat } = await buildAllProfiles(home);
      const patHashes = collectBlock0PrerequisiteStatus({
        proofs: { [PAT_SLOT]: pat },
        operatorPubkeyPem: pubkeyPem,
      }).slot_verification[PAT_SLOT].proof_hashes;
      const satHashes = collectBlock0PrerequisiteStatus({
        proofs: { [SAT_SLOT]: sat },
        operatorPubkeyPem: pubkeyPem,
      }).slot_verification[SAT_SLOT].proof_hashes;

      const prerequisites = {
        keyconsent_integration_complete: true,
        keyconsent_truth_labels: ["MEASURED:kernel", "WIRED:integration"],
        canonical_receipt_ledger_root_hash: H("canonical"),
        node0_identity_proof_hash: H("node0id"),
        dema_realm_state_proof_hash: H("realm"),
        pat_profile_proof_hashes: patHashes,
        sat_profile_proof_hashes: satHashes,
        urp_resource_status_proof_hash: H("urp"),
        genesis_local_token_ledger_root_hash: H("econ"),
        poi_rule_id: "consent_proof_replay_verification.v0.1",
        poi_rule_version: "0.1.0",
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
        nonce: "sealb2b0".repeat(8),
        createdAtIso: C_CREATED,
        expiresAtIso: C_EXPIRES,
      });
      const m = await buildBlock0Manifest({
        prerequisites,
        claimBoundary: claim_boundary,
        consentProof: seal.consent_proof,
        demaHome: home,
        createdAtIso: CREATED,
      });
      assert.equal(m.built, true, `manifest must build: ${m.error}`);

      const r = judgeBlock0FromProofs({
        manifest: m.manifest,
        operatorPubkeyPem: pubkeyPem,
        proofs: { [PAT_SLOT]: pat, [SAT_SLOT]: sat },
      });
      assert.equal(r.judged, true, r.error);
      assert.equal(r.slot_binding[PAT_SLOT].bound, true);
      assert.equal(r.slot_binding[SAT_SLOT].bound, true);
      assert.equal(r.judged_status_map[PAT_SLOT], "PRODUCER_LIVE");
      assert.equal(r.judged_status_map[SAT_SLOT], "PRODUCER_LIVE");
      assert.equal(r.bound_live_count, 2);
      assert.equal(r.sealable, false); // still partial — honest
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("judge hash-bind: manifest array order mismatch → NAMED_ONLY", async () => {
    const home = await freshHome();
    try {
      const { pubkeyPem, pat, sat } = await buildAllProfiles(home);
      const patHashes = collectBlock0PrerequisiteStatus({
        proofs: { [PAT_SLOT]: pat },
        operatorPubkeyPem: pubkeyPem,
      }).slot_verification[PAT_SLOT].proof_hashes;
      const satHashes = collectBlock0PrerequisiteStatus({
        proofs: { [SAT_SLOT]: sat },
        operatorPubkeyPem: pubkeyPem,
      }).slot_verification[SAT_SLOT].proof_hashes;
      const prerequisites = {
        keyconsent_integration_complete: true,
        keyconsent_truth_labels: ["MEASURED:kernel"],
        canonical_receipt_ledger_root_hash: H("canonical"),
        node0_identity_proof_hash: H("node0id"),
        dema_realm_state_proof_hash: H("realm"),
        pat_profile_proof_hashes: [...patHashes].reverse(), // wrong order
        sat_profile_proof_hashes: satHashes,
        urp_resource_status_proof_hash: H("urp"),
        genesis_local_token_ledger_root_hash: H("econ"),
        poi_rule_id: "consent_proof_replay_verification.v0.1",
        poi_rule_version: "0.1.0",
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
        nonce: "sealb2b1".repeat(8),
        createdAtIso: C_CREATED,
        expiresAtIso: C_EXPIRES,
      });
      const m = await buildBlock0Manifest({
        prerequisites,
        claimBoundary: claim_boundary,
        consentProof: seal.consent_proof,
        demaHome: home,
        createdAtIso: CREATED,
      });
      assert.equal(m.built, true, `manifest must build: ${m.error}`);
      const r = judgeBlock0FromProofs({
        manifest: m.manifest,
        operatorPubkeyPem: pubkeyPem,
        proofs: { [PAT_SLOT]: pat, [SAT_SLOT]: sat },
      });
      assert.equal(r.slot_binding[PAT_SLOT].bound, false);
      assert.equal(r.judged_status_map[PAT_SLOT], "NAMED_ONLY");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});

async function freshHome() {
  return mkdtemp(join(tmpdir(), "dema-collector-2b-"));
}
