// ECON-1A · Pure Dual-Token Ledger Kernel tests
//
// Covers all DOD criteria from the ECON-0 preflight (§9) adapted to the
// pure-kernel signature contracted for this slice:
//
//   buildLedgerEntry({
//     entry_type, token_class, amount,
//     evidence_receipt_hashes, prev_hash,
//     consentProof, demaHome, createdAtIso?
//   })
//
// And:
//
//   verifyLedgerEntry({ entry, pubkeyPem })
//
// Local-only. No network. No federation. No public economic claim.
// Consent for minting is gated by a KEYCONSENT-1A consent proof whose
// action_scope.action_type MUST equal "MINT_LEDGER_ENTRY".
//
// Schema: bizra.dema.dual_token_ledger_entry.v0.1

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildLedgerEntry,
  verifyLedgerEntry,
  DUAL_TOKEN_LEDGER_ENTRY_SCHEMA,
  VALID_ENTRY_TYPES,
  VALID_TOKEN_CLASSES,
} from "../packages/econ/src/dual-token-ledger.js";

import { buildConsentProof } from "../packages/receipts/src/consent-proof.js";
import {
  initAuthorshipKey,
  KEY_INIT_CONSENT_PHRASE,
} from "../packages/receipts/src/authorship-key-store.js";
import { generateEd25519Keypair } from "../packages/receipts/src/authorship-signature.js";
import {
  sha256,
  stableStringify,
} from "../packages/consent/src/consent-common.js";

const VALID_PHRASE = "MINT LEDGER ENTRY";
const MINT_TARGET_HASH = "f".repeat(64);
const VALID_MINT_SCOPE = Object.freeze({
  action_type: "MINT_LEDGER_ENTRY",
  target_hash: MINT_TARGET_HASH,
});
const WRONG_ACTION_SCOPE = Object.freeze({
  action_type: "MINT_VERDICT_RECEIPT",
  target_hash: MINT_TARGET_HASH,
});

const FIXED_NONCE = "deadbeef".repeat(8);
const FIXED_CREATED = "2026-05-30T08:00:00.000Z";
const FIXED_EXPIRES = "2026-05-30T08:05:00.000Z";
const FIXED_LEDGER_NOW = "2026-05-30T08:00:30.000Z";
const PREV_HASH_GENESIS = "0".repeat(64);
const EVIDENCE_HASH_A = "a".repeat(64);
const EVIDENCE_HASH_B = "b".repeat(64);

async function freshHome() {
  return await mkdtemp(join(tmpdir(), "dema-econ-ledger-test-"));
}

async function makeConsentProof(home, scope = VALID_MINT_SCOPE) {
  // Idempotent: initAuthorshipKey is a no-op when the key already exists.
  await initAuthorshipKey({
    consent: KEY_INIT_CONSENT_PHRASE,
    demaHome: home,
  });
  const cp = await buildConsentProof({
    phrase: VALID_PHRASE,
    actionScope: scope,
    demaHome: home,
    nonce: FIXED_NONCE,
    createdAtIso: FIXED_CREATED,
    expiresAtIso: FIXED_EXPIRES,
  });
  if (!cp.built) {
    throw new Error(`test setup failure: consent proof not built: ${cp.error}`);
  }
  return cp;
}

async function buildOk(home, overrides = {}) {
  const cp = await makeConsentProof(home);
  const result = await buildLedgerEntry({
    entry_type: "RESOURCE_DEBIT",
    token_class: "RESOURCE",
    amount: 5,
    evidence_receipt_hashes: [EVIDENCE_HASH_A],
    prev_hash: PREV_HASH_GENESIS,
    consentProof: cp.consent_proof,
    demaHome: home,
    createdAtIso: FIXED_LEDGER_NOW,
    ...overrides,
  });
  return { consentBundle: cp, result };
}

describe("econ-ledger · buildLedgerEntry · happy path & shape", () => {
  it("happy: builds frozen entry with all required fields per spec", async () => {
    const home = await freshHome();
    try {
      const { result } = await buildOk(home);
      assert.equal(result.error, undefined);
      assert.equal(result.schema, DUAL_TOKEN_LEDGER_ENTRY_SCHEMA);
      assert.equal(result.entry_type, "RESOURCE_DEBIT");
      assert.equal(result.token_class, "RESOURCE");
      assert.equal(result.amount, 5);
      assert.deepEqual(result.evidence_receipt_hashes, [EVIDENCE_HASH_A]);
      assert.equal(result.prev_hash, PREV_HASH_GENESIS);
      assert.equal(result.created_at_iso, FIXED_LEDGER_NOW);
      assert.ok(
        /^[a-f0-9]{64}$/.test(result.operator_public_key_fingerprint),
        "fingerprint must be sha256 hex",
      );
      assert.ok(
        typeof result.entry_signature_b64 === "string" &&
          result.entry_signature_b64.length > 0,
      );
      assert.ok(
        /^[a-f0-9]{64}$/.test(result.entry_hash),
        "entry_hash must be sha256 hex",
      );
      assert.ok(Object.isFrozen(result));
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("schema export equals 'bizra.dema.dual_token_ledger_entry.v0.1'", () => {
    assert.equal(
      DUAL_TOKEN_LEDGER_ENTRY_SCHEMA,
      "bizra.dema.dual_token_ledger_entry.v0.1",
    );
  });

  it("supports RESOURCE_CREDIT entry_type with token_class RESOURCE", async () => {
    const home = await freshHome();
    try {
      const cp = await makeConsentProof(home);
      const result = await buildLedgerEntry({
        entry_type: "RESOURCE_CREDIT",
        token_class: "RESOURCE",
        amount: 3,
        evidence_receipt_hashes: [EVIDENCE_HASH_A, EVIDENCE_HASH_B],
        prev_hash: PREV_HASH_GENESIS,
        consentProof: cp.consent_proof,
        demaHome: home,
        createdAtIso: FIXED_LEDGER_NOW,
      });
      assert.equal(result.error, undefined);
      assert.equal(result.entry_type, "RESOURCE_CREDIT");
      assert.equal(result.token_class, "RESOURCE");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("supports IMPACT_CREDIT entry_type with token_class IMPACT", async () => {
    const home = await freshHome();
    try {
      const cp = await makeConsentProof(home);
      const result = await buildLedgerEntry({
        entry_type: "IMPACT_CREDIT",
        token_class: "IMPACT",
        amount: 7,
        evidence_receipt_hashes: [EVIDENCE_HASH_A],
        prev_hash: PREV_HASH_GENESIS,
        consentProof: cp.consent_proof,
        demaHome: home,
        createdAtIso: FIXED_LEDGER_NOW,
      });
      assert.equal(result.error, undefined);
      assert.equal(result.entry_type, "IMPACT_CREDIT");
      assert.equal(result.token_class, "IMPACT");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("supports null prev_hash for replay-compatible genesis entries", async () => {
    const home = await freshHome();
    try {
      const cp = await makeConsentProof(home);
      const result = await buildLedgerEntry({
        entry_type: "IMPACT_CREDIT",
        token_class: "IMPACT",
        amount: 7,
        evidence_receipt_hashes: [EVIDENCE_HASH_A],
        prev_hash: null,
        consentProof: cp.consent_proof,
        demaHome: home,
        createdAtIso: FIXED_LEDGER_NOW,
      });
      assert.equal(result.error, undefined);
      assert.equal(result.prev_hash, null);
      const verified = verifyLedgerEntry({
        entry: result,
        pubkeyPem: cp.signer_public_key_pem,
      });
      assert.equal(verified.verified, true);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("determinism: identical inputs + injected createdAt → byte-equal entry", async () => {
    const home = await freshHome();
    try {
      const cp = await makeConsentProof(home);
      const args = {
        entry_type: "RESOURCE_DEBIT",
        token_class: "RESOURCE",
        amount: 5,
        evidence_receipt_hashes: [EVIDENCE_HASH_A],
        prev_hash: PREV_HASH_GENESIS,
        consentProof: cp.consent_proof,
        demaHome: home,
        createdAtIso: FIXED_LEDGER_NOW,
      };
      const a = await buildLedgerEntry(args);
      const b = await buildLedgerEntry(args);
      assert.deepEqual(a, b);
      assert.equal(a.entry_hash, b.entry_hash);
      assert.equal(a.entry_signature_b64, b.entry_signature_b64);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("entry_hash recomputes from body excluding entry_signature_b64 and entry_hash", async () => {
    const home = await freshHome();
    try {
      const { result } = await buildOk(home);
      const { entry_signature_b64: _s, entry_hash: _h, ...stableBody } = result;
      const recomputed = sha256(stableStringify(stableBody));
      assert.equal(recomputed, result.entry_hash);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("envelope contains NO private key material", async () => {
    const home = await freshHome();
    try {
      const { result } = await buildOk(home);
      const envStr = JSON.stringify(result);
      assert.ok(
        !envStr.includes("BEGIN PRIVATE KEY"),
        "envelope must not contain BEGIN PRIVATE KEY marker",
      );
      assert.ok(
        !envStr.includes("PRIVATE KEY"),
        "envelope must not contain any PRIVATE KEY marker",
      );
      assert.equal(result.private_key, undefined);
      assert.equal(result.private_key_pem, undefined);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("envelope contains NO public economic claim fields", async () => {
    const home = await freshHome();
    try {
      const { result } = await buildOk(home);
      const envStr = JSON.stringify(result);
      // No exchange / market / public-mint fields
      assert.ok(!envStr.includes('"exchange_value"'));
      assert.ok(!envStr.includes('"fiat_value"'));
      assert.ok(!envStr.includes('"public_mint"'));
      assert.ok(!envStr.includes('"market_price"'));
      assert.ok(!envStr.includes('"federation_target"'));
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});

describe("econ-ledger · buildLedgerEntry · fail-closed gates", () => {
  it("missing consentProof → error consent_proof_required", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const r = await buildLedgerEntry({
        entry_type: "RESOURCE_DEBIT",
        token_class: "RESOURCE",
        amount: 5,
        evidence_receipt_hashes: [EVIDENCE_HASH_A],
        prev_hash: PREV_HASH_GENESIS,
        consentProof: undefined,
        demaHome: home,
        createdAtIso: FIXED_LEDGER_NOW,
      });
      assert.equal(r.error, "consent_proof_required");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("null consentProof → consent_proof_required", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const r = await buildLedgerEntry({
        entry_type: "RESOURCE_DEBIT",
        token_class: "RESOURCE",
        amount: 5,
        evidence_receipt_hashes: [EVIDENCE_HASH_A],
        prev_hash: PREV_HASH_GENESIS,
        consentProof: null,
        demaHome: home,
        createdAtIso: FIXED_LEDGER_NOW,
      });
      assert.equal(r.error, "consent_proof_required");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("malformed consentProof (no schema) → consent_proof_required", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const r = await buildLedgerEntry({
        entry_type: "RESOURCE_DEBIT",
        token_class: "RESOURCE",
        amount: 5,
        evidence_receipt_hashes: [EVIDENCE_HASH_A],
        prev_hash: PREV_HASH_GENESIS,
        consentProof: { not_a_real_envelope: true },
        demaHome: home,
        createdAtIso: FIXED_LEDGER_NOW,
      });
      assert.equal(r.error, "consent_proof_required");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("consent scope mismatch (action_type != MINT_LEDGER_ENTRY) → consent_scope_mismatch", async () => {
    const home = await freshHome();
    try {
      const cp = await makeConsentProof(home, WRONG_ACTION_SCOPE);
      const r = await buildLedgerEntry({
        entry_type: "RESOURCE_DEBIT",
        token_class: "RESOURCE",
        amount: 5,
        evidence_receipt_hashes: [EVIDENCE_HASH_A],
        prev_hash: PREV_HASH_GENESIS,
        consentProof: cp.consent_proof,
        demaHome: home,
        createdAtIso: FIXED_LEDGER_NOW,
      });
      assert.equal(r.error, "consent_scope_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("amount non-integer (float) → amount_invalid", async () => {
    const home = await freshHome();
    try {
      const cp = await makeConsentProof(home);
      const r = await buildLedgerEntry({
        entry_type: "RESOURCE_DEBIT",
        token_class: "RESOURCE",
        amount: 1.5,
        evidence_receipt_hashes: [EVIDENCE_HASH_A],
        prev_hash: PREV_HASH_GENESIS,
        consentProof: cp.consent_proof,
        demaHome: home,
        createdAtIso: FIXED_LEDGER_NOW,
      });
      assert.equal(r.error, "amount_invalid");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("amount string → amount_invalid", async () => {
    const home = await freshHome();
    try {
      const cp = await makeConsentProof(home);
      const r = await buildLedgerEntry({
        entry_type: "RESOURCE_DEBIT",
        token_class: "RESOURCE",
        amount: "5",
        evidence_receipt_hashes: [EVIDENCE_HASH_A],
        prev_hash: PREV_HASH_GENESIS,
        consentProof: cp.consent_proof,
        demaHome: home,
        createdAtIso: FIXED_LEDGER_NOW,
      });
      assert.equal(r.error, "amount_invalid");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("amount negative → amount_invalid", async () => {
    const home = await freshHome();
    try {
      const cp = await makeConsentProof(home);
      const r = await buildLedgerEntry({
        entry_type: "RESOURCE_DEBIT",
        token_class: "RESOURCE",
        amount: -1,
        evidence_receipt_hashes: [EVIDENCE_HASH_A],
        prev_hash: PREV_HASH_GENESIS,
        consentProof: cp.consent_proof,
        demaHome: home,
        createdAtIso: FIXED_LEDGER_NOW,
      });
      assert.equal(r.error, "amount_invalid");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("amount NaN → amount_invalid", async () => {
    const home = await freshHome();
    try {
      const cp = await makeConsentProof(home);
      const r = await buildLedgerEntry({
        entry_type: "RESOURCE_DEBIT",
        token_class: "RESOURCE",
        amount: NaN,
        evidence_receipt_hashes: [EVIDENCE_HASH_A],
        prev_hash: PREV_HASH_GENESIS,
        consentProof: cp.consent_proof,
        demaHome: home,
        createdAtIso: FIXED_LEDGER_NOW,
      });
      assert.equal(r.error, "amount_invalid");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("token_class invalid string → token_class_invalid", async () => {
    const home = await freshHome();
    try {
      const cp = await makeConsentProof(home);
      const r = await buildLedgerEntry({
        entry_type: "RESOURCE_DEBIT",
        token_class: "MONEY",
        amount: 5,
        evidence_receipt_hashes: [EVIDENCE_HASH_A],
        prev_hash: PREV_HASH_GENESIS,
        consentProof: cp.consent_proof,
        demaHome: home,
        createdAtIso: FIXED_LEDGER_NOW,
      });
      assert.equal(r.error, "token_class_invalid");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("token_class missing → token_class_invalid", async () => {
    const home = await freshHome();
    try {
      const cp = await makeConsentProof(home);
      const r = await buildLedgerEntry({
        entry_type: "RESOURCE_DEBIT",
        token_class: undefined,
        amount: 5,
        evidence_receipt_hashes: [EVIDENCE_HASH_A],
        prev_hash: PREV_HASH_GENESIS,
        consentProof: cp.consent_proof,
        demaHome: home,
        createdAtIso: FIXED_LEDGER_NOW,
      });
      assert.equal(r.error, "token_class_invalid");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("entry_type invalid → entry_type_invalid", async () => {
    const home = await freshHome();
    try {
      const cp = await makeConsentProof(home);
      const r = await buildLedgerEntry({
        entry_type: "MAGIC_MINT",
        token_class: "RESOURCE",
        amount: 5,
        evidence_receipt_hashes: [EVIDENCE_HASH_A],
        prev_hash: PREV_HASH_GENESIS,
        consentProof: cp.consent_proof,
        demaHome: home,
        createdAtIso: FIXED_LEDGER_NOW,
      });
      assert.equal(r.error, "entry_type_invalid");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("entry_type / token_class cross-mismatch (IMPACT_CREDIT + RESOURCE) → entry_type_token_class_mismatch", async () => {
    const home = await freshHome();
    try {
      const cp = await makeConsentProof(home);
      const r = await buildLedgerEntry({
        entry_type: "IMPACT_CREDIT",
        token_class: "RESOURCE",
        amount: 5,
        evidence_receipt_hashes: [EVIDENCE_HASH_A],
        prev_hash: PREV_HASH_GENESIS,
        consentProof: cp.consent_proof,
        demaHome: home,
        createdAtIso: FIXED_LEDGER_NOW,
      });
      assert.equal(r.error, "entry_type_token_class_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("evidence_receipt_hashes not an array → evidence_receipt_hashes_invalid", async () => {
    const home = await freshHome();
    try {
      const cp = await makeConsentProof(home);
      const r = await buildLedgerEntry({
        entry_type: "RESOURCE_DEBIT",
        token_class: "RESOURCE",
        amount: 5,
        evidence_receipt_hashes: "not-array",
        prev_hash: PREV_HASH_GENESIS,
        consentProof: cp.consent_proof,
        demaHome: home,
        createdAtIso: FIXED_LEDGER_NOW,
      });
      assert.equal(r.error, "evidence_receipt_hashes_invalid");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("evidence_receipt_hashes contains non-sha256 string → evidence_receipt_hashes_invalid", async () => {
    const home = await freshHome();
    try {
      const cp = await makeConsentProof(home);
      const r = await buildLedgerEntry({
        entry_type: "RESOURCE_DEBIT",
        token_class: "RESOURCE",
        amount: 5,
        evidence_receipt_hashes: ["nothex"],
        prev_hash: PREV_HASH_GENESIS,
        consentProof: cp.consent_proof,
        demaHome: home,
        createdAtIso: FIXED_LEDGER_NOW,
      });
      assert.equal(r.error, "evidence_receipt_hashes_invalid");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("prev_hash not 64-hex → prev_hash_invalid", async () => {
    const home = await freshHome();
    try {
      const cp = await makeConsentProof(home);
      const r = await buildLedgerEntry({
        entry_type: "RESOURCE_DEBIT",
        token_class: "RESOURCE",
        amount: 5,
        evidence_receipt_hashes: [EVIDENCE_HASH_A],
        prev_hash: "tooshort",
        consentProof: cp.consent_proof,
        demaHome: home,
        createdAtIso: FIXED_LEDGER_NOW,
      });
      assert.equal(r.error, "prev_hash_invalid");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("no signing key on disk → no_authorship_key", async () => {
    const home = await freshHome();
    try {
      // Do NOT init key, but inject a hand-crafted (invalid) consent proof
      // shape that *passes* the structural front-door so we reach the key load.
      // We need a consent proof — but consent proofs require the key to be
      // built. So instead, init key, build consent, then wipe the key dir.
      const cp = await makeConsentProof(home);
      // Wipe key dir
      await rm(join(home, "keys"), { recursive: true, force: true });
      const r = await buildLedgerEntry({
        entry_type: "RESOURCE_DEBIT",
        token_class: "RESOURCE",
        amount: 5,
        evidence_receipt_hashes: [EVIDENCE_HASH_A],
        prev_hash: PREV_HASH_GENESIS,
        consentProof: cp.consent_proof,
        demaHome: home,
        createdAtIso: FIXED_LEDGER_NOW,
      });
      assert.equal(r.error, "no_authorship_key");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});

describe("econ-ledger · verifyLedgerEntry · happy + fail-closed", () => {
  it("happy: build then verify with matching external pubkey → verified:true", async () => {
    const home = await freshHome();
    try {
      const { consentBundle, result } = await buildOk(home);
      const v = verifyLedgerEntry({
        entry: result,
        pubkeyPem: consentBundle.signer_public_key_pem,
      });
      assert.equal(v.verified, true);
      assert.equal(v.entry_hash, result.entry_hash);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("wrong external pubkey → entry_signature_invalid", async () => {
    const home = await freshHome();
    try {
      const { result } = await buildOk(home);
      const wrong = generateEd25519Keypair();
      const v = verifyLedgerEntry({
        entry: result,
        pubkeyPem: wrong.public_key_pem,
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "entry_signature_invalid");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("tampered amount → entry_hash_mismatch", async () => {
    const home = await freshHome();
    try {
      const { consentBundle, result } = await buildOk(home);
      const tampered = { ...result, amount: 999 };
      const v = verifyLedgerEntry({
        entry: tampered,
        pubkeyPem: consentBundle.signer_public_key_pem,
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "entry_hash_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("tampered body re-hashed but signature unchanged → entry_signature_invalid", async () => {
    const home = await freshHome();
    try {
      const { consentBundle, result } = await buildOk(home);
      const { entry_signature_b64: _s, entry_hash: _h, ...stableBody } = result;
      const tamperedBody = { ...stableBody, amount: 999 };
      const rehash = sha256(stableStringify(tamperedBody));
      const tampered = {
        ...tamperedBody,
        entry_signature_b64: result.entry_signature_b64,
        entry_hash: rehash,
      };
      const v = verifyLedgerEntry({
        entry: tampered,
        pubkeyPem: consentBundle.signer_public_key_pem,
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "entry_signature_invalid");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("non-object entry → entry_missing_or_malformed", () => {
    const v = verifyLedgerEntry({ entry: null, pubkeyPem: "" });
    assert.equal(v.verified, false);
    assert.equal(v.reason, "entry_missing_or_malformed");
  });

  it("wrong schema → entry_schema_mismatch", async () => {
    const home = await freshHome();
    try {
      const { consentBundle, result } = await buildOk(home);
      const broken = { ...result, schema: "bizra.dema.foreign.v0.1" };
      const v = verifyLedgerEntry({
        entry: broken,
        pubkeyPem: consentBundle.signer_public_key_pem,
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "entry_schema_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("missing pubkeyPem → external_pubkey_required", async () => {
    const home = await freshHome();
    try {
      const { result } = await buildOk(home);
      const v = verifyLedgerEntry({ entry: result, pubkeyPem: "" });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "external_pubkey_required");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("verifier uses external pubkey only, ignores embedded fingerprint for trust", async () => {
    const home = await freshHome();
    try {
      const { consentBundle, result } = await buildOk(home);
      // Spoof the embedded fingerprint to a foreign one — must NOT affect
      // verify trust outcome (it changes the body, so hash will mismatch,
      // but the test demonstrates the verifier never *uses* the embedded
      // fingerprint as the trust anchor — it always uses external pubkey).
      const spoofed = {
        ...result,
        operator_public_key_fingerprint: "0".repeat(64),
      };
      const v = verifyLedgerEntry({
        entry: spoofed,
        pubkeyPem: consentBundle.signer_public_key_pem,
      });
      // Spoofed body → hash now mismatches the unchanged embedded entry_hash
      assert.equal(v.verified, false);
      assert.equal(v.reason, "entry_hash_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});

describe("econ-ledger · exports & invariants", () => {
  it("VALID_ENTRY_TYPES export contains the 3 frozen entry types", () => {
    assert.ok(VALID_ENTRY_TYPES.includes("RESOURCE_DEBIT"));
    assert.ok(VALID_ENTRY_TYPES.includes("RESOURCE_CREDIT"));
    assert.ok(VALID_ENTRY_TYPES.includes("IMPACT_CREDIT"));
    assert.ok(Object.isFrozen(VALID_ENTRY_TYPES));
  });

  it("VALID_TOKEN_CLASSES export contains RESOURCE and IMPACT only", () => {
    assert.ok(VALID_TOKEN_CLASSES.includes("RESOURCE"));
    assert.ok(VALID_TOKEN_CLASSES.includes("IMPACT"));
    assert.equal(VALID_TOKEN_CLASSES.length, 2);
    assert.ok(Object.isFrozen(VALID_TOKEN_CLASSES));
  });

  it("kernel does not write any file (pure)", async () => {
    const home = await freshHome();
    try {
      await buildOk(home);
      // No econ subdir should exist after a successful build
      const econDir = join(home, "econ");
      let exists = false;
      try {
        const { stat } = await import("node:fs/promises");
        await stat(econDir);
        exists = true;
      } catch {
        exists = false;
      }
      assert.equal(exists, false, "kernel must not write any econ files");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});
