// AGENT-PROFILE-1A · Static 12-Agent Civilization Registry kernel.
//
// Turns nominal agent identity from a decorative string into a signed,
// content-addressed envelope. Each profile binds:
//   - stable identity (schema + agent_id + agent_class + agent_role +
//     created_at_iso) via `stable_profile_hash`
//   - mutable state (skills, xp, wallet_id, service_catalog,
//     proof_references, failure_patterns, performance_contribution_score,
//     current_task_ownership, memory_log_path, event_log_path) via
//     `profile_proof_hash` (the content address of the full snapshot)
//   - operator-key authority via `profile_signature_b64`.
//
// Two profiles for the same agent at two points in time share
// `stable_profile_hash` but differ in `profile_proof_hash` whenever any
// mutable field differs.
//
// Reuses (no duplication):
// - signPayload, verifyPayload         packages/receipts/src/authorship-signature.js
// - loadActiveKeyPair      packages/receipts/src/authorship-key-store.js
// - sha256, stableStringify            packages/consent/src/consent-common.js
// - verifyConsentProof                 packages/receipts/src/consent-proof.js
//
// Scope (this slice — per preflight §6 + §9 + task contract):
// - Pure kernel functions only. No CLI surface. No wallet integration
//   (AGENT-WALLET-1A). No skill aggregation (AGENT-SKILL-1A). No
//   autonomous agent execution. No federation. No public identity. No
//   agent payments. Local Node0 only.
// - Output is deep-frozen.
// - Failure shape matches consent_proof: { built: false, error }.

import {
  signPayload,
  verifyPayload,
} from "../../receipts/src/authorship-signature.js";
import {
  loadActiveKeyPair,
} from "../../receipts/src/authorship-key-store.js";
import { verifyConsentProof } from "../../receipts/src/consent-proof.js";
import { sha256, stableStringify } from "../../consent/src/consent-common.js";

export const AGENT_PROFILE_SCHEMA = "bizra.dema.agent_profile.v0.1";
export const MUTATE_AGENT_PROFILE_ACTION_TYPE = "MUTATE_AGENT_PROFILE";

// ── Canonical 12-agent registry (preflight §2) ────────────────────────
// PAT-7 (user-serving) + SAT-5 (system-serving). Any role outside this
// frozen set is `unknown_agent_role`. Any class/role mismatch is
// `agent_class_role_mismatch`. Deterministic order: PAT first (in
// preflight order: Dema, Guardian, Reasoner, Builder, Critic, Archivist,
// Teacher) then SAT (Verifier, Compliance, Resource, Economist, Evolution).

const PAT_ROLES = Object.freeze([
  "Dema",
  "Guardian",
  "Reasoner",
  "Builder",
  "Critic",
  "Archivist",
  "Teacher",
]);

const SAT_ROLES = Object.freeze([
  "Verifier",
  "Compliance",
  "Resource",
  "Economist",
  "Evolution",
]);

function makeCanonicalAgent(agent_class, agent_role) {
  return Object.freeze({
    agent_id: `${agent_class.toLowerCase()}.${agent_role.toLowerCase()}`,
    agent_class,
    agent_role,
  });
}

export const CANONICAL_AGENTS = Object.freeze([
  ...PAT_ROLES.map((r) => makeCanonicalAgent("PAT", r)),
  ...SAT_ROLES.map((r) => makeCanonicalAgent("SAT", r)),
]);

const ROLE_TO_CLASS = Object.freeze(
  Object.fromEntries([
    ...PAT_ROLES.map((r) => [r, "PAT"]),
    ...SAT_ROLES.map((r) => [r, "SAT"]),
  ]),
);

// ── Required fields for verifyAgentProfile structural check ───────────
const REQUIRED_FIELDS = Object.freeze([
  "schema",
  "agent_id",
  "agent_class",
  "agent_role",
  "stable_profile_hash",
  "skills",
  "xp",
  "wallet_id",
  "service_catalog",
  "memory_log_path",
  "event_log_path",
  "proof_references",
  "failure_patterns",
  "performance_contribution_score",
  "current_task_ownership",
  "created_at_iso",
  "profile_signature_b64",
  "profile_proof_hash",
]);

function fail(error) {
  return Object.freeze({ built: false, error });
}

function reject(reason) {
  return Object.freeze({ verified: false, rejected: true, reason });
}

// Recursive freeze: top-level + nested arrays + nested objects. Strings
// and numbers are immutable primitives; arrays of strings become frozen
// arrays; objects become frozen objects.
function deepFreeze(value) {
  if (value === null || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;
  if (Array.isArray(value)) {
    for (const v of value) deepFreeze(v);
    return Object.freeze(value);
  }
  for (const k of Object.keys(value)) {
    deepFreeze(value[k]);
  }
  return Object.freeze(value);
}

// Compute the stable identity hash — covers ONLY immutable identity
// fields (schema + agent_id + agent_class + agent_role + created_at_iso).
// Two profile versions for the same identity at two times share this.
function computeStableProfileHash({
  agent_id,
  agent_class,
  agent_role,
  created_at_iso,
}) {
  return sha256(
    stableStringify({
      schema: AGENT_PROFILE_SCHEMA,
      agent_id,
      agent_class,
      agent_role,
      created_at_iso,
    }),
  );
}

// Build the canonical profile body the kernel signs and hashes. Field
// order is irrelevant for the hash (stableStringify sorts keys) but the
// shape must be IDENTICAL between buildAgentProfile (when shaping for
// consent target_hash) and the eventual signed body. The body excludes
// profile_signature_b64 and profile_proof_hash by construction.
function buildProfileBody({
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
}) {
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

// ── buildAgentProfile (kernel) ────────────────────────────────────────
//
// Fail-closed gates, in order:
//   (1) unknown_agent_role            — role not in canonical 12-set
//   (2) agent_class_role_mismatch     — class does not match role's class
//   (3) consent_proof_required        — missing consent envelope
//   (4) no_authorship_key             — no operator key on disk
//   (5) consent verification          — KEYCONSENT-1A verify with the
//       operator's pubkey + expectedActionScope = MUTATE_AGENT_PROFILE,
//       target_hash = sha256(stableStringify(projected profile body)).
//       Mismatches surface as consent_scope_mismatch /
//       consent_signature_invalid / consent_expired / etc.
//
// On success: signs the body, computes content-address, returns a deeply
// frozen envelope of shape:
//   { built:true, profile, signer_public_key_pem }
// where `profile` = body ∪ { profile_signature_b64, profile_proof_hash }.

export async function buildAgentProfile({
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
  consentProof,
  demaHome,
  createdAtIso,
}) {
  // (1) Role canonicality.
  if (!ROLE_TO_CLASS[agent_role]) {
    return fail("unknown_agent_role");
  }

  // (2) Class/role binding (preflight §5 step 3).
  if (ROLE_TO_CLASS[agent_role] !== agent_class) {
    return fail("agent_class_role_mismatch");
  }

  // (3) Consent proof mandatory (preflight §3 + §4: profile mutation is
  // consent-gated reusing KEYCONSENT-1A).
  if (!consentProof || typeof consentProof !== "object") {
    return fail("consent_proof_required");
  }

  // (4) Load operator key — same disk-load discipline as consent_proof.
  const activePair = await loadActiveKeyPair(demaHome);
  const privateKeyPem = activePair.ok ? activePair.private_key_pem : null;
  if (!privateKeyPem) {
    return fail("no_authorship_key");
  }
  const publicKeyPem = activePair.ok ? activePair.public_key_pem : null;

  // Resolve created_at_iso BEFORE projecting the body so target_hash is
  // stable between consent (built by caller) and projection (here).
  const created_at_iso = createdAtIso || new Date().toISOString();

  // Project the body the kernel WILL sign. Caller built consent against
  // this exact projected shape; if they didn't, consent verification
  // surfaces a consent_scope_mismatch (target_hash differs).
  const stable_profile_hash = computeStableProfileHash({
    agent_id,
    agent_class,
    agent_role,
    created_at_iso,
  });
  const projectedBody = buildProfileBody({
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
  });
  const target_hash = sha256(stableStringify(projectedBody));

  // (5) Verify consent proof — uses ONLY the operator's pubkey loaded
  // from disk as the external authority; consent's own embedded
  // fingerprint is NOT trusted for identity (same invariant as verdict-
  // attest). Scope match enforces action_type AND target_hash binding.
  const consentVerify = verifyConsentProof({
    consentProof,
    pubkeyPem: publicKeyPem,
    expectedActionScope: {
      action_type: MUTATE_AGENT_PROFILE_ACTION_TYPE,
      target_hash,
    },
    // Check consent freshness as of the act's own timestamp (deterministic),
    // not whenever the verifier runs (wall-clock → flaky). Matches block0.
    now: createdAtIso || new Date().toISOString(),
  });
  if (!consentVerify.verified) {
    // Surface scope mismatch as the contract error name, signature/expiry
    // as the proof prefix.
    if (consentVerify.reason === "consent_scope_mismatch") {
      return fail("consent_scope_mismatch");
    }
    return fail(`consent_proof_${consentVerify.reason}`);
  }

  // Sign the body. signPayload is deterministic for Ed25519 — identical
  // body bytes produce identical signatures.
  const signature = signPayload(projectedBody, privateKeyPem);
  const profile_proof_hash = sha256(stableStringify(projectedBody));

  const profile = deepFreeze({
    ...projectedBody,
    // Re-freeze nested arrays defensively (deepFreeze handles it, but
    // making the array references explicit at the field-level surface
    // helps future readers + the DOD-5 freeze test).
    skills: Object.freeze([...projectedBody.skills]),
    service_catalog: Object.freeze([...projectedBody.service_catalog]),
    proof_references: Object.freeze([...projectedBody.proof_references]),
    failure_patterns: Object.freeze([...projectedBody.failure_patterns]),
    profile_signature_b64: signature,
    profile_proof_hash,
  });

  return deepFreeze({
    built: true,
    profile,
    signer_public_key_pem: publicKeyPem,
  });
}

// ── verifyAgentProfile (permissionless verifier) ──────────────────────
//
// Per preflight §5 (steps 1, 2, 3, 6). Step 4 (proof_reference
// resolution) + step 5 (XP aggregation) are receipt-store-dependent and
// belong to a later slice (`verifyAgentProfileAgainstReceipts` or
// equivalent); the pure kernel stays receipt-store-free.
//
// Fail-closed cases:
//   - structural validation       — agent_profile_schema_mismatch
//                                  / structural_missing_field_<name>
//                                  / external_pubkey_required
//   - role canonicality (step 3) — unknown_agent_role
//   - class/role match  (step 3) — agent_class_role_mismatch
//   - content-address (step 2)   — profile_proof_hash_mismatch
//   - signature (step 1)         — profile_signature_invalid
//   - identity binding (step 6)  — stable_identity_mismatch
//
// External `pubkeyPem` is REQUIRED — the verifier brings its own pubkey
// (same trust invariant as verdict-receipt REJECT-4 / consent_proof
// step 2). Nothing inside the profile is trusted for authority.

export function verifyAgentProfile({ profile, pubkeyPem }) {
  // Structural validation.
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    return reject("agent_profile_missing_or_malformed");
  }
  if (profile.schema !== AGENT_PROFILE_SCHEMA) {
    return reject("agent_profile_schema_mismatch");
  }
  for (const f of REQUIRED_FIELDS) {
    if (profile[f] === undefined || profile[f] === null) {
      // current_task_ownership is explicitly nullable; everything else
      // missing or null is structural.
      if (f === "current_task_ownership" && profile[f] === null) continue;
      return reject(`structural_missing_field_${f}`);
    }
  }
  if (
    typeof pubkeyPem !== "string" ||
    !pubkeyPem.includes("BEGIN PUBLIC KEY")
  ) {
    return reject("external_pubkey_required");
  }

  // (Step 3) Role canonicality.
  if (!ROLE_TO_CLASS[profile.agent_role]) {
    return reject("unknown_agent_role");
  }
  if (ROLE_TO_CLASS[profile.agent_role] !== profile.agent_class) {
    return reject("agent_class_role_mismatch");
  }

  // (Step 2) Recompute profile_proof_hash from body excluding signature
  // + proof_hash fields.
  const { profile_signature_b64, profile_proof_hash, ...stableBody } = profile;
  const recomputedHash = sha256(stableStringify(stableBody));
  if (recomputedHash !== profile_proof_hash) {
    return reject("profile_proof_hash_mismatch");
  }

  // (Step 1) Verify Ed25519 signature using ONLY external pubkey.
  let sigValid;
  try {
    sigValid = verifyPayload(stableBody, profile_signature_b64, pubkeyPem);
  } catch {
    sigValid = false;
  }
  if (!sigValid) {
    return reject("profile_signature_invalid");
  }

  // (Step 6) Stable identity binding.
  const recomputedStable = computeStableProfileHash({
    agent_id: profile.agent_id,
    agent_class: profile.agent_class,
    agent_role: profile.agent_role,
    created_at_iso: profile.created_at_iso,
  });
  if (recomputedStable !== profile.stable_profile_hash) {
    return reject("stable_identity_mismatch");
  }

  return Object.freeze({
    verified: true,
    profile_proof_hash,
    stable_profile_hash: profile.stable_profile_hash,
    agent_id: profile.agent_id,
    agent_class: profile.agent_class,
    agent_role: profile.agent_role,
  });
}
