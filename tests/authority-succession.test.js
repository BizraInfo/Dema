import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  verifyCanonicalChain,
  verifyCanonicalAuthorityChain,
  buildCanonicalReceipt,
  CANONICAL_RECEIPT_CONSENT_PHRASE,
  VALID_TRUTH_LABELS,
} from "../packages/receipts/src/canonical-receipt.js";
import {
  buildSuccessionIntentBody,
  buildSuccessionCommitBody,
  classifySuccessionBody,
  validateSuccessionIntentBody,
  validateSuccessionCommitBody,
  successionBindingDrift,
  AUTHORITY_SUCCESSION_INTENT_SCHEMA,
} from "../packages/receipts/src/authority-succession.js";
import {
  initAuthorshipKey,
  loadActiveKeyPair,
  KEY_INIT_CONSENT_PHRASE,
} from "../packages/receipts/src/authorship-key-store.js";
import {
  generateEd25519Keypair,
  fingerprintPublicKeyPem,
  sha256,
} from "../packages/receipts/src/authorship-signature.js";

/**
 * ISNAD-AUTHORITY-SUCCESSION-1A — the adversarial matrix over the verifier.
 *
 * The end-to-end SIGKILL proof lives in authorship-rotation-evidence-gap. This
 * file attacks the walk directly, because the walk is the thing that decides
 * whether a key was ever entitled to sign, and a walk that answered "yes" too
 * easily would make every downstream receipt meaningless.
 *
 * TWO QUESTIONS, BOTH REQUIRED.
 *   MATN INTEGRITY   did key K sign this exact canonical receipt body?
 *   AUTHORITY SANAD  was K the legitimately established authority here?
 *
 * The old verifier answered only the first and assumed the second. Each test
 * below breaks the second while leaving the first intact — a valid signature by
 * the wrong authority is the whole attack surface this slice exists to close.
 *
 * THE NEGATIVE-CONTROL INTEGRITY TEST (ASC-30) is the one that keeps the rest
 * honest: a verifier that refused everything would satisfy every rejection
 * above it. It proves the suite can tell a working chain from a broken one.
 *
 * FIXTURE KEYS ONLY. Disposable DEMA_HOME only.
 */

const LABEL = VALID_TRUTH_LABELS[0];
const withHome = async (fn) => {
  const home = mkdtempSync(join(tmpdir(), "asc-"));
  try { return await fn(home); } finally { rmSync(home, { recursive: true, force: true }); }
};

/// Builds receipts signed by whichever key is active in `home`. The store signs
/// with the active pair, so switching identity means swapping the generation —
/// which the helper below does by writing a fresh home per authority and
/// re-signing, keeping the test independent of rotation machinery entirely.
async function sign(home, canonicalBody, prevHash, now) {
  const built = await buildCanonicalReceipt({
    canonicalBody, prevHash, truthLabel: LABEL,
    whatProves: "matrix entry", whatDoesNotProve: "nothing beyond it",
    consent: CANONICAL_RECEIPT_CONSENT_PHRASE, demaHome: home, now,
  });
  assert.equal(built.built, true, built.error ?? "");
  return built.receipt;
}

/// A chain builder that signs each entry with an explicitly chosen key, so a
/// test can hand the wrong key to the right position on purpose.
function chainBuilder() {
  const entries = [];
  return {
    entries,
    async add(home, body, now) {
      const prev = entries.length ? entries[entries.length - 1].receipt_id : null;
      entries.push(await sign(home, body, prev, now));
      return entries[entries.length - 1];
    },
  };
}

/// Two independent homes give two independent authorities with real keys.
async function twoAuthorities() {
  const a = mkdtempSync(join(tmpdir(), "asc-a-"));
  const b = mkdtempSync(join(tmpdir(), "asc-b-"));
  await initAuthorshipKey({ consent: KEY_INIT_CONSENT_PHRASE, demaHome: a });
  await initAuthorshipKey({ consent: KEY_INIT_CONSENT_PHRASE, demaHome: b });
  const ka = await loadActiveKeyPair(a);
  const kb = await loadActiveKeyPair(b);
  return {
    a, b,
    aPem: ka.public_key_pem, aFp: ka.fingerprint,
    bPem: kb.public_key_pem, bFp: kb.fingerprint,
    cleanup: () => { rmSync(a, { recursive: true, force: true }); rmSync(b, { recursive: true, force: true }); },
  };
}

const intentFor = (aFp, bFp, bPem, txId = "tx-1", over = {}) => ({
  ...buildSuccessionIntentBody({
    rotationTxId: txId,
    predecessorFingerprint: aFp,
    successorFingerprint: bFp,
    successorPublicKeyPem: bPem,
    successorPublicKeySha256: sha256(bPem),
    consentBindingSha256: sha256("consent"),
    expectedPointerStateSha256: sha256("pointer"),
  }),
  ...over,
});

const commitFor = (aFp, bFp, intentId, txId = "tx-1", over = {}) => ({
  ...buildSuccessionCommitBody({
    rotationTxId: txId,
    predecessorFingerprint: aFp,
    successorFingerprint: bFp,
    intentReceiptId: intentId,
    observedPointerStateSha256: sha256("pointer"),
    generationFingerprint: bFp,
    retirementRelationSha256: sha256("registry"),
  }),
  ...over,
});

describe("ASC · a valid succession is accepted, and only a valid one", () => {
  it("ASC-01: POSITIVE CONTROL — K0 authorizes K1, K1 commits, the walk advances", async () => {
    const t = await twoAuthorities();
    try {
      const c = chainBuilder();
      await c.add(t.a, { e: "before" }, "2026-08-11T00:00:00.000Z");
      const intent = await c.add(t.a, intentFor(t.aFp, t.bFp, t.bPem), "2026-08-11T00:01:00.000Z");
      await c.add(t.b, commitFor(t.aFp, t.bFp, intent.receipt_id), "2026-08-11T00:02:00.000Z");
      await c.add(t.b, { e: "after" }, "2026-08-11T00:03:00.000Z");

      const v = verifyCanonicalAuthorityChain({ entries: c.entries, genesisPubkeyPem: t.aPem });
      assert.equal(v.verified, true, v.reason ?? "");
      assert.equal(v.successions.length, 1);
      assert.equal(v.final_authority_fingerprint, t.bFp);
      assert.equal(v.pending_successor, null);
    } finally { t.cleanup(); }
  });

  it("ASC-02: an ordinary single-key chain still verifies — backward compatible", async () => {
    await withHome(async (home) => {
      await initAuthorshipKey({ consent: KEY_INIT_CONSENT_PHRASE, demaHome: home });
      const k = await loadActiveKeyPair(home);
      const c = chainBuilder();
      await c.add(home, { e: 0 }, "2026-08-11T00:00:00.000Z");
      await c.add(home, { e: 1 }, "2026-08-11T00:01:00.000Z");

      const walked = verifyCanonicalAuthorityChain({ entries: c.entries, genesisPubkeyPem: k.public_key_pem });
      assert.equal(walked.verified, true);
      assert.equal(walked.successions.length, 0);
      // And the original single-key verifier agrees — the two must not diverge
      // on a chain that contains no succession at all.
      const single = verifyCanonicalChain({ entries: c.entries, pubkeyPem: k.public_key_pem });
      assert.equal(single.verified, true);
    });
  });

  it("ASC-03: an intent with no commit leaves a PENDING successor, not a failure", async () => {
    const t = await twoAuthorities();
    try {
      const c = chainBuilder();
      await c.add(t.a, intentFor(t.aFp, t.bFp, t.bPem), "2026-08-11T00:00:00.000Z");
      const v = verifyCanonicalAuthorityChain({ entries: c.entries, genesisPubkeyPem: t.aPem });
      assert.equal(v.verified, true, "a crash between the halves is legible, not corrupt");
      assert.equal(v.pending_successor.successor_fingerprint, t.bFp);
      assert.equal(v.final_authority_fingerprint, t.aFp, "authority has NOT advanced yet");
    } finally { t.cleanup(); }
  });
});

describe("ASC · authority cannot be seized, only granted", () => {
  it("ASC-10: an unannounced key cannot append — no intent named it", async () => {
    const t = await twoAuthorities();
    try {
      const c = chainBuilder();
      await c.add(t.a, { e: "before" }, "2026-08-11T00:00:00.000Z");
      await c.add(t.b, { e: "seized" }, "2026-08-11T00:01:00.000Z");
      const v = verifyCanonicalAuthorityChain({ entries: c.entries, genesisPubkeyPem: t.aPem });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "signature_invalid");
      assert.equal(v.at_index, 1);
    } finally { t.cleanup(); }
  });

  it("ASC-11: a key cannot authorize its own succession", async () => {
    const t = await twoAuthorities();
    try {
      const c = chainBuilder();
      // K1 writes the intent that would elevate K1. It is signed by K1, which is
      // not the authority, so it dies on the signature — authorization must come
      // from the predecessor or it is not authorization.
      await c.add(t.b, intentFor(t.aFp, t.bFp, t.bPem), "2026-08-11T00:00:00.000Z");
      const v = verifyCanonicalAuthorityChain({ entries: c.entries, genesisPubkeyPem: t.aPem });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "signature_invalid");
    } finally { t.cleanup(); }
  });

  it("ASC-12: an intent naming a predecessor that is not the current authority is refused", async () => {
    const t = await twoAuthorities();
    try {
      const c = chainBuilder();
      // Correctly signed by the authority, but it claims a DIFFERENT predecessor.
      await c.add(t.a, intentFor("f".repeat(64), t.bFp, t.bPem), "2026-08-11T00:00:00.000Z");
      const v = verifyCanonicalAuthorityChain({ entries: c.entries, genesisPubkeyPem: t.aPem });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "succession_predecessor_not_trusted_authority");
    } finally { t.cleanup(); }
  });

  it("ASC-13: a commit with no intent cannot advance anything", async () => {
    const t = await twoAuthorities();
    try {
      const c = chainBuilder();
      await c.add(t.a, commitFor(t.aFp, t.bFp, "a".repeat(64)), "2026-08-11T00:00:00.000Z");
      const v = verifyCanonicalAuthorityChain({ entries: c.entries, genesisPubkeyPem: t.aPem });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "succession_commit_without_intent");
    } finally { t.cleanup(); }
  });

  it("ASC-14: the intent authorizes K1 but K2 signs the commit — refused", async () => {
    const t = await twoAuthorities();
    const third = mkdtempSync(join(tmpdir(), "asc-c-"));
    try {
      await initAuthorshipKey({ consent: KEY_INIT_CONSENT_PHRASE, demaHome: third });
      const c = chainBuilder();
      const intent = await c.add(t.a, intentFor(t.aFp, t.bFp, t.bPem), "2026-08-11T00:00:00.000Z");
      // Body still names K1 throughout — only the SIGNER differs, so this is a
      // possession failure and must be reported as one.
      await c.add(third, commitFor(t.aFp, t.bFp, intent.receipt_id), "2026-08-11T00:01:00.000Z");
      const v = verifyCanonicalAuthorityChain({ entries: c.entries, genesisPubkeyPem: t.aPem });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "succession_possession_proof_invalid");
    } finally { t.cleanup(); rmSync(third, { recursive: true, force: true }); }
  });

  it("ASC-15: the retired predecessor cannot sign ordinary entries after succession", async () => {
    const t = await twoAuthorities();
    try {
      const c = chainBuilder();
      const intent = await c.add(t.a, intentFor(t.aFp, t.bFp, t.bPem), "2026-08-11T00:00:00.000Z");
      await c.add(t.b, commitFor(t.aFp, t.bFp, intent.receipt_id), "2026-08-11T00:01:00.000Z");
      await c.add(t.a, { e: "retired key writes again" }, "2026-08-11T00:02:00.000Z");
      const v = verifyCanonicalAuthorityChain({ entries: c.entries, genesisPubkeyPem: t.aPem });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "signature_invalid");
      assert.equal(v.at_index, 2);
    } finally { t.cleanup(); }
  });

  it("ASC-16: a second intent cannot open while one is still uncommitted", async () => {
    const t = await twoAuthorities();
    try {
      const c = chainBuilder();
      await c.add(t.a, intentFor(t.aFp, t.bFp, t.bPem, "tx-1"), "2026-08-11T00:00:00.000Z");
      await c.add(t.a, intentFor(t.aFp, t.bFp, t.bPem, "tx-2"), "2026-08-11T00:01:00.000Z");
      const v = verifyCanonicalAuthorityChain({ entries: c.entries, genesisPubkeyPem: t.aPem });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "succession_intent_overlaps_open_intent");
    } finally { t.cleanup(); }
  });
});

describe("ASC · mutated retries of the same transaction are refused", () => {
  const mutations = [
    // Changing ONLY the successor leaves the commit internally incoherent — it
    // would attest a generation it does not claim to be — so the shape check
    // fires first. That is a correct refusal at an earlier gate, and pinning the
    // later reason here would have asserted a path the input never reaches.
    ["successor alone", { successor_fingerprint: "b".repeat(64) }, "succession_commit_generation_not_successor"],
    // Mutating both consistently produces a self-coherent commit for the WRONG
    // succession, which is the case the drift check exists for.
    ["successor, self-coherently", { successor_fingerprint: "b".repeat(64), generation_fingerprint: "b".repeat(64) }, "succession_binding_drift"],
    ["mutated predecessor", { predecessor_fingerprint: "c".repeat(64) }, "succession_binding_drift"],
    ["mutated transaction id", { rotation_tx_id: "tx-other" }, "succession_binding_drift"],
  ];
  for (const [name, over, expected] of mutations) {
    it(`ASC-2x: ${name} in the commit — ${expected}`, async () => {
      const t = await twoAuthorities();
      try {
        const c = chainBuilder();
        const intent = await c.add(t.a, intentFor(t.aFp, t.bFp, t.bPem), "2026-08-11T00:00:00.000Z");
        await c.add(t.b, commitFor(t.aFp, t.bFp, intent.receipt_id, "tx-1", over), "2026-08-11T00:01:00.000Z");
        const v = verifyCanonicalAuthorityChain({ entries: c.entries, genesisPubkeyPem: t.aPem });
        assert.equal(v.verified, false);
        assert.equal(v.reason, expected);
      } finally { t.cleanup(); }
    });
  }

  it("ASC-24: a commit pointing at a different intent receipt is refused", async () => {
    const t = await twoAuthorities();
    try {
      const c = chainBuilder();
      await c.add(t.a, intentFor(t.aFp, t.bFp, t.bPem), "2026-08-11T00:00:00.000Z");
      await c.add(t.b, commitFor(t.aFp, t.bFp, "d".repeat(64)), "2026-08-11T00:01:00.000Z");
      const v = verifyCanonicalAuthorityChain({ entries: c.entries, genesisPubkeyPem: t.aPem });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "succession_intent_receipt_mismatch");
    } finally { t.cleanup(); }
  });

  it("ASC-25: a successor fingerprint that does not derive from its own key is refused", async () => {
    const t = await twoAuthorities();
    try {
      const c = chainBuilder();
      // Declared fingerprint is a CLAIM; the derived one is the fact.
      await c.add(t.a, intentFor(t.aFp, "e".repeat(64), t.bPem), "2026-08-11T00:00:00.000Z");
      const v = verifyCanonicalAuthorityChain({ entries: c.entries, genesisPubkeyPem: t.aPem });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "succession_successor_fingerprint_mismatch");
    } finally { t.cleanup(); }
  });

  it("ASC-26: a successor key hash that does not match the key is refused", async () => {
    const t = await twoAuthorities();
    try {
      const c = chainBuilder();
      await c.add(t.a, intentFor(t.aFp, t.bFp, t.bPem, "tx-1", {
        successor_public_key_sha256: sha256("not the key"),
      }), "2026-08-11T00:00:00.000Z");
      const v = verifyCanonicalAuthorityChain({ entries: c.entries, genesisPubkeyPem: t.aPem });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "succession_successor_key_hash_mismatch");
    } finally { t.cleanup(); }
  });

  it("ASC-27: a malformed successor key is refused, never coerced", async () => {
    const t = await twoAuthorities();
    try {
      const c = chainBuilder();
      await c.add(t.a, intentFor(t.aFp, t.bFp, t.bPem, "tx-1", {
        successor_public_key_pem: "-----BEGIN PUBLIC KEY-----\nnot base64 at all\n-----END PUBLIC KEY-----\n",
      }), "2026-08-11T00:00:00.000Z");
      const v = verifyCanonicalAuthorityChain({ entries: c.entries, genesisPubkeyPem: t.aPem });
      assert.equal(v.verified, false);
      assert.ok(
        ["succession_successor_key_unreadable", "succession_successor_fingerprint_mismatch"].includes(v.reason),
        `unexpected reason: ${v.reason}`,
      );
    } finally { t.cleanup(); }
  });

  it("ASC-28: a self-succession intent is refused before anything else happens", async () => {
    const t = await twoAuthorities();
    try {
      const c = chainBuilder();
      await c.add(t.a, intentFor(t.aFp, t.aFp, t.aPem), "2026-08-11T00:00:00.000Z");
      const v = verifyCanonicalAuthorityChain({ entries: c.entries, genesisPubkeyPem: t.aPem });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "succession_intent_self_succession");
    } finally { t.cleanup(); }
  });
});

describe("ASC · the anchor is external, and the suite can tell green from red", () => {
  it("ASC-30: NEGATIVE-CONTROL INTEGRITY — a refuse-everything verifier would fail here", async () => {
    // Every rejection above would be satisfied by a verifier that always says
    // no. This is the one that would break it: a fully valid two-authority chain
    // must verify, advance, and report the right final authority.
    const t = await twoAuthorities();
    try {
      const c = chainBuilder();
      await c.add(t.a, { e: "genesis" }, "2026-08-11T00:00:00.000Z");
      const intent = await c.add(t.a, intentFor(t.aFp, t.bFp, t.bPem), "2026-08-11T00:01:00.000Z");
      await c.add(t.b, commitFor(t.aFp, t.bFp, intent.receipt_id), "2026-08-11T00:02:00.000Z");
      const v = verifyCanonicalAuthorityChain({ entries: c.entries, genesisPubkeyPem: t.aPem });
      assert.equal(v.verified, true, `a refuse-everything verifier is indistinguishable without this: ${v.reason}`);
      assert.equal(v.final_authority_fingerprint, t.bFp);
    } finally { t.cleanup(); }
  });

  it("ASC-31: anchoring on the SUCCESSOR instead of genesis fails — no self-certified ancestry", async () => {
    const t = await twoAuthorities();
    try {
      const c = chainBuilder();
      await c.add(t.a, { e: "genesis" }, "2026-08-11T00:00:00.000Z");
      const intent = await c.add(t.a, intentFor(t.aFp, t.bFp, t.bPem), "2026-08-11T00:01:00.000Z");
      await c.add(t.b, commitFor(t.aFp, t.bFp, intent.receipt_id), "2026-08-11T00:02:00.000Z");
      const v = verifyCanonicalAuthorityChain({ entries: c.entries, genesisPubkeyPem: t.bPem });
      assert.equal(v.verified, false, "the current key must not be able to certify the history before it");
      assert.equal(v.at_index, 0);
    } finally { t.cleanup(); }
  });

  it("ASC-32: no anchor at all is refused", () => {
    const v = verifyCanonicalAuthorityChain({ entries: [{}], genesisPubkeyPem: undefined });
    assert.equal(v.verified, false);
    assert.equal(v.reason, "external_pubkey_required");
  });
});

describe("ASC · the pure body kernel", () => {
  it("ASC-40: classification requires BOTH schema and event to agree", () => {
    const body = buildSuccessionIntentBody({
      rotationTxId: "t", predecessorFingerprint: "a", successorFingerprint: "b",
      successorPublicKeyPem: "x", successorPublicKeySha256: "y",
      consentBindingSha256: "z", expectedPointerStateSha256: "w",
    });
    assert.equal(classifySuccessionBody(body), "INTENT");
    assert.equal(classifySuccessionBody({ ...body, event: "SOMETHING_ELSE" }), null);
    assert.equal(classifySuccessionBody({ ...body, schema: "other" }), null);
    assert.equal(classifySuccessionBody({ schema: AUTHORITY_SUCCESSION_INTENT_SCHEMA }), null);
    assert.equal(classifySuccessionBody(null), null);
    assert.equal(classifySuccessionBody([]), null);
  });

  it("ASC-41: a nonzero authority_delta is refused on both halves", () => {
    const keys = generateEd25519Keypair();
    const fp = fingerprintPublicKeyPem(keys.public_key_pem);
    const intent = intentFor("a".repeat(64), fp, keys.public_key_pem, "t", { authority_delta: 1 });
    assert.equal(validateSuccessionIntentBody(intent).reason, "intent_authority_delta_nonzero");
    const commit = commitFor("a".repeat(64), fp, "b".repeat(64), "t", { authority_delta: 1 });
    assert.equal(validateSuccessionCommitBody(commit).reason, "commit_authority_delta_nonzero");
  });

  it("ASC-42: a commit attesting a generation other than the successor is refused", () => {
    const commit = commitFor("a".repeat(64), "b".repeat(64), "c".repeat(64), "t", {
      generation_fingerprint: "d".repeat(64),
    });
    assert.equal(validateSuccessionCommitBody(commit).reason, "commit_generation_not_successor");
  });

  it("ASC-43: drift is reported per field, and an exact match reports none", () => {
    const i = { rotation_tx_id: "t", predecessor_fingerprint: "a", successor_fingerprint: "b" };
    assert.deepEqual(successionBindingDrift(i, { ...i }), []);
    assert.deepEqual(successionBindingDrift(i, { ...i, successor_fingerprint: "z" }), ["successor_fingerprint"]);
    assert.deepEqual(
      successionBindingDrift(i, { rotation_tx_id: "x", predecessor_fingerprint: "y", successor_fingerprint: "z" }),
      ["rotation_tx_id", "predecessor_fingerprint", "successor_fingerprint"],
    );
  });
});
