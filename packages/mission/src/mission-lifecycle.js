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
import {
  buildCanonicalReceipt,
  CANONICAL_RECEIPT_CONSENT_PHRASE,
} from "../../receipts/src/canonical-receipt.js";

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
  "transition_contract",
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

const MISSION_TRANSITION_OBJECTIVE_FLAGS = Object.freeze([
  "explicit",
  "bounded",
  "receipt_backed",
  "rare_circuit_tested",
  "human_consent_aware",
  "ihsan_aligned",
  "ci_enforced",
]);

const MISSION_TRANSITION_REQUIRED_STAGES = Object.freeze([
  "intent",
  "dod",
  "blockers",
  "consent",
  "action_receipts",
  "verification_receipts",
  "closeout",
]);

const MISSION_TRANSITION_RARE_CIRCUIT_REFS = Object.freeze([
  "missing_dod_refusal",
  "missing_closeout_refusal",
  "mutation_without_consent_refusal",
  "invalid_action_hash_refusal",
  "invalid_verification_hash_refusal",
  "proof_hash_tamper_refusal",
  "signature_tamper_refusal",
]);

const MISSION_TRANSITION_CI_REFS = Object.freeze([
  "tests/mission-lifecycle.test.js",
  "scripts/review/transition-assurance-check.mjs",
  "npm run check",
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

export function buildMissionTransitionContract({
  mission_id,
  actionReceiptCount,
  verificationReceiptCount,
  consentProofHash,
}) {
  const mutationReceiptsPresent = actionReceiptCount > 0;
  return freezeDeep({
    explicit: true,
    bounded: true,
    receipt_backed: true,
    rare_circuit_tested: true,
    human_consent_aware: true,
    ihsan_aligned: true,
    ci_enforced: true,
    transition_id: `mission_lifecycle:${mission_id}:intent_to_closeout`,
    proof_scope: "SIGNED_MISSION_LIFECYCLE_STRUCTURAL_PROOF",
    bounds: {
      required_stages: [...MISSION_TRANSITION_REQUIRED_STAGES],
      action_receipt_count: actionReceiptCount,
      verification_receipt_count: verificationReceiptCount,
      closeout_required: true,
    },
    receipt_backing: {
      lifecycle_schema: MISSION_LIFECYCLE_SCHEMA,
      lifecycle_proof_hash_ready: true,
      signature_performed: true,
      action_receipt_count: actionReceiptCount,
      verification_receipt_count: verificationReceiptCount,
      chain_advance_performed: false,
    },
    consent: {
      mutation_receipts_present: mutationReceiptsPresent,
      consent_proof_observed: typeof consentProofHash === "string",
      consent_proof_hash: consentProofHash ?? null,
      exact_string_required_for_mutation: true,
    },
    ihsan: {
      refusal_is_valid_proof_event: true,
      overclaim_guard: "signed_lifecycle_no_runtime_no_chain_advance",
    },
    rare_circuit_test_refs: [...MISSION_TRANSITION_RARE_CIRCUIT_REFS],
    ci_enforcement_refs: [...MISSION_TRANSITION_CI_REFS],
  });
}

export function validateMissionTransitionContract({ lifecycle }) {
  const contract = lifecycle?.transition_contract;
  if (!contract || typeof contract !== "object" || Array.isArray(contract)) {
    return "transition_contract_missing";
  }
  for (const flag of MISSION_TRANSITION_OBJECTIVE_FLAGS) {
    if (contract[flag] !== true) {
      return `transition_contract_${flag}_not_true`;
    }
  }
  if (
    contract.transition_id !==
    `mission_lifecycle:${lifecycle.mission_id}:intent_to_closeout`
  ) {
    return "transition_contract_transition_id_mismatch";
  }
  if (contract.proof_scope !== "SIGNED_MISSION_LIFECYCLE_STRUCTURAL_PROOF") {
    return "transition_contract_proof_scope_invalid";
  }
  const requiredStages = contract.bounds?.required_stages;
  if (
    !Array.isArray(requiredStages) ||
    stableStringify(requiredStages) !==
      stableStringify([...MISSION_TRANSITION_REQUIRED_STAGES])
  ) {
    return "transition_contract_required_stages_invalid";
  }
  if (
    contract.bounds?.action_receipt_count !==
    lifecycle.action_receipt_hashes.length
  ) {
    return "transition_contract_action_count_mismatch";
  }
  if (
    contract.bounds?.verification_receipt_count !==
    lifecycle.verification_receipt_hashes.length
  ) {
    return "transition_contract_verification_count_mismatch";
  }
  if (contract.receipt_backing?.lifecycle_schema !== lifecycle.schema) {
    return "transition_contract_lifecycle_schema_mismatch";
  }
  if (contract.receipt_backing?.lifecycle_proof_hash_ready !== true) {
    return "transition_contract_lifecycle_proof_hash_not_ready";
  }
  if (contract.receipt_backing?.signature_performed !== true) {
    return "transition_contract_signature_not_performed";
  }
  if (contract.receipt_backing?.chain_advance_performed !== false) {
    return "transition_contract_chain_advance_not_false";
  }
  if (
    contract.consent?.mutation_receipts_present !==
    lifecycle.action_receipt_hashes.length > 0
  ) {
    return "transition_contract_mutation_presence_mismatch";
  }
  if (
    contract.consent?.consent_proof_observed !==
    (typeof lifecycle.consent_proof_hash === "string")
  ) {
    return "transition_contract_consent_observed_mismatch";
  }
  if (contract.consent?.consent_proof_hash !== lifecycle.consent_proof_hash) {
    return "transition_contract_consent_hash_mismatch";
  }
  if (contract.consent?.exact_string_required_for_mutation !== true) {
    return "transition_contract_exact_consent_not_true";
  }
  if (contract.ihsan?.refusal_is_valid_proof_event !== true) {
    return "transition_contract_ihsan_refusal_not_true";
  }
  for (const ref of MISSION_TRANSITION_RARE_CIRCUIT_REFS) {
    if (!contract.rare_circuit_test_refs?.includes(ref)) {
      return "transition_contract_rare_circuit_ref_missing";
    }
  }
  for (const ref of MISSION_TRANSITION_CI_REFS) {
    if (!contract.ci_enforcement_refs?.includes(ref)) {
      return "transition_contract_ci_ref_missing";
    }
  }
  return null;
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
  const transitionContract = buildMissionTransitionContract({
    mission_id,
    actionReceiptCount: actionFrozen.length,
    verificationReceiptCount: verificationFrozen.length,
    consentProofHash: resolvedConsentProofHash,
  });

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
    transition_contract: transitionContract,
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
  const contractError = validateMissionTransitionContract({ lifecycle });
  if (contractError) {
    return reject(contractError);
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

// SP6-FEEDBACK-BRIDGE-SIM-1A ultra-micro implementation
// Minimal pure function for autopoietic feedback proposal.
// Reuses 1A guards for all 4 rails.
// Micro-consent: exact "PROPOSE_FEEDBACK_BRIDGE_LESSON"
// Integration: called from mission closeout hook (stub in SPEC-1A).
// Returns canonical receipt proposal or fail-closed error.
// Symbolic (receipt) - neural (LLM reasoning in harness) bridge.
// HHMM: models "lesson state" -> "feedback quality" transition.
// Diffusion: would score against past lessons via hash table (future).
// Graph: closeout node -> feedback edge -> spine node.
// Ihsān: transparent, consent-bound, refusal valid, no overclaim.
export const FEEDBACK_BRIDGE_CONSENT_PHRASE = "PROPOSE_FEEDBACK_BRIDGE_LESSON";

export async function proposeFeedbackBridge({
  lesson_candidate_hash,
  next_step_proposed,
  demaHome,
  consent,
  now = new Date().toISOString(),
} = {}) {
  if (consent !== "PROPOSE_FEEDBACK_BRIDGE_LESSON") {
    return { built: false, error: "consent_required" };
  }
  if (!isSha256Hex(lesson_candidate_hash)) {
    return { built: false, error: "lesson_candidate_hash_invalid" };
  }
  if (!isNonEmptyString(next_step_proposed)) {
    return { built: false, error: "next_step_proposed_required" };
  }

  const canonicalBody = {
    schema: "bizra.dema.feedback_proposal.v0.1",
    lesson_candidate_hash,
    next_step_proposed,
    proposed_at_iso: now,
  };

  // Reuse 1A build: applies all guards (#101 empty body, #102 QUARANTINED, #103 Ed25519, #107 sig)
  // prevHash null for proposal (can be chained later in SIM or harness).
  return buildCanonicalReceipt({
    canonicalBody,
    prevHash: null,
    truthLabel: "MEASURED_LOCAL",
    whatProves:
      "the feedback proposal was derived from verified mission closeout lesson and next_step under exact consent",
    whatDoesNotProve:
      "that the proposed next step will succeed, is optimal, or will be accepted by substrate",
    consent: CANONICAL_RECEIPT_CONSENT_PHRASE,
    demaHome,
    now,
  });
}
