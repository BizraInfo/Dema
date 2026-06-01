// BLOCK0-1B · pure Block0 manifest verifier — the judge, not the generator.
//
// BIZRA is shifting from proof GENERATION to proof JUDGMENT. The Block0
// generator (BLOCK0-1A) signs a manifest; this verifier decides whether that
// manifest is structurally valid, cryptographically intact under the EXTERNAL
// operator pubkey, and — separately — SEALABLE.
//
// Hard boundary: verifier ≠ collector. verifyBlock0Manifest never scans the
// repo and never recomputes producer outputs. Sealability is decided ONLY from
// an explicit `prerequisiteStatusMap` the caller supplies (a later collector
// slice resolves real statuses). So a structurally-valid manifest over
// not-yet-sealed prerequisites returns verified:true, sealable:false — truth
// before completion.
//
// Pure: no I/O, no clock, no key load (the external pubkey is supplied).

import { createPublicKey } from "node:crypto";
import { verifyPayload } from "../../receipts/src/authorship-signature.js";
import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import { BLOCK0_MANIFEST_SCHEMA } from "./block0-manifest.js";

export const BLOCK0_MANIFEST_VERIFICATION_SCHEMA =
  "bizra.dema.block0_manifest_verification.v0.1";

// The 12 logical prerequisite slots the sealability decision is taken over.
export const BLOCK0_PREREQUISITE_SLOTS = Object.freeze([
  "canonical_receipt_ledger_root_hash",
  "node0_identity_proof_hash",
  "dema_realm_state_proof_hash",
  "urp_resource_status_proof_hash",
  "genesis_local_token_ledger_root_hash",
  "full_flywheel_run_receipt_hash",
  "performance_baseline_proof_hash",
  "house_of_wisdom_first_lesson_proof_hash",
  "pat_profile_proof_hashes",
  "sat_profile_proof_hashes",
  "keyconsent_integration",
  "poi_rule",
]);

const SINGLE_HASH_SLOTS = Object.freeze([
  "canonical_receipt_ledger_root_hash",
  "node0_identity_proof_hash",
  "dema_realm_state_proof_hash",
  "urp_resource_status_proof_hash",
  "genesis_local_token_ledger_root_hash",
  "full_flywheel_run_receipt_hash",
  "performance_baseline_proof_hash",
  "house_of_wisdom_first_lesson_proof_hash",
]);

const REQUIRED_FALSE_BOUNDARY_FIELDS = Object.freeze([
  "public_network_launched",
  "public_market_value_claimed",
  "legal_certification_claimed",
  "shariah_certification_claimed",
  "node1_enabled",
  "federation_used",
  "token_minted_to_humans",
]);

const VALID_STATUSES = new Set(["PRODUCER_LIVE", "PARTIAL", "NAMED_ONLY"]);

const VERIFIER_BOUNDARY = Object.freeze({
  local_only: true,
  file_write_performed: false,
  network_used: false,
  federation_used: false,
  public_economic_claim_made: false,
  public_transfer_performed: false,
  private_key_material_returned: false,
});

function isSha256Hex(s) {
  return typeof s === "string" && /^[a-f0-9]{64}$/.test(s);
}
// A real sha256 is never 64 identical characters — that is a sentinel/placeholder.
function isPlaceholderHash(s) {
  return /^([a-f0-9])\1{63}$/.test(s);
}
function isNonEmptyString(s) {
  return typeof s === "string" && s.length > 0;
}

function fail(reason) {
  return Object.freeze({
    schema: BLOCK0_MANIFEST_VERIFICATION_SCHEMA,
    verified: false,
    reason,
    boundary: VERIFIER_BOUNDARY,
  });
}

// Validate a hash slot present + canonical sha256 + not a placeholder sentinel.
function checkHash(value, name) {
  if (value === undefined || value === null)
    return `prerequisite_${name}_missing`;
  if (!isSha256Hex(value)) return `${name}_hash_malformed`;
  if (isPlaceholderHash(value)) return "placeholder_hash";
  return null;
}

function validateManifestShape(m) {
  // Derived-field shapes.
  if (!isSha256Hex(m.block0_id)) return "block0_id_invalid";
  if (!isSha256Hex(m.block0_proof_hash)) return "block0_proof_hash_invalid";
  if (!isNonEmptyString(m.block0_signature_b64)) {
    return "block0_signature_missing";
  }
  // 8 single hash slots.
  for (const name of SINGLE_HASH_SLOTS) {
    const err = checkHash(m[name], name);
    if (err) return err;
  }
  // PAT (7) + SAT (5) arrays.
  for (const [name, len] of [
    ["pat_profile_proof_hashes", 7],
    ["sat_profile_proof_hashes", 5],
  ]) {
    const arr = m[name];
    if (!Array.isArray(arr)) return `prerequisite_${name}_missing`;
    if (arr.length !== len) return `${name}_count_mismatch`;
    for (const h of arr) {
      const err = checkHash(h, name);
      if (err) return err;
    }
  }
  // KEYCONSENT integration.
  if (m.keyconsent_integration_complete !== true) {
    return "keyconsent_integration_incomplete";
  }
  if (!Array.isArray(m.keyconsent_truth_labels)) {
    return "keyconsent_truth_labels_invalid";
  }
  // PoI.
  if (
    !isNonEmptyString(m.poi_rule_id) ||
    !isNonEmptyString(m.poi_rule_version)
  ) {
    return "poi_rule_invalid";
  }
  // The manifest commits the consent proof hash (SEAL_BLOCK0 consent at build).
  // Without it, an operator-key-signed envelope with no consent could verify.
  if (!isSha256Hex(m.consent_proof_hash)) {
    return "consent_proof_hash_missing";
  }
  return null;
}

// Re-derive block0_id from the committed fields (mirrors the generator's
// freezePrerequisites shape) so an arbitrary 64-hex block0_id is rejected —
// the content-address / consent-target binding must hold.
function deriveBlock0Id(m) {
  const prerequisites = {
    keyconsent_integration_complete: m.keyconsent_integration_complete,
    keyconsent_truth_labels: m.keyconsent_truth_labels,
    canonical_receipt_ledger_root_hash: m.canonical_receipt_ledger_root_hash,
    node0_identity_proof_hash: m.node0_identity_proof_hash,
    dema_realm_state_proof_hash: m.dema_realm_state_proof_hash,
    pat_profile_proof_hashes: m.pat_profile_proof_hashes,
    sat_profile_proof_hashes: m.sat_profile_proof_hashes,
    urp_resource_status_proof_hash: m.urp_resource_status_proof_hash,
    genesis_local_token_ledger_root_hash:
      m.genesis_local_token_ledger_root_hash,
    poi_rule_id: m.poi_rule_id,
    poi_rule_version: m.poi_rule_version,
    full_flywheel_run_receipt_hash: m.full_flywheel_run_receipt_hash,
    performance_baseline_proof_hash: m.performance_baseline_proof_hash,
    house_of_wisdom_first_lesson_proof_hash:
      m.house_of_wisdom_first_lesson_proof_hash,
  };
  return sha256(
    stableStringify({
      prerequisites,
      claim_boundary: m.claim_boundary,
      created_at_iso: m.created_at_iso,
    }),
  );
}

function validateClaimBoundary(boundary) {
  if (!boundary || typeof boundary !== "object" || Array.isArray(boundary)) {
    return "claim_boundary_invalid";
  }
  for (const f of REQUIRED_FALSE_BOUNDARY_FIELDS) {
    if (boundary[f] !== false) return "claim_boundary_violation";
  }
  return null;
}

// Decide sealability from the explicit status map ONLY. No repo scan.
function evaluatePrerequisiteStatusMap(prerequisiteStatusMap) {
  if (
    !prerequisiteStatusMap ||
    typeof prerequisiteStatusMap !== "object" ||
    Array.isArray(prerequisiteStatusMap)
  ) {
    return { ok: false };
  }
  const slot_results = {};
  const blocking_reasons = [];
  let producer_live_count = 0;
  let partial_count = 0;
  let named_only_count = 0;
  for (const slot of BLOCK0_PREREQUISITE_SLOTS) {
    let status = prerequisiteStatusMap[slot];
    // Anything missing or out-of-vocabulary is un-evidenced → blocks the seal.
    if (!VALID_STATUSES.has(status)) status = "NAMED_ONLY";
    slot_results[slot] = status;
    if (status === "PRODUCER_LIVE") producer_live_count += 1;
    else {
      if (status === "PARTIAL") partial_count += 1;
      else named_only_count += 1;
      blocking_reasons.push({ slot, status });
    }
  }
  return {
    ok: true,
    sealable: producer_live_count === BLOCK0_PREREQUISITE_SLOTS.length,
    producer_live_count,
    partial_count,
    named_only_count,
    blocking_reasons,
    slot_results,
  };
}

/**
 * Verify a Block0 manifest and judge its sealability. Pure.
 *
 * @returns frozen verification envelope. On structural/crypto failure:
 *   { verified:false, reason, boundary }. On success: { verified:true,
 *   sealable, truth_label, … , boundary }.
 */
export function verifyBlock0Manifest({
  manifest,
  operatorPubkeyPem,
  prerequisiteStatusMap,
} = {}) {
  // ── Structural ────────────────────────────────────────────────────
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    return fail("manifest_required");
  }
  if (manifest.schema !== BLOCK0_MANIFEST_SCHEMA) {
    return fail("schema_mismatch");
  }
  if (
    typeof operatorPubkeyPem !== "string" ||
    !operatorPubkeyPem.includes("BEGIN PUBLIC KEY")
  ) {
    return fail("external_pubkey_required");
  }
  const shapeError = validateManifestShape(manifest);
  if (shapeError) return fail(shapeError);
  const boundaryError = validateClaimBoundary(manifest.claim_boundary);
  if (boundaryError) return fail(boundaryError);

  // ── Operator authority ────────────────────────────────────────────
  // Block0/operator authority is defined as Ed25519. verifyPayload would also
  // accept RSA/EC, so an RSA-signed envelope with an RSA fingerprint could
  // otherwise verify — reject any non-Ed25519 operator key.
  let fingerprint;
  try {
    const pk = createPublicKey(operatorPubkeyPem);
    if (pk.asymmetricKeyType !== "ed25519") {
      return fail("operator_key_not_ed25519");
    }
    fingerprint = sha256(
      pk.export({ type: "spki", format: "der" }).toString("hex"),
    );
  } catch {
    return fail("external_pubkey_required");
  }
  if (manifest.operator_public_key_fingerprint !== fingerprint) {
    return fail("operator_key_mismatch");
  }

  // ── Cryptographic: re-derive content address + verify signature ───
  const { block0_signature_b64, block0_proof_hash, ...body } = manifest;
  if (sha256(stableStringify(body)) !== block0_proof_hash) {
    return fail("block0_proof_hash_mismatch");
  }
  let signatureOk;
  try {
    signatureOk = verifyPayload(body, block0_signature_b64, operatorPubkeyPem);
  } catch {
    return fail("block0_signature_invalid");
  }
  if (!signatureOk) return fail("block0_signature_invalid");

  // block0_id must be the real content address over the committed fields, not
  // an arbitrary 64-hex value — this is the consent-target / content-address
  // binding the manifest relies on.
  if (manifest.block0_id !== deriveBlock0Id(manifest)) {
    return fail("block0_id_mismatch");
  }

  // ── Sealability — from the explicit status map ONLY ───────────────
  const seal = evaluatePrerequisiteStatusMap(prerequisiteStatusMap);
  if (!seal.ok) {
    return Object.freeze({
      schema: BLOCK0_MANIFEST_VERIFICATION_SCHEMA,
      verified: true,
      sealable: false,
      truth_label: "BLOCK0_NOT_SEALABLE",
      reason: "prerequisite_status_missing",
      producer_live_count: 0,
      partial_count: 0,
      named_only_count: 0,
      blocking_reasons: Object.freeze([]),
      slot_results: Object.freeze({}),
      boundary: VERIFIER_BOUNDARY,
      ...VERDICT_CLAIMS,
    });
  }

  return Object.freeze({
    schema: BLOCK0_MANIFEST_VERIFICATION_SCHEMA,
    verified: true,
    sealable: seal.sealable,
    truth_label: seal.sealable ? "BLOCK0_SEALABLE" : "BLOCK0_NOT_SEALABLE",
    reason: seal.sealable
      ? "all_prerequisites_producer_live"
      : "prerequisites_not_all_sealed",
    producer_live_count: seal.producer_live_count,
    partial_count: seal.partial_count,
    named_only_count: seal.named_only_count,
    blocking_reasons: Object.freeze(seal.blocking_reasons),
    slot_results: Object.freeze(seal.slot_results),
    boundary: VERIFIER_BOUNDARY,
    ...VERDICT_CLAIMS,
  });
}

const VERDICT_CLAIMS = Object.freeze({
  what_this_proves: Object.freeze([
    "manifest_shape_valid",
    "manifest_hash_rederived",
    "manifest_signature_valid",
    "operator_key_matches_manifest",
    "claim_boundary_preserved",
    "sealability_decided_from_explicit_status_map",
  ]),
  what_this_does_not_prove: Object.freeze([
    "producer_outputs_recomputed",
    "missing_producers_implemented",
    "block0_persisted",
    "block0_sealed_on_disk",
    "public_network_live",
    "federation_live",
    "public_economy_live",
  ]),
});
