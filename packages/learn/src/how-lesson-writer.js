// HOW-1A · House of Wisdom local lesson writer kernel
//
// Turns an experience → reflection → SAT-review → MuMu-approval chain
// into a signed, content-addressed House of Wisdom lesson envelope.
// Pure kernel (with key load + consent gate). No CLI, no Realm UI,
// no policy/skill update — those are LEARN-2 and later.
//
// Reuses (no duplication):
// - signPayload, verifyPayload      packages/receipts/src/authorship-signature.js
// - loadPrivateKey, loadPublicKey   packages/receipts/src/authorship-key-store.js
// - sha256, stableStringify         packages/consent/src/consent-common.js
// - verifyConsentProof              packages/receipts/src/consent-proof.js
//
// Spec reference: docs/security/LEARN_0_PREFLIGHT.md §3 (schema), §5
// (verification flow), §9 (DOD).
//
// SCOPE (this slice):
// - Pure kernel + key load + consent gate.
// - No persistence here (writer returns the envelope; persistence is a
//   separate caller responsibility — keeps the kernel pure).
// - share_status default "local_only"; "candidate_shareable" allowed;
//   any other value rejected.

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
import { verifyConsentProof } from "../../receipts/src/consent-proof.js";

export const LESSON_SCHEMA = "bizra.dema.house_of_wisdom_lesson.v0.1";

// Stable action_type the MuMu approval consent proof must declare.
// Cross-action consent reuse → consent_scope_mismatch (same pattern
// the verdict-attest slice established for MINT_VERDICT_RECEIPT).
export const APPROVE_LESSON_ACTION_TYPE = "APPROVE_LESSON";

// share_status whitelist this slice. Any other value rejected:
// `share_status_invalid`. Federation / public is explicitly out of
// scope per preflight §6.
const PERMITTED_SHARE_STATUS = Object.freeze([
  "local_only",
  "candidate_shareable",
]);
const DEFAULT_SHARE_STATUS = "local_only";

const SHA256_HEX = /^[a-f0-9]{64}$/;

function isSha256Hex(s) {
  return typeof s === "string" && SHA256_HEX.test(s);
}

function fail(error) {
  return Object.freeze({ built: false, error });
}

function fingerprintFromPem(pubkeyPem) {
  const pk = createPublicKey(pubkeyPem);
  const der = pk.export({ type: "spki", format: "der" });
  return sha256(der.toString("hex"));
}

export async function buildLesson({
  experience_receipt_hash,
  reflection_text,
  sat_review_receipt_hash,
  mumu_approval_consent_proof_hash,
  lesson_text,
  policy_or_skill_target,
  share_status,
  mumuApprovalConsentProof,
  demaHome,
  createdAtIso,
}) {
  // ── (1) Required-field gate (preflight DOD §9) ────────────────────
  if (!isSha256Hex(experience_receipt_hash)) {
    return fail("required_field_missing_experience_receipt_hash");
  }
  if (typeof reflection_text !== "string" || reflection_text.length === 0) {
    return fail("required_field_missing_reflection_text");
  }
  if (!isSha256Hex(sat_review_receipt_hash)) {
    return fail("required_field_missing_sat_review_receipt_hash");
  }
  if (!isSha256Hex(mumu_approval_consent_proof_hash)) {
    return fail("required_field_missing_mumu_approval_consent_proof_hash");
  }
  if (typeof lesson_text !== "string" || lesson_text.length === 0) {
    return fail("required_field_missing_lesson_text");
  }

  // ── (2) share_status whitelist (preflight §3 + DOD §9) ────────────
  const resolvedShareStatus =
    typeof share_status === "string" && share_status.length > 0
      ? share_status
      : DEFAULT_SHARE_STATUS;
  if (!PERMITTED_SHARE_STATUS.includes(resolvedShareStatus)) {
    return fail("share_status_invalid");
  }

  // ── (3) Load operator signing key ─────────────────────────────────
  const privateKeyPem = await loadPrivateKey(demaHome);
  if (!privateKeyPem) {
    return fail("no_authorship_key");
  }
  const publicKeyPem = await loadPublicKey(demaHome);
  if (!publicKeyPem) {
    return fail("no_authorship_key");
  }

  // ── (4) Compute content addresses ─────────────────────────────────
  const reflectionHash = sha256(reflection_text);
  const lessonHash = sha256(lesson_text);

  // ── (5) MuMu approval consent gate ────────────────────────────────
  // Per preflight §5 step 6: the supplied consent proof must verify
  // against the operator pubkey, with action_type APPROVE_LESSON and
  // target_hash == lesson_hash (semantic: MuMu signed THIS specific
  // lesson_text, not some other lesson).
  //
  // We also require the supplied mumu_approval_consent_proof_hash
  // field to actually equal the envelope's consent_proof_hash — the
  // committed-hash must match the supplied envelope, otherwise the
  // body would commit to a hash whose preimage we cannot prove.
  if (
    !mumuApprovalConsentProof ||
    typeof mumuApprovalConsentProof !== "object"
  ) {
    return fail("consent_scope_mismatch");
  }
  if (
    mumuApprovalConsentProof.consent_proof_hash !==
    mumu_approval_consent_proof_hash
  ) {
    return fail("consent_scope_mismatch");
  }
  const consentVerify = verifyConsentProof({
    consentProof: mumuApprovalConsentProof,
    pubkeyPem: publicKeyPem,
    expectedActionScope: {
      action_type: APPROVE_LESSON_ACTION_TYPE,
      target_hash: lessonHash,
    },
    now: createdAtIso || new Date().toISOString(),
  });
  if (!consentVerify.verified) {
    // Collapse all consent failures into a single scope-mismatch error
    // surface so the writer's contract stays narrow. Detailed reason
    // is available via the LEARN-1A verifier.
    return fail("consent_scope_mismatch");
  }

  // ── (6) Build envelope body (everything except sig + proof_hash) ──
  const createdIso = createdAtIso || new Date().toISOString();
  const fingerprint = fingerprintFromPem(publicKeyPem);
  const lessonId = sha256(
    stableStringify({
      experience_receipt_hash,
      lesson_hash: lessonHash,
      created_at_iso: createdIso,
    }),
  );

  const stableBody = Object.freeze({
    schema: LESSON_SCHEMA,
    lesson_id: lessonId,
    experience_receipt_hash,
    reflection_text,
    reflection_hash: reflectionHash,
    sat_review_receipt_hash,
    mumu_approval_consent_proof_hash,
    lesson_text,
    lesson_hash: lessonHash,
    policy_or_skill_target:
      typeof policy_or_skill_target === "string" ? policy_or_skill_target : "",
    share_status: resolvedShareStatus,
    created_at_iso: createdIso,
    operator_public_key_fingerprint: fingerprint,
  });

  // ── (7) Sign and content-address ──────────────────────────────────
  const signature = signPayload(stableBody, privateKeyPem);
  const lessonProofHash = sha256(stableStringify(stableBody));

  const lesson = Object.freeze({
    ...stableBody,
    lesson_signature_b64: signature,
    lesson_proof_hash: lessonProofHash,
  });

  return Object.freeze({
    built: true,
    lesson,
  });
}

function reject(reason) {
  return Object.freeze({ verified: false, reason });
}

// Permissionless verifier — performs the cryptographic + content-address
// checks a stranger holding only the lesson envelope + external pubkey
// can do (preflight §5 steps 1, 2, 4, 7, 8). Receipt-resolution checks
// (steps 3, 5, 6) belong to the LEARN-1A bundle verifier and require
// the full bundle + resolveReceiptHash callback.
export function verifyLesson({ lesson, pubkeyPem }) {
  if (!lesson || typeof lesson !== "object" || Array.isArray(lesson)) {
    return reject("lesson_missing_or_malformed");
  }
  if (lesson.schema !== LESSON_SCHEMA) {
    return reject("lesson_schema_mismatch");
  }
  if (
    typeof pubkeyPem !== "string" ||
    !pubkeyPem.includes("BEGIN PUBLIC KEY")
  ) {
    return reject("external_pubkey_required");
  }

  // (step 4) reflection_hash matches reflection_text.
  if (sha256(lesson.reflection_text) !== lesson.reflection_hash) {
    return reject("reflection_hash_mismatch");
  }

  // (step 7) lesson_hash matches lesson_text.
  if (sha256(lesson.lesson_text) !== lesson.lesson_hash) {
    return reject("lesson_hash_mismatch");
  }

  // (step 2 / step 8) lesson_proof_hash recomputes from stable body.
  const { lesson_signature_b64, lesson_proof_hash, ...stableBody } = lesson;
  const recomputed = sha256(stableStringify(stableBody));
  if (recomputed !== lesson_proof_hash) {
    return reject("lesson_proof_hash_mismatch");
  }

  // (step 1) lesson signature valid under external pubkey.
  let sigValid;
  try {
    sigValid = verifyPayload(stableBody, lesson_signature_b64, pubkeyPem);
  } catch {
    sigValid = false;
  }
  if (!sigValid) {
    return reject("lesson_signature_invalid");
  }

  return Object.freeze({
    verified: true,
    lesson_proof_hash,
    lesson_hash: lesson.lesson_hash,
    lesson_id: lesson.lesson_id,
  });
}
