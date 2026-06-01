// COLLECTOR-1A · Block0 prerequisite status collector.
//
// Turns the Block0 `prerequisiteStatusMap` (the input verifyBlock0Manifest
// judges sealability from) from a HAND-ASSERTED claim into a DERIVED fact — but
// only for the slots whose genesis producers can actually be run + verified
// locally: node0_identity, urp_resource_status, dema_realm_state.
//
// For each provided proof, the collector runs the matching pure verifier under
// the EXTERNAL operator pubkey and marks the slot PRODUCER_LIVE iff
// verified:true, else NAMED_ONLY (carrying the verifier's reason). It returns
// ONLY the slots it was given — it NEVER asserts a slot it did not verify, and
// it NEVER scans the repo. The remaining 9 Block0 slots are out of scope and are
// omitted, so a downstream verifyBlock0Manifest still treats them as NAMED_ONLY
// (not sealable) — the honest posture: capable ≠ wired ≠ sealable.
//
// Pure: no key load, no clock, no network, no write.

import { verifyNode0IdentityProof } from "./node0-identity-proof.js";
import { verifyUrpResourceStatusProof } from "./urp-resource-status-proof.js";
import { verifyDemaRealmStateProof } from "./dema-realm-state-proof.js";
import { BLOCK0_PREREQUISITE_SLOTS } from "./block0-manifest-verifier.js";
import { verifyBaseline } from "../../perf/src/perf-baseline.js";
import { verifyLesson } from "../../learn/src/how-lesson-writer.js";
import {
  verifyAgentProfile,
  CANONICAL_AGENTS,
} from "../../agents/src/agent-profile-registry.js";

export const BLOCK0_PREREQUISITE_STATUS_COLLECTION_SCHEMA =
  "bizra.dema.block0_prerequisite_status_collection.v0.1";

const CANONICAL_PAT = Object.freeze(
  CANONICAL_AGENTS.filter((a) => a.agent_class === "PAT").map(
    (a) => a.agent_id,
  ),
);
const CANONICAL_SAT = Object.freeze(
  CANONICAL_AGENTS.filter((a) => a.agent_class === "SAT").map(
    (a) => a.agent_id,
  ),
);

// COLLECTOR-2A/2B · uniform slot-verifier adapter interface.
//
// Each Block0 slot maps to an adapter with a `kind`:
//   - kind:"scalar_hash" → { verify, proofHashField }. verify is a uniform
//     ({proof, operatorPubkeyPem}) → {verified, reason?} wrapper over the slot's
//     real external-pubkey verifier (native genesis drop-in; domain verifiers
//     adapted inline). proofHashField is the field the manifest commits (the
//     judge binds manifest[slot] === proof[proofHashField]).
//   - kind:"hash_list" → { canonicalIds }. proofs[slot] is an ARRAY of signed
//     agent profiles; the collector verifies each, enforces roster completeness
//     (exactly canonicalIds, distinct, no extras), and emits proof_hashes in
//     canonical order. The judge binds manifest[slot] (array) === proof_hashes.
//
// Only slots present here are collectable; any other key fails closed.
export const SLOT_ADAPTERS = Object.freeze({
  node0_identity_proof_hash: {
    kind: "scalar_hash",
    verify: verifyNode0IdentityProof,
    proofHashField: "node0_identity_proof_hash",
  },
  urp_resource_status_proof_hash: {
    kind: "scalar_hash",
    verify: verifyUrpResourceStatusProof,
    proofHashField: "urp_resource_status_proof_hash",
  },
  dema_realm_state_proof_hash: {
    kind: "scalar_hash",
    verify: verifyDemaRealmStateProof,
    proofHashField: "dema_realm_state_proof_hash",
  },
  performance_baseline_proof_hash: {
    kind: "scalar_hash",
    verify: ({ proof, operatorPubkeyPem }) =>
      verifyBaseline({ baseline: proof, pubkeyPem: operatorPubkeyPem }),
    proofHashField: "baseline_proof_hash",
  },
  house_of_wisdom_first_lesson_proof_hash: {
    kind: "scalar_hash",
    verify: ({ proof, operatorPubkeyPem }) =>
      verifyLesson({ lesson: proof, pubkeyPem: operatorPubkeyPem }),
    proofHashField: "lesson_proof_hash",
  },
  pat_profile_proof_hashes: {
    kind: "hash_list",
    canonicalIds: CANONICAL_PAT,
  },
  sat_profile_proof_hashes: {
    kind: "hash_list",
    canonicalIds: CANONICAL_SAT,
  },
});

function isPlainObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// Order-sensitive string-array equality (zero-dependency). Used by the judge to
// bind a manifest hash array against the collected canonical-ordered array.
export function sameStringArray(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

// Verify a list of signed agent profiles, enforce EXACT canonical roster
// coverage (every canonicalId present once, no missing/dup/extra), and return
// profile_proof_hashes ordered by canonicalIds. Pure (external pubkey only).
// STATIC profile-list proof ONLY — proves canonical presence + signature +
// roster completeness; proves NOTHING about runtime isolation/authority.
export function collectCanonicalProfileList({
  profiles,
  canonicalIds,
  operatorPubkeyPem,
}) {
  if (!Array.isArray(profiles)) {
    return { verified: false, reason: "profile_list_not_array" };
  }
  if (profiles.length !== canonicalIds.length) {
    return { verified: false, reason: "profile_count_mismatch" };
  }
  const byId = new Map();
  for (const profile of profiles) {
    const result = verifyAgentProfile({
      profile,
      pubkeyPem: operatorPubkeyPem,
    });
    if (result.verified !== true) {
      return { verified: false, reason: `profile_${result.reason}` };
    }
    if (!canonicalIds.includes(result.agent_id)) {
      return { verified: false, reason: "unexpected_agent_in_roster" };
    }
    if (byId.has(result.agent_id)) {
      return { verified: false, reason: "duplicate_agent_in_roster" };
    }
    byId.set(result.agent_id, result.profile_proof_hash);
  }
  // Roster completeness: every canonical agent present (count + no-dup + no-extra
  // already guarantee this, but assert explicitly for fail-closed clarity).
  for (const id of canonicalIds) {
    if (!byId.has(id)) return { verified: false, reason: "roster_incomplete" };
  }
  return {
    verified: true,
    proof_hashes: canonicalIds.map((id) => byId.get(id)),
  };
}

function fail(error) {
  return Object.freeze({
    schema: BLOCK0_PREREQUISITE_STATUS_COLLECTION_SCHEMA,
    collected: false,
    truth_label: "BLOCK0_PREREQUISITE_STATUS_COLLECTION_REFUSED",
    error,
  });
}

/**
 * Collect a Block0 prerequisite status map from real producer proofs. Pure.
 *
 * @param {object} proofs - slot-name → producer proof (only the 3 collectable
 *   genesis slots are accepted; any other key fails closed).
 * @param {string} operatorPubkeyPem - external operator pubkey (authority).
 * @returns frozen collection envelope. status_map[slot] is "PRODUCER_LIVE" only
 *   when the matching verifier returned verified:true; otherwise "NAMED_ONLY".
 */
export function collectBlock0PrerequisiteStatus({
  proofs,
  operatorPubkeyPem,
} = {}) {
  if (!isPlainObject(proofs)) return fail("proofs_required");
  if (
    typeof operatorPubkeyPem !== "string" ||
    !operatorPubkeyPem.includes("BEGIN PUBLIC KEY")
  ) {
    return fail("external_pubkey_required");
  }
  // Exact slot vocabulary — never collect a proof into an unknown/foreign slot.
  for (const slot of Object.keys(proofs)) {
    if (!Object.prototype.hasOwnProperty.call(SLOT_ADAPTERS, slot)) {
      return fail("unexpected_proof_slot");
    }
  }

  const status_map = {};
  const slot_verification = {};
  let producer_live_count = 0;
  let provided_slot_count = 0;

  for (const slot of Object.keys(SLOT_ADAPTERS)) {
    if (!Object.prototype.hasOwnProperty.call(proofs, slot)) continue;
    provided_slot_count += 1;
    const adapter = SLOT_ADAPTERS[slot];

    let verified;
    let verification;
    if (adapter.kind === "hash_list") {
      // proofs[slot] is an ARRAY of signed profiles; verify + roster-complete.
      const result = collectCanonicalProfileList({
        profiles: proofs[slot],
        canonicalIds: adapter.canonicalIds,
        operatorPubkeyPem,
      });
      verified = result.verified === true;
      verification = verified
        ? {
            verified: true,
            proof_hashes: Object.freeze([...result.proof_hashes]),
          }
        : { verified: false, reason: result.reason };
    } else {
      // scalar_hash: single proof object through the slot's verifier.
      const result = adapter.verify({ proof: proofs[slot], operatorPubkeyPem });
      verified = result.verified === true;
      verification = verified
        ? { verified: true }
        : { verified: false, reason: result.reason };
    }

    // A status mark is ONLY ever set from a real verification result. There is
    // no path that asserts PRODUCER_LIVE without verified:true.
    status_map[slot] = verified ? "PRODUCER_LIVE" : "NAMED_ONLY";
    slot_verification[slot] = Object.freeze(verification);
    if (verified) producer_live_count += 1;
  }

  return Object.freeze({
    schema: BLOCK0_PREREQUISITE_STATUS_COLLECTION_SCHEMA,
    collected: true,
    truth_label: "BLOCK0_PREREQUISITE_STATUS_COLLECTED",
    status_map: Object.freeze(status_map),
    slot_verification: Object.freeze(slot_verification),
    producer_live_count,
    provided_slot_count,
    of_total: BLOCK0_PREREQUISITE_SLOTS.length,
    boundary: Object.freeze({
      repo_scanned: false,
      status_asserted_without_verification: false,
      private_key_loaded: false,
      network_used: false,
      federation_used: false,
    }),
    what_this_proves: Object.freeze([
      "Each PRODUCER_LIVE slot is backed by a real verify roundtrip under the external pubkey.",
    ]),
    what_this_does_not_prove: Object.freeze([
      "The 9 non-collectable Block0 slots are NOT covered; Block0 is not sealable from this map alone.",
    ]),
  });
}
