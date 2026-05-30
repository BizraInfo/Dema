// ECON-1B · Pure Dual-Token Ledger Replay Verifier tests
//
// Covers all 6 DOD criteria for the replay verifier. The verifier walks an
// ordered ordered array of `bizra.dema.dual_token_ledger_entry.v0.1`
// envelopes (built by ECON-1A's `buildLedgerEntry`) and confirms:
//
//   - entries[0].prev_hash === null (genesis)
//   - entries[i].prev_hash === entries[i-1].entry_hash for i >= 1
//   - each entry's signature verifies under the EXTERNAL pubkeyPem
//   - each entry's body hash recomputes from the stable body
//   - no public economic claim fields anywhere in the chain
//
// Signature surface:
//   verifyLedgerReplay({ entries, pubkeyPem })
//     ok    -> { verified: true, total_entries, chain_root_hash }
//     fail  -> { verified: false, reason, at_index? }
//
// Local-only. Permissionless. No I/O, no Date.now, no Math.random, no network.
//
// NOTE: ECON-1A now accepts `prev_hash:null` for genesis so the entries built
// by the kernel replay directly under ECON-1B. Linked entries still require a
// 64-hex predecessor hash.

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  verifyLedgerReplay,
  DUAL_TOKEN_LEDGER_ENTRY_SCHEMA as REPLAY_SCHEMA,
} from "../packages/econ/src/dual-token-ledger-replay.js";

import { buildLedgerEntry } from "../packages/econ/src/dual-token-ledger.js";
import { buildConsentProof } from "../packages/receipts/src/consent-proof.js";
import {
  initAuthorshipKey,
  KEY_INIT_CONSENT_PHRASE,
} from "../packages/receipts/src/authorship-key-store.js";
import {
  signPayload,
  generateEd25519Keypair,
} from "../packages/receipts/src/authorship-signature.js";

const VALID_PHRASE = "MINT LEDGER ENTRY";
const MINT_TARGET_HASH = "f".repeat(64);
const VALID_MINT_SCOPE = Object.freeze({
  action_type: "MINT_LEDGER_ENTRY",
  target_hash: MINT_TARGET_HASH,
});

const FIXED_NONCE = "deadbeef".repeat(8);
const FIXED_CREATED = "2026-05-30T08:00:00.000Z";
const FIXED_EXPIRES = "2026-05-30T08:05:00.000Z";
const FIXED_LEDGER_NOW_1 = "2026-05-30T08:00:01.000Z";
const FIXED_LEDGER_NOW_2 = "2026-05-30T08:00:02.000Z";
const FIXED_LEDGER_NOW_3 = "2026-05-30T08:00:03.000Z";
const FIXED_LEDGER_NOW_4 = "2026-05-30T08:00:04.000Z";

const EVIDENCE_HASH_A = "a".repeat(64);
const EVIDENCE_HASH_B = "b".repeat(64);
const EVIDENCE_HASH_C = "c".repeat(64);
const EVIDENCE_HASH_D = "d".repeat(64);

async function freshHome() {
  return await mkdtemp(join(tmpdir(), "dema-econ-replay-test-"));
}

async function makeConsentProof(home, scope = VALID_MINT_SCOPE) {
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

async function buildKernelEntry(home, cp, prev_hash, overrides = {}) {
  const r = await buildLedgerEntry({
    entry_type: overrides.entry_type ?? "RESOURCE_DEBIT",
    token_class: overrides.token_class ?? "RESOURCE",
    amount: overrides.amount ?? 5,
    evidence_receipt_hashes: overrides.evidence_receipt_hashes ?? [
      EVIDENCE_HASH_A,
    ],
    prev_hash,
    consentProof: cp.consent_proof,
    demaHome: home,
    createdAtIso: overrides.createdAtIso ?? FIXED_LEDGER_NOW_1,
  });
  if (r.error) {
    throw new Error(`test setup failure: kernel build error: ${r.error}`);
  }
  return r;
}

// Build a clean 4-entry chain (1 genesis + 3 linked) for happy path / mutation
// fixtures. Returns { entries, pubkeyPem, home }.
async function buildChain(home, length = 4) {
  const cp = await makeConsentProof(home);
  const pubkeyPem = cp.signer_public_key_pem;
  const entries = [];

  // Genesis: build directly with prev_hash:null to match ECON-1B replay.
  const genesis = await buildKernelEntry(home, cp, null, {
    entry_type: "RESOURCE_DEBIT",
    token_class: "RESOURCE",
    amount: 5,
    evidence_receipt_hashes: [EVIDENCE_HASH_A],
    createdAtIso: FIXED_LEDGER_NOW_1,
  });
  entries.push(genesis);

  const overrides = [
    {
      entry_type: "RESOURCE_DEBIT",
      token_class: "RESOURCE",
      amount: 7,
      evidence_receipt_hashes: [EVIDENCE_HASH_B],
      createdAtIso: FIXED_LEDGER_NOW_2,
    },
    {
      entry_type: "IMPACT_CREDIT",
      token_class: "IMPACT",
      amount: 3,
      evidence_receipt_hashes: [EVIDENCE_HASH_C],
      createdAtIso: FIXED_LEDGER_NOW_3,
    },
    {
      entry_type: "RESOURCE_CREDIT",
      token_class: "RESOURCE",
      amount: 2,
      evidence_receipt_hashes: [EVIDENCE_HASH_D],
      createdAtIso: FIXED_LEDGER_NOW_4,
    },
  ];

  for (let i = 1; i < length; i += 1) {
    const prev = entries[i - 1].entry_hash;
    const ov = overrides[i - 1];
    const next = await buildKernelEntry(home, cp, prev, ov);
    entries.push(next);
  }

  return { entries, pubkeyPem };
}

describe("econ-ledger-replay · happy path", () => {
  it("DOD-1 · genesis + 3 chained entries signed by operator → verified:true", async () => {
    const home = await freshHome();
    try {
      const { entries, pubkeyPem } = await buildChain(home, 4);
      const r = verifyLedgerReplay({ entries, pubkeyPem });
      assert.equal(
        r.verified,
        true,
        `expected verified:true got ${JSON.stringify(r)}`,
      );
      assert.equal(r.total_entries, 4);
      assert.equal(r.chain_root_hash, entries[entries.length - 1].entry_hash);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("happy: single genesis entry → verified:true, total_entries:1", async () => {
    const home = await freshHome();
    try {
      const { entries, pubkeyPem } = await buildChain(home, 1);
      const r = verifyLedgerReplay({ entries, pubkeyPem });
      assert.equal(r.verified, true);
      assert.equal(r.total_entries, 1);
      assert.equal(r.chain_root_hash, entries[0].entry_hash);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("happy: output is frozen (no mutation possible)", async () => {
    const home = await freshHome();
    try {
      const { entries, pubkeyPem } = await buildChain(home, 2);
      const r = verifyLedgerReplay({ entries, pubkeyPem });
      assert.ok(Object.isFrozen(r), "verify output must be frozen");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("happy: schema export matches ECON-1A canon", () => {
    assert.equal(REPLAY_SCHEMA, "bizra.dema.dual_token_ledger_entry.v0.1");
  });

  it("happy: output carries NO private key material", async () => {
    const home = await freshHome();
    try {
      const { entries, pubkeyPem } = await buildChain(home, 3);
      const r = verifyLedgerReplay({ entries, pubkeyPem });
      const s = JSON.stringify(r);
      assert.ok(!s.includes("PRIVATE KEY"));
      assert.equal(r.private_key, undefined);
      assert.equal(r.private_key_pem, undefined);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});

describe("econ-ledger-replay · structural rejections", () => {
  it("empty array → entries_empty", () => {
    const home = "/tmp/should-not-be-touched";
    void home;
    const r = verifyLedgerReplay({ entries: [], pubkeyPem: "dummy" });
    assert.equal(r.verified, false);
    assert.equal(r.reason, "entries_empty");
  });

  it("entries not an array → entries_empty", () => {
    const r = verifyLedgerReplay({ entries: null, pubkeyPem: "dummy" });
    assert.equal(r.verified, false);
    assert.equal(r.reason, "entries_empty");
  });

  it("entries undefined → entries_empty", () => {
    const r = verifyLedgerReplay({ entries: undefined, pubkeyPem: "dummy" });
    assert.equal(r.verified, false);
    assert.equal(r.reason, "entries_empty");
  });

  it("DOD-2 · genesis prev_hash not null → genesis_prev_hash_not_null at_index:0", async () => {
    const home = await freshHome();
    try {
      // Build genesis-style entry but keep prev_hash as 64-zero string (NOT null).
      const cp = await makeConsentProof(home);
      const entry = await buildKernelEntry(home, cp, "0".repeat(64), {
        createdAtIso: FIXED_LEDGER_NOW_1,
      });
      const r = verifyLedgerReplay({
        entries: [entry],
        pubkeyPem: cp.signer_public_key_pem,
      });
      assert.equal(r.verified, false);
      assert.equal(r.reason, "genesis_prev_hash_not_null");
      assert.equal(r.at_index, 0);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("schema mismatch at index 0 → entry_schema_mismatch at_index:0", async () => {
    const home = await freshHome();
    try {
      const { entries, pubkeyPem } = await buildChain(home, 1);
      const broken = { ...entries[0], schema: "bizra.dema.foreign.v0.1" };
      const r = verifyLedgerReplay({ entries: [broken], pubkeyPem });
      assert.equal(r.verified, false);
      assert.equal(r.reason, "entry_schema_mismatch");
      assert.equal(r.at_index, 0);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("token_class invalid at index 1 → token_class_invalid at_index:1", async () => {
    const home = await freshHome();
    try {
      const { entries, pubkeyPem } = await buildChain(home, 2);
      const tampered = { ...entries[1], token_class: "MONEY" };
      const r = verifyLedgerReplay({
        entries: [entries[0], tampered],
        pubkeyPem,
      });
      assert.equal(r.verified, false);
      assert.equal(r.reason, "token_class_invalid");
      assert.equal(r.at_index, 1);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});

describe("econ-ledger-replay · chain integrity", () => {
  it("DOD-3 · prev_hash break at index 2 → prev_hash_mismatch at_index:2", async () => {
    const home = await freshHome();
    try {
      const { entries, pubkeyPem } = await buildChain(home, 4);
      // Replace entries[2] with a fresh kernel build whose prev_hash points
      // to a fake hash, then keep entries[3] linked to (broken) entries[2].
      const cp = await makeConsentProof(home);
      const wrongPrev = "1".repeat(64);
      const tamperedAt2 = await buildKernelEntry(home, cp, wrongPrev, {
        entry_type: "IMPACT_CREDIT",
        token_class: "IMPACT",
        amount: 3,
        evidence_receipt_hashes: [EVIDENCE_HASH_C],
        createdAtIso: FIXED_LEDGER_NOW_3,
      });
      const chain = [entries[0], entries[1], tamperedAt2];
      const r = verifyLedgerReplay({ entries: chain, pubkeyPem });
      assert.equal(r.verified, false);
      assert.equal(r.reason, "prev_hash_mismatch");
      assert.equal(r.at_index, 2);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("prev_hash break at index 1 → prev_hash_mismatch at_index:1", async () => {
    const home = await freshHome();
    try {
      const { entries, pubkeyPem } = await buildChain(home, 3);
      const cp = await makeConsentProof(home);
      const wrong = await buildKernelEntry(home, cp, "9".repeat(64), {
        entry_type: "RESOURCE_DEBIT",
        token_class: "RESOURCE",
        amount: 7,
        evidence_receipt_hashes: [EVIDENCE_HASH_B],
        createdAtIso: FIXED_LEDGER_NOW_2,
      });
      const chain = [entries[0], wrong];
      const r = verifyLedgerReplay({ entries: chain, pubkeyPem });
      assert.equal(r.verified, false);
      assert.equal(r.reason, "prev_hash_mismatch");
      assert.equal(r.at_index, 1);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});

describe("econ-ledger-replay · signature + hash integrity", () => {
  it("DOD-4 · forged signature at index 1 → signature_invalid at_index:1", async () => {
    const home = await freshHome();
    try {
      const { entries, pubkeyPem } = await buildChain(home, 3);
      const foreign = generateEd25519Keypair();
      // Tamper signature on entries[1] by re-signing with a foreign key
      // (keeping the body — and entry_hash — unchanged). The hash matches,
      // but the signature does not verify under the operator's pubkey.
      const { entry_signature_b64: _s, entry_hash, ...body } = entries[1];
      const foreignSig = signPayload(body, foreign.private_key_pem);
      const forged = Object.freeze({
        ...body,
        entry_signature_b64: foreignSig,
        entry_hash,
      });
      const chain = [entries[0], forged, entries[2]];
      const r = verifyLedgerReplay({ entries: chain, pubkeyPem });
      assert.equal(r.verified, false);
      assert.equal(r.reason, "signature_invalid");
      assert.equal(r.at_index, 1);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("forged signature at genesis → signature_invalid at_index:0", async () => {
    const home = await freshHome();
    try {
      const { entries, pubkeyPem } = await buildChain(home, 2);
      const foreign = generateEd25519Keypair();
      const { entry_signature_b64: _s, entry_hash, ...body } = entries[0];
      const sig = signPayload(body, foreign.private_key_pem);
      const forged = Object.freeze({
        ...body,
        entry_signature_b64: sig,
        entry_hash,
      });
      const r = verifyLedgerReplay({
        entries: [forged, entries[1]],
        pubkeyPem,
      });
      assert.equal(r.verified, false);
      assert.equal(r.reason, "signature_invalid");
      assert.equal(r.at_index, 0);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-5 · tampered amount at index 1 → entry_hash_mismatch at_index:1", async () => {
    const home = await freshHome();
    try {
      const { entries, pubkeyPem } = await buildChain(home, 3);
      const tampered = { ...entries[1], amount: 999 };
      const chain = [entries[0], tampered, entries[2]];
      const r = verifyLedgerReplay({ entries: chain, pubkeyPem });
      assert.equal(r.verified, false);
      assert.equal(r.reason, "entry_hash_mismatch");
      assert.equal(r.at_index, 1);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("tampered amount at genesis → entry_hash_mismatch at_index:0", async () => {
    const home = await freshHome();
    try {
      const { entries, pubkeyPem } = await buildChain(home, 2);
      const tampered = { ...entries[0], amount: 999 };
      const r = verifyLedgerReplay({
        entries: [tampered, entries[1]],
        pubkeyPem,
      });
      assert.equal(r.verified, false);
      assert.equal(r.reason, "entry_hash_mismatch");
      assert.equal(r.at_index, 0);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("wrong external pubkey on a valid chain → signature_invalid at_index:0", async () => {
    const home = await freshHome();
    try {
      const { entries } = await buildChain(home, 3);
      const wrong = generateEd25519Keypair();
      const r = verifyLedgerReplay({
        entries,
        pubkeyPem: wrong.public_key_pem,
      });
      assert.equal(r.verified, false);
      assert.equal(r.reason, "signature_invalid");
      assert.equal(r.at_index, 0);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});

describe("econ-ledger-replay · public economic claim guard", () => {
  it("public economic claim field present in body → public_economic_claim_present", async () => {
    const home = await freshHome();
    try {
      const { entries, pubkeyPem } = await buildChain(home, 2);
      // Inject a forbidden field; matches the family of names the verifier
      // refuses outright before signature checks.
      const polluted = { ...entries[1], exchange_value: "1 USD" };
      const r = verifyLedgerReplay({
        entries: [entries[0], polluted],
        pubkeyPem,
      });
      assert.equal(r.verified, false);
      assert.equal(r.reason, "public_economic_claim_present");
      assert.equal(r.at_index, 1);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("public_mint field present → public_economic_claim_present", async () => {
    const home = await freshHome();
    try {
      const { entries, pubkeyPem } = await buildChain(home, 1);
      const polluted = { ...entries[0], public_mint: true };
      const r = verifyLedgerReplay({
        entries: [polluted],
        pubkeyPem,
      });
      assert.equal(r.verified, false);
      assert.equal(r.reason, "public_economic_claim_present");
      assert.equal(r.at_index, 0);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("market_price field present → public_economic_claim_present", async () => {
    const home = await freshHome();
    try {
      const { entries, pubkeyPem } = await buildChain(home, 1);
      const polluted = { ...entries[0], market_price: 42 };
      const r = verifyLedgerReplay({ entries: [polluted], pubkeyPem });
      assert.equal(r.verified, false);
      assert.equal(r.reason, "public_economic_claim_present");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fiat_value field present → public_economic_claim_present", async () => {
    const home = await freshHome();
    try {
      const { entries, pubkeyPem } = await buildChain(home, 1);
      const polluted = { ...entries[0], fiat_value: 5 };
      const r = verifyLedgerReplay({ entries: [polluted], pubkeyPem });
      assert.equal(r.verified, false);
      assert.equal(r.reason, "public_economic_claim_present");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("federation_target field present → public_economic_claim_present", async () => {
    const home = await freshHome();
    try {
      const { entries, pubkeyPem } = await buildChain(home, 1);
      const polluted = { ...entries[0], federation_target: "peer://x" };
      const r = verifyLedgerReplay({ entries: [polluted], pubkeyPem });
      assert.equal(r.verified, false);
      assert.equal(r.reason, "public_economic_claim_present");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});

describe("econ-ledger-replay · determinism & purity", () => {
  it("DOD-6 · identical inputs → identical output (twice)", async () => {
    const home = await freshHome();
    try {
      const { entries, pubkeyPem } = await buildChain(home, 3);
      const a = verifyLedgerReplay({ entries, pubkeyPem });
      const b = verifyLedgerReplay({ entries, pubkeyPem });
      assert.deepEqual(a, b);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("verifier writes no file (pure)", async () => {
    const home = await freshHome();
    try {
      const { entries, pubkeyPem } = await buildChain(home, 2);
      verifyLedgerReplay({ entries, pubkeyPem });
      // No econ subdir should exist after a verify call
      const { stat } = await import("node:fs/promises");
      let exists = false;
      try {
        await stat(join(home, "econ"));
        exists = true;
      } catch {
        exists = false;
      }
      assert.equal(exists, false, "verifier must not write any files");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});
