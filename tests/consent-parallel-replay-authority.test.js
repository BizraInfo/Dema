// PARALLEL_CONSENT_REPLAY_AUTHORITY — characterization. RESOLVED 2026-08-11.
//
// `consent-nonce-claim.js` declares itself "the ONE canonical atomic consent
// claim" and names `consent/nonces` (the weld registry) in LEGACY_NAMESPACES as
// a superseded authority it replaces. Its header records why: measured on disk
// after a single closure, 8 nonces were consumed by one authority and 1 was
// visible to the other.
//
// WHAT THIS FILE PINNED, AND WHAT CHANGED.
//
// It pinned the CURRENT behaviour in both directions, because the escape was
// ASYMMETRIC and the closed half is exactly what made the open half easy to
// miss. Measured then:
//
//   legacy-first     → the canonical authority REFUSED        (closed)
//   canonical-first  → the LEGACY authority consumed anyway   (OPEN — the defect)
//
// Cutover part 2 (8f42685) moved the corridor onto the canonical claim. Part 3
// retired both legacy writers: they create nothing, for any caller. The open
// direction is now closed — not by making the legacy writer agree, which would
// have left two components entitled to decide consumption, but by removing its
// ability to decide at all.
//
// The tests below are the SAME experiment, re-run. The direction that was
// already closed must stay closed, and is asserted first for exactly the reason
// this file was written: a repair that silently opened it while closing the
// other would read as progress.
//
// The historical fixture now writes the legacy bytes directly rather than
// calling the retired writer. That is what history actually left on disk, and a
// fixture that needed the writer alive would make retirement untestable.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { claimConsentNonce, LEGACY_NAMESPACES, CONSENT_NONCE_RELDIR } from "../packages/receipts/src/consent-nonce-claim.js";
import { recordConsentNonce, _internal as legacyInternal } from "../packages/receipts/src/consent-nonce-registry-atomic.js";

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

// A historical legacy consumption, written as history left it: bytes on disk.
// Not through the retired writer — see the header.
const seedLegacy = (demaHome) => {
  const { dir, entry } = legacyInternal.paths(demaHome);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  writeFileSync(entry(NONCE), JSON.stringify(legacyInternal.buildEntry({
    actionType: "C3_LOCAL_WRITE",
    targetHash: `sha256:${"1".repeat(64)}`,
    consumedAtIso: "2026-01-01T00:00:00.000Z",
    consentProofHash: `sha256:${"2".repeat(64)}`,
  })), { mode: 0o600 });
};

// ── POSITIVE CONTROLS · the surviving authority is internally sound ──────────
test("control: the LEGACY authority can no longer consume anything, first attempt included", async () => {
  const h = home("l2");
  try {
    // This control used to read "the second attempt loses". After retirement
    // there is no first attempt to lose to.
    const first = await recordConsentNonce(legacyArgs(h));
    assert.equal(first.recorded, false);
    assert.equal(first.error, "legacy_consent_authority_retired");
    assert.equal(existsSync(legacyInternal.paths(h).dir), false, "and it created no store");
  } finally { rmSync(h, { recursive: true, force: true }); }
});

test("control: within the CANONICAL authority alone, the second attempt loses", async () => {
  const h = home("c2");
  try {
    assert.equal((await claimConsentNonce({ nonce: NONCE, demaHome: h })).claimed, true);
    assert.equal((await claimConsentNonce({ nonce: NONCE, demaHome: h })).claimed, false);
  } finally { rmSync(h, { recursive: true, force: true }); }
});

// ── the direction that was ALREADY CLOSED must stay closed ───────────────────
test("legacy-first: the canonical authority correctly REFUSES a legacy-consumed nonce", async () => {
  const h = home("d1");
  try {
    seedLegacy(h);
    const c = await claimConsentNonce({ nonce: NONCE, demaHome: h });
    assert.equal(c.claimed, false);
    assert.equal(c.reason, "consent_nonce_legacy_consumed");
    assert.equal(existsSync(join(h, CONSENT_NONCE_RELDIR)), false, "a refused claim writes no canonical record");
  } finally { rmSync(h, { recursive: true, force: true }); }
});

// ── the direction that was OPEN · RESOLVED by cutover part 3 ─────────────────
test("RESOLVED · canonical-first: the LEGACY authority can no longer consume the same nonce", async () => {
  // PINNED DEFECT, as measured before the cutover: a nonce claimed for one
  // governed act could still be spent through the legacy writer, because
  // recordConsentNonce never looked at consent/nonces-v1. The desired law was
  // that this second call FAILS. It now does — because the writer creates
  // nothing at all, not because it learned to check.
  const h = home("d2");
  try {
    assert.equal((await claimConsentNonce({ nonce: NONCE, demaHome: h })).claimed, true);
    const l = await recordConsentNonce(legacyArgs(h));
    assert.equal(l.recorded, false, "the escape is closed in this direction");
    assert.equal(l.error, "legacy_consent_authority_retired");
    assert.equal(existsSync(legacyInternal.paths(h).dir), false, "no second consumption record exists");
  } finally { rmSync(h, { recursive: true, force: true }); }
});

test("the escape is now SYMMETRIC — closed in both directions", async () => {
  // The asymmetry was the reason this outlived the module written to eliminate
  // it: checking only the refusing half read as "the authorities are reconciled".
  // Both halves are measured here, in one test, so neither can be checked alone.
  const a = home("s1");
  const b = home("s2");
  try {
    seedLegacy(a);
    const legacyThenCanonical = (await claimConsentNonce({ nonce: NONCE, demaHome: a })).claimed;
    await claimConsentNonce({ nonce: NONCE, demaHome: b });
    const canonicalThenLegacy = (await recordConsentNonce(legacyArgs(b))).recorded;
    assert.equal(legacyThenCanonical, false, "legacy-first: still closed");
    assert.equal(canonicalThenLegacy, false, "canonical-first: now closed too");
    assert.equal(legacyThenCanonical, canonicalThenLegacy, "the two directions now agree");

    // POSITIVE CONTROL. Both halves reading false would also be satisfied by an
    // estate where nothing can consume consent at all.
    const c = home("s3");
    try {
      assert.equal((await claimConsentNonce({ nonce: NONCE, demaHome: c })).claimed, true,
        "the surviving authority must still be able to consume");
    } finally { rmSync(c, { recursive: true, force: true }); }
  } finally {
    rmSync(a, { recursive: true, force: true });
    rmSync(b, { recursive: true, force: true });
  }
});
