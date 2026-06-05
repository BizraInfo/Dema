// MISSION-1A · Pure Mission Lifecycle Kernel tests.
//
// Covers all 9 DOD criteria from MISSION-0 preflight (§9) plus structural
// tail. Pure kernel — no CLI, no Realm renderer, no integration with
// runtime mission orchestrator. The kernel is pure-with-key-load:
// buildMissionLifecycle (open+close in one call per the immediate contract)
// and verifyMissionLifecycle (permissionless replay verifier).
//
// Schema reference: docs/security/MISSION_0_PREFLIGHT.md §3.
// Verification flow reference: docs/security/MISSION_0_PREFLIGHT.md §5.

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildMissionLifecycle,
  verifyMissionLifecycle,
  MISSION_LIFECYCLE_SCHEMA,
  MISSION_ACTION_TYPE,
  proposeFeedbackBridge,
  FEEDBACK_BRIDGE_CONSENT_PHRASE,
} from "../packages/mission/src/mission-lifecycle.js";
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

const VALID_INTENT = "Wire MISSION-1A pure lifecycle kernel";
const VALID_DOD = Object.freeze([
  "kernel module exists",
  "tests pass",
  "frozen envelope returned",
]);
const VALID_BLOCKERS = Object.freeze(["none-known"]);
const VALID_CLOSEOUT =
  "Kernel sealed; tests green; lifecycle envelope verified.";
const VALID_NEXT_STEP = "MISSION-1B CLI surfaces";

const FIXED_CREATED = "2026-05-30T08:00:00.000Z";
const FIXED_NONCE = "deadbeef".repeat(8);
const FIXED_EXPIRES = "2026-05-30T08:30:00.000Z";

const SHA256_HEX = /^[a-f0-9]{64}$/;
const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_C = "c".repeat(64);

async function freshHome() {
  return await mkdtemp(join(tmpdir(), "dema-mission-lifecycle-test-"));
}

function computeMissionId({ mission_intent, created_at_iso }) {
  return sha256(stableStringify({ mission_intent, created_at_iso }));
}

async function freshHomeWithKey() {
  const home = await freshHome();
  await initAuthorshipKey({
    consent: KEY_INIT_CONSENT_PHRASE,
    demaHome: home,
  });
  return home;
}

async function makeConsentProofForMission({
  home,
  missionId,
  createdAtIso = FIXED_CREATED,
  expiresAtIso = FIXED_EXPIRES,
  nonce = FIXED_NONCE,
}) {
  const r = await buildConsentProof({
    phrase: "SIGN AUTHORSHIP RECEIPT",
    actionScope: {
      action_type: MISSION_ACTION_TYPE,
      target_hash: sha256(missionId),
    },
    demaHome: home,
    nonce,
    createdAtIso,
    expiresAtIso,
  });
  if (!r.built) {
    throw new Error(`consent proof failed: ${r.error}`);
  }
  return r.consent_proof;
}

async function happyBuild({ home, withMutation = false, overrides = {} } = {}) {
  const ownHome = home || (await freshHomeWithKey());
  const createdAtIso = overrides.createdAtIso || FIXED_CREATED;
  const missionIntent = overrides.mission_intent || VALID_INTENT;
  const missionId = computeMissionId({
    mission_intent: missionIntent,
    created_at_iso: createdAtIso,
  });

  let action_receipt_hashes =
    overrides.action_receipt_hashes !== undefined
      ? overrides.action_receipt_hashes
      : withMutation
        ? [HASH_A, HASH_B]
        : [];
  let consentProof = overrides.consentProof;
  if (consentProof === undefined && action_receipt_hashes.length > 0) {
    consentProof = await makeConsentProofForMission({
      home: ownHome,
      missionId,
    });
  }

  const args = {
    mission_intent: missionIntent,
    dod_declared: overrides.dod_declared || [...VALID_DOD],
    blockers_identified: overrides.blockers_identified || [...VALID_BLOCKERS],
    pat_proposal_receipt_hash:
      overrides.pat_proposal_receipt_hash !== undefined
        ? overrides.pat_proposal_receipt_hash
        : null,
    sat_audit_receipt_hash:
      overrides.sat_audit_receipt_hash !== undefined
        ? overrides.sat_audit_receipt_hash
        : null,
    consent_proof_hash:
      overrides.consent_proof_hash !== undefined
        ? overrides.consent_proof_hash
        : consentProof
          ? consentProof.consent_proof_hash
          : null,
    action_receipt_hashes,
    verification_receipt_hashes:
      overrides.verification_receipt_hashes !== undefined
        ? overrides.verification_receipt_hashes
        : withMutation
          ? [HASH_C]
          : [],
    closeout_text:
      overrides.closeout_text !== undefined
        ? overrides.closeout_text
        : VALID_CLOSEOUT,
    lesson_candidate_hash:
      overrides.lesson_candidate_hash !== undefined
        ? overrides.lesson_candidate_hash
        : null,
    next_step_proposed:
      overrides.next_step_proposed !== undefined
        ? overrides.next_step_proposed
        : VALID_NEXT_STEP,
    consentProof: consentProof || null,
    demaHome: ownHome,
    createdAtIso,
  };
  const result = await buildMissionLifecycle(args);
  return { home: ownHome, result, missionId, consentProof };
}

describe("mission-lifecycle · buildMissionLifecycle (DOD-1, 2, 3, 4 + envelope shape)", () => {
  it("DOD-1 happy path (no mutation): built:true, frozen envelope, schema + shape", async () => {
    const { home, result, missionId } = await happyBuild();
    try {
      assert.equal(result.built, true);
      const env = result.lifecycle;
      assert.equal(env.schema, MISSION_LIFECYCLE_SCHEMA);
      assert.equal(env.mission_intent, VALID_INTENT);
      assert.deepEqual(env.dod_declared, [...VALID_DOD]);
      assert.deepEqual(env.blockers_identified, [...VALID_BLOCKERS]);
      assert.deepEqual(env.action_receipt_hashes, []);
      assert.deepEqual(env.verification_receipt_hashes, []);
      assert.equal(env.closeout_text, VALID_CLOSEOUT);
      assert.equal(env.next_step_proposed, VALID_NEXT_STEP);
      assert.equal(env.created_at_iso, FIXED_CREATED);
      assert.equal(env.mission_id, missionId);
      assert.ok(SHA256_HEX.test(env.mission_id), "mission_id is sha256 hex");
      assert.ok(SHA256_HEX.test(env.lifecycle_proof_hash));
      assert.ok(
        typeof env.lifecycle_signature_b64 === "string" &&
          env.lifecycle_signature_b64.length > 0,
      );
      assert.ok(Object.isFrozen(env));
      assert.ok(Object.isFrozen(result));
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-2 frozen envelope — mutation throws in strict mode", async () => {
    const { home, result } = await happyBuild();
    try {
      assert.throws(
        () => {
          result.lifecycle.mission_intent = "changed";
        },
        TypeError,
        "envelope must be frozen",
      );
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-3 deterministic: identical inputs → byte-identical lifecycle body", async () => {
    const home = await freshHomeWithKey();
    try {
      const args = {
        mission_intent: VALID_INTENT,
        dod_declared: [...VALID_DOD],
        blockers_identified: [...VALID_BLOCKERS],
        pat_proposal_receipt_hash: null,
        sat_audit_receipt_hash: null,
        consent_proof_hash: null,
        action_receipt_hashes: [],
        verification_receipt_hashes: [],
        closeout_text: VALID_CLOSEOUT,
        lesson_candidate_hash: null,
        next_step_proposed: VALID_NEXT_STEP,
        consentProof: null,
        demaHome: home,
        createdAtIso: FIXED_CREATED,
      };
      const a = await buildMissionLifecycle(args);
      const b = await buildMissionLifecycle(args);
      assert.equal(a.built, true);
      assert.equal(b.built, true);
      assert.deepEqual(a.lifecycle, b.lifecycle);
      assert.equal(
        a.lifecycle.lifecycle_proof_hash,
        b.lifecycle.lifecycle_proof_hash,
      );
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-4 fail-closed: empty mission_intent → built:false, error dod_required", async () => {
    const home = await freshHomeWithKey();
    try {
      const r = await buildMissionLifecycle({
        mission_intent: "",
        dod_declared: [...VALID_DOD],
        blockers_identified: [],
        pat_proposal_receipt_hash: null,
        sat_audit_receipt_hash: null,
        consent_proof_hash: null,
        action_receipt_hashes: [],
        verification_receipt_hashes: [],
        closeout_text: VALID_CLOSEOUT,
        lesson_candidate_hash: null,
        next_step_proposed: VALID_NEXT_STEP,
        consentProof: null,
        demaHome: home,
        createdAtIso: FIXED_CREATED,
      });
      assert.equal(r.built, false);
      assert.equal(r.error, "dod_required");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-4 fail-closed: empty dod_declared array → built:false, error dod_required", async () => {
    const home = await freshHomeWithKey();
    try {
      const r = await buildMissionLifecycle({
        mission_intent: VALID_INTENT,
        dod_declared: [],
        blockers_identified: [],
        pat_proposal_receipt_hash: null,
        sat_audit_receipt_hash: null,
        consent_proof_hash: null,
        action_receipt_hashes: [],
        verification_receipt_hashes: [],
        closeout_text: VALID_CLOSEOUT,
        lesson_candidate_hash: null,
        next_step_proposed: VALID_NEXT_STEP,
        consentProof: null,
        demaHome: home,
        createdAtIso: FIXED_CREATED,
      });
      assert.equal(r.built, false);
      assert.equal(r.error, "dod_required");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-4 fail-closed: dod_declared array of only empty strings → built:false, error dod_required", async () => {
    const home = await freshHomeWithKey();
    try {
      const r = await buildMissionLifecycle({
        mission_intent: VALID_INTENT,
        dod_declared: ["", "   "],
        blockers_identified: [],
        pat_proposal_receipt_hash: null,
        sat_audit_receipt_hash: null,
        consent_proof_hash: null,
        action_receipt_hashes: [],
        verification_receipt_hashes: [],
        closeout_text: VALID_CLOSEOUT,
        lesson_candidate_hash: null,
        next_step_proposed: VALID_NEXT_STEP,
        consentProof: null,
        demaHome: home,
        createdAtIso: FIXED_CREATED,
      });
      assert.equal(r.built, false);
      assert.equal(r.error, "dod_required");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-5 fail-closed: action_receipt_hashes non-empty but no consentProof → consent_proof_required_when_mutation", async () => {
    const home = await freshHomeWithKey();
    try {
      const r = await buildMissionLifecycle({
        mission_intent: VALID_INTENT,
        dod_declared: [...VALID_DOD],
        blockers_identified: [],
        pat_proposal_receipt_hash: null,
        sat_audit_receipt_hash: null,
        consent_proof_hash: null,
        action_receipt_hashes: [HASH_A],
        verification_receipt_hashes: [],
        closeout_text: VALID_CLOSEOUT,
        lesson_candidate_hash: null,
        next_step_proposed: VALID_NEXT_STEP,
        consentProof: null,
        demaHome: home,
        createdAtIso: FIXED_CREATED,
      });
      assert.equal(r.built, false);
      assert.equal(r.error, "consent_proof_required_when_mutation");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-6 fail-closed: empty closeout_text → built:false, error closeout_required", async () => {
    const home = await freshHomeWithKey();
    try {
      const r = await buildMissionLifecycle({
        mission_intent: VALID_INTENT,
        dod_declared: [...VALID_DOD],
        blockers_identified: [],
        pat_proposal_receipt_hash: null,
        sat_audit_receipt_hash: null,
        consent_proof_hash: null,
        action_receipt_hashes: [],
        verification_receipt_hashes: [],
        closeout_text: "",
        lesson_candidate_hash: null,
        next_step_proposed: VALID_NEXT_STEP,
        consentProof: null,
        demaHome: home,
        createdAtIso: FIXED_CREATED,
      });
      assert.equal(r.built, false);
      assert.equal(r.error, "closeout_required");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-7 fail-closed: action_receipt_hash not sha256 hex → action_receipt_hash_invalid", async () => {
    const home = await freshHomeWithKey();
    try {
      const missionId = computeMissionId({
        mission_intent: VALID_INTENT,
        created_at_iso: FIXED_CREATED,
      });
      const consentProof = await makeConsentProofForMission({
        home,
        missionId,
      });
      const r = await buildMissionLifecycle({
        mission_intent: VALID_INTENT,
        dod_declared: [...VALID_DOD],
        blockers_identified: [],
        pat_proposal_receipt_hash: null,
        sat_audit_receipt_hash: null,
        consent_proof_hash: consentProof.consent_proof_hash,
        action_receipt_hashes: ["not-a-hash"],
        verification_receipt_hashes: [],
        closeout_text: VALID_CLOSEOUT,
        lesson_candidate_hash: null,
        next_step_proposed: VALID_NEXT_STEP,
        consentProof,
        demaHome: home,
        createdAtIso: FIXED_CREATED,
      });
      assert.equal(r.built, false);
      assert.equal(r.error, "action_receipt_hash_invalid");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-7 fail-closed: uppercase hex action_receipt_hash → action_receipt_hash_invalid (must be lowercase hex)", async () => {
    const home = await freshHomeWithKey();
    try {
      const missionId = computeMissionId({
        mission_intent: VALID_INTENT,
        created_at_iso: FIXED_CREATED,
      });
      const consentProof = await makeConsentProofForMission({
        home,
        missionId,
      });
      const r = await buildMissionLifecycle({
        mission_intent: VALID_INTENT,
        dod_declared: [...VALID_DOD],
        blockers_identified: [],
        pat_proposal_receipt_hash: null,
        sat_audit_receipt_hash: null,
        consent_proof_hash: consentProof.consent_proof_hash,
        action_receipt_hashes: ["A".repeat(64)],
        verification_receipt_hashes: [],
        closeout_text: VALID_CLOSEOUT,
        lesson_candidate_hash: null,
        next_step_proposed: VALID_NEXT_STEP,
        consentProof,
        demaHome: home,
        createdAtIso: FIXED_CREATED,
      });
      assert.equal(r.built, false);
      assert.equal(r.error, "action_receipt_hash_invalid");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-8 fail-closed: verification_receipt_hash not sha256 hex → verification_receipt_hash_invalid", async () => {
    const home = await freshHomeWithKey();
    try {
      const r = await buildMissionLifecycle({
        mission_intent: VALID_INTENT,
        dod_declared: [...VALID_DOD],
        blockers_identified: [],
        pat_proposal_receipt_hash: null,
        sat_audit_receipt_hash: null,
        consent_proof_hash: null,
        action_receipt_hashes: [],
        verification_receipt_hashes: ["short"],
        closeout_text: VALID_CLOSEOUT,
        lesson_candidate_hash: null,
        next_step_proposed: VALID_NEXT_STEP,
        consentProof: null,
        demaHome: home,
        createdAtIso: FIXED_CREATED,
      });
      assert.equal(r.built, false);
      assert.equal(r.error, "verification_receipt_hash_invalid");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("mission_id is content-addressed: sha256(stableStringify({mission_intent, created_at_iso}))", async () => {
    const { home, result } = await happyBuild();
    try {
      const expected = sha256(
        stableStringify({
          mission_intent: VALID_INTENT,
          created_at_iso: FIXED_CREATED,
        }),
      );
      assert.equal(result.lifecycle.mission_id, expected);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-9 envelope contains NO private key material", async () => {
    const { home, result } = await happyBuild();
    try {
      const str = JSON.stringify(result);
      assert.ok(!str.includes("BEGIN PRIVATE KEY"));
      assert.ok(!str.includes("PRIVATE KEY"));
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-safe: no signing key on disk → built:false, error no_authorship_key", async () => {
    const home = await freshHome();
    try {
      const r = await buildMissionLifecycle({
        mission_intent: VALID_INTENT,
        dod_declared: [...VALID_DOD],
        blockers_identified: [],
        pat_proposal_receipt_hash: null,
        sat_audit_receipt_hash: null,
        consent_proof_hash: null,
        action_receipt_hashes: [],
        verification_receipt_hashes: [],
        closeout_text: VALID_CLOSEOUT,
        lesson_candidate_hash: null,
        next_step_proposed: VALID_NEXT_STEP,
        consentProof: null,
        demaHome: home,
        createdAtIso: FIXED_CREATED,
      });
      assert.equal(r.built, false);
      assert.equal(r.error, "no_authorship_key");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("mutation path with valid consentProof builds successfully", async () => {
    const { home, result } = await happyBuild({ withMutation: true });
    try {
      assert.equal(result.built, true);
      assert.deepEqual(result.lifecycle.action_receipt_hashes, [
        HASH_A,
        HASH_B,
      ]);
      assert.deepEqual(result.lifecycle.verification_receipt_hashes, [HASH_C]);
      assert.ok(SHA256_HEX.test(result.lifecycle.consent_proof_hash));
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});

describe("mission-lifecycle · verifyMissionLifecycle (signature + proof_hash + hash-shape)", () => {
  it("happy: built lifecycle verifies with the operator's pubkey → verified:true", async () => {
    const { home, result } = await happyBuild();
    try {
      const pubkey = await loadPublicKey(home);
      const v = verifyMissionLifecycle({
        lifecycle: result.lifecycle,
        pubkeyPem: pubkey,
      });
      assert.equal(v.verified, true);
      assert.equal(v.mission_id, result.lifecycle.mission_id);
      assert.equal(
        v.lifecycle_proof_hash,
        result.lifecycle.lifecycle_proof_hash,
      );
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("happy: mutation path verifies", async () => {
    const { home, result } = await happyBuild({ withMutation: true });
    try {
      const pubkey = await loadPublicKey(home);
      const v = verifyMissionLifecycle({
        lifecycle: result.lifecycle,
        pubkeyPem: pubkey,
      });
      assert.equal(v.verified, true);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("tampered body (mission_intent changed) but signature unchanged → lifecycle_proof_hash_mismatch", async () => {
    const { home, result } = await happyBuild();
    try {
      const pubkey = await loadPublicKey(home);
      const tampered = {
        ...result.lifecycle,
        mission_intent: "DIFFERENT INTENT",
      };
      const v = verifyMissionLifecycle({
        lifecycle: tampered,
        pubkeyPem: pubkey,
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "lifecycle_proof_hash_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("tampered body with recomputed proof_hash but original signature → lifecycle_signature_invalid", async () => {
    const { home, result } = await happyBuild();
    try {
      const pubkey = await loadPublicKey(home);
      const {
        lifecycle_signature_b64,
        lifecycle_proof_hash: _h,
        ...stableBody
      } = result.lifecycle;
      const tamperedStable = {
        ...stableBody,
        mission_intent: "DIFFERENT INTENT",
      };
      const rehash = sha256(stableStringify(tamperedStable));
      const tampered = {
        ...tamperedStable,
        lifecycle_signature_b64,
        lifecycle_proof_hash: rehash,
      };
      const v = verifyMissionLifecycle({
        lifecycle: tampered,
        pubkeyPem: pubkey,
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "lifecycle_signature_invalid");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("wrong external pubkey → lifecycle_signature_invalid", async () => {
    const { home, result } = await happyBuild();
    try {
      const wrong = generateEd25519Keypair();
      const v = verifyMissionLifecycle({
        lifecycle: result.lifecycle,
        pubkeyPem: wrong.public_key_pem,
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "lifecycle_signature_invalid");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("structural: empty pubkey → external_pubkey_required", async () => {
    const { home, result } = await happyBuild();
    try {
      const v = verifyMissionLifecycle({
        lifecycle: result.lifecycle,
        pubkeyPem: "",
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "external_pubkey_required");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("structural: schema mismatch → lifecycle_schema_mismatch", async () => {
    const { home, result } = await happyBuild();
    try {
      const pubkey = await loadPublicKey(home);
      const broken = { ...result.lifecycle, schema: "not.real.v0.1" };
      const v = verifyMissionLifecycle({
        lifecycle: broken,
        pubkeyPem: pubkey,
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "lifecycle_schema_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("structural: missing lifecycle envelope → lifecycle_missing_or_malformed", async () => {
    const v = verifyMissionLifecycle({
      lifecycle: null,
      pubkeyPem: "-----BEGIN PUBLIC KEY-----\nx\n-----END PUBLIC KEY-----",
    });
    assert.equal(v.verified, false);
    assert.equal(v.reason, "lifecycle_missing_or_malformed");
  });

  it("structural: action_receipt_hashes in stored body contains non-hex → action_receipt_hash_invalid (verifier re-checks)", async () => {
    const { home, result } = await happyBuild({ withMutation: true });
    try {
      const pubkey = await loadPublicKey(home);
      const {
        lifecycle_signature_b64: _s,
        lifecycle_proof_hash: _h,
        ...stableBody
      } = result.lifecycle;
      const tamperedStable = {
        ...stableBody,
        action_receipt_hashes: ["xx"],
      };
      const rehash = sha256(stableStringify(tamperedStable));
      const tampered = {
        ...tamperedStable,
        lifecycle_signature_b64: _s,
        lifecycle_proof_hash: rehash,
      };
      const v = verifyMissionLifecycle({
        lifecycle: tampered,
        pubkeyPem: pubkey,
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "action_receipt_hash_invalid");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("structural: verification_receipt_hashes in stored body contains non-hex → verification_receipt_hash_invalid (verifier re-checks)", async () => {
    const { home, result } = await happyBuild({ withMutation: true });
    try {
      const pubkey = await loadPublicKey(home);
      const {
        lifecycle_signature_b64: _s,
        lifecycle_proof_hash: _h,
        ...stableBody
      } = result.lifecycle;
      const tamperedStable = {
        ...stableBody,
        verification_receipt_hashes: ["yy"],
      };
      const rehash = sha256(stableStringify(tamperedStable));
      const tampered = {
        ...tamperedStable,
        lifecycle_signature_b64: _s,
        lifecycle_proof_hash: rehash,
      };
      const v = verifyMissionLifecycle({
        lifecycle: tampered,
        pubkeyPem: pubkey,
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "verification_receipt_hash_invalid");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("lifecycle_proof_hash is recomputable: sha256(stableStringify(body excluding lifecycle_signature_b64 + lifecycle_proof_hash))", async () => {
    const { home, result } = await happyBuild();
    try {
      const {
        lifecycle_signature_b64: _s,
        lifecycle_proof_hash,
        ...stableBody
      } = result.lifecycle;
      const recomputed = sha256(stableStringify(stableBody));
      assert.equal(recomputed, lifecycle_proof_hash);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  // SP6-SIM-HARNESS-1A: direct tests for proposeFeedbackBridge (pure, before any wiring)
  describe("proposeFeedbackBridge (SP6-SIM-HARNESS-1A)", () => {
    it("refuses without exact consent → consent_required", async () => {
      const home = await freshHomeWithKey();
      try {
        const r = await proposeFeedbackBridge({
          lesson_candidate_hash: HASH_A,
          next_step_proposed: "improve spine",
          demaHome: home,
          consent: "WRONG CONSENT",
        });
        assert.equal(r.built, false);
        assert.equal(r.error, "consent_required");
      } finally {
        await rm(home, { recursive: true, force: true });
      }
    });

    it("refuses if authorship key unavailable → no_authorship_key (reuses 1A)", async () => {
      const home = await freshHome(); // no key init
      try {
        const r = await proposeFeedbackBridge({
          lesson_candidate_hash: HASH_A,
          next_step_proposed: "improve spine",
          demaHome: home,
          consent: FEEDBACK_BRIDGE_CONSENT_PHRASE,
        });
        assert.equal(r.built, false);
        assert.equal(r.error, "no_authorship_key");
      } finally {
        await rm(home, { recursive: true, force: true });
      }
    });

    it("succeeds with exact consent + temp keyed Dema home → canonical proposal receipt (reuses 1A guards)", async () => {
      const home = await freshHomeWithKey();
      try {
        const r = await proposeFeedbackBridge({
          lesson_candidate_hash: HASH_A,
          next_step_proposed: "improve spine via feedback",
          demaHome: home,
          consent: FEEDBACK_BRIDGE_CONSENT_PHRASE,
        });
        assert.equal(r.built, true);
        assert.ok(r.receipt, "should return receipt");
        // The outer receipt is canonical (from 1A build); the feedback proposal is in canonical_body
        assert.equal(r.receipt.schema, "bizra.dema.canonical_receipt.v0.1");
        assert.equal(r.receipt.canonical_body.schema, "bizra.dema.feedback_proposal.v0.1");
        assert.equal(r.receipt.canonical_body.lesson_candidate_hash, HASH_A);
        assert.ok(r.receipt.receipt_signature_b64, "should have Ed25519 signature");
        assert.equal(r.receipt.prev_hash, null);
        // 1A guards ensure no QUARANTINED etc.
        assert.notEqual(r.receipt.truth_label, "QUARANTINED");
      } finally {
        await rm(home, { recursive: true, force: true });
      }
    });

    it("refuses invalid payload (non-hex lesson) → lesson_candidate_hash_invalid (exercises 1A guard path)", async () => {
      const home = await freshHomeWithKey();
      try {
        const r = await proposeFeedbackBridge({
          lesson_candidate_hash: "not-a-valid-hex",
          next_step_proposed: "improve",
          demaHome: home,
          consent: FEEDBACK_BRIDGE_CONSENT_PHRASE,
        });
        assert.equal(r.built, false);
        assert.equal(r.error, "lesson_candidate_hash_invalid");
        // Note: this path precedes build, but build would also guard; 1A reuse confirmed in happy path above.
      } finally {
        await rm(home, { recursive: true, force: true });
      }
    });
  });
});
