// AGENT-WALLET-1A · Per-agent local wallet kernel tests
//
// Covers the 6 DOD criteria from AGENT_PROFILE_0_PREFLIGHT.md §10
// (AGENT-WALLET-1A) re-scoped for the task contract:
//
//   buildAgentWallet({
//     agent_id, resource_balance, impact_balance,
//     ledger_entries, consentProof, demaHome, createdAtIso?
//   })
//
// And:
//
//   verifyAgentWallet({ wallet, ledgerEntries, pubkeyPem })
//
// Wallet binds to ONE agent (1:1 with profile per AGENT-PROFILE-1A).
// Recomputes balances from referenced ECON-1A dual-token ledger entries:
//   - resource_balance = Σ RESOURCE_CREDIT.amount − Σ RESOURCE_DEBIT.amount
//   - impact_balance   = Σ IMPACT_CREDIT.amount    (credits-only; impact
//                        tokens cannot be spent per PDF §9)
//
// Schema: bizra.dema.agent_wallet.v0.1
//
// Local-only. No CLI. No transfer surface. No agent-to-agent payment.

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildAgentWallet,
  verifyAgentWallet,
  AGENT_WALLET_SCHEMA,
  MUTATE_AGENT_WALLET_ACTION_TYPE,
} from "../packages/agents/src/agent-wallet.js";

import { buildLedgerEntry } from "../packages/econ/src/dual-token-ledger.js";
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

const AGENT_ID = "pat.dema";
const FIXED_CREATED = "2026-05-30T08:00:00.000Z";
const FIXED_LEDGER_NOW = "2026-05-30T08:00:30.000Z";
const FIXED_CONSENT_NONCE = "cafebabe".repeat(8);
const FIXED_CONSENT_CREATED = "2026-05-30T08:00:00.000Z";
const FIXED_CONSENT_EXPIRES = "2026-05-30T08:05:00.000Z";

const PREV_HASH_GENESIS = "0".repeat(64);
const EVIDENCE_HASH_A = "a".repeat(64);
const EVIDENCE_HASH_B = "b".repeat(64);
const EVIDENCE_HASH_C = "c".repeat(64);

const LEDGER_CONSENT_PHRASE = "MINT LEDGER ENTRY";
const LEDGER_MINT_TARGET_HASH = "f".repeat(64);

async function freshHome() {
  return await mkdtemp(join(tmpdir(), "dema-agent-wallet-test-"));
}

async function makeLedgerConsent(home) {
  await initAuthorshipKey({
    consent: KEY_INIT_CONSENT_PHRASE,
    demaHome: home,
  });
  const cp = await buildConsentProof({
    phrase: LEDGER_CONSENT_PHRASE,
    actionScope: {
      action_type: "MINT_LEDGER_ENTRY",
      target_hash: LEDGER_MINT_TARGET_HASH,
    },
    demaHome: home,
    nonce: FIXED_CONSENT_NONCE,
    createdAtIso: FIXED_CONSENT_CREATED,
    expiresAtIso: FIXED_CONSENT_EXPIRES,
  });
  if (!cp.built) {
    throw new Error(`ledger consent build failed: ${cp.error}`);
  }
  return cp;
}

async function mintEntry(
  home,
  { entry_type, token_class, amount, evidence, prev_hash },
) {
  const cp = await makeLedgerConsent(home);
  const entry = await buildLedgerEntry({
    entry_type,
    token_class,
    amount,
    evidence_receipt_hashes: evidence,
    prev_hash,
    consentProof: cp.consent_proof,
    demaHome: home,
    createdAtIso: FIXED_LEDGER_NOW,
  });
  if (entry.error) {
    throw new Error(`mint failed: ${entry.error}`);
  }
  return entry;
}

// Build a six-entry ledger for the happy path:
//   2 RESOURCE_CREDIT  (sum: +amounts)
//   1 RESOURCE_DEBIT   (subtract amount)
//   3 IMPACT_CREDIT    (sum of amounts → impact_balance)
async function buildHappyLedger(home) {
  // 2 RESOURCE credits: 10 + 7 = 17
  const rc1 = await mintEntry(home, {
    entry_type: "RESOURCE_CREDIT",
    token_class: "RESOURCE",
    amount: 10,
    evidence: [EVIDENCE_HASH_A],
    prev_hash: PREV_HASH_GENESIS,
  });
  const rc2 = await mintEntry(home, {
    entry_type: "RESOURCE_CREDIT",
    token_class: "RESOURCE",
    amount: 7,
    evidence: [EVIDENCE_HASH_B],
    prev_hash: rc1.entry_hash,
  });
  // 1 RESOURCE debit: -4 → resource_balance = 17 - 4 = 13
  const rd1 = await mintEntry(home, {
    entry_type: "RESOURCE_DEBIT",
    token_class: "RESOURCE",
    amount: 4,
    evidence: [EVIDENCE_HASH_C],
    prev_hash: rc2.entry_hash,
  });
  // 3 IMPACT credits: 2 + 3 + 5 = 10
  const ic1 = await mintEntry(home, {
    entry_type: "IMPACT_CREDIT",
    token_class: "IMPACT",
    amount: 2,
    evidence: [EVIDENCE_HASH_A],
    prev_hash: rd1.entry_hash,
  });
  const ic2 = await mintEntry(home, {
    entry_type: "IMPACT_CREDIT",
    token_class: "IMPACT",
    amount: 3,
    evidence: [EVIDENCE_HASH_B],
    prev_hash: ic1.entry_hash,
  });
  const ic3 = await mintEntry(home, {
    entry_type: "IMPACT_CREDIT",
    token_class: "IMPACT",
    amount: 5,
    evidence: [EVIDENCE_HASH_C],
    prev_hash: ic2.entry_hash,
  });
  return [rc1, rc2, rd1, ic1, ic2, ic3];
}

function projectedWalletBody({
  agent_id,
  resource_balance,
  impact_balance,
  ledger_entries_referenced,
  prev_hash,
  created_at_iso,
  operator_public_key_fingerprint,
}) {
  return {
    schema: AGENT_WALLET_SCHEMA,
    agent_id,
    resource_balance,
    impact_balance,
    ledger_entries_referenced,
    prev_hash,
    created_at_iso,
    operator_public_key_fingerprint,
  };
}

async function makeWalletConsent({
  home,
  scopeOverride,
  agent_id = AGENT_ID,
  resource_balance,
  impact_balance,
  ledger_entries_referenced,
  prev_hash,
  created_at_iso = FIXED_CREATED,
}) {
  // We need the operator fingerprint to project the body — re-derive from
  // the public key on disk (mirrors how buildAgentWallet will compute it).
  const { loadPublicKey } =
    await import("../packages/receipts/src/authorship-key-store.js");
  const { createPublicKey } = await import("node:crypto");
  const pub = await loadPublicKey(home);
  const pk = createPublicKey(pub);
  const fingerprint = sha256(
    pk.export({ type: "spki", format: "der" }).toString("hex"),
  );
  const projected = projectedWalletBody({
    agent_id,
    resource_balance,
    impact_balance,
    ledger_entries_referenced,
    prev_hash,
    created_at_iso,
    operator_public_key_fingerprint: fingerprint,
  });
  const target_hash = sha256(stableStringify(projected));
  const scope = scopeOverride || {
    action_type: MUTATE_AGENT_WALLET_ACTION_TYPE,
    target_hash,
  };
  const cp = await buildConsentProof({
    phrase: "SIGN AUTHORSHIP RECEIPT",
    actionScope: scope,
    demaHome: home,
    nonce: "feedbeef".repeat(8),
    createdAtIso: FIXED_CONSENT_CREATED,
    expiresAtIso: FIXED_CONSENT_EXPIRES,
  });
  if (!cp.built) {
    throw new Error(`wallet consent build failed: ${cp.error}`);
  }
  return cp;
}

async function buildHappyWallet() {
  const home = await freshHome();
  await initAuthorshipKey({
    consent: KEY_INIT_CONSENT_PHRASE,
    demaHome: home,
  });
  const ledger = await buildHappyLedger(home);
  const ledger_entries_referenced = ledger.map((e) => e.entry_hash);
  const cp = await makeWalletConsent({
    home,
    resource_balance: 13,
    impact_balance: 10,
    ledger_entries_referenced,
    prev_hash: PREV_HASH_GENESIS,
  });
  const result = await buildAgentWallet({
    agent_id: AGENT_ID,
    resource_balance: 13,
    impact_balance: 10,
    ledger_entries: ledger,
    consentProof: cp.consent_proof,
    demaHome: home,
    createdAtIso: FIXED_CREATED,
  });
  return { home, result, ledger, ledger_entries_referenced };
}

describe("agent-wallet · buildAgentWallet happy path (DOD-1)", () => {
  it("DOD-1: agent with 2 RESOURCE credits + 1 RESOURCE debit + 3 IMPACT credits → wallet balances match recomputed", async () => {
    const { home, result, ledger_entries_referenced } =
      await buildHappyWallet();
    try {
      assert.equal(result.built, true, `built failed: ${result.error}`);
      const w = result.wallet;
      assert.equal(w.schema, AGENT_WALLET_SCHEMA);
      assert.equal(w.agent_id, AGENT_ID);
      assert.equal(w.resource_balance, 13);
      assert.equal(w.impact_balance, 10);
      assert.deepEqual(
        [...w.ledger_entries_referenced],
        ledger_entries_referenced,
      );
      assert.ok(typeof w.wallet_id === "string" && w.wallet_id.length > 0);
      assert.ok(/^[a-f0-9]{64}$/.test(w.wallet_proof_hash));
      assert.ok(
        typeof w.wallet_signature_b64 === "string" &&
          w.wallet_signature_b64.length > 0,
      );
      assert.equal(w.created_at_iso, FIXED_CREATED);
      assert.ok(/^[a-f0-9]{64}$/.test(w.operator_public_key_fingerprint));
      assert.ok(Object.isFrozen(result));
      assert.ok(Object.isFrozen(w));
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("happy path verifies with external pubkey → verified:true", async () => {
    const { home, result, ledger } = await buildHappyWallet();
    try {
      const v = verifyAgentWallet({
        wallet: result.wallet,
        ledgerEntries: ledger,
        pubkeyPem: result.signer_public_key_pem,
      });
      assert.equal(v.verified, true, `expected verified; got ${v.reason}`);
      assert.equal(v.resource_balance, 13);
      assert.equal(v.impact_balance, 10);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});

describe("agent-wallet · verifyAgentWallet rejects (DOD-2..DOD-5)", () => {
  it("DOD-2: tampered resource_balance → resource_balance_mismatch", async () => {
    const { home, result, ledger } = await buildHappyWallet();
    try {
      const tampered = { ...result.wallet, resource_balance: 9999 };
      const v = verifyAgentWallet({
        wallet: tampered,
        ledgerEntries: ledger,
        pubkeyPem: result.signer_public_key_pem,
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "resource_balance_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-3: tampered impact_balance → impact_balance_mismatch", async () => {
    const { home, result, ledger } = await buildHappyWallet();
    try {
      const tampered = { ...result.wallet, impact_balance: 9999 };
      const v = verifyAgentWallet({
        wallet: tampered,
        ledgerEntries: ledger,
        pubkeyPem: result.signer_public_key_pem,
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "impact_balance_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-4: referenced ledger entry not in supplied set → ledger_entry_missing", async () => {
    const { home, result, ledger } = await buildHappyWallet();
    try {
      // Drop the first referenced entry from the supplied set.
      const reducedLedger = ledger.slice(1);
      const v = verifyAgentWallet({
        wallet: result.wallet,
        ledgerEntries: reducedLedger,
        pubkeyPem: result.signer_public_key_pem,
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "ledger_entry_missing");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-5: impact_balance < 0 → no_payment_to_human (impact never spent)", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const cp = await makeWalletConsent({
        home,
        resource_balance: 0,
        impact_balance: -3,
        ledger_entries_referenced: [],
        prev_hash: PREV_HASH_GENESIS,
      });
      const r = await buildAgentWallet({
        agent_id: AGENT_ID,
        resource_balance: 0,
        impact_balance: -3,
        ledger_entries: [],
        consentProof: cp.consent_proof,
        demaHome: home,
        createdAtIso: FIXED_CREATED,
      });
      assert.equal(r.built, false);
      assert.equal(r.error, "no_payment_to_human");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("ledger entry with mismatched agent_id field → ledger_entry_agent_mismatch", async () => {
    const { home, result, ledger } = await buildHappyWallet();
    try {
      // Decorate one ledger entry with a foreign agent_id. The wallet
      // commits to AGENT_ID; verifier must reject this entry as belonging
      // to someone else's wallet.
      const polluted = ledger.map((e, i) =>
        i === 0 ? { ...e, agent_id: "pat.guardian" } : e,
      );
      const v = verifyAgentWallet({
        wallet: result.wallet,
        ledgerEntries: polluted,
        pubkeyPem: result.signer_public_key_pem,
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "ledger_entry_agent_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("wrong external pubkey → signature_invalid", async () => {
    const { home, result, ledger } = await buildHappyWallet();
    try {
      const wrong = generateEd25519Keypair();
      const v = verifyAgentWallet({
        wallet: result.wallet,
        ledgerEntries: ledger,
        pubkeyPem: wrong.public_key_pem,
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "signature_invalid");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("tampered body re-hashed but signature unchanged → signature_invalid", async () => {
    const { home, result, ledger } = await buildHappyWallet();
    try {
      // Strategy: swap ledger_entries_referenced order (order is part of
      // the signed body). Recompute proof_hash using the EXACT shape the
      // verifier reconstructs (the canonical buildWalletBody projection
      // — wallet_id excluded). The recomputed proof_hash will now match
      // the tampered body, so the proof-hash gate passes. But the stored
      // signature was over the ORIGINAL ordering and will not verify.
      const w = result.wallet;
      const swappedRefs = [
        w.ledger_entries_referenced[1],
        w.ledger_entries_referenced[0],
        ...w.ledger_entries_referenced.slice(2),
      ];
      const stableBody = {
        schema: w.schema,
        agent_id: w.agent_id,
        resource_balance: w.resource_balance,
        impact_balance: w.impact_balance,
        ledger_entries_referenced: swappedRefs,
        prev_hash: w.prev_hash,
        created_at_iso: w.created_at_iso,
        operator_public_key_fingerprint: w.operator_public_key_fingerprint,
      };
      const rehash = sha256(stableStringify(stableBody));
      const tampered = {
        ...stableBody,
        wallet_id: w.wallet_id,
        wallet_signature_b64: w.wallet_signature_b64,
        wallet_proof_hash: rehash,
      };
      const v = verifyAgentWallet({
        wallet: tampered,
        ledgerEntries: ledger,
        pubkeyPem: result.signer_public_key_pem,
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "signature_invalid");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});

describe("agent-wallet · no PRIVATE KEY material (DOD-6)", () => {
  it("DOD-6: returned envelope contains NO private-key material", async () => {
    const { home, result } = await buildHappyWallet();
    try {
      const envStr = JSON.stringify(result);
      assert.ok(
        !envStr.includes("BEGIN PRIVATE KEY"),
        "envelope must not contain BEGIN PRIVATE KEY marker",
      );
      assert.ok(
        !envStr.includes("PRIVATE KEY"),
        "envelope must not contain any PRIVATE KEY marker",
      );
      assert.equal(result.wallet.private_key, undefined);
      assert.equal(result.wallet.private_key_pem, undefined);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});

describe("agent-wallet · fail-closed gates", () => {
  it("missing consent → consent_proof_required", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const r = await buildAgentWallet({
        agent_id: AGENT_ID,
        resource_balance: 0,
        impact_balance: 0,
        ledger_entries: [],
        consentProof: undefined,
        demaHome: home,
        createdAtIso: FIXED_CREATED,
      });
      assert.equal(r.built, false);
      assert.equal(r.error, "consent_proof_required");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("consent scoped to wrong action_type → consent_scope_mismatch", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const cp = await makeWalletConsent({
        home,
        resource_balance: 0,
        impact_balance: 0,
        ledger_entries_referenced: [],
        prev_hash: PREV_HASH_GENESIS,
        scopeOverride: {
          action_type: "MINT_VERDICT_RECEIPT",
          target_hash: "0".repeat(64),
        },
      });
      const r = await buildAgentWallet({
        agent_id: AGENT_ID,
        resource_balance: 0,
        impact_balance: 0,
        ledger_entries: [],
        consentProof: cp.consent_proof,
        demaHome: home,
        createdAtIso: FIXED_CREATED,
      });
      assert.equal(r.built, false);
      assert.equal(r.error, "consent_scope_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("build with declared resource_balance != recomputed → resource_balance_mismatch", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const ledger = await buildHappyLedger(home);
      // Build with wrong declared resource_balance. Kernel must refuse to
      // sign a wallet whose declared totals disagree with the ledger it
      // references.
      const ledger_entries_referenced = ledger.map((e) => e.entry_hash);
      const cp = await makeWalletConsent({
        home,
        resource_balance: 9999,
        impact_balance: 10,
        ledger_entries_referenced,
        prev_hash: PREV_HASH_GENESIS,
      });
      const r = await buildAgentWallet({
        agent_id: AGENT_ID,
        resource_balance: 9999,
        impact_balance: 10,
        ledger_entries: ledger,
        consentProof: cp.consent_proof,
        demaHome: home,
        createdAtIso: FIXED_CREATED,
      });
      assert.equal(r.built, false);
      assert.equal(r.error, "resource_balance_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("no authorship key on disk → no_authorship_key", async () => {
    const home = await freshHome();
    try {
      // Do NOT init key. Hand a structurally-shaped consent proof so the
      // (3) consent shape gate does not pre-empt.
      const r = await buildAgentWallet({
        agent_id: AGENT_ID,
        resource_balance: 0,
        impact_balance: 0,
        ledger_entries: [],
        consentProof: {
          schema: "bizra.dema.consent_proof.v0.1",
          consent_phrase: "x",
          action_scope: {
            action_type: MUTATE_AGENT_WALLET_ACTION_TYPE,
            target_hash: "a".repeat(64),
          },
          nonce: "x",
          created_at_iso: FIXED_CREATED,
          expires_at_iso: "2099-01-01T00:00:00.000Z",
          operator_public_key_fingerprint: "a".repeat(64),
          consent_signature_b64: "x",
          consent_proof_hash: "a".repeat(64),
        },
        demaHome: home,
        createdAtIso: FIXED_CREATED,
      });
      assert.equal(r.built, false);
      assert.equal(r.error, "no_authorship_key");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("module exposes NO transfer / pay / settle surface (preflight §10)", async () => {
    const mod = await import("../packages/agents/src/agent-wallet.js");
    assert.equal(mod.transfer, undefined);
    assert.equal(mod.pay, undefined);
    assert.equal(mod.settle, undefined);
    assert.equal(mod.send, undefined);
  });
});

describe("agent-wallet · verify structural", () => {
  it("empty pubkey → signature_invalid (or external_pubkey_required)", async () => {
    const { home, result, ledger } = await buildHappyWallet();
    try {
      const v = verifyAgentWallet({
        wallet: result.wallet,
        ledgerEntries: ledger,
        pubkeyPem: "",
      });
      assert.equal(v.verified, false);
      // Accept either reason — both signal external pubkey failure.
      assert.ok(
        v.reason === "signature_invalid" ||
          v.reason === "external_pubkey_required",
        `unexpected reason: ${v.reason}`,
      );
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("wrong schema → agent_wallet_schema_mismatch", async () => {
    const { home, result, ledger } = await buildHappyWallet();
    try {
      const broken = { ...result.wallet, schema: "not.real.v0.1" };
      const v = verifyAgentWallet({
        wallet: broken,
        ledgerEntries: ledger,
        pubkeyPem: result.signer_public_key_pem,
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "agent_wallet_schema_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});
