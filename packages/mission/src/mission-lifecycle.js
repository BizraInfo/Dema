// MISSION-1A · Pure Mission Lifecycle Kernel
//
// Turns a "mission" (a coherent task spanning intent → DoD → blockers →
// optional PAT/SAT → consent → action receipts → verification receipts →
// closeout) into a signed, content-addressed lifecycle envelope. A
// stranger holding the envelope + the operator's externally-supplied
// pubkey + this repo's verifier code can confirm the lifecycle is
// internally consistent and was signed by the operator's key.
//
// Reuses (no duplication):
// - signPayload, verifyPayload      packages/receipts/src/authorship-signature.js
// - loadPrivateKey, loadPublicKey   packages/receipts/src/authorship-key-store.js
// - sha256, stableStringify         packages/consent/src/consent-common.js
//
// Spec reference: docs/security/MISSION_0_PREFLIGHT.md (§3 schema, §5
// verification flow, §9 DOD for MISSION-1A).
//
// SCOPE (this slice):
// - Pure kernel functions only. No CLI (MISSION-1B). No Realm renderer
//   (MISSION-1C). No bundle-walking sub-receipt resolution (FLYWHEEL-1A
//   territory).
// - The verifier checks: structural validity, every cited hash is sha256
//   hex shape, signature verifies under externally-supplied pubkey, and
//   lifecycle_proof_hash recomputes from the stable body.
// - No network, no federation, no token/mint, no economic claim.

import { createPublicKey } from "node:crypto";
import {
  signPayload,
  verifyPayload,
} from "../../receipts/src/authorship-signature.js";
import {
  loadPrivateKey,
  loadPublicKey,
} from "../../receipts/src/authorship-key-store.js";
import { sha256, stableStringify } from "../../consent/src/consent-common.js";

export const MISSION_LIFECYCLE_SCHEMA = "bizra.dema.mission_lifecycle.v0.1";

// Stable action_type for mission-scoped consent proofs. A KEYCONSENT
// consent proof issued against a different action_type cannot satisfy a
// mission's mutation phase. (Wiring of this check into the verifier is
// FLYWHEEL-1A — at MISSION-1A scope the action_type is exported so that
// callers can build mission-bound consent proofs consistently.)
export const MISSION_ACTION_TYPE = "EXECUTE_MISSION";

const SHA256_HEX = /^[a-f0-9]{64}$/;

const REQUIRED_FIELDS = Object.freeze([
  "schema",
  "mission_id",
  "mission_intent",
  "dod_declared",
  "blockers_identified",
  "pat_proposal_receipt_hash",
  "sat_audit_receipt_hash",
  "consent_proof_hash",
  "action_receipt_hashes",
  "verification_receipt_hashes",
  "closeout_text",
  "lesson_candidate_hash",
  "next_step_proposed",
  "created_at_iso",
  "operator_public_key_fingerprint",
  "lifecycle_signature_b64",
  "lifecycle_proof_hash",
]);

function fingerprintFromPem(pubkeyPem) {
  const pk = createPublicKey(pubkeyPem);
  const der = pk.export({ type: "spki", format: "der" });
  return sha256(der.toString("hex"));
}

function fail(error) {
  return Object.freeze({ built: false, error });
}

function isSha256Hex(s) {
  return typeof s === "string" && SHA256_HEX.test(s);
}

function isNullOrSha256Hex(s) {
  return s === null || s === undefined ? true : isSha256Hex(s);
}

function isNonEmptyString(s) {
  return typeof s === "string" && s.trim().length > 0;
}

function hasMeaningfulDoD(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return false;
  return arr.some((x) => isNonEmptyString(x));
}

function freezeDeep(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    value.forEach(freezeDeep);
    return Object.freeze(value);
  }
  if (typeof value === "object") {
    for (const k of Object.keys(value)) {
      freezeDeep(value[k]);
    }
    return Object.freeze(value);
  }
  return value;
}

// ─── buildMissionLifecycle ────────────────────────────────────────────
//
// Single-call open+close kernel.
//
// Output on success:
//   { built: true, mission_id, lifecycle: <frozen envelope>, signer_public_key_pem }
//
// Output on failure:
//   { built: false, error: "<reason>" }
//
// Failure reasons (per preflight §9 DOD):
//   dod_required                              missing intent or DoD
//   consent_proof_required_when_mutation      action_receipt_hashes non-empty
//                                             but no consentProof supplied
//   closeout_required                         empty closeout_text
//   action_receipt_hash_invalid               an action hash is not sha256 hex
//   verification_receipt_hash_invalid         a verification hash is not
//                                             sha256 hex
//   pat_proposal_receipt_hash_invalid         pat_proposal_receipt_hash is
//                                             not nullable sha256 hex
//   sat_audit_receipt_hash_invalid            sat_audit_receipt_hash is not
//                                             nullable sha256 hex
//   consent_proof_hash_invalid                consent_proof_hash is not
//                                             nullable sha256 hex
//   lesson_candidate_hash_invalid             lesson_candidate_hash is not
//                                             nullable sha256 hex
//   no_authorship_key                         operator signing key not on
//                                             disk under demaHome
export async function buildMissionLifecycle({
  mission_intent,
  dod_declared,
  blockers_identified,
  pat_proposal_receipt_hash,
  sat_audit_receipt_hash,
  consent_proof_hash,
  action_receipt_hashes,
  verification_receipt_hashes,
  closeout_text,
  lesson_candidate_hash,
  next_step_proposed,
  consentProof,
  demaHome,
  createdAtIso,
} = {}) {
  // ── (1) Fail-closed: intent + DoD ──────────────────────────────────
  if (!isNonEmptyString(mission_intent)) {
    return fail("dod_required");
  }
  if (!hasMeaningfulDoD(dod_declared)) {
    return fail("dod_required");
  }

  // ── (2) Fail-closed: closeout ──────────────────────────────────────
  if (!isNonEmptyString(closeout_text)) {
    return fail("closeout_required");
  }

  // ── (3) Hash-shape validation (all referenced hashes) ──────────────
  const actionHashes = Array.isArray(action_receipt_hashes)
    ? action_receipt_hashes
    : [];
  for (const h of actionHashes) {
    if (!isSha256Hex(h)) {
      return fail("action_receipt_hash_invalid");
    }
  }
  const verificationHashes = Array.isArray(verification_receipt_hashes)
    ? verification_receipt_hashes
    : [];
  for (const h of verificationHashes) {
    if (!isSha256Hex(h)) {
      return fail("verification_receipt_hash_invalid");
    }
  }
  if (!isNullOrSha256Hex(pat_proposal_receipt_hash)) {
    return fail("pat_proposal_receipt_hash_invalid");
  }
  if (!isNullOrSha256Hex(sat_audit_receipt_hash)) {
    return fail("sat_audit_receipt_hash_invalid");
  }
  if (!isNullOrSha256Hex(consent_proof_hash)) {
    return fail("consent_proof_hash_invalid");
  }
  if (!isNullOrSha256Hex(lesson_candidate_hash)) {
    return fail("lesson_candidate_hash_invalid");
  }

  // ── (4) Mutation requires consent proof ────────────────────────────
  // Mirrors KEYCONSENT-0 §3 at the lifecycle layer: any action receipt
  // referenced from this mission implies mutation occurred, and a
  // consent proof MUST have been issued. We do NOT inspect the proof's
  // internal validity here (that is the per-action verifier's job and
  // FLYWHEEL-1A's full-bundle walk); we only refuse to build the
  // envelope if the proof is absent.
  if (actionHashes.length > 0) {
    if (!consentProof || typeof consentProof !== "object") {
      return fail("consent_proof_required_when_mutation");
    }
  }

  // ── (5) Load operator's signing key (private + public) ─────────────
  const privateKeyPem = await loadPrivateKey(demaHome);
  if (!privateKeyPem) {
    return fail("no_authorship_key");
  }
  const publicKeyPem = await loadPublicKey(demaHome);

  // ── (6) Normalize timestamps + derived consent_proof_hash ──────────
  const createdIso = createdAtIso || new Date().toISOString();
  const resolvedConsentProofHash =
    consent_proof_hash !== undefined && consent_proof_hash !== null
      ? consent_proof_hash
      : consentProof &&
          typeof consentProof === "object" &&
          typeof consentProof.consent_proof_hash === "string"
        ? consentProof.consent_proof_hash
        : null;

  // ── (7) mission_id is content-addressed over (intent, created_at) ──
  // Per the immediate contract: sha256(stableStringify({mission_intent,
  // created_at_iso})). Two missions with identical intent + open time
  // collide deliberately.
  const mission_id = sha256(
    stableStringify({
      mission_intent,
      created_at_iso: createdIso,
    }),
  );

  // ── (8) Normalize array shapes (freeze for output) ─────────────────
  const dodFrozen = Object.freeze(
    dod_declared.map((s) => (typeof s === "string" ? s : String(s))),
  );
  const blockersFrozen = Object.freeze(
    (Array.isArray(blockers_identified) ? blockers_identified : []).map((s) =>
      typeof s === "string" ? s : String(s),
    ),
  );
  const actionFrozen = Object.freeze([...actionHashes]);
  const verificationFrozen = Object.freeze([...verificationHashes]);

  const fingerprint = fingerprintFromPem(publicKeyPem);

  // ── (9) Stable body — basis for signature and lifecycle_proof_hash.
  // Excludes the two derived fields (lifecycle_signature_b64,
  // lifecycle_proof_hash) by construction. Same separation pattern as
  // KEYCONSENT-0's consent proof and verdict-receipt body.
  const stableBody = Object.freeze({
    schema: MISSION_LIFECYCLE_SCHEMA,
    mission_id,
    mission_intent,
    dod_declared: dodFrozen,
    blockers_identified: blockersFrozen,
    pat_proposal_receipt_hash: pat_proposal_receipt_hash ?? null,
    sat_audit_receipt_hash: sat_audit_receipt_hash ?? null,
    consent_proof_hash: resolvedConsentProofHash,
    action_receipt_hashes: actionFrozen,
    verification_receipt_hashes: verificationFrozen,
    closeout_text,
    lesson_candidate_hash: lesson_candidate_hash ?? null,
    next_step_proposed:
      typeof next_step_proposed === "string" ? next_step_proposed : "",
    created_at_iso: createdIso,
    operator_public_key_fingerprint: fingerprint,
  });

  const lifecycle_signature_b64 = signPayload(stableBody, privateKeyPem);
  const lifecycle_proof_hash = sha256(stableStringify(stableBody));

  const lifecycle = freezeDeep({
    ...stableBody,
    lifecycle_signature_b64,
    lifecycle_proof_hash,
  });

  return Object.freeze({
    built: true,
    mission_id,
    lifecycle,
    signer_public_key_pem: publicKeyPem,
  });
}

// SP6-FEEDBACK-BRIDGE-SPEC-1A: design-only lifecycle hook.
// Future SIM-1A may derive a feedback proposal from closeout lesson/next_step,
// then route it through exact consent:
// "PROPOSE_FEEDBACK_BRIDGE_LESSON"
// No runtime behavior is introduced in SPEC-1A.

function reject(reason) {
  return Object.freeze({ verified: false, rejected: true, reason });
}

// ─── verifyMissionLifecycle ───────────────────────────────────────────
//
// Permissionless replay verifier. A stranger with the lifecycle envelope
// and an externally-supplied operator pubkey (NOT trusting any pubkey
// hint embedded in the envelope) can confirm:
//   1. Schema match.
//   2. All required fields present.
//   3. Every referenced action / verification hash is sha256 hex shape.
//   4. lifecycle_proof_hash recomputes from the stable body.
//   5. Ed25519 signature verifies under the externally-supplied pubkey.
//
// Out of scope at MISSION-1A:
//   - Walking a bundle of sub-receipts to confirm each cited hash resolves
//     (deferred to FLYWHEEL-1A).
//   - Confirming each sub-receipt back-references this mission_id
//     (deferred to FLYWHEEL-1A).
//   - Re-verifying the consent proof envelope (deferred to FLYWHEEL-1A;
//     consent_proof_hash is checked for shape only here).
//
// Returns:
//   { verified: true, mission_id, lifecycle_proof_hash, operator_public_key_fingerprint }
// or
//   { verified: false, rejected: true, reason: "<reason>" }
export function verifyMissionLifecycle({ lifecycle, pubkeyPem } = {}) {
  // ── Structural validation ────────────────────────────────────────
  if (!lifecycle || typeof lifecycle !== "object" || Array.isArray(lifecycle)) {
    return reject("lifecycle_missing_or_malformed");
  }
  if (
    typeof pubkeyPem !== "string" ||
    !pubkeyPem.includes("BEGIN PUBLIC KEY")
  ) {
    return reject("external_pubkey_required");
  }
  if (lifecycle.schema !== MISSION_LIFECYCLE_SCHEMA) {
    return reject("lifecycle_schema_mismatch");
  }
  for (const f of REQUIRED_FIELDS) {
    if (lifecycle[f] === undefined) {
      return reject(`structural_missing_field_${f}`);
    }
  }

  // ── Hash-shape validation (verifier independently re-checks) ────
  if (!Array.isArray(lifecycle.action_receipt_hashes)) {
    return reject("action_receipt_hash_invalid");
  }
  for (const h of lifecycle.action_receipt_hashes) {
    if (!isSha256Hex(h)) return reject("action_receipt_hash_invalid");
  }
  if (!Array.isArray(lifecycle.verification_receipt_hashes)) {
    return reject("verification_receipt_hash_invalid");
  }
  for (const h of lifecycle.verification_receipt_hashes) {
    if (!isSha256Hex(h)) return reject("verification_receipt_hash_invalid");
  }
  if (!isNullOrSha256Hex(lifecycle.pat_proposal_receipt_hash)) {
    return reject("pat_proposal_receipt_hash_invalid");
  }
  if (!isNullOrSha256Hex(lifecycle.sat_audit_receipt_hash)) {
    return reject("sat_audit_receipt_hash_invalid");
  }
  if (!isNullOrSha256Hex(lifecycle.consent_proof_hash)) {
    return reject("consent_proof_hash_invalid");
  }
  if (!isNullOrSha256Hex(lifecycle.lesson_candidate_hash)) {
    return reject("lesson_candidate_hash_invalid");
  }
  if (!isSha256Hex(lifecycle.mission_id)) {
    return reject("mission_id_invalid");
  }

  // ── Required strings ─────────────────────────────────────────────
  if (!isNonEmptyString(lifecycle.mission_intent)) {
    return reject("dod_missing");
  }
  if (!hasMeaningfulDoD(lifecycle.dod_declared)) {
    return reject("dod_missing");
  }
  if (!isNonEmptyString(lifecycle.closeout_text)) {
    return reject("closeout_missing");
  }

  // ── (1) Recompute lifecycle_proof_hash from stable body ─────────
  const { lifecycle_signature_b64, lifecycle_proof_hash, ...stableBody } =
    lifecycle;
  const recomputed = sha256(stableStringify(stableBody));
  if (recomputed !== lifecycle_proof_hash) {
    return reject("lifecycle_proof_hash_mismatch");
  }

  // ── (2) Verify Ed25519 signature using ONLY external pubkey ─────
  // Same trust invariant as verdict-receipt REJECT-4 and KEYCONSENT-0:
  // the embedded operator_public_key_fingerprint is NOT used for
  // authority; the verifier brings its own external pubkey.
  let sigValid;
  try {
    sigValid = verifyPayload(stableBody, lifecycle_signature_b64, pubkeyPem);
  } catch {
    sigValid = false;
  }
  if (!sigValid) {
    return reject("lifecycle_signature_invalid");
  }

  return Object.freeze({
    verified: true,
    mission_id: lifecycle.mission_id,
    lifecycle_proof_hash,
    operator_public_key_fingerprint: lifecycle.operator_public_key_fingerprint,
  });
}
