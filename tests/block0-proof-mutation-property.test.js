// BLOCK0-PROPERTY · mutation-property hardening of the Block0 proof verifiers.
//
// Audit finding: every Block0 adapter test was example-based. This adds a
// PROPERTY test (stdlib-only — zero-dep posture forbids fast-check, so we
// EXHAUSTIVELY enumerate field mutations, which is stronger than random
// sampling): for a real proof, EVERY single-field mutation must drop the slot to
// NAMED_ONLY. The control (unmutated proof → PRODUCER_LIVE) proves the harness
// builds genuine proofs and the mutations are what break them — so a vacuous
// pass is impossible. If any mutation survives, that's a real verifier hole.

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectBlock0PrerequisiteStatus } from "../packages/genesis/src/block0-prerequisite-status-collector.js";
import {
  buildUrpResourceStatusProof,
  urpResourceStatusCommitment,
  PROVE_URP_RESOURCE_STATUS_ACTION_TYPE,
  PROVE_URP_RESOURCE_STATUS_CONSENT_PHRASE,
} from "../packages/genesis/src/urp-resource-status-proof.js";
import { buildKeyconsentIntegrationProof } from "../packages/genesis/src/keyconsent-integration-proof.js";
import {
  buildAgentProfile,
  CANONICAL_AGENTS,
  AGENT_PROFILE_SCHEMA,
  MUTATE_AGENT_PROFILE_ACTION_TYPE,
} from "../packages/agents/src/agent-profile-registry.js";
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

const CREATED = "2026-06-02T10:00:00.000Z";
const C_CREATED = "2026-06-02T09:59:00.000Z";
const C_EXPIRES = "2026-06-02T10:04:00.000Z";

async function freshHome() {
  return mkdtemp(join(tmpdir(), "dema-prop-"));
}

// Deterministically mutate one field to a DIFFERENT, type-appropriate value.
function mutateField(value) {
  if (typeof value === "string") return value === "MUT" ? "MUT2" : "MUT";
  if (typeof value === "boolean") return !value;
  if (typeof value === "number") return value + 1;
  if (Array.isArray(value)) return [...value, "__INJECTED__"];
  if (value === null) return "__WAS_NULL__";
  if (typeof value === "object") return { ...value, __injected__: true };
  return "__MUT__";
}

// Yield [fieldName, mutatedProof] for every top-level field (single-field
// mutations only — exhaustive over the proof's own keys).
function singleFieldMutations(proof) {
  return Object.keys(proof).map((k) => [
    k,
    { ...proof, [k]: mutateField(proof[k]) },
  ]);
}

// The property: control is live; every single-field mutation is NOT live.
function assertMutationProperty({ slot, proof, operatorPubkeyPem, label }) {
  const control = collectBlock0PrerequisiteStatus({
    proofs: { [slot]: proof },
    operatorPubkeyPem,
  });
  assert.equal(
    control.status_map[slot],
    "PRODUCER_LIVE",
    `${label}: control (unmutated) must be PRODUCER_LIVE`,
  );

  const muts = singleFieldMutations(proof);
  assert.ok(muts.length >= 4, `${label}: expected several fields to mutate`);
  for (const [field, mutated] of muts) {
    const r = collectBlock0PrerequisiteStatus({
      proofs: { [slot]: mutated },
      operatorPubkeyPem,
    });
    assert.equal(
      r.status_map[slot],
      "NAMED_ONLY",
      `${label}: mutating field "${field}" MUST drop the slot to NAMED_ONLY (verifier hole if not)`,
    );
  }
  return muts.length;
}

describe("BLOCK0-PROPERTY · single-field mutation invariant", () => {
  it("urp_resource_status_proof_hash: every field mutation → NAMED_ONLY", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const pubkeyPem = await loadPublicKey(home);
      const resourceStatus = { cpu_count: 8, share_status: "local-only" };
      const id = urpResourceStatusCommitment({
        operatorPubkeyPem: pubkeyPem,
        resourceStatus,
        createdAtIso: CREATED,
      });
      const cp = await buildConsentProof({
        phrase: PROVE_URP_RESOURCE_STATUS_CONSENT_PHRASE,
        actionScope: {
          action_type: PROVE_URP_RESOURCE_STATUS_ACTION_TYPE,
          target_hash: id,
        },
        demaHome: home,
        nonce: "p".repeat(64),
        createdAtIso: C_CREATED,
        expiresAtIso: C_EXPIRES,
      });
      const r = await buildUrpResourceStatusProof({
        demaHome: home,
        consentProof: cp.consent_proof,
        resourceStatus,
        createdAtIso: CREATED,
      });
      assert.equal(r.built, true, r.error);
      const n = assertMutationProperty({
        slot: "urp_resource_status_proof_hash",
        proof: r.proof,
        operatorPubkeyPem: pubkeyPem,
        label: "urp",
      });
      assert.ok(n >= 8, `urp: expected to mutate all proof fields, got ${n}`);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("keyconsent_integration: every field mutation → NAMED_ONLY", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const pubkeyPem = await loadPublicKey(home);
      const k = await buildKeyconsentIntegrationProof({
        demaHome: home,
        createdAtIso: CREATED,
      });
      assert.equal(k.built, true, k.error);
      assertMutationProperty({
        slot: "keyconsent_integration",
        proof: k.proof,
        operatorPubkeyPem: pubkeyPem,
        label: "keyconsent",
      });
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("pat_profile_proof_hashes: mutating ANY field of ANY profile in the list → NAMED_ONLY", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const pubkeyPem = await loadPublicKey(home);
      const patAgents = CANONICAL_AGENTS.filter((a) => a.agent_class === "PAT");
      const profiles = [];
      let nonce = 0;
      for (const agent of patAgents) {
        const body = {
          schema: AGENT_PROFILE_SCHEMA,
          agent_id: agent.agent_id,
          agent_class: agent.agent_class,
          agent_role: agent.agent_role,
          stable_profile_hash: sha256(
            stableStringify({
              schema: AGENT_PROFILE_SCHEMA,
              agent_id: agent.agent_id,
              agent_class: agent.agent_class,
              agent_role: agent.agent_role,
              created_at_iso: CREATED,
            }),
          ),
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
          created_at_iso: CREATED,
        };
        const cp = await buildConsentProof({
          phrase: "SIGN AUTHORSHIP RECEIPT",
          actionScope: {
            action_type: MUTATE_AGENT_PROFILE_ACTION_TYPE,
            target_hash: sha256(stableStringify(body)),
          },
          demaHome: home,
          nonce: `prof${nonce++}`.padEnd(8, "z").repeat(8),
          createdAtIso: C_CREATED,
          expiresAtIso: C_EXPIRES,
        });
        const pr = await buildAgentProfile({
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
        assert.equal(pr.built, true, pr.error);
        profiles.push(pr.profile);
      }
      const slot = "pat_profile_proof_hashes";
      // control
      assert.equal(
        collectBlock0PrerequisiteStatus({
          proofs: { [slot]: profiles },
          operatorPubkeyPem: pubkeyPem,
        }).status_map[slot],
        "PRODUCER_LIVE",
        "pat: control list must be PRODUCER_LIVE",
      );
      // mutate every field of the first profile → list must fail closed
      const patMuts = singleFieldMutations(profiles[0]);
      assert.ok(
        patMuts.length >= 4,
        "pat: expected several profile fields to mutate (non-vacuous guard)",
      );
      for (const [field, mutatedProfile] of patMuts) {
        const mutatedList = [mutatedProfile, ...profiles.slice(1)];
        const r = collectBlock0PrerequisiteStatus({
          proofs: { [slot]: mutatedList },
          operatorPubkeyPem: pubkeyPem,
        });
        assert.equal(
          r.status_map[slot],
          "NAMED_ONLY",
          `pat: mutating profile[0] field "${field}" MUST drop the list to NAMED_ONLY`,
        );
      }
      // ...and EVERY other profile POSITION must be verified too — guards
      // against a regression that only checks profile[0] and skips the rest.
      for (let i = 1; i < profiles.length; i += 1) {
        const [field, mutatedProfile] = singleFieldMutations(profiles[i])[0];
        const list = [
          ...profiles.slice(0, i),
          mutatedProfile,
          ...profiles.slice(i + 1),
        ];
        const r = collectBlock0PrerequisiteStatus({
          proofs: { [slot]: list },
          operatorPubkeyPem: pubkeyPem,
        });
        assert.equal(
          r.status_map[slot],
          "NAMED_ONLY",
          `pat: mutating profile[${i}] field "${field}" MUST drop the list to NAMED_ONLY`,
        );
      }
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});
