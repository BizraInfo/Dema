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

export const BLOCK0_PREREQUISITE_STATUS_COLLECTION_SCHEMA =
  "bizra.dema.block0_prerequisite_status_collection.v0.1";

// The only slots with a runnable genesis producer this collector can verify.
// Each maps a slot name → its pure external-pubkey verifier.
const SLOT_VERIFIERS = Object.freeze({
  node0_identity_proof_hash: verifyNode0IdentityProof,
  urp_resource_status_proof_hash: verifyUrpResourceStatusProof,
  dema_realm_state_proof_hash: verifyDemaRealmStateProof,
});

function isPlainObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
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
    if (!Object.prototype.hasOwnProperty.call(SLOT_VERIFIERS, slot)) {
      return fail("unexpected_proof_slot");
    }
  }

  const status_map = {};
  const slot_verification = {};
  let producer_live_count = 0;
  let provided_slot_count = 0;

  for (const slot of Object.keys(SLOT_VERIFIERS)) {
    if (!Object.prototype.hasOwnProperty.call(proofs, slot)) continue;
    provided_slot_count += 1;
    const verify = SLOT_VERIFIERS[slot];
    const result = verify({ proof: proofs[slot], operatorPubkeyPem });
    const verified = result.verified === true;
    // A status mark is ONLY ever set from a real verification result. There is
    // no path that asserts PRODUCER_LIVE without verified:true.
    status_map[slot] = verified ? "PRODUCER_LIVE" : "NAMED_ONLY";
    slot_verification[slot] = Object.freeze(
      verified
        ? { verified: true }
        : { verified: false, reason: result.reason },
    );
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
