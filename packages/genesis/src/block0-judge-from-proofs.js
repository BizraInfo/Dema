// COLLECTOR-1B · judge Block0 sealability from real producer proofs.
//
// The end-to-end honest chain that COLLECTOR-1A's derived status map enables:
//
//   proofs -> collectBlock0PrerequisiteStatus (verify) -> per-slot manifest
//   hash-bind -> verifyBlock0Manifest (judge).
//
// It NEVER asserts the 9 non-collectable slots — they are absent from the judged
// status map, so verifyBlock0Manifest treats them as NAMED_ONLY and the result
// is ALWAYS sealable:false today (capable != wired != sealable). A full seal
// needs producers for the other slots; this slice only proves the derived 3
// flow honestly into the judge.
//
// The hash-bind closes the trust gap COLLECTOR-1A left open: a slot is marked
// PRODUCER_LIVE in the judged map only if BOTH (a) its proof verified, AND
// (b) the proof's own proof_hash equals the hash the manifest committed for that
// slot. Without (b) a valid-but-different proof could back a slot the manifest
// never referenced.
//
// Pure: no key load, no clock, no network, no write, no repo scan.

import { collectBlock0PrerequisiteStatus } from "./block0-prerequisite-status-collector.js";
import { verifyBlock0Manifest } from "./block0-manifest-verifier.js";

export const BLOCK0_JUDGED_FROM_PROOFS_SCHEMA =
  "bizra.dema.block0_judged_from_proofs.v0.1";

// For the 3 collectable slots, the proof's self-declared proof_hash field name
// is identical to the slot name (verified in the producers), so the manifest
// bind is manifest[slot] === proof[slot].
const COLLECTABLE_SLOTS = Object.freeze([
  "node0_identity_proof_hash",
  "urp_resource_status_proof_hash",
  "dema_realm_state_proof_hash",
]);

function isPlainObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function fail(error, stage) {
  return Object.freeze({
    schema: BLOCK0_JUDGED_FROM_PROOFS_SCHEMA,
    judged: false,
    truth_label: "BLOCK0_JUDGE_FROM_PROOFS_REFUSED",
    stage,
    error,
  });
}

/**
 * Judge Block0 sealability directly from producer proofs. Pure.
 *
 * @param {object} manifest - the signed Block0 manifest.
 * @param {string} operatorPubkeyPem - external operator pubkey (authority).
 * @param {object} proofs - slot-name → producer proof (the 3 collectable slots).
 * @returns frozen envelope: collection + per-slot bind + judged status map +
 *   the verifyBlock0Manifest verdict. sealable is true only when the judge says
 *   so (impossible from 3 slots alone — honest by construction).
 */
export function judgeBlock0FromProofs({
  manifest,
  operatorPubkeyPem,
  proofs,
} = {}) {
  // ── 1. Collect: verify each provided proof under the external pubkey. ──
  const collection = collectBlock0PrerequisiteStatus({
    proofs,
    operatorPubkeyPem,
  });
  if (!collection.collected) return fail(collection.error, "collect");

  // ── 2. Per-slot manifest hash-bind. A slot stays PRODUCER_LIVE only if it
  //       verified AND the manifest committed this exact proof's proof_hash. ──
  const slot_binding = {};
  const judged_status_map = {};
  let bound_live_count = 0;
  for (const slot of COLLECTABLE_SLOTS) {
    if (collection.status_map[slot] !== "PRODUCER_LIVE") {
      if (Object.prototype.hasOwnProperty.call(collection.status_map, slot)) {
        slot_binding[slot] = Object.freeze({
          bound: false,
          reason: "not_producer_live",
        });
        judged_status_map[slot] = "NAMED_ONLY";
      }
      continue;
    }
    const manifestHash = isPlainObject(manifest) ? manifest[slot] : undefined;
    const proofHash = proofs[slot]?.[slot];
    if (manifestHash !== undefined && manifestHash === proofHash) {
      slot_binding[slot] = Object.freeze({ bound: true });
      judged_status_map[slot] = "PRODUCER_LIVE";
      bound_live_count += 1;
    } else {
      slot_binding[slot] = Object.freeze({
        bound: false,
        reason: "manifest_hash_mismatch",
      });
      judged_status_map[slot] = "NAMED_ONLY";
    }
  }

  // ── 3. Judge: the manifest's own validity + sealability from the DERIVED map.
  //       The other 9 slots are absent → NAMED_ONLY → never sealable today. ──
  const verification = verifyBlock0Manifest({
    manifest,
    operatorPubkeyPem,
    prerequisiteStatusMap: judged_status_map,
  });

  return Object.freeze({
    schema: BLOCK0_JUDGED_FROM_PROOFS_SCHEMA,
    judged: true,
    truth_label: "BLOCK0_JUDGED_FROM_PROOFS",
    collection,
    slot_binding: Object.freeze(slot_binding),
    judged_status_map: Object.freeze(judged_status_map),
    bound_live_count,
    verification,
    sealable: verification.verified === true && verification.sealable === true,
    boundary: Object.freeze({
      repo_scanned: false,
      asserted_slot_marked_live: false,
      private_key_loaded: false,
      network_used: false,
      federation_used: false,
    }),
    what_this_proves: Object.freeze([
      "Each judged PRODUCER_LIVE slot both verified AND matches the manifest-committed hash.",
    ]),
    what_this_does_not_prove: Object.freeze([
      "The 9 non-collectable slots are absent; Block0 is NOT sealable from this chain alone.",
    ]),
  });
}
