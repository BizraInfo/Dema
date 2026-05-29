// HOW-1A · House of Wisdom local lesson writer kernel — tests
//
// Tests all 8 DOD criteria from LEARN_0_PREFLIGHT.md §9 plus structural
// shape and the permissionless verifier (LEARN-1A §10 happy path).
//
// Schema reference: docs/security/LEARN_0_PREFLIGHT.md §3.
// Verification flow reference: docs/security/LEARN_0_PREFLIGHT.md §5.

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildLesson,
  verifyLesson,
  LESSON_SCHEMA,
  APPROVE_LESSON_ACTION_TYPE,
} from "../packages/learn/src/how-lesson-writer.js";
import { buildConsentProof } from "../packages/receipts/src/consent-proof.js";
import {
  initAuthorshipKey,
  KEY_INIT_CONSENT_PHRASE,
  loadPublicKey,
} from "../packages/receipts/src/authorship-key-store.js";
import { generateEd25519Keypair } from "../packages/receipts/src/authorship-signature.js";
import {
  sha256,
  stableStringify,
} from "../packages/consent/src/consent-common.js";

const VALID_EXP_HASH = "a".repeat(64);
const VALID_SAT_HASH = "b".repeat(64);
const VALID_MUMU_HASH = "c".repeat(64);
const REFLECTION = "I noticed the operator paused before approving.";
const LESSON = "When in doubt, halt and request explicit consent.";
const POLICY_TARGET = "policy.refusal.fetch_and_execute";
const FIXED_CREATED = "2026-05-30T08:00:00.000Z";
const FIXED_NOW_INSIDE_WINDOW = "2026-05-30T08:00:30.000Z";
const FIXED_NOW_AFTER_EXPIRY = "2026-05-30T08:10:00.000Z";
const FIXED_NONCE = "feedface".repeat(8);

async function freshHome() {
  return await mkdtemp(join(tmpdir(), "dema-how-lesson-test-"));
}

// Pre-compute the lesson_hash deterministically so the MuMu approval
// consent proof can bind target_hash = lesson_hash BEFORE the writer
// runs. Reflects the real flow: MuMu approves a specific lesson_text,
// not the post-signed envelope.
function computeLessonHash(lessonText) {
  return sha256(lessonText);
}

async function mintApprovalConsentProof({
  home,
  lessonHash,
  createdAtIso,
  expiresAtIso,
  nonce,
}) {
  return await buildConsentProof({
    phrase: "APPROVE LESSON",
    actionScope: {
      action_type: APPROVE_LESSON_ACTION_TYPE,
      target_hash: lessonHash,
    },
    demaHome: home,
    nonce: nonce || FIXED_NONCE,
    createdAtIso: createdAtIso || FIXED_CREATED,
    expiresAtIso:
      expiresAtIso ||
      new Date(
        new Date(createdAtIso || FIXED_CREATED).getTime() + 5 * 60 * 1000,
      ).toISOString(),
  });
}

async function buildOk(overrides = {}) {
  const home = await freshHome();
  await initAuthorshipKey({ consent: KEY_INIT_CONSENT_PHRASE, demaHome: home });
  const lessonHash = computeLessonHash(overrides.lesson_text || LESSON);
  const cp = await mintApprovalConsentProof({
    home,
    lessonHash,
  });
  const result = await buildLesson({
    experience_receipt_hash: VALID_EXP_HASH,
    reflection_text: REFLECTION,
    sat_review_receipt_hash: VALID_SAT_HASH,
    mumu_approval_consent_proof_hash: cp.consent_proof.consent_proof_hash,
    lesson_text: LESSON,
    policy_or_skill_target: POLICY_TARGET,
    mumuApprovalConsentProof: cp.consent_proof,
    demaHome: home,
    createdAtIso: FIXED_CREATED,
    ...overrides,
  });
  return {
    home,
    result,
    consentProof: cp.consent_proof,
    signerPubkeyPem: cp.signer_public_key_pem,
  };
}

describe("how-lesson-writer · buildLesson (DOD §9 happy path + shape)", () => {
  it("happy path: all four hashes + texts + valid consent → frozen envelope per §3", async () => {
    const { home, result } = await buildOk();
    try {
      assert.equal(result.built, true);
      const lesson = result.lesson;
      assert.equal(lesson.schema, LESSON_SCHEMA);
      assert.equal(lesson.experience_receipt_hash, VALID_EXP_HASH);
      assert.equal(lesson.reflection_text, REFLECTION);
      assert.equal(lesson.sat_review_receipt_hash, VALID_SAT_HASH);
      assert.equal(lesson.lesson_text, LESSON);
      assert.equal(lesson.policy_or_skill_target, POLICY_TARGET);
      assert.equal(lesson.share_status, "local_only");
      assert.equal(lesson.created_at_iso, FIXED_CREATED);
      assert.equal(lesson.reflection_hash, sha256(REFLECTION));
      assert.equal(lesson.lesson_hash, sha256(LESSON));
      assert.ok(/^[a-f0-9]{64}$/.test(lesson.lesson_id));
      assert.ok(/^[a-f0-9]{64}$/.test(lesson.operator_public_key_fingerprint));
      assert.ok(
        typeof lesson.lesson_signature_b64 === "string" &&
          lesson.lesson_signature_b64.length > 0,
      );
      assert.ok(/^[a-f0-9]{64}$/.test(lesson.lesson_proof_hash));
      assert.ok(Object.isFrozen(lesson));
      assert.ok(Object.isFrozen(result));
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD: share_status defaults to 'local_only' when not provided", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const lessonHash = computeLessonHash(LESSON);
      const cp = await mintApprovalConsentProof({ home, lessonHash });
      const r = await buildLesson({
        experience_receipt_hash: VALID_EXP_HASH,
        reflection_text: REFLECTION,
        sat_review_receipt_hash: VALID_SAT_HASH,
        mumu_approval_consent_proof_hash: cp.consent_proof.consent_proof_hash,
        lesson_text: LESSON,
        policy_or_skill_target: POLICY_TARGET,
        // share_status omitted
        mumuApprovalConsentProof: cp.consent_proof,
        demaHome: home,
        createdAtIso: FIXED_CREATED,
      });
      assert.equal(r.built, true);
      assert.equal(r.lesson.share_status, "local_only");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD: deterministic — identical inputs and injected createdAtIso → deep-equal envelopes", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const lessonHash = computeLessonHash(LESSON);
      const cp = await mintApprovalConsentProof({ home, lessonHash });
      const args = {
        experience_receipt_hash: VALID_EXP_HASH,
        reflection_text: REFLECTION,
        sat_review_receipt_hash: VALID_SAT_HASH,
        mumu_approval_consent_proof_hash: cp.consent_proof.consent_proof_hash,
        lesson_text: LESSON,
        policy_or_skill_target: POLICY_TARGET,
        share_status: "local_only",
        mumuApprovalConsentProof: cp.consent_proof,
        demaHome: home,
        createdAtIso: FIXED_CREATED,
      };
      const a = await buildLesson(args);
      const b = await buildLesson(args);
      assert.deepEqual(a, b);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});

describe("how-lesson-writer · fail-closed (DOD §9 fail-closed criteria)", () => {
  it("missing experience_receipt_hash → required_field_missing_experience_receipt_hash", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const cp = await mintApprovalConsentProof({
        home,
        lessonHash: computeLessonHash(LESSON),
      });
      const r = await buildLesson({
        experience_receipt_hash: "",
        reflection_text: REFLECTION,
        sat_review_receipt_hash: VALID_SAT_HASH,
        mumu_approval_consent_proof_hash: cp.consent_proof.consent_proof_hash,
        lesson_text: LESSON,
        policy_or_skill_target: POLICY_TARGET,
        mumuApprovalConsentProof: cp.consent_proof,
        demaHome: home,
        createdAtIso: FIXED_CREATED,
      });
      assert.equal(r.built, false);
      assert.equal(r.error, "required_field_missing_experience_receipt_hash");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("missing reflection_text → required_field_missing_reflection_text", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const cp = await mintApprovalConsentProof({
        home,
        lessonHash: computeLessonHash(LESSON),
      });
      const r = await buildLesson({
        experience_receipt_hash: VALID_EXP_HASH,
        reflection_text: "",
        sat_review_receipt_hash: VALID_SAT_HASH,
        mumu_approval_consent_proof_hash: cp.consent_proof.consent_proof_hash,
        lesson_text: LESSON,
        policy_or_skill_target: POLICY_TARGET,
        mumuApprovalConsentProof: cp.consent_proof,
        demaHome: home,
        createdAtIso: FIXED_CREATED,
      });
      assert.equal(r.built, false);
      assert.equal(r.error, "required_field_missing_reflection_text");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("missing sat_review_receipt_hash → required_field_missing_sat_review_receipt_hash", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const cp = await mintApprovalConsentProof({
        home,
        lessonHash: computeLessonHash(LESSON),
      });
      const r = await buildLesson({
        experience_receipt_hash: VALID_EXP_HASH,
        reflection_text: REFLECTION,
        sat_review_receipt_hash: "",
        mumu_approval_consent_proof_hash: cp.consent_proof.consent_proof_hash,
        lesson_text: LESSON,
        policy_or_skill_target: POLICY_TARGET,
        mumuApprovalConsentProof: cp.consent_proof,
        demaHome: home,
        createdAtIso: FIXED_CREATED,
      });
      assert.equal(r.built, false);
      assert.equal(r.error, "required_field_missing_sat_review_receipt_hash");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("missing mumu_approval_consent_proof_hash → required_field_missing_mumu_approval_consent_proof_hash", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const cp = await mintApprovalConsentProof({
        home,
        lessonHash: computeLessonHash(LESSON),
      });
      const r = await buildLesson({
        experience_receipt_hash: VALID_EXP_HASH,
        reflection_text: REFLECTION,
        sat_review_receipt_hash: VALID_SAT_HASH,
        mumu_approval_consent_proof_hash: "",
        lesson_text: LESSON,
        policy_or_skill_target: POLICY_TARGET,
        mumuApprovalConsentProof: cp.consent_proof,
        demaHome: home,
        createdAtIso: FIXED_CREATED,
      });
      assert.equal(r.built, false);
      assert.equal(
        r.error,
        "required_field_missing_mumu_approval_consent_proof_hash",
      );
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("missing lesson_text → required_field_missing_lesson_text", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const cp = await mintApprovalConsentProof({
        home,
        lessonHash: computeLessonHash(LESSON),
      });
      const r = await buildLesson({
        experience_receipt_hash: VALID_EXP_HASH,
        reflection_text: REFLECTION,
        sat_review_receipt_hash: VALID_SAT_HASH,
        mumu_approval_consent_proof_hash: cp.consent_proof.consent_proof_hash,
        lesson_text: "",
        policy_or_skill_target: POLICY_TARGET,
        mumuApprovalConsentProof: cp.consent_proof,
        demaHome: home,
        createdAtIso: FIXED_CREATED,
      });
      assert.equal(r.built, false);
      assert.equal(r.error, "required_field_missing_lesson_text");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("malformed experience_receipt_hash (not sha256 hex) → required_field_missing_experience_receipt_hash", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const cp = await mintApprovalConsentProof({
        home,
        lessonHash: computeLessonHash(LESSON),
      });
      const r = await buildLesson({
        experience_receipt_hash: "not-a-hash",
        reflection_text: REFLECTION,
        sat_review_receipt_hash: VALID_SAT_HASH,
        mumu_approval_consent_proof_hash: cp.consent_proof.consent_proof_hash,
        lesson_text: LESSON,
        policy_or_skill_target: POLICY_TARGET,
        mumuApprovalConsentProof: cp.consent_proof,
        demaHome: home,
        createdAtIso: FIXED_CREATED,
      });
      assert.equal(r.built, false);
      assert.equal(r.error, "required_field_missing_experience_receipt_hash");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("share_status non-default ('public') → share_status_invalid", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const cp = await mintApprovalConsentProof({
        home,
        lessonHash: computeLessonHash(LESSON),
      });
      const r = await buildLesson({
        experience_receipt_hash: VALID_EXP_HASH,
        reflection_text: REFLECTION,
        sat_review_receipt_hash: VALID_SAT_HASH,
        mumu_approval_consent_proof_hash: cp.consent_proof.consent_proof_hash,
        lesson_text: LESSON,
        policy_or_skill_target: POLICY_TARGET,
        share_status: "public",
        mumuApprovalConsentProof: cp.consent_proof,
        demaHome: home,
        createdAtIso: FIXED_CREATED,
      });
      assert.equal(r.built, false);
      assert.equal(r.error, "share_status_invalid");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("share_status 'candidate_shareable' is permitted", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const cp = await mintApprovalConsentProof({
        home,
        lessonHash: computeLessonHash(LESSON),
      });
      const r = await buildLesson({
        experience_receipt_hash: VALID_EXP_HASH,
        reflection_text: REFLECTION,
        sat_review_receipt_hash: VALID_SAT_HASH,
        mumu_approval_consent_proof_hash: cp.consent_proof.consent_proof_hash,
        lesson_text: LESSON,
        policy_or_skill_target: POLICY_TARGET,
        share_status: "candidate_shareable",
        mumuApprovalConsentProof: cp.consent_proof,
        demaHome: home,
        createdAtIso: FIXED_CREATED,
      });
      assert.equal(r.built, true);
      assert.equal(r.lesson.share_status, "candidate_shareable");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});

describe("how-lesson-writer · MuMu approval consent gate", () => {
  it("consent proof bound to a different lesson_hash → consent_scope_mismatch", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      // Consent proof bound to DIFFERENT lesson text's hash.
      const otherLesson = "Something completely else.";
      const cp = await mintApprovalConsentProof({
        home,
        lessonHash: computeLessonHash(otherLesson),
      });
      const r = await buildLesson({
        experience_receipt_hash: VALID_EXP_HASH,
        reflection_text: REFLECTION,
        sat_review_receipt_hash: VALID_SAT_HASH,
        mumu_approval_consent_proof_hash: cp.consent_proof.consent_proof_hash,
        lesson_text: LESSON, // hash differs from consent's target_hash
        policy_or_skill_target: POLICY_TARGET,
        mumuApprovalConsentProof: cp.consent_proof,
        demaHome: home,
        createdAtIso: FIXED_CREATED,
      });
      assert.equal(r.built, false);
      assert.equal(r.error, "consent_scope_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("consent proof action_type != APPROVE_LESSON → consent_scope_mismatch", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const lessonHash = computeLessonHash(LESSON);
      const cp = await buildConsentProof({
        phrase: "SIGN AUTHORSHIP RECEIPT",
        actionScope: {
          action_type: "MINT_VERDICT_RECEIPT", // WRONG type
          target_hash: lessonHash,
        },
        demaHome: home,
        nonce: FIXED_NONCE,
        createdAtIso: FIXED_CREATED,
        expiresAtIso: new Date(
          new Date(FIXED_CREATED).getTime() + 5 * 60 * 1000,
        ).toISOString(),
      });
      const r = await buildLesson({
        experience_receipt_hash: VALID_EXP_HASH,
        reflection_text: REFLECTION,
        sat_review_receipt_hash: VALID_SAT_HASH,
        mumu_approval_consent_proof_hash: cp.consent_proof.consent_proof_hash,
        lesson_text: LESSON,
        policy_or_skill_target: POLICY_TARGET,
        mumuApprovalConsentProof: cp.consent_proof,
        demaHome: home,
        createdAtIso: FIXED_CREATED,
      });
      assert.equal(r.built, false);
      assert.equal(r.error, "consent_scope_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("provided mumu_approval_consent_proof_hash field disagrees with envelope's consent_proof_hash → consent_scope_mismatch", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const lessonHash = computeLessonHash(LESSON);
      const cp = await mintApprovalConsentProof({ home, lessonHash });
      const r = await buildLesson({
        experience_receipt_hash: VALID_EXP_HASH,
        reflection_text: REFLECTION,
        sat_review_receipt_hash: VALID_SAT_HASH,
        // Claim a hash that does NOT match the supplied envelope.
        mumu_approval_consent_proof_hash: "d".repeat(64),
        lesson_text: LESSON,
        policy_or_skill_target: POLICY_TARGET,
        mumuApprovalConsentProof: cp.consent_proof,
        demaHome: home,
        createdAtIso: FIXED_CREATED,
      });
      assert.equal(r.built, false);
      assert.equal(r.error, "consent_scope_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});

describe("how-lesson-writer · verifyLesson (permissionless verifier)", () => {
  it("happy path: returns verified:true on untampered envelope with matching pubkey", async () => {
    const { home, result, signerPubkeyPem } = await buildOk();
    try {
      const v = verifyLesson({
        lesson: result.lesson,
        pubkeyPem: signerPubkeyPem,
      });
      assert.equal(v.verified, true);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("tampered lesson_text → lesson_hash_mismatch", async () => {
    const { home, result, signerPubkeyPem } = await buildOk();
    try {
      const tampered = { ...result.lesson, lesson_text: "different text" };
      const v = verifyLesson({
        lesson: tampered,
        pubkeyPem: signerPubkeyPem,
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "lesson_hash_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("tampered reflection_text → reflection_hash_mismatch", async () => {
    const { home, result, signerPubkeyPem } = await buildOk();
    try {
      const tampered = { ...result.lesson, reflection_text: "different" };
      const v = verifyLesson({
        lesson: tampered,
        pubkeyPem: signerPubkeyPem,
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "reflection_hash_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("wrong external pubkey → lesson_signature_invalid", async () => {
    const { home, result } = await buildOk();
    try {
      const wrong = generateEd25519Keypair();
      const v = verifyLesson({
        lesson: result.lesson,
        pubkeyPem: wrong.public_key_pem,
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "lesson_signature_invalid");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("lesson_proof_hash tampered → lesson_proof_hash_mismatch", async () => {
    const { home, result, signerPubkeyPem } = await buildOk();
    try {
      const tampered = {
        ...result.lesson,
        lesson_proof_hash: "e".repeat(64),
      };
      const v = verifyLesson({
        lesson: tampered,
        pubkeyPem: signerPubkeyPem,
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "lesson_proof_hash_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});

describe("how-lesson-writer · envelope content addressing", () => {
  it("lesson_id == sha256(stableStringify({experience_receipt_hash, lesson_hash, created_at_iso}))", async () => {
    const { home, result } = await buildOk();
    try {
      const expected = sha256(
        stableStringify({
          experience_receipt_hash: VALID_EXP_HASH,
          lesson_hash: sha256(LESSON),
          created_at_iso: FIXED_CREATED,
        }),
      );
      assert.equal(result.lesson.lesson_id, expected);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("envelope carries NO private key material", async () => {
    const { home, result } = await buildOk();
    try {
      const s = JSON.stringify(result);
      assert.ok(!s.includes("PRIVATE KEY"));
      assert.equal(result.lesson.private_key, undefined);
      assert.equal(result.lesson.private_key_pem, undefined);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("no signing key on disk → no_authorship_key", async () => {
    const home = await freshHome();
    try {
      // Init key just to mint a consent proof, then DELETE the key.
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const lessonHash = computeLessonHash(LESSON);
      const cp = await mintApprovalConsentProof({ home, lessonHash });
      // Rip out the key directory.
      await rm(join(home, "keys"), { recursive: true, force: true });
      const r = await buildLesson({
        experience_receipt_hash: VALID_EXP_HASH,
        reflection_text: REFLECTION,
        sat_review_receipt_hash: VALID_SAT_HASH,
        mumu_approval_consent_proof_hash: cp.consent_proof.consent_proof_hash,
        lesson_text: LESSON,
        policy_or_skill_target: POLICY_TARGET,
        mumuApprovalConsentProof: cp.consent_proof,
        demaHome: home,
        createdAtIso: FIXED_CREATED,
      });
      assert.equal(r.built, false);
      assert.equal(r.error, "no_authorship_key");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});
