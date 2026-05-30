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
  verifyCanonicalChain,
  CANONICAL_RECEIPT_SCHEMA,
  CANONICAL_RECEIPT_CONSENT_PHRASE,
} from "../packages/receipts/src/canonical-receipt.js";
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
