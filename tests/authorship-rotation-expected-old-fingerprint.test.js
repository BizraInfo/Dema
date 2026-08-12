import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  initAuthorshipKey,
  rotateAuthorshipKey,
  loadActiveKeyPair,
  KEY_INIT_CONSENT_PHRASE,
  KEY_ROTATE_CONSENT_PHRASE,
} from "../packages/receipts/src/authorship-key-store.js";

/**
 * TASK-029 R2 — EXPECTED-OLD-FINGERPRINT-BINDING-1A
 *
 * Consent to "ROTATE AUTHORSHIP KEY" is consent to an OPERATION CLASS, not to
 * rotating one exact key. `rotateAuthorshipKey` reads the live active key as
 * `oldFingerprint`, rechecks it under the lease, then mutates — nothing ever
 * compares the sovereign's INTENDED target to the key actually being retired.
 *
 * MEASURED RED (independently reproduced here, and by the Codex audit on main
 * 0fe9eea): an envelope naming a WRONG `expected_old_fingerprint` was ignored
 * and rotation returned `rotated: true`. Same defect class as the migration
 * exact-target binding, in the rotation path.
 *
 * This slice closes it as an ENFORCE-WHEN-PRESENT guard on the primitive: when
 * the envelope names an expected_old_fingerprint it must be 64-hex and must
 * equal the live key re-derived under the lease, refused before any mutation
 * and without consuming the nonce. Backward compatible — an omitted field keeps
 * the prior behavior; making it MANDATORY + no-downgrade is the governed
 * rotation-ceremony follow-up (exactly as migration split primitive/executor).
 *
 * Fixture keys, disposable homes. authority_delta = 0.
 */

const STAMP = "2026-08-12T00:00:00.000Z";
const WRONG_FP = "b".repeat(64);

const home = () => mkdtempSync(join(tmpdir(), "rot-r2-"));
const cleanup = (h) => rmSync(h, { recursive: true, force: true });

async function seed(h) {
  const r = await initAuthorshipKey({ consent: KEY_INIT_CONSENT_PHRASE, demaHome: h });
  assert.equal(r.initialized, true, r.error ?? "");
  return r.public_key_fingerprint;
}
function rotate(h, envelope) {
  return rotateAuthorshipKey({
    consent: KEY_ROTATE_CONSENT_PHRASE, demaHome: h, retiredAt: STAMP, envelope,
  });
}

// ── R2-01 ── THE LOAD-BEARING CONTROL: wrong expected fingerprint refuses,
//            zero mutation, and the nonce survives for a corrected retry.
describe("TASK-029 R2 — expected_old_fingerprint binding", () => {
  it("R2-01: a wrong expected_old_fingerprint refuses before any mutation, nonce intact", async () => {
    const h = home();
    try {
      const F = await seed(h);
      assert.notEqual(F, WRONG_FP);

      const bad = await rotate(h, { nonce: "n-r2-1", ceremony_id: "c", reason: "test", expected_old_fingerprint: WRONG_FP });
      assert.equal(bad.rotated, false);
      assert.equal(bad.error, "expected_old_fingerprint_mismatch");

      // Zero mutation: the active key is unchanged.
      const still = await loadActiveKeyPair(h);
      assert.equal(still.ok, true, still.error ?? "");
      assert.equal(still.fingerprint, F, "active key must be untouched after refusal");

      // The nonce was NOT consumed — a corrected retry with the SAME nonce and
      // the CORRECT fingerprint proceeds.
      const good = await rotate(h, { nonce: "n-r2-1", ceremony_id: "c", reason: "test", expected_old_fingerprint: F });
      assert.equal(good.rotated, true, good.error ?? "");
      assert.notEqual(good.new_fingerprint ?? (await loadActiveKeyPair(h)).fingerprint, F);
    } finally { cleanup(h); }
  });

  // ── R2-02 ── malformed expected fingerprint refuses (not silently ignored)
  it("R2-02: a malformed expected_old_fingerprint refuses before mutation", async () => {
    const h = home();
    try {
      const F = await seed(h);
      const r = await rotate(h, { nonce: "n-r2-2", ceremony_id: "c", reason: "test", expected_old_fingerprint: "not-a-hash" });
      assert.equal(r.rotated, false);
      assert.equal(r.error, "consent_envelope_expected_fingerprint_malformed");
      assert.equal((await loadActiveKeyPair(h)).fingerprint, F);
    } finally { cleanup(h); }
  });

  // ── R2-03 ── the correct expected fingerprint binds and rotates
  it("R2-03: the exact live fingerprint authorizes the rotation", async () => {
    const h = home();
    try {
      const F = await seed(h);
      const r = await rotate(h, { nonce: "n-r2-3", ceremony_id: "c", reason: "test", expected_old_fingerprint: F });
      assert.equal(r.rotated, true, r.error ?? "");
      const now = await loadActiveKeyPair(h);
      assert.equal(now.ok, true);
      assert.notEqual(now.fingerprint, F, "the key was actually rotated");
    } finally { cleanup(h); }
  });

  // ── R2-04 ── backward compat: an omitted field keeps the prior behavior,
  //            marking the seam a governed ceremony later makes mandatory.
  it("R2-04: an omitted expected_old_fingerprint still rotates (enforce-when-present seam)", async () => {
    const h = home();
    try {
      const F = await seed(h);
      const r = await rotate(h, { nonce: "n-r2-4", ceremony_id: "c", reason: "test" });
      assert.equal(r.rotated, true, r.error ?? "");
      assert.notEqual((await loadActiveKeyPair(h)).fingerprint, F);
    } finally { cleanup(h); }
  });
});
