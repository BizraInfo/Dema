import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  initAuthorshipKey,
  rotateAuthorshipKey,
  resumeAuthorshipRotation,
  loadActiveKeyPair,
  loadPublicKey,
  activeKeyPaths,
  keyPaths,
  KEY_INIT_CONSENT_PHRASE,
  KEY_ROTATE_CONSENT_PHRASE,
  KEY_ROTATE_RESUME_CONSENT_PHRASE,
} from "../packages/receipts/src/authorship-key-store.js";
import {
  appendCanonicalReceipt,
  verifyCanonicalLedger,
  loadCanonicalLedger,
} from "../packages/receipts/src/canonical-ledger.js";
import {
  CANONICAL_RECEIPT_CONSENT_PHRASE,
  VALID_TRUTH_LABELS,
} from "../packages/receipts/src/canonical-receipt.js";

/**
 * ROW8-AUTHORSHIP-IDENTITY-ROTATION — the experiment, RE-RUN after repair.
 *
 * This file first PINNED two defects measured on 0952c16.
 * ISNAD-AUTHORITY-SUCCESSION-1A repaired both, so the pins are re-run here
 * rather than deleted: a characterization never re-measured after the repair it
 * motivated degrades into an assertion that the repair happened.
 *
 * ── FINDING 1 · authority could change with no evidence, and recovery could
 *    not finalize it ────────────────────────────────────────────────────────
 *
 * `rotateAuthorshipKey` ordered its writes: journal PREPARED → ACTIVATING →
 * retire the old fingerprint → activate the new generation (THE AUTHORITY
 * SWITCH) → verify → journal → write the rotation receipt → COMPLETE.
 *
 * A kill after the pointer rename left the new generation authoritative with no
 * evidence, and `resumeAuthorshipRotation` classified that state ALREADY_ACTIVE,
 * answered `already_resolved: true` and wrote nothing — it existed to roll a
 * stalled pointer forward, not to reconstruct missing evidence. The forbidden
 * pair, and permanent. The pre-existing CP5 fixture kills on the OTHER side of
 * the same rename and yields a liveness stall, which is how the hole survived a
 * crash matrix that already existed.
 *
 * NOW: the predecessor appends a signed SUCCESSION INTENT while it is still the
 * authority, before the pointer moves. A crash on the far side therefore leaves
 * an authorized-but-uncommitted intent — a legible state — and resume finalizes
 * the successor-signed COMMIT from durable facts alone, with no human
 * reconstruction. The local rotation-receipt FILE is still absent after such a
 * crash; it is no longer the evidence that matters.
 *
 * ── FINDING 2 · the canonical ledger could not survive a rotation ───────────
 *
 * `verifyCanonicalChain` took ONE `pubkeyPem` and verified every entry against
 * it; entries carried no key identity and the chain had no notion of
 * succession. After a rotation the chain reported `signature_invalid` and
 * `appendCanonicalReceipt` refused with `ledger_chain_broken` — which is
 * precisely why finding 1 could not be repaired by "just emit a receipt".
 *
 * NOW: verification walks the authority forward from an externally supplied
 * genesis anchor, advancing only across a valid two-half succession link.
 * Passing the CURRENT active key still fails, loudly and correctly: the anchor
 * is the root of trust, not the key in force today.
 *
 * The adversarial matrix over the verifier itself lives in
 * `tests/authority-succession.test.js`. This file stays what it was — the real
 * SIGKILL, end to end.
 *
 * FIXTURE KEYS ONLY. Disposable DEMA_HOME only. No real ~/.dema is touched.
 */

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const KILL_AFTER = join(REPO, "tests/fixtures/kill-after-pointer-commit-preload.mjs");
const STAMP = "2026-08-11T00:00:00.000Z";
const LABEL = VALID_TRUTH_LABELS[0];

const freshHome = () => mkdtempSync(join(tmpdir(), "row8-rot-"));
const withHome = async (fn) => {
  const home = freshHome();
  try { return await fn(home); } finally { rmSync(home, { recursive: true, force: true }); }
};

async function seedKey(home) {
  const r = await initAuthorshipKey({ consent: KEY_INIT_CONSENT_PHRASE, demaHome: home });
  assert.equal(r.initialized, true);
  return r.public_key_fingerprint;
}

const rotate = (home) => rotateAuthorshipKey({
  consent: KEY_ROTATE_CONSENT_PHRASE,
  demaHome: home,
  retiredAt: STAMP,
  reason: "compromised_key_rotation",
  envelope: { nonce: "row8-nonce", ceremony_id: "row8-cer", reason: "row8" },
});

const rotationReceipts = (home) => {
  const dir = join(keyPaths(home).dir, "rotation-receipts");
  try { return readdirSync(dir); } catch { return []; }
};

/// Drive a real rotation in a child that dies AFTER the pointer commits.
function crashRotationAfterPointerCommit(home) {
  const ap = activeKeyPaths(home);
  const script = `
    import { rotateAuthorshipKey, KEY_ROTATE_CONSENT_PHRASE }
      from ${JSON.stringify(join(REPO, "packages/receipts/src/authorship-key-store.js"))};
    await rotateAuthorshipKey({
      consent: KEY_ROTATE_CONSENT_PHRASE,
      demaHome: ${JSON.stringify(home)},
      retiredAt: ${JSON.stringify(STAMP)},
      reason: "compromised_key_rotation",
      envelope: { nonce: "row8-nonce", ceremony_id: "row8-cer", reason: "row8" },
    });
  `;
  const killed = spawnSync(
    process.execPath,
    ["--import", KILL_AFTER, "--input-type=module", "--eval", script],
    {
      cwd: REPO,
      encoding: "utf8",
      timeout: 30_000,
      env: { ...process.env, BIZRA_TEST_CP5_KEYS_DIR: ap.dir },
    },
  );
  assert.equal(killed.signal, "SIGKILL", `rotation did not die after the pointer commit: ${killed.stderr}`);
  return ap;
}

describe("ROW8-A · a changed authority now carries its evidence, and recovery finalizes it", () => {
  it("ROW8-A1: POSITIVE CONTROL — an uninterrupted rotation DOES write a rotation receipt", async () => {
    await withHome(async (home) => {
      await seedKey(home);
      const r = await rotate(home);
      assert.equal(r.rotated, true, r.error ?? "");
      assert.equal(rotationReceipts(home).length, 1, "the happy path writes exactly one receipt");
      // Without this, ROW8-A3's "no receipt" would be satisfied by a rotation
      // that never writes receipts at all, and would prove nothing about crashes.
    });
  });

  it("ROW8-A2: the kill lands AFTER the authority switch — the new generation is active", async () => {
    await withHome(async (home) => {
      const oldFp = await seedKey(home);
      const ap = crashRotationAfterPointerCommit(home);

      const registry = JSON.parse(readFileSync(ap.retiredRegistry, "utf8"));
      assert.equal(registry.retired.some((e) => e.fingerprint === oldFp), true, "old fingerprint is retired");

      const pointer = JSON.parse(readFileSync(ap.activePointer, "utf8"));
      assert.notEqual(pointer.generation_fingerprint, oldFp,
        "the pointer ADVANCED — this fixture must land on the far side of the switch");
      assert.equal(pointer.previous_generation, oldFp);

      const active = await loadActiveKeyPair(home);
      assert.equal(active.ok, true, active.error ?? "");
      assert.equal(active.fingerprint, pointer.generation_fingerprint,
        "the new generation is loadable and authoritative");
    });
  });

  it("ROW8-A3: RESOLVED — the crash leaves a predecessor-signed INTENT, not silence", async () => {
    await withHome(async (home) => {
      await seedKey(home);
      const genesis = await loadPublicKey(home);
      crashRotationAfterPointerCommit(home);

      // The local rotation-receipt file is still absent. It was never the
      // evidence the invariant asks for, and pinning its absence again would
      // pin the wrong thing.
      assert.deepEqual(rotationReceipts(home), []);

      const entries = await loadCanonicalLedger({ demaHome: home });
      assert.equal(entries.length, 1, "exactly the intent — the commit never ran");

      const walk = await verifyCanonicalLedger({ demaHome: home, pubkeyPem: genesis });
      assert.equal(walk.verified, true, "the chain still verifies from the genesis anchor");
      assert.ok(walk.pending_successor, "and it names an authorized-but-uncommitted successor");
      const active = await loadActiveKeyPair(home);
      assert.equal(walk.pending_successor.successor_fingerprint, active.fingerprint,
        "the pending successor is exactly the generation the pointer selected");
    });
  });

  it("ROW8-A4: RESOLVED — resume finalizes the succession, and is idempotent", async () => {
    await withHome(async (home) => {
      await seedKey(home);
      const genesis = await loadPublicKey(home);
      crashRotationAfterPointerCommit(home);

      const resumed = await resumeAuthorshipRotation({
        consent: KEY_ROTATE_RESUME_CONSENT_PHRASE,
        demaHome: home,
        resumedAt: "2026-08-11T00:05:00.000Z",
      });
      assert.equal(resumed.resumed, true);
      assert.equal(resumed.succession_finalized, true,
        "recovery completes the evidence rather than declaring the state settled");

      const after = await loadCanonicalLedger({ demaHome: home });
      assert.equal(after.length, 2, "intent + commit");
      const walk = await verifyCanonicalLedger({ demaHome: home, pubkeyPem: genesis });
      assert.equal(walk.verified, true);
      assert.equal(walk.successions.length, 1);
      assert.equal(walk.pending_successor, null, "nothing is left open");
      const active = await loadActiveKeyPair(home);
      assert.equal(walk.final_authority_fingerprint, active.fingerprint,
        "the lineage lands on the key that is actually authoritative");

      // Idempotence: an exact re-run must change no durable byte.
      const again = await resumeAuthorshipRotation({
        consent: KEY_ROTATE_RESUME_CONSENT_PHRASE,
        demaHome: home,
        resumedAt: "2026-08-11T00:06:00.000Z",
      });
      assert.equal(again.succession_finalized, false, "there is nothing left to finalize");
      assert.equal((await loadCanonicalLedger({ demaHome: home })).length, 2);
    });
  });

  it("ROW8-A5: RESOLVED — a completed rotation emits both halves into the canonical ledger", async () => {
    await withHome(async (home) => {
      await seedKey(home);
      const genesis = await loadPublicKey(home);
      const before = await loadCanonicalLedger({ demaHome: home });
      const r = await rotate(home);
      assert.equal(r.rotated, true, r.error ?? "");
      const after = await loadCanonicalLedger({ demaHome: home });
      assert.equal(after.length, before.length + 2,
        "this is what the Row-8 producer measures: the authoritative transition now touches the canonical ledger");
      assert.equal(typeof r.succession_intent_receipt_id, "string");
      assert.equal(typeof r.succession_commit_receipt_id, "string");
      assert.notEqual(r.succession_intent_receipt_id, r.succession_commit_receipt_id);

      const walk = await verifyCanonicalLedger({ demaHome: home, pubkeyPem: genesis });
      assert.equal(walk.verified, true);
      assert.equal(walk.successions.length, 1);
    });
  });
});

describe("ROW8-B · the canonical ledger survives a rotation, anchored on genesis", () => {
  const append = (home, body, now) => appendCanonicalReceipt({
    canonicalBody: body,
    truthLabel: LABEL,
    whatProves: "characterization probe entry",
    whatDoesNotProve: "anything beyond this probe",
    consent: CANONICAL_RECEIPT_CONSENT_PHRASE,
    demaHome: home,
    now,
  });

  it("ROW8-B1: RESOLVED — a chain spanning a rotation verifies from the GENESIS anchor", async () => {
    await withHome(async (home) => {
      await seedKey(home);
      const genesis = await loadPublicKey(home); // captured BEFORE any rotation
      const a = await append(home, { probe: "pre-rotation" }, "2026-08-11T00:00:00.000Z");
      assert.equal(a.appended, true, a.error ?? "");

      // NON-VACUITY: an empty ledger verifies as a "verified empty chain", so a
      // pass on an empty ledger would prove nothing at all.
      assert.equal((await loadCanonicalLedger({ demaHome: home })).length, 1);

      const before = await verifyCanonicalLedger({ demaHome: home, pubkeyPem: genesis });
      assert.equal(before.verified, true, "POSITIVE CONTROL: the chain verifies before the rotation");

      const r = await rotate(home);
      assert.equal(r.rotated, true, r.error ?? "");

      const after = await verifyCanonicalLedger({ demaHome: home, pubkeyPem: genesis });
      assert.equal(after.verified, true, "the retired key's entries remain valid under the walked authority");
      assert.equal(after.successions.length, 1);
      assert.equal(after.final_authority_fingerprint, r.new_fingerprint);
    });
  });

  it("ROW8-B1b: the CURRENT active key is not an anchor, and saying so is not optional", async () => {
    await withHome(async (home) => {
      await seedKey(home);
      assert.equal((await append(home, { probe: "pre" }, "2026-08-11T00:00:00.000Z")).appended, true);
      assert.equal((await rotate(home)).rotated, true);

      // CONTRACT MIGRATION. `pubkeyPem` is the root-trust anchor now. Handing it
      // the key in force today asks the chain to certify its own ancestry, and
      // it must fail rather than appear to verify a history that key never
      // signed. Failing loudly here is the whole point of the change.
      const wrong = await verifyCanonicalLedger({ demaHome: home, pubkeyPem: await loadPublicKey(home) });
      assert.equal(wrong.verified, false);
      assert.equal(wrong.reason, "signature_invalid");
    });
  });

  it("ROW8-B2: RESOLVED — canonical receipts append normally after a rotation", async () => {
    await withHome(async (home) => {
      await seedKey(home);
      const genesis = await loadPublicKey(home);
      assert.equal((await append(home, { probe: "pre" }, "2026-08-11T00:00:00.000Z")).appended, true);
      assert.equal((await rotate(home)).rotated, true);

      const post = await append(home, { probe: "post" }, "2026-08-11T00:01:00.000Z");
      assert.equal(post.appended, true, "the ledger is no longer closed by a rotation");

      const walk = await verifyCanonicalLedger({ demaHome: home, pubkeyPem: genesis });
      assert.equal(walk.verified, true, "and the post-rotation entry verifies under the evolved authority");
    });
  });

  it("ROW8-B3: two sequential successions walk K0 → K1 → K2 from one anchor", async () => {
    await withHome(async (home) => {
      await seedKey(home);
      const genesis = await loadPublicKey(home);
      assert.equal((await append(home, { probe: "e0" }, "2026-08-11T00:00:00.000Z")).appended, true);
      const r1 = await rotate(home);
      assert.equal((await append(home, { probe: "e1" }, "2026-08-11T00:01:00.000Z")).appended, true);
      const r2 = await rotateAuthorshipKey({
        consent: KEY_ROTATE_CONSENT_PHRASE, demaHome: home, retiredAt: "2026-08-11T00:02:00.000Z",
        reason: "compromised_key_rotation",
        envelope: { nonce: "row8-nonce-2", ceremony_id: "row8-cer-2", reason: "row8" },
      });
      assert.equal(r2.rotated, true, r2.error ?? "");
      assert.equal((await append(home, { probe: "e2" }, "2026-08-11T00:03:00.000Z")).appended, true);

      const walk = await verifyCanonicalLedger({ demaHome: home, pubkeyPem: genesis });
      assert.equal(walk.verified, true);
      assert.equal(walk.successions.length, 2, "both links are recorded, in order");
      assert.equal(walk.successions[0].successor_fingerprint, r1.new_fingerprint);
      assert.equal(walk.successions[1].predecessor_fingerprint, r1.new_fingerprint);
      assert.equal(walk.final_authority_fingerprint, r2.new_fingerprint);
      assert.equal(walk.total_entries, 7, "3 ordinary + 2 intents + 2 commits");
    });
  });
});
