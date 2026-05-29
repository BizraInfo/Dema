// AGENT-PROFILE-1A · Static 12-Agent Civilization Registry kernel tests
//
// Covers all 8 DOD criteria from the AGENT_PROFILE_0_PREFLIGHT contract
// (§9) plus structural validation. No CLI, no wallet integration, no
// skill aggregation, no autonomous execution — the kernel is pure with
// disk-bound key load + KEYCONSENT-1A consent_proof verification.
//
// Schema reference: docs/security/AGENT_PROFILE_0_PREFLIGHT.md §3.
// Verification flow reference: docs/security/AGENT_PROFILE_0_PREFLIGHT.md §5.
// Twelve canonical agents reference: docs/security/AGENT_PROFILE_0_PREFLIGHT.md §2.

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildAgentProfile,
  verifyAgentProfile,
  CANONICAL_AGENTS,
  AGENT_PROFILE_SCHEMA,
  MUTATE_AGENT_PROFILE_ACTION_TYPE,
} from "../packages/agents/src/agent-profile-registry.js";
import {
  initAuthorshipKey,
  KEY_INIT_CONSENT_PHRASE,
} from "../packages/receipts/src/authorship-key-store.js";
import { generateEd25519Keypair } from "../packages/receipts/src/authorship-signature.js";
import { buildConsentProof } from "../packages/receipts/src/consent-proof.js";
import {
  sha256,
  stableStringify,
} from "../packages/consent/src/consent-common.js";

const FIXED_CREATED = "2026-05-30T08:00:00.000Z";
const FIXED_NOW_INSIDE_WINDOW = "2026-05-30T08:00:30.000Z";
const FIXED_CONSENT_NONCE = "feedface".repeat(8);
const FIXED_CONSENT_CREATED = "2026-05-30T08:00:00.000Z";
const FIXED_CONSENT_EXPIRES = "2026-05-30T08:05:00.000Z";

async function freshHome() {
  return await mkdtemp(join(tmpdir(), "dema-agent-profile-test-"));
}

// Build the immutable identity body the kernel hashes for stable_profile_hash.
function stableIdentityBody({
  agent_id,
  agent_class,
  agent_role,
  created_at_iso,
}) {
  return {
    schema: AGENT_PROFILE_SCHEMA,
    agent_id,
    agent_class,
    agent_role,
    created_at_iso,
  };
}

// Build a consent proof scoped to MUTATE_AGENT_PROFILE for the projected
// new profile body. Target body must match what the kernel will produce
// pre-signature/pre-proof-hash so the verifier accepts it.
async function buildMutationConsent({
  home,
  projectedBody,
  scopeOverride,
} = {}) {
  const target_hash = sha256(stableStringify(projectedBody));
  const scope = scopeOverride || {
    action_type: MUTATE_AGENT_PROFILE_ACTION_TYPE,
    target_hash,
  };
  const cp = await buildConsentProof({
    phrase: "SIGN AUTHORSHIP RECEIPT",
    actionScope: scope,
    demaHome: home,
    nonce: FIXED_CONSENT_NONCE,
    createdAtIso: FIXED_CONSENT_CREATED,
    expiresAtIso: FIXED_CONSENT_EXPIRES,
  });
  return cp;
}

// Compute the projected profile body the kernel will sign — must match
// the kernel's canonical body shape EXACTLY so consent target_hash binds.
function projectedProfileBody({
  agent_id,
  agent_class,
  agent_role,
  skills = [],
  xp = 0,
  wallet_id = "",
  service_catalog = [],
  memory_log_path,
  event_log_path,
  proof_references = [],
  failure_patterns = [],
  performance_contribution_score = 0,
  current_task_ownership = null,
  created_at_iso,
}) {
  const stable_profile_hash = sha256(
    stableStringify(
      stableIdentityBody({
        agent_id,
        agent_class,
        agent_role,
        created_at_iso,
      }),
    ),
  );
  return {
    schema: AGENT_PROFILE_SCHEMA,
    agent_id,
    agent_class,
    agent_role,
    stable_profile_hash,
    skills,
    xp,
    wallet_id,
    service_catalog,
    memory_log_path,
    event_log_path,
    proof_references,
    failure_patterns,
    performance_contribution_score,
    current_task_ownership,
    created_at_iso,
  };
}

const PAT_DEMA_INPUT = Object.freeze({
  agent_id: "pat.dema",
  agent_class: "PAT",
  agent_role: "Dema",
  skills: [],
  xp: 0,
  wallet_id: "",
  service_catalog: [],
  memory_log_path: "agents/pat.dema/memory.log",
  event_log_path: "agents/pat.dema/events.log",
  proof_references: [],
  failure_patterns: [],
  performance_contribution_score: 0,
  current_task_ownership: null,
});

async function buildPatDemaOk(overrides = {}) {
  const home = await freshHome();
  await initAuthorshipKey({
    consent: KEY_INIT_CONSENT_PHRASE,
    demaHome: home,
  });
  const input = { ...PAT_DEMA_INPUT, ...overrides };
  const projected = projectedProfileBody({
    ...input,
    created_at_iso: FIXED_CREATED,
  });
  const consentResult = await buildMutationConsent({
    home,
    projectedBody: projected,
  });
  assert.equal(consentResult.built, true, "consent build prerequisite failed");
  const result = await buildAgentProfile({
    ...input,
    consentProof: consentResult.consent_proof,
    demaHome: home,
    createdAtIso: FIXED_CREATED,
  });
  return { home, result, consentResult };
}

describe("agent-profile-registry · CANONICAL_AGENTS (DOD-2)", () => {
  it("exposes exactly 12 canonical agents (7 PAT + 5 SAT)", () => {
    assert.equal(CANONICAL_AGENTS.length, 12);
    const patRoles = CANONICAL_AGENTS.filter((a) => a.agent_class === "PAT");
    const satRoles = CANONICAL_AGENTS.filter((a) => a.agent_class === "SAT");
    assert.equal(patRoles.length, 7);
    assert.equal(satRoles.length, 5);
  });

  it("PAT-7 roles match preflight §2 exactly", () => {
    const patRoles = CANONICAL_AGENTS.filter((a) => a.agent_class === "PAT")
      .map((a) => a.agent_role)
      .sort();
    assert.deepEqual(patRoles, [
      "Archivist",
      "Builder",
      "Critic",
      "Dema",
      "Guardian",
      "Reasoner",
      "Teacher",
    ]);
  });

  it("SAT-5 roles match preflight §2 exactly", () => {
    const satRoles = CANONICAL_AGENTS.filter((a) => a.agent_class === "SAT")
      .map((a) => a.agent_role)
      .sort();
    assert.deepEqual(satRoles, [
      "Compliance",
      "Economist",
      "Evolution",
      "Resource",
      "Verifier",
    ]);
  });

  it("CANONICAL_AGENTS is deep-frozen", () => {
    assert.ok(Object.isFrozen(CANONICAL_AGENTS));
    for (const a of CANONICAL_AGENTS) {
      assert.ok(Object.isFrozen(a));
    }
  });

  it("each canonical agent carries agent_id, agent_class, agent_role", () => {
    for (const a of CANONICAL_AGENTS) {
      assert.equal(typeof a.agent_id, "string");
      assert.ok(a.agent_id.length > 0);
      assert.ok(a.agent_class === "PAT" || a.agent_class === "SAT");
      assert.equal(typeof a.agent_role, "string");
      assert.ok(a.agent_role.length > 0);
    }
  });
});

describe("agent-profile-registry · buildAgentProfile happy path (DOD-1, DOD-3)", () => {
  it("DOD-1 happy: builds a signed profile for pat.dema with all schema fields", async () => {
    const { home, result } = await buildPatDemaOk();
    try {
      assert.equal(result.built, true);
      const p = result.profile;
      assert.equal(p.schema, AGENT_PROFILE_SCHEMA);
      assert.equal(p.agent_id, "pat.dema");
      assert.equal(p.agent_class, "PAT");
      assert.equal(p.agent_role, "Dema");
      assert.equal(p.created_at_iso, FIXED_CREATED);
      assert.ok(/^[a-f0-9]{64}$/.test(p.stable_profile_hash));
      assert.ok(/^[a-f0-9]{64}$/.test(p.profile_proof_hash));
      assert.ok(
        typeof p.profile_signature_b64 === "string" &&
          p.profile_signature_b64.length > 0,
      );
      assert.deepEqual(p.skills, []);
      assert.equal(p.xp, 0);
      assert.equal(p.wallet_id, "");
      assert.deepEqual(p.service_catalog, []);
      assert.equal(p.memory_log_path, "agents/pat.dema/memory.log");
      assert.equal(p.event_log_path, "agents/pat.dema/events.log");
      assert.deepEqual(p.proof_references, []);
      assert.deepEqual(p.failure_patterns, []);
      assert.equal(p.performance_contribution_score, 0);
      assert.equal(p.current_task_ownership, null);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-3 profile_proof_hash determinism: identical inputs → byte-identical envelopes", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const projected = projectedProfileBody({
        ...PAT_DEMA_INPUT,
        created_at_iso: FIXED_CREATED,
      });
      const cpA = await buildMutationConsent({
        home,
        projectedBody: projected,
      });
      const cpB = await buildMutationConsent({
        home,
        projectedBody: projected,
      });
      const a = await buildAgentProfile({
        ...PAT_DEMA_INPUT,
        consentProof: cpA.consent_proof,
        demaHome: home,
        createdAtIso: FIXED_CREATED,
      });
      const b = await buildAgentProfile({
        ...PAT_DEMA_INPUT,
        consentProof: cpB.consent_proof,
        demaHome: home,
        createdAtIso: FIXED_CREATED,
      });
      assert.equal(a.built, true);
      assert.equal(b.built, true);
      // profile_proof_hash + signature + stable_profile_hash + body are
      // all identical given identical inputs (consent proof is not part
      // of the body the kernel signs).
      assert.equal(a.profile.profile_proof_hash, b.profile.profile_proof_hash);
      assert.equal(
        a.profile.stable_profile_hash,
        b.profile.stable_profile_hash,
      );
      assert.equal(
        a.profile.profile_signature_b64,
        b.profile.profile_signature_b64,
      );
      assert.deepEqual(a.profile, b.profile);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("can build all 12 canonical agents successfully", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const built = [];
      for (const canon of CANONICAL_AGENTS) {
        const input = {
          agent_id: canon.agent_id,
          agent_class: canon.agent_class,
          agent_role: canon.agent_role,
          skills: [],
          xp: 0,
          wallet_id: "",
          service_catalog: [],
          memory_log_path: `agents/${canon.agent_id}/memory.log`,
          event_log_path: `agents/${canon.agent_id}/events.log`,
          proof_references: [],
          failure_patterns: [],
          performance_contribution_score: 0,
          current_task_ownership: null,
        };
        const projected = projectedProfileBody({
          ...input,
          created_at_iso: FIXED_CREATED,
        });
        const cp = await buildMutationConsent({
          home,
          projectedBody: projected,
        });
        const r = await buildAgentProfile({
          ...input,
          consentProof: cp.consent_proof,
          demaHome: home,
          createdAtIso: FIXED_CREATED,
        });
        assert.equal(
          r.built,
          true,
          `expected built=true for ${canon.agent_role}; got error=${r.error}`,
        );
        built.push(r.profile);
      }
      assert.equal(built.length, 12);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});

describe("agent-profile-registry · fail-closed (DOD-4)", () => {
  it("DOD-4 unknown agent_role → built:false, error unknown_agent_role", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const projected = projectedProfileBody({
        agent_id: "pat.marketing",
        agent_class: "PAT",
        agent_role: "MarketingAgent",
        memory_log_path: "agents/pat.marketing/memory.log",
        event_log_path: "agents/pat.marketing/events.log",
        created_at_iso: FIXED_CREATED,
      });
      const cp = await buildMutationConsent({ home, projectedBody: projected });
      const r = await buildAgentProfile({
        agent_id: "pat.marketing",
        agent_class: "PAT",
        agent_role: "MarketingAgent",
        skills: [],
        xp: 0,
        wallet_id: "",
        service_catalog: [],
        memory_log_path: "agents/pat.marketing/memory.log",
        event_log_path: "agents/pat.marketing/events.log",
        proof_references: [],
        failure_patterns: [],
        performance_contribution_score: 0,
        current_task_ownership: null,
        consentProof: cp.consent_proof,
        demaHome: home,
        createdAtIso: FIXED_CREATED,
      });
      assert.equal(r.built, false);
      assert.equal(r.error, "unknown_agent_role");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("missing consentProof → built:false, error consent_proof_required", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const r = await buildAgentProfile({
        ...PAT_DEMA_INPUT,
        consentProof: undefined,
        demaHome: home,
        createdAtIso: FIXED_CREATED,
      });
      assert.equal(r.built, false);
      assert.equal(r.error, "consent_proof_required");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("consent scope mismatch (action_type ≠ MUTATE_AGENT_PROFILE) → consent_scope_mismatch", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const projected = projectedProfileBody({
        ...PAT_DEMA_INPUT,
        created_at_iso: FIXED_CREATED,
      });
      // Build a consent proof scoped to a different action_type.
      const target_hash = sha256(stableStringify(projected));
      const cp = await buildMutationConsent({
        home,
        projectedBody: projected,
        scopeOverride: {
          action_type: "MINT_VERDICT_RECEIPT",
          target_hash,
        },
      });
      const r = await buildAgentProfile({
        ...PAT_DEMA_INPUT,
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

  it("agent_class/role mismatch (Verifier claimed as PAT) → agent_class_role_mismatch", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      // Verifier is SAT-5, not PAT-7. Claiming PAT is a class/role mismatch.
      const projected = projectedProfileBody({
        agent_id: "pat.verifier",
        agent_class: "PAT",
        agent_role: "Verifier",
        memory_log_path: "agents/pat.verifier/memory.log",
        event_log_path: "agents/pat.verifier/events.log",
        created_at_iso: FIXED_CREATED,
      });
      const cp = await buildMutationConsent({ home, projectedBody: projected });
      const r = await buildAgentProfile({
        agent_id: "pat.verifier",
        agent_class: "PAT",
        agent_role: "Verifier",
        skills: [],
        xp: 0,
        wallet_id: "",
        service_catalog: [],
        memory_log_path: "agents/pat.verifier/memory.log",
        event_log_path: "agents/pat.verifier/events.log",
        proof_references: [],
        failure_patterns: [],
        performance_contribution_score: 0,
        current_task_ownership: null,
        consentProof: cp.consent_proof,
        demaHome: home,
        createdAtIso: FIXED_CREATED,
      });
      assert.equal(r.built, false);
      assert.equal(r.error, "agent_class_role_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("agent_class/role mismatch (Dema claimed as SAT) → agent_class_role_mismatch", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const projected = projectedProfileBody({
        agent_id: "sat.dema",
        agent_class: "SAT",
        agent_role: "Dema",
        memory_log_path: "agents/sat.dema/memory.log",
        event_log_path: "agents/sat.dema/events.log",
        created_at_iso: FIXED_CREATED,
      });
      const cp = await buildMutationConsent({ home, projectedBody: projected });
      const r = await buildAgentProfile({
        agent_id: "sat.dema",
        agent_class: "SAT",
        agent_role: "Dema",
        skills: [],
        xp: 0,
        wallet_id: "",
        service_catalog: [],
        memory_log_path: "agents/sat.dema/memory.log",
        event_log_path: "agents/sat.dema/events.log",
        proof_references: [],
        failure_patterns: [],
        performance_contribution_score: 0,
        current_task_ownership: null,
        consentProof: cp.consent_proof,
        demaHome: home,
        createdAtIso: FIXED_CREATED,
      });
      assert.equal(r.built, false);
      assert.equal(r.error, "agent_class_role_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("no authorship key on disk → built:false, error no_authorship_key", async () => {
    const home = await freshHome();
    try {
      // Do NOT init key.
      const r = await buildAgentProfile({
        ...PAT_DEMA_INPUT,
        consentProof: {
          schema: "bizra.dema.consent_proof.v0.1",
          consent_phrase: "x",
          action_scope: {
            action_type: MUTATE_AGENT_PROFILE_ACTION_TYPE,
            target_hash: "a".repeat(64),
          },
          nonce: "x",
          created_at_iso: FIXED_CREATED,
          expires_at_iso: "2099-01-01T00:00:00.000Z",
          operator_public_key_fingerprint: "a".repeat(64),
          consent_signature_b64: "x",
          consent_proof_hash: "a".repeat(64),
        },
        demaHome: home,
        createdAtIso: FIXED_CREATED,
      });
      assert.equal(r.built, false);
      assert.equal(r.error, "no_authorship_key");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});

describe("agent-profile-registry · freezing (DOD-5)", () => {
  it("DOD-5 returned envelope is deep-frozen — top, nested arrays, profile", async () => {
    const { home, result } = await buildPatDemaOk({
      skills: ["s1", "s2"],
      service_catalog: ["svc.a"],
      proof_references: ["rref1"],
      failure_patterns: ["fp1"],
    });
    try {
      assert.ok(Object.isFrozen(result));
      assert.ok(Object.isFrozen(result.profile));
      assert.ok(Object.isFrozen(result.profile.skills));
      assert.ok(Object.isFrozen(result.profile.service_catalog));
      assert.ok(Object.isFrozen(result.profile.proof_references));
      assert.ok(Object.isFrozen(result.profile.failure_patterns));
      // Mutation attempts should not change profile_proof_hash.
      const beforeHash = result.profile.profile_proof_hash;
      // attempt mutation
      try {
        result.profile.xp = 999;
      } catch {
        /* strict mode throws — acceptable */
      }
      assert.equal(result.profile.profile_proof_hash, beforeHash);
      assert.equal(result.profile.xp, 0);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});

describe("agent-profile-registry · no key leak (DOD-6)", () => {
  it("DOD-6 returned envelope contains NO private-key material", async () => {
    const { home, result } = await buildPatDemaOk();
    try {
      const envStr = JSON.stringify(result);
      assert.ok(
        !envStr.includes("BEGIN PRIVATE KEY"),
        "envelope must not contain BEGIN PRIVATE KEY marker",
      );
      assert.ok(
        !envStr.includes("PRIVATE KEY"),
        "envelope must not contain any PRIVATE KEY marker",
      );
      assert.equal(result.profile.private_key, undefined);
      assert.equal(result.profile.private_key_pem, undefined);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});

describe("agent-profile-registry · verifyAgentProfile (DOD-7)", () => {
  it("DOD-7 happy: verify with matching external pubkey → verified:true", async () => {
    const { home, result } = await buildPatDemaOk();
    try {
      const v = verifyAgentProfile({
        profile: result.profile,
        pubkeyPem: result.signer_public_key_pem,
      });
      assert.equal(v.verified, true);
      assert.equal(v.profile_proof_hash, result.profile.profile_proof_hash);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("tampered xp only (without re-sign) → profile_proof_hash_mismatch", async () => {
    const { home, result } = await buildPatDemaOk();
    try {
      const tampered = { ...result.profile, xp: 9999 };
      const v = verifyAgentProfile({
        profile: tampered,
        pubkeyPem: result.signer_public_key_pem,
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "profile_proof_hash_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("tampered body re-hashed but signature unchanged → profile_signature_invalid", async () => {
    const { home, result } = await buildPatDemaOk();
    try {
      const {
        profile_signature_b64: _s,
        profile_proof_hash: _h,
        ...stableBody
      } = result.profile;
      const tamperedStable = { ...stableBody, xp: 9999 };
      const rehash = sha256(stableStringify(tamperedStable));
      const tampered = {
        ...tamperedStable,
        profile_signature_b64: result.profile.profile_signature_b64,
        profile_proof_hash: rehash,
      };
      const v = verifyAgentProfile({
        profile: tampered,
        pubkeyPem: result.signer_public_key_pem,
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "profile_signature_invalid");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("wrong external pubkey → profile_signature_invalid", async () => {
    const { home, result } = await buildPatDemaOk();
    try {
      const wrongKey = generateEd25519Keypair();
      const v = verifyAgentProfile({
        profile: result.profile,
        pubkeyPem: wrongKey.public_key_pem,
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "profile_signature_invalid");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("verify rejects unknown role even if signature valid → unknown_agent_role", async () => {
    // An attacker (with operator key) crafts a body with an unknown role,
    // signs it cleanly. The verifier must still reject — role canonicality
    // is enforced at verification per preflight §5 step 3.
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      // Hand-craft a properly-signed envelope for a non-canonical role.
      const { loadPrivateKey, loadPublicKey } =
        await import("../packages/receipts/src/authorship-key-store.js");
      const { signPayload } =
        await import("../packages/receipts/src/authorship-signature.js");
      const priv = await loadPrivateKey(home);
      const pub = await loadPublicKey(home);
      const stableIdentity = {
        schema: AGENT_PROFILE_SCHEMA,
        agent_id: "ghost.x",
        agent_class: "PAT",
        agent_role: "GhostAgent",
        created_at_iso: FIXED_CREATED,
      };
      const stable_profile_hash = sha256(stableStringify(stableIdentity));
      const body = {
        schema: AGENT_PROFILE_SCHEMA,
        agent_id: "ghost.x",
        agent_class: "PAT",
        agent_role: "GhostAgent",
        stable_profile_hash,
        skills: [],
        xp: 0,
        wallet_id: "",
        service_catalog: [],
        memory_log_path: "agents/ghost.x/memory.log",
        event_log_path: "agents/ghost.x/events.log",
        proof_references: [],
        failure_patterns: [],
        performance_contribution_score: 0,
        current_task_ownership: null,
        created_at_iso: FIXED_CREATED,
      };
      const sig = signPayload(body, priv);
      const profile_proof_hash = sha256(stableStringify(body));
      const profile = {
        ...body,
        profile_signature_b64: sig,
        profile_proof_hash,
      };
      const v = verifyAgentProfile({ profile, pubkeyPem: pub });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "unknown_agent_role");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("verify rejects class/role mismatch even if signature valid → agent_class_role_mismatch", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const { loadPrivateKey, loadPublicKey } =
        await import("../packages/receipts/src/authorship-key-store.js");
      const { signPayload } =
        await import("../packages/receipts/src/authorship-signature.js");
      const priv = await loadPrivateKey(home);
      const pub = await loadPublicKey(home);
      const stableIdentity = {
        schema: AGENT_PROFILE_SCHEMA,
        agent_id: "pat.verifier",
        agent_class: "PAT",
        agent_role: "Verifier",
        created_at_iso: FIXED_CREATED,
      };
      const stable_profile_hash = sha256(stableStringify(stableIdentity));
      const body = {
        schema: AGENT_PROFILE_SCHEMA,
        agent_id: "pat.verifier",
        agent_class: "PAT",
        agent_role: "Verifier",
        stable_profile_hash,
        skills: [],
        xp: 0,
        wallet_id: "",
        service_catalog: [],
        memory_log_path: "agents/pat.verifier/memory.log",
        event_log_path: "agents/pat.verifier/events.log",
        proof_references: [],
        failure_patterns: [],
        performance_contribution_score: 0,
        current_task_ownership: null,
        created_at_iso: FIXED_CREATED,
      };
      const sig = signPayload(body, priv);
      const profile_proof_hash = sha256(stableStringify(body));
      const profile = {
        ...body,
        profile_signature_b64: sig,
        profile_proof_hash,
      };
      const v = verifyAgentProfile({ profile, pubkeyPem: pub });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "agent_class_role_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("stable_profile_hash recomputed mismatch → stable_identity_mismatch", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const { loadPrivateKey, loadPublicKey } =
        await import("../packages/receipts/src/authorship-key-store.js");
      const { signPayload } =
        await import("../packages/receipts/src/authorship-signature.js");
      const priv = await loadPrivateKey(home);
      const pub = await loadPublicKey(home);
      // Body carries a bogus stable_profile_hash that does NOT match
      // the identity fields, yet body+sig+proof_hash are otherwise valid.
      const body = {
        schema: AGENT_PROFILE_SCHEMA,
        agent_id: "pat.dema",
        agent_class: "PAT",
        agent_role: "Dema",
        stable_profile_hash: "b".repeat(64),
        skills: [],
        xp: 0,
        wallet_id: "",
        service_catalog: [],
        memory_log_path: "agents/pat.dema/memory.log",
        event_log_path: "agents/pat.dema/events.log",
        proof_references: [],
        failure_patterns: [],
        performance_contribution_score: 0,
        current_task_ownership: null,
        created_at_iso: FIXED_CREATED,
      };
      const sig = signPayload(body, priv);
      const profile_proof_hash = sha256(stableStringify(body));
      const profile = {
        ...body,
        profile_signature_b64: sig,
        profile_proof_hash,
      };
      const v = verifyAgentProfile({ profile, pubkeyPem: pub });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "stable_identity_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("empty pubkey → external_pubkey_required", async () => {
    const { home, result } = await buildPatDemaOk();
    try {
      const v = verifyAgentProfile({
        profile: result.profile,
        pubkeyPem: "",
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "external_pubkey_required");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("wrong schema → agent_profile_schema_mismatch", async () => {
    const { home, result } = await buildPatDemaOk();
    try {
      const broken = { ...result.profile, schema: "not.real.v0.1" };
      const v = verifyAgentProfile({
        profile: broken,
        pubkeyPem: result.signer_public_key_pem,
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "agent_profile_schema_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});

describe("agent-profile-registry · reuse + content-address (DOD-8)", () => {
  it("DOD-8 stable_profile_hash equals sha256 of identity body only", async () => {
    const { home, result } = await buildPatDemaOk();
    try {
      const recomputed = sha256(
        stableStringify({
          schema: AGENT_PROFILE_SCHEMA,
          agent_id: "pat.dema",
          agent_class: "PAT",
          agent_role: "Dema",
          created_at_iso: FIXED_CREATED,
        }),
      );
      assert.equal(result.profile.stable_profile_hash, recomputed);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-8 profile_proof_hash recomputes from body excluding signature + proof_hash", async () => {
    const { home, result } = await buildPatDemaOk();
    try {
      const {
        profile_signature_b64: _s,
        profile_proof_hash: _h,
        ...stableBody
      } = result.profile;
      const recomputed = sha256(stableStringify(stableBody));
      assert.equal(recomputed, result.profile.profile_proof_hash);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("two profiles for same identity at different times share stable_profile_hash but differ in profile_proof_hash when other state differs", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      // Version A: empty proof refs.
      const inputA = { ...PAT_DEMA_INPUT };
      const projectedA = projectedProfileBody({
        ...inputA,
        created_at_iso: FIXED_CREATED,
      });
      const cpA = await buildMutationConsent({
        home,
        projectedBody: projectedA,
      });
      const a = await buildAgentProfile({
        ...inputA,
        consentProof: cpA.consent_proof,
        demaHome: home,
        createdAtIso: FIXED_CREATED,
      });
      // Version B: same identity, with one proof reference + xp=10.
      const inputB = {
        ...PAT_DEMA_INPUT,
        proof_references: ["receipt.aaa"],
        xp: 10,
      };
      const projectedB = projectedProfileBody({
        ...inputB,
        created_at_iso: FIXED_CREATED,
      });
      const cpB = await buildMutationConsent({
        home,
        projectedBody: projectedB,
      });
      const b = await buildAgentProfile({
        ...inputB,
        consentProof: cpB.consent_proof,
        demaHome: home,
        createdAtIso: FIXED_CREATED,
      });
      assert.equal(a.built, true);
      assert.equal(b.built, true);
      assert.equal(
        a.profile.stable_profile_hash,
        b.profile.stable_profile_hash,
        "same identity should share stable_profile_hash",
      );
      assert.notEqual(
        a.profile.profile_proof_hash,
        b.profile.profile_proof_hash,
        "different mutable state should produce different profile_proof_hash",
      );
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});
