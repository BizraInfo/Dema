// RECEIPT-CHAIN-1A · canonical signed prev_hash receipt ledger kernel
//
// The proof-spine gap (disk-verified): ~/.dema/receipts is a flat bag of
// independent receipts (0 carry prev_hash). This kernel is the trustless spine:
// buildCanonicalReceipt produces a signed, content-addressed receipt that
// chains to a prior one (prev_hash); verifyCanonicalChain walks the chain and
// confirms it with ZERO trust in the producer — the first step toward
// "Node2 verifies Node1 without trusting Node1".
//
// Reuses (no new crypto): signPayload/verifyPayload (authorship-signature),
// loadPrivateKey/loadPublicKey (authorship-key-store), sha256/stableStringify
// (consent-common). External-pubkey-only authority (embedded fingerprint
// ignored) — same invariant as verdict-receipt REJECT-4 / KEYCONSENT-1A.
//
// SCOPE (1A): pure kernel — builder returns the receipt, verifier walks a chain.
// NO write into the live ~/.dema/receipts ledger (that is RECEIPT-CHAIN-1B).
// No token/PoI/economy/federation. Fail-closed on consent + structure.

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildCanonicalReceipt,
  buildCanonicalReceiptV0_2,
  verifyCanonicalChain,
  verifyCanonicalAuthorityChain,
  CANONICAL_RECEIPT_SCHEMA,
  CANONICAL_RECEIPT_SCHEMA_V0_2,
  CANONICAL_RECEIPT_CONSENT_PHRASE,
  RECEIPT_SIGNATURE_ALG,
  QSAFE_CUTOVER_AT,
} from "../packages/receipts/src/canonical-receipt.js";
import { QSAFE_REASON_CODES } from "../packages/receipts/src/crypto-policy.js";
import {
  initAuthorshipKey,
  KEY_INIT_CONSENT_PHRASE,
  loadPublicKey,
} from "../packages/receipts/src/authorship-key-store.js";
import {
  generateEd25519Keypair,
  signPayload,
} from "../packages/receipts/src/authorship-signature.js";
import {
  sha256,
  stableStringify,
} from "../packages/consent/src/consent-common.js";

const NOW = "2026-05-30T14:30:00.000Z";

async function freshKeyedHome() {
  const home = await mkdtemp(join(tmpdir(), "dema-canon-receipt-"));
  await initAuthorshipKey({ consent: KEY_INIT_CONSENT_PHRASE, demaHome: home });
  return home;
}

function commonArgs(home, overrides = {}) {
  return {
    canonicalBody: { kind: "demo", value: 1 },
    prevHash: null,
    truthLabel: "MEASURED_LOCAL",
    whatProves: "the demo body was authored by this operator key",
    whatDoesNotProve: "that the demo body's content is true",
    consent: CANONICAL_RECEIPT_CONSENT_PHRASE,
    demaHome: home,
    now: NOW,
    ...overrides,
  };
}

// Re-seal a (possibly tampered) receipt so receipt_id is self-consistent —
// proves the verifier rejects on body_hash / signature, not merely receipt_id.
function reseal(receipt) {
  const { receipt_id, receipt_signature_b64, ...body } = receipt;
  return {
    ...body,
    receipt_signature_b64,
    receipt_id: sha256(stableStringify(body)),
  };
}

describe("RECEIPT-CHAIN-1A · build + verify canonical chain", () => {
  it("happy: genesis + child → 2-entry chain verifies under external pubkey", async () => {
    const home = await freshKeyedHome();
    try {
      const g = await buildCanonicalReceipt(commonArgs(home));
      assert.equal(g.built, true, `genesis: ${g.error}`);
      assert.equal(g.receipt.schema, CANONICAL_RECEIPT_SCHEMA);
      assert.equal(g.receipt.prev_hash, null);

      const c = await buildCanonicalReceipt(
        commonArgs(home, {
          canonicalBody: { kind: "demo", value: 2 },
          prevHash: g.receipt.receipt_id,
        }),
      );
      assert.equal(c.built, true, `child: ${c.error}`);
      assert.equal(c.receipt.prev_hash, g.receipt.receipt_id);

      const pubkey = await loadPublicKey(home);
      const v = verifyCanonicalChain({
        entries: [g.receipt, c.receipt],
        pubkeyPem: pubkey,
      });
      assert.equal(v.verified, true, `verify: ${v.reason}`);
      assert.equal(v.total_entries, 2);
      assert.equal(v.chain_root_hash, c.receipt.receipt_id);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("REJECT: genesis prev_hash not null → genesis_prev_hash_not_null", async () => {
    const home = await freshKeyedHome();
    try {
      const g = await buildCanonicalReceipt(commonArgs(home));
      const pubkey = await loadPublicKey(home);
      // forge a genesis whose prev_hash is non-null, re-seal so id is consistent
      const forged = reseal({ ...g.receipt, prev_hash: "a".repeat(64) });
      const v = verifyCanonicalChain({ entries: [forged], pubkeyPem: pubkey });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "genesis_prev_hash_not_null");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("REJECT: broken prev_hash on non-genesis → prev_hash_mismatch", async () => {
    const home = await freshKeyedHome();
    try {
      const g = await buildCanonicalReceipt(commonArgs(home));
      const c = await buildCanonicalReceipt(
        commonArgs(home, {
          canonicalBody: { v: 2 },
          prevHash: "b".repeat(64), // not the genesis id
        }),
      );
      const pubkey = await loadPublicKey(home);
      const v = verifyCanonicalChain({
        entries: [g.receipt, c.receipt],
        pubkeyPem: pubkey,
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "prev_hash_mismatch");
      assert.equal(v.at_index, 1);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("REJECT: tampered canonical_body (content changed, body_hash stale) → body_hash_mismatch", async () => {
    const home = await freshKeyedHome();
    try {
      const g = await buildCanonicalReceipt(commonArgs(home));
      const pubkey = await loadPublicKey(home);
      // change the content but keep the old body_hash, then re-seal receipt_id
      const forged = reseal({
        ...g.receipt,
        canonical_body: { kind: "demo", value: 999 },
      });
      const v = verifyCanonicalChain({ entries: [forged], pubkeyPem: pubkey });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "body_hash_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("REJECT: tampered body field without re-sealing → receipt_id_mismatch (non-canonical drift)", async () => {
    const home = await freshKeyedHome();
    try {
      const g = await buildCanonicalReceipt(commonArgs(home));
      const pubkey = await loadPublicKey(home);
      // flip truth_label but DON'T recompute receipt_id
      const tampered = { ...g.receipt, truth_label: "REMOTE_CI_VERIFIED" };
      const v = verifyCanonicalChain({
        entries: [tampered],
        pubkeyPem: pubkey,
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "receipt_id_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("REJECT: verify with a different external pubkey → signature_invalid", async () => {
    const home = await freshKeyedHome();
    try {
      const g = await buildCanonicalReceipt(commonArgs(home));
      const foreign = generateEd25519Keypair();
      const v = verifyCanonicalChain({
        entries: [g.receipt],
        pubkeyPem: foreign.public_key_pem,
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "signature_invalid");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("REJECT-4: re-signed by attacker key B but verified with operator key A → signature_invalid (embedded fingerprint never trusted)", async () => {
    const home = await freshKeyedHome();
    try {
      const g = await buildCanonicalReceipt(commonArgs(home));
      const operatorPubkey = await loadPublicKey(home);
      const attacker = generateEd25519Keypair();
      // attacker re-signs the SAME body with key B, leaves operator fingerprint
      const { receipt_id, receipt_signature_b64, ...body } = g.receipt;
      const forged = {
        ...body,
        receipt_signature_b64: signPayload(body, attacker.private_key_pem),
        receipt_id, // body unchanged → id still valid
      };
      const v = verifyCanonicalChain({
        entries: [forged],
        pubkeyPem: operatorPubkey,
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "signature_invalid");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("REJECT structural: empty chain → entries_empty; wrong schema → receipt_schema_mismatch; empty pubkey → external_pubkey_required", async () => {
    const home = await freshKeyedHome();
    try {
      const g = await buildCanonicalReceipt(commonArgs(home));
      const pubkey = await loadPublicKey(home);
      assert.equal(
        verifyCanonicalChain({ entries: [], pubkeyPem: pubkey }).reason,
        "entries_empty",
      );
      assert.equal(
        verifyCanonicalChain({
          entries: [{ ...g.receipt, schema: "x" }],
          pubkeyPem: pubkey,
        }).reason,
        "receipt_schema_mismatch",
      );
      assert.equal(
        verifyCanonicalChain({ entries: [g.receipt], pubkeyPem: "" }).reason,
        "external_pubkey_required",
      );
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("builder fail-closed: wrong consent / missing now / missing labels / no key", async () => {
    const home = await freshKeyedHome();
    try {
      assert.equal(
        (await buildCanonicalReceipt(commonArgs(home, { consent: "x" }))).error,
        "consent_required",
      );
      assert.equal(
        (await buildCanonicalReceipt(commonArgs(home, { now: undefined })))
          .error,
        "created_at_iso_required",
      );
      assert.equal(
        (await buildCanonicalReceipt(commonArgs(home, { whatProves: "" })))
          .error,
        "what_this_proves_required",
      );
      assert.equal(
        (
          await buildCanonicalReceipt(
            commonArgs(home, { whatDoesNotProve: "" }),
          )
        ).error,
        "what_this_does_not_prove_required",
      );
      assert.equal(
        (
          await buildCanonicalReceipt(
            commonArgs(home, { truthLabel: "MADE_UP" }),
          )
        ).error,
        "truth_label_invalid",
      );
      assert.equal(
        (await buildCanonicalReceipt(commonArgs(home, { prevHash: "nothex" })))
          .error,
        "prev_hash_invalid",
      );
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("PROOF-SPINE-GUARD-1A: builder guards for empty genesis body (#101), quarantined pulse (#102); verify guards for empty sig (#107), empty genesis body (#101)", async () => {
    const home = await freshKeyedHome();
    try {
      // #101: genesis must not be empty body (formal root of trust)
      const emptyGenesis = await buildCanonicalReceipt(
        commonArgs(home, { canonicalBody: {}, prevHash: null }),
      );
      assert.equal(emptyGenesis.built, false);
      assert.equal(
        emptyGenesis.error,
        "genesis_receipt_body_must_not_be_empty",
      );

      // #102: refuse on QUARANTINED (economic rail)
      const quarantined = await buildCanonicalReceipt(
        commonArgs(home, {
          canonicalBody: { pulse_state: "QUARANTINED", value: 1 },
        }),
      );
      assert.equal(quarantined.built, false);
      assert.equal(quarantined.error, "refuse_on_quarantined_pulse");

      // Build a valid genesis for verify tampering
      const g = await buildCanonicalReceipt(commonArgs(home));
      const pubkey = await loadPublicKey(home);

      // #107: verify rejects empty/missing signature (cryptographic)
      const noSig = { ...g.receipt, receipt_signature_b64: "" };
      const vNoSig = verifyCanonicalChain({
        entries: [noSig],
        pubkeyPem: pubkey,
      });
      assert.equal(vNoSig.verified, false);
      assert.equal(vNoSig.reason, "empty_or_missing_signature");

      // #101 in verify: genesis body empty
      const emptyBodyGenesis = {
        ...g.receipt,
        canonical_body: {},
        body_hash: sha256(stableStringify({})),
      };
      const resealedEmpty = reseal(emptyBodyGenesis); // keep id/sig consistent for the test
      const vEmptyBody = verifyCanonicalChain({
        entries: [resealedEmpty],
        pubkeyPem: pubkey,
      });
      assert.equal(vEmptyBody.verified, false);
      assert.equal(vEmptyBody.reason, "genesis_receipt_body_empty");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("deterministic + no PRIVATE KEY material in the receipt", async () => {
    const home = await freshKeyedHome();
    try {
      const a = await buildCanonicalReceipt(commonArgs(home));
      const b = await buildCanonicalReceipt(commonArgs(home));
      assert.equal(a.receipt.receipt_id, b.receipt.receipt_id);
      const s = JSON.stringify(a.receipt);
      assert.ok(!s.includes("PRIVATE KEY"));
      assert.ok(!/token_minted|federation|private_key/i.test(s));
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  // ── PR #113 review hardening: fail-closed, never throw ───────────
  it("builder fail-closed (not throw) on non-JSON-safe canonical_body", async () => {
    const home = await freshKeyedHome();
    try {
      const fn = await buildCanonicalReceipt(
        commonArgs(home, { canonicalBody: { f: () => 1 } }),
      );
      assert.equal(fn.built, false);
      assert.equal(fn.error, "canonical_body_invalid");

      const circ = {};
      circ.self = circ;
      const c = await buildCanonicalReceipt(
        commonArgs(home, { canonicalBody: circ }),
      );
      assert.equal(c.built, false);
      assert.equal(c.error, "canonical_body_invalid");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("verifier never THROWS on a hostile entry (circular body) → verified:false", async () => {
    const home = await freshKeyedHome();
    try {
      const g = await buildCanonicalReceipt(commonArgs(home));
      const pubkey = await loadPublicKey(home);
      const hostile = { ...g.receipt, canonical_body: {} };
      hostile.canonical_body.self = hostile.canonical_body; // circular
      const v = verifyCanonicalChain({ entries: [hostile], pubkeyPem: pubkey });
      assert.equal(v.verified, false); // must reject, not crash
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("builder rejects a malformed created_at_iso (not a real timestamp) → created_at_iso_required", async () => {
    const home = await freshKeyedHome();
    try {
      const r = await buildCanonicalReceipt(
        commonArgs(home, { now: "not-a-timestamp" }),
      );
      assert.equal(r.built, false);
      assert.equal(r.error, "created_at_iso_required");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("verifier rejects an invalid truth_label even if self-consistent → truth_label_invalid", async () => {
    const home = await freshKeyedHome();
    try {
      const g = await buildCanonicalReceipt(commonArgs(home));
      const pubkey = await loadPublicKey(home);
      const forged = reseal({ ...g.receipt, truth_label: "MADE_UP_LABEL" });
      const v = verifyCanonicalChain({ entries: [forged], pubkeyPem: pubkey });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "truth_label_invalid");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CRYPTO-AGILITY-1A · every receipt declares the algorithm that signed it.
//
// The rejections below all fire from checkEntryStructure, which runs BEFORE the
// signature is verified — so a resealed receipt (receipt_id recomputed, original
// signature kept) is enough to prove WHICH rule refused it. Each test asserts
// the exact reason, so a refusal for the wrong cause cannot pass as the right one.
// ═══════════════════════════════════════════════════════════════════════════

describe("CRYPTO-AGILITY-1A · sig_alg under the v0.2 schema", () => {
  it("CA-01: v0.2 declares sig_alg INSIDE the signed body — stripping it breaks receipt_id", async () => {
    const home = await freshKeyedHome();
    try {
      const g = await buildCanonicalReceiptV0_2(commonArgs(home));
      assert.equal(g.built, true, `build: ${g.error}`);
      assert.equal(g.receipt.schema, CANONICAL_RECEIPT_SCHEMA_V0_2);
      assert.equal(g.receipt.sig_alg, RECEIPT_SIGNATURE_ALG);

      // hash-bound, not merely present: the id the builder sealed is the id of
      // a body that CONTAINS sig_alg
      const { receipt_id, receipt_signature_b64, ...body } = g.receipt;
      assert.equal(sha256(stableStringify(body)), receipt_id);
      const { sig_alg, ...without } = body;
      assert.notEqual(
        sha256(stableStringify(without)),
        receipt_id,
        "sig_alg must be committed to by receipt_id, not carried beside it",
      );

      const v = verifyCanonicalChain({
        entries: [g.receipt],
        pubkeyPem: await loadPublicKey(home),
      });
      assert.equal(v.verified, true, `verify: ${v.reason}`);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("CA-02: v0.1 still verifies under v0.1 rules and carries no sig_alg", async () => {
    const home = await freshKeyedHome();
    try {
      const g = await buildCanonicalReceipt(commonArgs(home));
      assert.equal(g.receipt.schema, CANONICAL_RECEIPT_SCHEMA);
      assert.ok(!("sig_alg" in g.receipt), "v0.1 must not gain a field");
      const v = verifyCanonicalChain({
        entries: [g.receipt],
        pubkeyPem: await loadPublicKey(home),
      });
      assert.equal(v.verified, true, `verify: ${v.reason}`);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("CA-03: NEGATIVE CONTROL — a v0.2 receipt with no declared algorithm is refused CRYPTO_ALGORITHM_UNDECLARED", async () => {
    const home = await freshKeyedHome();
    try {
      const g = await buildCanonicalReceiptV0_2(commonArgs(home));
      const { sig_alg, ...stripped } = g.receipt;
      const undeclared = reseal(stripped); // otherwise perfect: id recomputed
      const v = verifyCanonicalChain({
        entries: [undeclared],
        pubkeyPem: await loadPublicKey(home),
      });
      assert.equal(v.verified, false);
      assert.equal(
        v.reason,
        `crypto_policy:${QSAFE_REASON_CODES.CRYPTO_ALGORITHM_UNDECLARED}`,
      );
      assert.equal(v.at_index, 0);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("CA-04: a declared algorithm this build cannot verify is refused DOWNGRADE_ATTACK_DETECTED", async () => {
    const home = await freshKeyedHome();
    try {
      const g = await buildCanonicalReceiptV0_2(commonArgs(home));
      // the signature below was produced by ed25519; the body now claims it was
      // not. A declaration nobody checks is decoration.
      const lying = reseal({ ...g.receipt, sig_alg: "ML-DSA-65" });
      const v = verifyCanonicalChain({
        entries: [lying],
        pubkeyPem: await loadPublicKey(home),
      });
      assert.equal(v.verified, false);
      assert.equal(
        v.reason,
        `crypto_policy:${QSAFE_REASON_CODES.DOWNGRADE_ATTACK_DETECTED}`,
      );
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("CA-05: a v0.1 receipt carrying sig_alg is refused — the old contract cannot be widened", async () => {
    const home = await freshKeyedHome();
    try {
      const g = await buildCanonicalReceipt(commonArgs(home));
      const smuggled = reseal({ ...g.receipt, sig_alg: RECEIPT_SIGNATURE_ALG });
      const v = verifyCanonicalChain({
        entries: [smuggled],
        pubkeyPem: await loadPublicKey(home),
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "sig_alg_not_valid_in_v0_1");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("CA-06: dispatch is per entry — a v0.1 genesis chains to a v0.2 child", async () => {
    const home = await freshKeyedHome();
    try {
      const g = await buildCanonicalReceipt(commonArgs(home));
      const c = await buildCanonicalReceiptV0_2(
        commonArgs(home, {
          canonicalBody: { kind: "demo", value: 2 },
          prevHash: g.receipt.receipt_id,
        }),
      );
      assert.equal(c.built, true, `child: ${c.error}`);
      const v = verifyCanonicalChain({
        entries: [g.receipt, c.receipt],
        pubkeyPem: await loadPublicKey(home),
      });
      assert.equal(v.verified, true, `verify: ${v.reason}`);
      assert.equal(v.total_entries, 2);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("CA-07: the authority-chain verifier enforces the identical rule — one definition, no drift", async () => {
    const home = await freshKeyedHome();
    try {
      const g = await buildCanonicalReceiptV0_2(commonArgs(home));
      const pubkey = await loadPublicKey(home);
      const ok = verifyCanonicalAuthorityChain({
        entries: [g.receipt],
        genesisPubkeyPem: pubkey,
      });
      assert.equal(ok.verified, true, `verify: ${ok.reason}`);

      const { sig_alg, ...stripped } = g.receipt;
      const bad = verifyCanonicalAuthorityChain({
        entries: [reseal(stripped)],
        genesisPubkeyPem: pubkey,
      });
      assert.equal(bad.verified, false);
      assert.equal(
        bad.reason,
        `crypto_policy:${QSAFE_REASON_CODES.CRYPTO_ALGORITHM_UNDECLARED}`,
      );
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("CA-08: no cutover is declared, so the hybrid branch is unreachable and 1A changes nothing at the cutover", () => {
    // Pinned deliberately. If someone sets a date, this test turns red and sends
    // them to the constant's note: the policy call must first move to after the
    // signature check, or it will read an assumed classicalValid instead of a
    // measured one.
    assert.equal(QSAFE_CUTOVER_AT, null);
  });
});
