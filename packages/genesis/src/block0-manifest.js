// BLOCK0-1A · Genesis Block0 manifest generator
//
// Builds the signed proof-of-origin snapshot of Node0. Pure-with-key-load
// kernel: reads the operator's Ed25519 keypair from disk, validates the
// 12 PDF §18 prerequisites + the claim_boundary block, gates on a
// KEYCONSENT-1A consent_proof with action_type "SEAL_BLOCK0", and
// returns a frozen envelope per BLOCK0_0_PREFLIGHT.md §3.
//
// Reuses (no new crypto, no new schema, no new consent kernel):
// - signPayload                  packages/receipts/src/authorship-signature.js
// - loadPrivateKey/loadPublicKey packages/receipts/src/authorship-key-store.js
// - sha256, stableStringify      packages/consent/src/consent-common.js
//
// SCOPE (this slice):
// - Pure-with-key-load. No verifier (BLOCK0-1B). No Realm renderer
//   (BLOCK0-1C). No CLI (BLOCK0-1D). No disk write of the manifest
//   (callers persist if they wish).
// - No public network, no federation, no token mint, no public market
//   value claim, no legal/Shariah certification.

import { createPublicKey } from "node:crypto";
import { signPayload } from "../../receipts/src/authorship-signature.js";
import {
  loadPrivateKey,
  loadPublicKey,
} from "../../receipts/src/authorship-key-store.js";
import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import { verifyConsentProof } from "../../receipts/src/consent-proof.js";

export const BLOCK0_MANIFEST_SCHEMA = "bizra.dema.block0_genesis_snapshot.v0.1";

// Consent action_type that the operator must declare in the
// consent_proof.action_scope. Cross-action consent reuse is rejected
// with consent_scope_mismatch.
export const BLOCK0_ACTION_TYPE = "SEAL_BLOCK0";

// Per PDF §18 + preflight §3. Twelve required prerequisite slots.
// The two "complete/labels" KEYCONSENT slots count as ONE prerequisite
// (KEYCONSENT integration); the truth_labels array is metadata on the
// same integration claim.
const HASH_PREREQUISITES = Object.freeze([
  "canonical_receipt_ledger_root_hash",
  "node0_identity_proof_hash",
  "dema_realm_state_proof_hash",
  "urp_resource_status_proof_hash",
  "genesis_local_token_ledger_root_hash",
  "full_flywheel_run_receipt_hash",
  "performance_baseline_proof_hash",
  "house_of_wisdom_first_lesson_proof_hash",
]);

const STRING_PREREQUISITES = Object.freeze(["poi_rule_id", "poi_rule_version"]);

const ARRAY_PREREQUISITES = Object.freeze([
  // {name, expectedLength}
  { name: "pat_profile_proof_hashes", expectedLength: 7, errCode: "pat" },
  { name: "sat_profile_proof_hashes", expectedLength: 5, errCode: "sat" },
]);

// Mandatory-false claim_boundary fields per preflight §3 + DOD §8.
const REQUIRED_FALSE_BOUNDARY_FIELDS = Object.freeze([
  "public_network_launched",
  "public_market_value_claimed",
  "legal_certification_claimed",
  "shariah_certification_claimed",
  "node1_enabled",
  "federation_used",
  "token_minted_to_humans",
]);

const SHA256_HEX = /^[a-f0-9]{64}$/;

function isSha256Hex(s) {
  return typeof s === "string" && SHA256_HEX.test(s);
}

function fingerprintFromPem(pubkeyPem) {
  const pk = createPublicKey(pubkeyPem);
  const der = pk.export({ type: "spki", format: "der" });
  return sha256(der.toString("hex"));
}

function fail(error) {
  return Object.freeze({ built: false, error });
}

function defaultClaimBoundary() {
  return {
    public_network_launched: false,
    public_market_value_claimed: false,
    legal_certification_claimed: false,
    shariah_certification_claimed: false,
    node1_enabled: false,
    federation_used: false,
    token_minted_to_humans: false,
  };
}

function validatePrerequisites(p) {
  if (!p || typeof p !== "object" || Array.isArray(p)) {
    return "prerequisites_invalid";
  }

  // (1) KEYCONSENT integration: present + must be exactly true.
  if (
    !Object.prototype.hasOwnProperty.call(p, "keyconsent_integration_complete")
  ) {
    return "prerequisite_keyconsent_integration_complete_missing";
  }
  if (p.keyconsent_integration_complete !== true) {
    return "keyconsent_integration_required";
  }

  // (2) KEYCONSENT truth labels: present array of strings.
  if (!Object.prototype.hasOwnProperty.call(p, "keyconsent_truth_labels")) {
    return "prerequisite_keyconsent_truth_labels_missing";
  }
  if (
    !Array.isArray(p.keyconsent_truth_labels) ||
    !p.keyconsent_truth_labels.every(
      (l) => typeof l === "string" && l.length > 0,
    )
  ) {
    return "prerequisite_keyconsent_truth_labels_invalid";
  }

  // (3) Hash-typed prerequisites: present + sha256 hex.
  for (const name of HASH_PREREQUISITES) {
    if (!Object.prototype.hasOwnProperty.call(p, name)) {
      return `prerequisite_${name}_missing`;
    }
    if (!isSha256Hex(p[name])) {
      return `prerequisite_${name}_hash_invalid`;
    }
  }

  // (4) String-typed prerequisites (poi_rule_id, poi_rule_version).
  for (const name of STRING_PREREQUISITES) {
    if (!Object.prototype.hasOwnProperty.call(p, name)) {
      return `prerequisite_${name}_missing`;
    }
    if (typeof p[name] !== "string" || p[name].length === 0) {
      return `prerequisite_${name}_invalid`;
    }
  }

  // (5) Array-typed prerequisites: presence first, then length, then
  // every element sha256 hex.
  for (const spec of ARRAY_PREREQUISITES) {
    if (!Object.prototype.hasOwnProperty.call(p, spec.name)) {
      return `prerequisite_${spec.name}_missing`;
    }
    const arr = p[spec.name];
    if (!Array.isArray(arr)) {
      return `prerequisite_${spec.name}_invalid`;
    }
    if (arr.length !== spec.expectedLength) {
      return `${spec.errCode}_profile_count_invalid`;
    }
    for (const h of arr) {
      if (!isSha256Hex(h)) {
        return `prerequisite_${spec.name}_hash_invalid`;
      }
    }
  }

  return null;
}

function validateClaimBoundary(boundary) {
  if (!boundary || typeof boundary !== "object" || Array.isArray(boundary)) {
    return "claim_boundary_invalid";
  }
  for (const field of REQUIRED_FALSE_BOUNDARY_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(boundary, field)) {
      return `claim_boundary_field_${field}_missing`;
    }
    if (boundary[field] !== false) {
      return "claim_boundary_violation";
    }
  }
  return null;
}

function freezeBoundary(b) {
  return Object.freeze({
    public_network_launched: b.public_network_launched,
    public_market_value_claimed: b.public_market_value_claimed,
    legal_certification_claimed: b.legal_certification_claimed,
    shariah_certification_claimed: b.shariah_certification_claimed,
    node1_enabled: b.node1_enabled,
    federation_used: b.federation_used,
    token_minted_to_humans: b.token_minted_to_humans,
  });
}

function freezePrerequisites(p) {
  return {
    keyconsent_integration_complete: p.keyconsent_integration_complete,
    keyconsent_truth_labels: Object.freeze([...p.keyconsent_truth_labels]),
    canonical_receipt_ledger_root_hash: p.canonical_receipt_ledger_root_hash,
    node0_identity_proof_hash: p.node0_identity_proof_hash,
    dema_realm_state_proof_hash: p.dema_realm_state_proof_hash,
    pat_profile_proof_hashes: Object.freeze([...p.pat_profile_proof_hashes]),
    sat_profile_proof_hashes: Object.freeze([...p.sat_profile_proof_hashes]),
    urp_resource_status_proof_hash: p.urp_resource_status_proof_hash,
    genesis_local_token_ledger_root_hash:
      p.genesis_local_token_ledger_root_hash,
    poi_rule_id: p.poi_rule_id,
    poi_rule_version: p.poi_rule_version,
    full_flywheel_run_receipt_hash: p.full_flywheel_run_receipt_hash,
    performance_baseline_proof_hash: p.performance_baseline_proof_hash,
    house_of_wisdom_first_lesson_proof_hash:
      p.house_of_wisdom_first_lesson_proof_hash,
  };
}

export async function buildBlock0Manifest({
  prerequisites,
  consentProof,
  demaHome,
  createdAtIso,
  claimBoundary,
  prevHash = null,
}) {
  // ── (1) Validate the 12 prerequisites ────────────────────────────
  const prereqErr = validatePrerequisites(prerequisites);
  if (prereqErr) {
    return fail(prereqErr);
  }

  // ── (2) Validate the claim_boundary block ────────────────────────
  // Caller may omit; we materialize the all-false default. If caller
  // passes a boundary, every required field must be exactly false.
  const boundaryInput = claimBoundary || defaultClaimBoundary();
  const boundaryErr = validateClaimBoundary(boundaryInput);
  if (boundaryErr) {
    return fail(boundaryErr);
  }

  // ── (3) Validate consent_proof shape + action scope ──────────────
  if (
    !consentProof ||
    typeof consentProof !== "object" ||
    Array.isArray(consentProof)
  ) {
    return fail("consent_proof_required");
  }
  if (
    !consentProof.action_scope ||
    consentProof.action_scope.action_type !== BLOCK0_ACTION_TYPE
  ) {
    return fail("consent_scope_mismatch");
  }

  // ── (3b) created_at_iso is required — no wall-clock fallback ──────
  // block0_id and the signature commit to created_at_iso; a Date.now()
  // fallback would make the builder nondeterministic. Fail closed.
  if (typeof createdAtIso !== "string" || createdAtIso.length === 0) {
    return fail("created_at_iso_required");
  }

  // ── (4) Load the operator's signing keypair from disk ────────────
  const privateKeyPem = await loadPrivateKey(demaHome);
  if (!privateKeyPem) {
    return fail("no_authorship_key");
  }
  const publicKeyPem = await loadPublicKey(demaHome);
  if (!publicKeyPem) {
    return fail("no_authorship_key");
  }

  const fingerprint = fingerprintFromPem(publicKeyPem);

  // ── (5) Derive deterministic ids + freeze sub-shapes ─────────────
  const createdIso = createdAtIso;
  const frozenPrereqs = freezePrerequisites(prerequisites);
  const frozenBoundary = freezeBoundary(boundaryInput);

  // block0_id is content-addressed over the *commitment set*: the
  // prerequisites, the boundary, and the creation moment. It is
  // distinct from block0_proof_hash (which covers the full envelope
  // body sans signature + proof_hash).
  const block0Id = sha256(
    stableStringify({
      prerequisites: frozenPrereqs,
      claim_boundary: frozenBoundary,
      created_at_iso: createdIso,
    }),
  );

  // ── (5b) Cryptographically verify the consent proof ──────────────
  // The action_type check above is necessary but NOT sufficient: a
  // forged or stale object with that field set would otherwise be
  // signed with the operator's key. Verify the consent proof's Ed25519
  // signature using the operator's OWN on-disk public key (trust ONLY
  // that key, not any embedded fingerprint — same rule as verdict-attest
  // / KEYCONSENT-1A), and bind its scope to this manifest's commitment
  // set: consent.action_scope.target_hash must equal block0_id. Freshness
  // is checked as of created_at_iso (the sealing moment).
  const consentVerify = verifyConsentProof({
    consentProof,
    pubkeyPem: publicKeyPem,
    expectedActionScope: {
      action_type: BLOCK0_ACTION_TYPE,
      target_hash: block0Id,
    },
    now: createdIso,
  });
  if (!consentVerify.verified) {
    return fail(`consent_proof_${consentVerify.reason}`);
  }

  // ── (6) Compose the signing body (no signature, no proof_hash) ───
  //
  // Same separation pattern as URP-3.1A local index, URP-4.1A choose,
  // verdict-receipt, and KEYCONSENT-1A consent_proof: the body is
  // exactly what the signature and hash commit to; the two derived
  // fields are appended afterwards.
  const body = Object.freeze({
    schema: BLOCK0_MANIFEST_SCHEMA,
    block0_id: block0Id,
    genesis_node_id: fingerprint,
    genesis_human_id: fingerprint,
    prev_hash: prevHash,
    // 12 prerequisite slots (flat on the body, per §3 schema).
    keyconsent_integration_complete:
      frozenPrereqs.keyconsent_integration_complete,
    keyconsent_truth_labels: frozenPrereqs.keyconsent_truth_labels,
    canonical_receipt_ledger_root_hash:
      frozenPrereqs.canonical_receipt_ledger_root_hash,
    node0_identity_proof_hash: frozenPrereqs.node0_identity_proof_hash,
    dema_realm_state_proof_hash: frozenPrereqs.dema_realm_state_proof_hash,
    pat_profile_proof_hashes: frozenPrereqs.pat_profile_proof_hashes,
    sat_profile_proof_hashes: frozenPrereqs.sat_profile_proof_hashes,
    urp_resource_status_proof_hash:
      frozenPrereqs.urp_resource_status_proof_hash,
    genesis_local_token_ledger_root_hash:
      frozenPrereqs.genesis_local_token_ledger_root_hash,
    poi_rule_id: frozenPrereqs.poi_rule_id,
    poi_rule_version: frozenPrereqs.poi_rule_version,
    full_flywheel_run_receipt_hash:
      frozenPrereqs.full_flywheel_run_receipt_hash,
    performance_baseline_proof_hash:
      frozenPrereqs.performance_baseline_proof_hash,
    house_of_wisdom_first_lesson_proof_hash:
      frozenPrereqs.house_of_wisdom_first_lesson_proof_hash,
    claim_boundary: frozenBoundary,
    consent_proof_hash: consentProof.consent_proof_hash,
    created_at_iso: createdIso,
    operator_public_key_fingerprint: fingerprint,
  });

  // ── (7) Sign + hash ──────────────────────────────────────────────
  const signatureB64 = signPayload(body, privateKeyPem);
  const block0ProofHash = sha256(stableStringify(body));

  // ── (8) Assemble final frozen envelope ───────────────────────────
  const manifest = Object.freeze({
    ...body,
    block0_signature_b64: signatureB64,
    block0_proof_hash: block0ProofHash,
  });

  return Object.freeze({
    built: true,
    manifest,
    signer_public_key_pem: publicKeyPem,
  });
}
