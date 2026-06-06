/**
 * URP-5SAT-1A · Node0 5 SAT URP Launch and Lock (declared-only v0).
 *
 * Completes the BIZRA URP launch with *only* the Node0 5 SAT (Guardian, Reasoner, Builder, Critic, Archivist).
 * "Always on active": The launch declares URP active with exactly these 5 SAT.
 * "Lock it": Sets locked:true, manipulators_blocked: ["PAT", "Dema", "Momo"] so the 5 SAT cannot be manipulated by PAT or Dema or Momo.
 *
 * This is the local face declaration / receipt surface. No runtime execution.
 * The 5 SAT are the declared council profiles from UX-1D.
 *
 * [PROTOTYPE] — Launch/lock declaration only. Not a runtime URP activation. Not Node0 execution.
 * [DESIGN] — The lock is advisory in this face; future Node0 runtime will enforce via receipts.
 * [DO NOT CLAIM] — No actual "always on" daemon, no manipulation prevention in running code, no Node1/2.
 *
 * Dema = face only. Local state in DEMA_HOME. Exact consent required to launch/lock.
 * Receipts read/list only.
 */

import { sha256, stableStringify } from "../../consent/src/consent-common.js";

export const NODE0_5SAT_URP_LAUNCH_SCHEMA = "bizra.dema.node0_5sat_urp_launch.v0.1";
export const NODE0_5SAT_URP_LAUNCH_RESULT_SCHEMA =
  "bizra.dema.node0_5sat_urp_launch_result.v0.1";

const FIVE_SAT_PROFILES = Object.freeze([
  "Guardian",
  "Reasoner",
  "Builder",
  "Critic",
  "Archivist",
]);

const FAIL_BOUNDARY = Object.freeze({
  private_key_loaded: false,
  file_write_performed: false,
  raw_artifact_included: false,
  full_receipt_json_included: false,
  personal_memory_included: false,
  network_used: false,
  federation_used: false,
  token_minted: false,
  poi_score_calculated: false,
  economic_claim_made: false,
});

export function buildNode05SatU rpLaunch({ now = new Date() } = {}) {
  const body = Object.freeze({
    schema: NODE0_5SAT_URP_LAUNCH_SCHEMA,
    node0: "declared",
    urp: "launched_with_only_5_sat",
    active_sat: FIVE_SAT_PROFILES,
    always_active: true,
    locked: true,
    manipulators_blocked: Object.freeze(["PAT", "Dema", "Momo"]),
    launched_at_iso: now.toISOString(),
    truth_label: "NODE0_5SAT_URP_LAUNCHED_AND_LOCKED",
    // After launch: Node0 connects via its URP layer.
    // Node1 connects to BIZRA universal resource pool and declares (preview) new 5 SAT.
    // [PREVIEW] for Node1 – declaration is governed runtime outside Dema face.
    connection_rules: Object.freeze({
      node0_connects_via_its_urp_layer: true,
      node1_connects_to_bizra_universal_resource_pool: true,
      node1_declares_new_5_sat: "preview_only_not_minted_in_dema",
    }),
  });

  const launch_hash = sha256(stableStringify(body));

  return Object.freeze({
    schema: NODE0_5SAT_URP_LAUNCH_RESULT_SCHEMA,
    launched: true,
    launch_hash,
    body,
    active_sat_count: FIVE_SAT_PROFILES.length,
    locked: true,
    boundary: FAIL_BOUNDARY, // honest: no write yet, this is build
    truth_label: "NODE0_5SAT_URP_LAUNCHED_AND_LOCKED",
  });
}

export function verifyNode05SatU rpLaunch(launchResult) {
  if (!launchResult || launchResult.schema !== NODE0_5SAT_URP_LAUNCH_RESULT_SCHEMA) {
    return Object.freeze({ verified: false, reason: "wrong_schema" });
  }
  if (!launchResult.launched || !launchResult.locked) {
    return Object.freeze({ verified: false, reason: "not_launched_or_locked" });
  }
  if (!Array.isArray(launchResult.body?.active_sat) || launchResult.body.active_sat.length !== 5) {
    return Object.freeze({ verified: false, reason: "not_exactly_5_sat" });
  }
  // Recompute hash for integrity
  const expectedHash = sha256(stableStringify(launchResult.body));
  if (launchResult.launch_hash !== expectedHash) {
    return Object.freeze({ verified: false, reason: "hash_mismatch" });
  }
  return Object.freeze({
    verified: true,
    launch_hash: launchResult.launch_hash,
    active_sat: launchResult.body.active_sat,
    locked: true,
    manipulators_blocked: launchResult.body.manipulators_blocked,
    truth_label: launchResult.body.truth_label,
    connection_rules: launchResult.body.connection_rules || null,
  });
}

/**
 * Node1 5 SAT preview "mint" declaration (for the universal resource pool connection).
 * [PREVIEW] — Node1 connects to BIZRA universal resource pool and declares new 5 SAT.
 * Not minted in Dema; governed runtime outside.
 */
export function buildNode15SatPreview({ now = new Date() } = {}) {
  const body = Object.freeze({
    schema: "bizra.dema.node1_5sat_preview.v0.1",
    node1: "preview",
    connects_to: "bizra_universal_resource_pool",
    new_5_sat: FIVE_SAT_PROFILES,
    mint: "preview_only_not_minted_in_dema",
    declared_at_iso: now.toISOString(),
    truth_label: "NODE1_5SAT_PREVIEW",
  });
  const preview_hash = sha256(stableStringify(body));
  return Object.freeze({
    schema: "bizra.dema.node1_5sat_preview_result.v0.1",
    preview: true,
    preview_hash,
    body,
    truth_label: "NODE1_5SAT_PREVIEW",
  });
}