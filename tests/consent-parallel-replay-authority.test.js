// PARALLEL_CONSENT_REPLAY_AUTHORITY — characterization, pinned not fixed.
//
// `consent-nonce-claim.js` declares itself "the ONE canonical atomic consent
// claim" and names `consent/nonces` (the weld registry) in LEGACY_NAMESPACES as
// a superseded authority it replaces. Its header records why: measured on disk
// after a single closure, 8 nonces were consumed by one authority and 1 was
// visible to the other.
//
// The cutover never completed. `verdict-attest.js:146` still uses the LEGACY
// `recordConsentNonce` as its replay gate ("First call with a given nonce wins;
// replay -> consent_nonce_already_used"), and corridor-closure-gatherer imports
// from BOTH surfaces.
//
// These tests pin the CURRENT behaviour in both directions, because the escape
// is ASYMMETRIC and the closed half is exactly what makes the open half easy to
// miss. They take no position on the repair; that is a cutover, not a test's
// call. They exist so nobody reads "legacy is checked for refusal" and concludes
// the two authorities are reconciled.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { claimConsentNonce, LEGACY_NAMESPACES, CONSENT_NONCE_RELDIR } from "../packages/receipts/src/consent-nonce-claim.js";
import { recordConsentNonce } from "../packages/receipts/src/consent-nonce-registry-atomic.js";

const NONCE = "a".repeat(43) + "B";
const legacyArgs = (demaHome) => ({
  nonce: NONCE,
  actionType: "C3_LOCAL_WRITE",
  targetHash: `sha256:${"1".repeat(64)}`,
  consentProofHash: `sha256:${"2".repeat(64)}`,
  demaHome,
});
const home = (tag) => mkdtempSync(join(tmpdir(), `pcra-${tag}-`));

test("canon declares the weld registry superseded, and the canonical store is a different namespace", () => {
  assert.equal(LEGACY_NAMESPACES.weldRegistry, join("consent", "nonces"));
  assert.equal(CONSENT_NONCE_RELDIR, join("consent", "nonces-v1"));
  assert.notEqual(LEGACY_NAMESPACES.weldRegistry, CONSENT_NONCE_RELDIR);
});

// ── POSITIVE CONTROLS · each authority is internally sound ───────────────────
test("control: within the LEGACY authority alone, the second attempt loses", async () => {
  const h = home("l2");
  try {
    assert.equal((await recordConsentNonce(legacyArgs(h))).recorded, true);
    assert.equal((await recordConsentNonce(legacyArgs(h))).recorded, false);
  } finally { rmSync(h, { recursive: true, force: true }); }
});

test("control: within the CANONICAL authority alone, the second attempt loses", async () => {
  const h = home("c2");
  try {
    assert.equal((await claimConsentNonce({ nonce: NONCE, demaHome: h })).claimed, true);
    assert.equal((await claimConsentNonce({ nonce: NONCE, demaHome: h })).claimed, false);
  } finally { rmSync(h, { recursive: true, force: true }); }
});

// ── the CLOSED direction ─────────────────────────────────────────────────────
test("legacy-first: the canonical authority correctly REFUSES a legacy-consumed nonce", async () => {
  const h = home("d1");
  try {
    assert.equal((await recordConsentNonce(legacyArgs(h))).recorded, true);
    const c = await claimConsentNonce({ nonce: NONCE, demaHome: h });
    assert.equal(c.claimed, false);
    assert.equal(c.reason, "consent_nonce_legacy_consumed");
  } finally { rmSync(h, { recursive: true, force: true }); }
});

// ── the OPEN direction · this is the defect ──────────────────────────────────
test("PINNED DEFECT · canonical-first: the LEGACY authority still consumes the same nonce", async () => {
  // A nonce claimed for one governed act can still be spent through
  // verdict-attest, because recordConsentNonce never looks at consent/nonces-v1.
  // The desired law is that this second call FAILS. It does not, today.
  const h = home("d2");
  try {
    assert.equal((await claimConsentNonce({ nonce: NONCE, demaHome: h })).claimed, true);
    const l = await recordConsentNonce(legacyArgs(h));
    assert.equal(l.recorded, true, "PINNED: the escape is open in this direction");
  } finally { rmSync(h, { recursive: true, force: true }); }
});

test("the escape is ASYMMETRIC, and that is why it survives review", async () => {
  // One direction refuses and the other admits. Checking only the refusing half
  // reads as "the authorities are reconciled" — which is how this outlived the
  // module that was written to eliminate it.
  const a = home("s1");
  const b = home("s2");
  try {
    await recordConsentNonce(legacyArgs(a));
    const legacyThenCanonical = (await claimConsentNonce({ nonce: NONCE, demaHome: a })).claimed;
    await claimConsentNonce({ nonce: NONCE, demaHome: b });
    const canonicalThenLegacy = (await recordConsentNonce(legacyArgs(b))).recorded;
    assert.equal(legacyThenCanonical, false, "closed");
    assert.equal(canonicalThenLegacy, true, "open");
    assert.notEqual(legacyThenCanonical, !canonicalThenLegacy === false, "the two directions must not be conflated");
  } finally {
    rmSync(a, { recursive: true, force: true });
    rmSync(b, { recursive: true, force: true });
  }
});
