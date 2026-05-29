// KEYCONSENT-1A · Pure Consent Proof Kernel tests
//
// Covers all 9 DOD criteria from the KEYCONSENT-0 preflight (§9) plus a
// short structural-validation tail. No CLI, no integration with existing
// gates, no nonce registry, no network — the kernel is pure-with-key-load.
//
// Schema reference: docs/security/KEYCONSENT_PREFLIGHT.md §3.
// Verification flow reference: docs/security/KEYCONSENT_PREFLIGHT.md §5.

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildConsentProof,
  verifyConsentProof,
  CONSENT_PROOF_SCHEMA,
} from "../packages/receipts/src/consent-proof.js";
import {
  initAuthorshipKey,
  KEY_INIT_CONSENT_PHRASE,
} from "../packages/receipts/src/authorship-key-store.js";
import { generateEd25519Keypair } from "../packages/receipts/src/authorship-signature.js";
import {
  sha256,
  stableStringify,
} from "../packages/consent/src/consent-common.js";

const VALID_PHRASE = "SIGN AUTHORSHIP RECEIPT";
const VALID_SCOPE = Object.freeze({
  action_type: "MINT_VERDICT_RECEIPT",
  target_hash: "a".repeat(64),
  rule_id: "canonical-shape.v0.1",
});
const FIXED_NONCE = "deadbeef".repeat(8); // 32 bytes = 64 hex chars
const FIXED_CREATED = "2026-05-29T08:00:00.000Z";
const FIXED_EXPIRES = "2026-05-29T08:05:00.000Z";
const FIXED_NOW_INSIDE_WINDOW = "2026-05-29T08:00:30.000Z";
const FIXED_NOW_AFTER_EXPIRY = "2026-05-29T08:10:00.000Z";

async function freshHome() {
  return await mkdtemp(join(tmpdir(), "dema-consent-proof-test-"));
}

async function buildOk(overrides = {}) {
  const home = await freshHome();
  await initAuthorshipKey({ consent: KEY_INIT_CONSENT_PHRASE, demaHome: home });
  const result = await buildConsentProof({
    phrase: VALID_PHRASE,
    actionScope: VALID_SCOPE,
    demaHome: home,
    nonce: FIXED_NONCE,
    createdAtIso: FIXED_CREATED,
    expiresAtIso: FIXED_EXPIRES,
    ...overrides,
  });
  return { home, result };
}

describe("consent-proof · buildConsentProof (DOD 1-3, 9 + envelope shape)", () => {
  it("DOD-1 determinism: identical injected nonce/now/expires → deep-equal", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const a = await buildConsentProof({
        phrase: VALID_PHRASE,
        actionScope: VALID_SCOPE,
        demaHome: home,
        nonce: FIXED_NONCE,
        createdAtIso: FIXED_CREATED,
        expiresAtIso: FIXED_EXPIRES,
      });
      const b = await buildConsentProof({
        phrase: VALID_PHRASE,
        actionScope: VALID_SCOPE,
        demaHome: home,
        nonce: FIXED_NONCE,
        createdAtIso: FIXED_CREATED,
        expiresAtIso: FIXED_EXPIRES,
      });
      assert.deepEqual(a, b);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-2 fail-closed: empty phrase → built:false, error consent_phrase_required", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const r = await buildConsentProof({
        phrase: "",
        actionScope: VALID_SCOPE,
        demaHome: home,
      });
      assert.equal(r.built, false);
      assert.equal(r.error, "consent_phrase_required");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-3 fail-safe: no signing key on disk → built:false, error no_authorship_key", async () => {
    const home = await freshHome();
    try {
      // Do NOT init key.
      const r = await buildConsentProof({
        phrase: VALID_PHRASE,
        actionScope: VALID_SCOPE,
        demaHome: home,
      });
      assert.equal(r.built, false);
      assert.equal(r.error, "no_authorship_key");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: missing action_type → built:false, error action_scope_invalid", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const r = await buildConsentProof({
        phrase: VALID_PHRASE,
        actionScope: { target_hash: "a".repeat(64) }, // missing action_type
        demaHome: home,
      });
      assert.equal(r.built, false);
      assert.equal(r.error, "action_scope_invalid");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: missing target_hash → built:false, error action_scope_invalid", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const r = await buildConsentProof({
        phrase: VALID_PHRASE,
        actionScope: { action_type: "X" }, // missing target_hash
        demaHome: home,
      });
      assert.equal(r.built, false);
      assert.equal(r.error, "action_scope_invalid");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-9 envelope contains NO private key material", async () => {
    const { home, result } = await buildOk();
    try {
      assert.equal(result.built, true);
      const envStr = JSON.stringify(result);
      assert.ok(
        !envStr.includes("BEGIN PRIVATE KEY"),
        "envelope must not contain BEGIN PRIVATE KEY marker",
      );
      assert.ok(
        !envStr.includes("PRIVATE KEY"),
        "envelope must not contain any PRIVATE KEY marker",
      );
      assert.equal(result.consent_proof.private_key, undefined);
      assert.equal(result.consent_proof.private_key_pem, undefined);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("envelope shape per §3 schema: all required fields present, correct shapes", async () => {
    const { home, result } = await buildOk();
    try {
      const cp = result.consent_proof;
      assert.equal(cp.schema, CONSENT_PROOF_SCHEMA);
      assert.equal(cp.consent_phrase, VALID_PHRASE);
      assert.equal(cp.action_scope.action_type, VALID_SCOPE.action_type);
      assert.equal(cp.action_scope.target_hash, VALID_SCOPE.target_hash);
      assert.equal(cp.action_scope.rule_id, VALID_SCOPE.rule_id);
      assert.equal(cp.nonce, FIXED_NONCE);
      assert.equal(cp.created_at_iso, FIXED_CREATED);
      assert.equal(cp.expires_at_iso, FIXED_EXPIRES);
      assert.ok(
        /^[a-f0-9]{64}$/.test(cp.operator_public_key_fingerprint),
        "fingerprint must be sha256 hex",
      );
      assert.ok(
        typeof cp.consent_signature_b64 === "string" &&
          cp.consent_signature_b64.length > 0,
      );
      assert.ok(
        /^[a-f0-9]{64}$/.test(cp.consent_proof_hash),
        "consent_proof_hash must be sha256 hex",
      );
      assert.ok(Object.isFrozen(cp));
      assert.ok(Object.isFrozen(result));
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("rule_id is optional in actionScope (omitted scope still builds)", async () => {
    const { home, result } = await buildOk({
      actionScope: {
        action_type: "MINT_VERDICT_RECEIPT",
        target_hash: "b".repeat(64),
      },
    });
    try {
      assert.equal(result.built, true);
      assert.equal(result.consent_proof.action_scope.rule_id, undefined);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});

describe("consent-proof · verifyConsentProof (DOD 4-8 + structural)", () => {
  it("happy: verify with matching external pubkey + within window → verified:true", async () => {
    const { home, result } = await buildOk();
    try {
      const v = verifyConsentProof({
        consentProof: result.consent_proof,
        pubkeyPem: result.signer_public_key_pem,
        now: FIXED_NOW_INSIDE_WINDOW,
      });
      assert.equal(v.verified, true);
      assert.equal(
        v.consent_proof_hash,
        result.consent_proof.consent_proof_hash,
      );
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-4 tampered consent body (consent_phrase changed) → consent_proof_hash_mismatch", async () => {
    const { home, result } = await buildOk();
    try {
      const tampered = {
        ...result.consent_proof,
        consent_phrase: "DIFFERENT PHRASE",
      };
      const v = verifyConsentProof({
        consentProof: tampered,
        pubkeyPem: result.signer_public_key_pem,
        now: FIXED_NOW_INSIDE_WINDOW,
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "consent_proof_hash_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-4 tampered body re-hashed (attacker rebuilt hash to match) but signature unchanged → consent_signature_invalid", async () => {
    const { home, result } = await buildOk();
    try {
      const {
        consent_signature_b64: _s,
        consent_proof_hash: _h,
        ...stableBody
      } = result.consent_proof;
      const tamperedStable = { ...stableBody, consent_phrase: "DIFFERENT" };
      const rehash = sha256(stableStringify(tamperedStable));
      const tampered = {
        ...tamperedStable,
        consent_signature_b64: result.consent_proof.consent_signature_b64,
        consent_proof_hash: rehash,
      };
      const v = verifyConsentProof({
        consentProof: tampered,
        pubkeyPem: result.signer_public_key_pem,
        now: FIXED_NOW_INSIDE_WINDOW,
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "consent_signature_invalid");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-5 wrong external pubkey → consent_signature_invalid", async () => {
    const { home, result } = await buildOk();
    try {
      const wrongKey = generateEd25519Keypair();
      const v = verifyConsentProof({
        consentProof: result.consent_proof,
        pubkeyPem: wrongKey.public_key_pem,
        now: FIXED_NOW_INSIDE_WINDOW,
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "consent_signature_invalid");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-6 scope mismatch on action_type → consent_scope_mismatch", async () => {
    const { home, result } = await buildOk();
    try {
      const v = verifyConsentProof({
        consentProof: result.consent_proof,
        pubkeyPem: result.signer_public_key_pem,
        now: FIXED_NOW_INSIDE_WINDOW,
        expectedActionScope: {
          action_type: "DIFFERENT_ACTION",
          target_hash: VALID_SCOPE.target_hash,
        },
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "consent_scope_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-6 scope mismatch on target_hash → consent_scope_mismatch", async () => {
    const { home, result } = await buildOk();
    try {
      const v = verifyConsentProof({
        consentProof: result.consent_proof,
        pubkeyPem: result.signer_public_key_pem,
        now: FIXED_NOW_INSIDE_WINDOW,
        expectedActionScope: {
          action_type: VALID_SCOPE.action_type,
          target_hash: "c".repeat(64),
        },
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "consent_scope_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-6 scope match (action_type + target_hash agree) → verified:true even if rule_id only in envelope", async () => {
    const { home, result } = await buildOk();
    try {
      const v = verifyConsentProof({
        consentProof: result.consent_proof,
        pubkeyPem: result.signer_public_key_pem,
        now: FIXED_NOW_INSIDE_WINDOW,
        expectedActionScope: {
          action_type: VALID_SCOPE.action_type,
          target_hash: VALID_SCOPE.target_hash,
        },
      });
      assert.equal(v.verified, true);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-7 expired (now > expires_at_iso) with injected now → consent_expired", async () => {
    const { home, result } = await buildOk();
    try {
      const v = verifyConsentProof({
        consentProof: result.consent_proof,
        pubkeyPem: result.signer_public_key_pem,
        now: FIXED_NOW_AFTER_EXPIRY,
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "consent_expired");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-8 consent_proof_hash recomputes from stable body (excluding sig + hash field)", async () => {
    const { home, result } = await buildOk();
    try {
      const cp = result.consent_proof;
      const {
        consent_signature_b64: _s,
        consent_proof_hash: _h,
        ...stableBody
      } = cp;
      const recomputed = sha256(stableStringify(stableBody));
      assert.equal(recomputed, cp.consent_proof_hash);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("structural: empty pubkey → external_pubkey_required", async () => {
    const { home, result } = await buildOk();
    try {
      const v = verifyConsentProof({
        consentProof: result.consent_proof,
        pubkeyPem: "",
        now: FIXED_NOW_INSIDE_WINDOW,
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "external_pubkey_required");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("structural: wrong schema → consent_proof_schema_mismatch", async () => {
    const { home, result } = await buildOk();
    try {
      const broken = { ...result.consent_proof, schema: "not.real.v0.1" };
      const v = verifyConsentProof({
        consentProof: broken,
        pubkeyPem: result.signer_public_key_pem,
        now: FIXED_NOW_INSIDE_WINDOW,
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "consent_proof_schema_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("structural: missing required field surfaces structural_missing_field_<name>", async () => {
    const { home, result } = await buildOk();
    try {
      const broken = { ...result.consent_proof };
      delete broken.nonce;
      const v = verifyConsentProof({
        consentProof: broken,
        pubkeyPem: result.signer_public_key_pem,
        now: FIXED_NOW_INSIDE_WINDOW,
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "structural_missing_field_nonce");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});
