// BLOCK0-SEAL-CEREMONY-DRY-RUN-1A · preview-only Block0 signing-ceremony planner.
//
// Honest scope: a real Block0 seal is an operator-only SIGNING ceremony (11 of 12
// prerequisite slots require the operator's PRIVATE Ed25519 key; only poi_rule is
// verifier-only). This kernel does the only safe thing — it PREVIEWS the ceremony
// the operator will perform later, from already-computed read-only inputs:
//   - readiness  (assessBlock0LiveReadiness)         — slot statuses + pubkey presence
//   - preflight  (assessNode0GenesisKeyCeremonyPreflight) — provenance blockers
//
// It NEVER reads a private key, signs, produces a proof, persists, or seals. It is
// a pure function: no disk, no clock, no network. The `plan_hash` is a content
// fingerprint of the ceremony PLAN (sha256 over stableStringify) — it is NOT a
// signature and binds no identity.
//
// Reuses (no new crypto, no new vocabulary):
//   - sha256, stableStringify          packages/consent/src/consent-common.js
//   - BLOCK0_PREREQUISITE_SLOTS         ./block0-manifest-verifier.js

import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import { BLOCK0_PREREQUISITE_SLOTS } from "./block0-manifest-verifier.js";

export const BLOCK0_SEAL_CEREMONY_DRY_RUN_SCHEMA =
  "bizra.dema.block0_seal_ceremony_dry_run.v0.1";

// Preflight blocker codes that mean cross-repo provenance is not cleared for a
// ceremony. `authorship_key_already_present` is intentionally NOT here: for a
// SEAL ceremony the key being present is REQUIRED, not a blocker.
const PROVENANCE_BLOCKER_CODES = Object.freeze([
  "provenance_unresolved",
  "unknown_provenance_gate",
  "migrate_review_required",
]);

const REQUIRED_ATTESTATIONS = Object.freeze([
  "No private key was read.",
  "No signature was produced.",
  "No Block0 seal was written.",
  "No identity-binding action occurred.",
]);

const BLOCKED_UNTIL_EXPLICIT_GO = Object.freeze([
  "read_private_key",
  "produce_signature",
  "seal_block0",
  "bind_identity",
  "federation",
  "receipt_mint",
  "chain_advance",
]);

function honestBoundary() {
  return Object.freeze({
    filesystem_write_performed: false,
    network_used: false,
    runtime_execution_performed: false,
    model_loaded: false,
    model_invocation_performed: false,
    prompt_executed: false,
    external_call_performed: false,
    raw_corpus_scan_performed: false,
    raw_data_included: false,
    tool_executed: false,
    chain_advance_performed: false,
    receipt_mint_performed: false,
    federation_invoked: false,
    node_connection_performed: false,
    public_network_used: false,
    consent_collected: false,
  });
}

/**
 * Preview the Block0 signing ceremony from read-only readiness + preflight. PURE.
 * Never reads a private key, signs, produces a proof, persists, or seals.
 *
 * @param {object}  opts
 * @param {object}  [opts.readiness] - assessBlock0LiveReadiness() output.
 * @param {object}  [opts.preflight] - assessNode0GenesisKeyCeremonyPreflight() output.
 * @returns frozen preview-only envelope (truth_label BLOCK0_SEAL_DRY_RUN_PREVIEW_ONLY).
 *   Any other property (e.g. a private key) is structurally ignored.
 */
export function buildBlock0SealCeremonyDryRun({ readiness, preflight } = {}) {
  const blockers = [];

  const readinessOk =
    readiness != null &&
    typeof readiness === "object" &&
    readiness.slots != null &&
    typeof readiness.slots === "object";

  // (1) Provenance — unresolved if no preflight, or any provenance-class blocker.
  const preflightBlockers = Array.isArray(preflight?.blockers)
    ? preflight.blockers
    : [];
  const provenanceBlockers = preflightBlockers.filter(
    (b) => b && PROVENANCE_BLOCKER_CODES.includes(b.code),
  );
  const provenance_resolved =
    preflight != null && provenanceBlockers.length === 0;

  // (2) Operator pubkey presence.
  const operator_pubkey_present = readinessOk
    ? readiness.operator_pubkey_present === true
    : false;

  // (3) Slot completeness — all 12 canonical slots present and poi_rule verifiable.
  let missingSlots = [];
  let poiVerifiable = false;
  if (readinessOk) {
    missingSlots = BLOCK0_PREREQUISITE_SLOTS.filter(
      (s) => !Object.prototype.hasOwnProperty.call(readiness.slots, s),
    );
    poiVerifiable = readiness.slots.poi_rule?.status === "VERIFIABLE_NOW";
  }
  const all_slots_accounted =
    readinessOk && missingSlots.length === 0 && poiVerifiable;

  // Fail-closed status resolution (precedence: provenance → pubkey → slots).
  let status = null;
  if (!provenance_resolved) {
    status = "BLOCKED_BY_UNRESOLVED_PROVENANCE";
    if (provenanceBlockers.length > 0) {
      for (const b of provenanceBlockers) {
        blockers.push({ code: b.code, message: String(b.message ?? b.code) });
      }
    } else {
      blockers.push({
        code: "provenance_unresolved",
        message: "No preflight supplied; cross-repo provenance is unconfirmed.",
      });
    }
  }
  if (!operator_pubkey_present) {
    blockers.push({
      code: "operator_pubkey_missing",
      message: "Operator public key is not present in readiness.",
    });
    if (status === null) status = "BLOCKED_BY_MISSING_OPERATOR_PUBKEY";
  }
  if (!all_slots_accounted) {
    const reason = !readinessOk
      ? "readiness_invalid_or_missing"
      : missingSlots.length > 0
        ? `missing_slots:${missingSlots.join(",")}`
        : "poi_rule_not_verifiable_now";
    blockers.push({ code: "slots_incomplete", message: reason });
    if (status === null) status = "BLOCKED_BY_INCOMPLETE_SLOTS";
  }
  if (status === null) status = "SIGNING_READY_PREVIEW_ONLY";

  // Ceremony plan — descriptor only. No proof is produced, no signature created.
  const presentSlots = readinessOk
    ? BLOCK0_PREREQUISITE_SLOTS.filter((s) =>
        Object.prototype.hasOwnProperty.call(readiness.slots, s),
      )
    : [];
  const steps = presentSlots.map((slot, i) => {
    const needs_private_key = readiness.slots[slot]?.needs_private_key === true;
    const required_action =
      slot === "poi_rule" ? "verify_rule_identity" : "operator_sign";
    const descriptor = { slot, required_action, needs_private_key };
    return Object.freeze({
      order: i + 1,
      slot,
      required_action,
      needs_private_key,
      step_descriptor_hash: sha256(stableStringify(descriptor)),
    });
  });
  const needs_operator_signing_count = steps.filter(
    (s) => s.required_action === "operator_sign",
  ).length;
  const verifiable_now = steps
    .filter((s) => s.required_action === "verify_rule_identity")
    .map((s) => s.slot);
  const plan_hash = sha256(
    stableStringify(
      steps.map((s) => ({
        order: s.order,
        slot: s.slot,
        required_action: s.required_action,
        needs_private_key: s.needs_private_key,
      })),
    ),
  );

  return Object.freeze({
    schema: BLOCK0_SEAL_CEREMONY_DRY_RUN_SCHEMA,
    truth_label: "BLOCK0_SEAL_DRY_RUN_PREVIEW_ONLY",
    mode: "preview_only",
    status,
    preconditions: Object.freeze({
      provenance_resolved,
      operator_pubkey_present,
      all_slots_accounted,
    }),
    blockers: Object.freeze(blockers.map((b) => Object.freeze(b))),
    ceremony_plan: Object.freeze({
      slot_count: steps.length,
      needs_operator_signing_count,
      verifiable_now: Object.freeze(verifiable_now),
      steps: Object.freeze(steps),
      plan_hash,
    }),
    attestations: REQUIRED_ATTESTATIONS,
    what_this_proves:
      "The local system can assemble and preview the Block0 signing-ceremony inputs without reading private keys or sealing.",
    what_this_does_not_prove:
      "Operator approval, private-key signing, Block0 activation, identity binding, federation, economic activation, or live runtime closure.",
    blocked_until_explicit_go: BLOCKED_UNTIL_EXPLICIT_GO,
    boundary: honestBoundary(),
  });
}

export function formatBlock0SealCeremonyDryRun(preview) {
  const lines = [
    "Block0 Seal Ceremony — DRY RUN (preview only)",
    "=============================================",
    `Schema: ${preview.schema}`,
    `Status: ${preview.status}`,
    `Preconditions: provenance_resolved=${preview.preconditions.provenance_resolved} · operator_pubkey_present=${preview.preconditions.operator_pubkey_present} · all_slots_accounted=${preview.preconditions.all_slots_accounted}`,
    "",
  ];
  if (preview.blockers.length > 0) {
    lines.push("Blockers:");
    for (const b of preview.blockers) lines.push(`  - ${b.code}: ${b.message}`);
    lines.push("");
  }
  lines.push(
    `Ceremony plan: ${preview.ceremony_plan.slot_count} slots · ${preview.ceremony_plan.needs_operator_signing_count} need operator signing · verifiable now: ${preview.ceremony_plan.verifiable_now.join(", ") || "none"}`,
  );
  lines.push(`Plan hash: ${preview.ceremony_plan.plan_hash}`);
  lines.push("");
  for (const a of preview.attestations) lines.push(`  ✓ ${a}`);
  return lines.join("\n");
}
