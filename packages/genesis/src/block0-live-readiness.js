// BLOCK0-LIVE-READINESS · read-only Block0 seal-ceremony precheck.
//
// Honest finding this kernel encodes (verified against the producers
// 2026-06-04): a Block0 seal is intrinsically a SIGNING ceremony. Eleven of the
// twelve prerequisite slots require the operator's PRIVATE Ed25519 key to
// PRODUCE their signed proof (each producer calls loadActiveKeyPair + signPayload).
// Only `poi_rule` is verifier-only (a canonical rule-identity recognition, no
// signing). So there is NO read-only path to a real 12/12 sealable verdict —
// producing the proofs IS the operator-only ceremony.
//
// This assessor therefore does the only honest read-only thing: it reports what
// the ceremony will require from the live home — operator pubkey presence, the
// one slot verifiable now (poi_rule, reusing the real collector path), and the
// per-slot signing requirement. It NEVER loads the private key, signs,
// produces a proof, persists, or seals.
//
// Reuses (no new crypto, no new schema):
// - loadPublicKey                       packages/receipts/src/authorship-key-store.js
// - collectBlock0PrerequisiteStatus     ./block0-prerequisite-status-collector.js
// - RULE_ID (poi canonical rule)        packages/rules/src/rule-consent-replay-verification.v0.1.js

import { loadPublicKey } from "../../receipts/src/authorship-key-store.js";
import { collectBlock0PrerequisiteStatus } from "./block0-prerequisite-status-collector.js";
import { RULE_ID as POI_REPLAY_RULE_ID } from "../../rules/src/rule-consent-replay-verification.v0.1.js";

export const BLOCK0_LIVE_READINESS_SCHEMA =
  "bizra.dema.block0_live_readiness.v0.1";

// Per-slot signing requirement, verified against each producer's source
// 2026-06-04: every producer signs (loadActiveKeyPair + signPayload) except
// poi_rule, which has no producer and is recognized by canonical-rule lookup.
// Slot IDs align with BLOCK0_PREREQUISITE_SLOTS from block0-manifest-verifier.js.
const SLOT_NEEDS_PRIVATE_KEY = Object.freeze({
  canonical_receipt_ledger_root_hash: true,
  node0_identity_proof_hash: true,
  dema_realm_state_proof_hash: true,
  urp_resource_status_proof_hash: true,
  genesis_local_token_ledger_root_hash: true,
  full_flywheel_run_receipt_hash: true,
  performance_baseline_proof_hash: true,
  house_of_wisdom_first_lesson_proof_hash: true,
  pat_profile_proof_hashes: true,
  sat_profile_proof_hashes: true,
  keyconsent_integration: true,
  poi_rule: false,
});

function isPubkeyPem(pem) {
  return typeof pem === "string" && pem.includes("BEGIN PUBLIC KEY");
}

/**
 * Assess Block0 seal-ceremony readiness from the live home — READ ONLY.
 *
 * @param {object}  opts
 * @param {string} [opts.demaHome] - DEMA_HOME; the operator pubkey is read from
 *   here when `operatorPubkeyPem` is not supplied.
 * @param {string} [opts.operatorPubkeyPem] - external operator pubkey PEM; if
 *   absent it is loaded read-only from `demaHome`.
 * @param {string} [opts.poiRuleVersion] - canonical poi rule version to check
 *   (default "0.1.0"); a mismatch surfaces as honest drift.
 * @returns frozen readiness report. Never loads the private key; never signs;
 *   never produces a proof; never persists; never seals.
 */
export async function assessBlock0LiveReadiness({
  demaHome,
  operatorPubkeyPem,
  poiRuleVersion = "0.1.0",
} = {}) {
  // (1) Operator pubkey presence — read-only. Prefer the supplied PEM; else
  //     load the PUBLIC key from the home. Never touches the private key.
  let resolvedPubkey = isPubkeyPem(operatorPubkeyPem)
    ? operatorPubkeyPem
    : null;
  if (!resolvedPubkey) {
    try {
      const pem = await loadPublicKey(demaHome);
      if (isPubkeyPem(pem)) resolvedPubkey = pem;
    } catch {
      // absent / unreadable → treated as not present below.
    }
  }
  const operator_pubkey_present = resolvedPubkey !== null;

  // (2) poi_rule is the ONLY slot verifiable read-only. Reuse the real
  //     collector path so any rule-id/version drift is detected honestly.
  let poi_rule_verifiable = false;
  let poi_rule_reason = "operator_pubkey_absent";
  if (operator_pubkey_present) {
    const collected = collectBlock0PrerequisiteStatus({
      proofs: {
        poi_rule: {
          poi_rule_id: POI_REPLAY_RULE_ID,
          poi_rule_version: poiRuleVersion,
        },
      },
      operatorPubkeyPem: resolvedPubkey,
    });
    poi_rule_verifiable =
      collected.collected === true &&
      collected.status_map?.poi_rule === "PRODUCER_LIVE";
    poi_rule_reason = poi_rule_verifiable
      ? "resolved"
      : collected.slot_verification?.poi_rule?.reason ||
        collected.error ||
        "unresolved";
  }

  // (3) Classify every slot.
  const slots = {};
  let needs_operator_signing_count = 0;
  for (const [slot, needsKey] of Object.entries(SLOT_NEEDS_PRIVATE_KEY)) {
    let status;
    if (slot === "poi_rule") {
      status = poi_rule_verifiable ? "VERIFIABLE_NOW" : "ABSENT_OR_DRIFTED";
    } else {
      status = "NEEDS_OPERATOR_SIGNING";
      needs_operator_signing_count += 1;
    }
    slots[slot] = Object.freeze({ status, needs_private_key: needsKey });
  }

  return Object.freeze({
    schema: BLOCK0_LIVE_READINESS_SCHEMA,
    truth_label: "BLOCK0_SEAL_CEREMONY_PRECHECK",
    operator_pubkey_present,
    poi_rule_verifiable,
    poi_rule_reason,
    slots: Object.freeze(slots),
    needs_operator_signing_count,
    read_only_verifiable_slots: Object.freeze(["poi_rule"]),
    ceremony_required: needs_operator_signing_count > 0,
    boundary: Object.freeze({
      read_only: true,
      private_key_loaded: false,
      proofs_produced: false,
      manifest_signed: false,
      block0_sealed: false,
      network_used: false,
    }),
  });
}
