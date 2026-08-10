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
 * ROW8-AUTHORSHIP-IDENTITY-ROTATION · CHARACTERIZATION, PINNED NOT FIXED.
 *
 * `receipt_per_transition` is VIOLATED with exactly one proven counterexample,
 * `authorship_identity_rotation`. These tests establish WHY, by measurement
 * rather than by reading the producer's verdict back to itself, and they pin
 * the current behaviour so a future repair has a baseline to move.
 *
 * They take no position on the repair. Two independent findings are recorded.
 *
 * ── FINDING 1 · authority can change with no evidence, and recovery cannot
 *    finalize it ─────────────────────────────────────────────────────────────
 *
 * `rotateAuthorshipKey` orders its writes: journal PREPARED → journal ACTIVATING
 * → retire the old fingerprint → activate the new generation (THE AUTHORITY
 * SWITCH) → verify → journal RETIREMENT_COMMITTED → write the rotation receipt →
 * journal COMPLETE.
 *
 * A kill after the pointer rename and before the receipt write therefore leaves
 * the new generation authoritative with no rotation receipt. On restart,
 * `resumeAuthorshipRotation` classifies that state as ALREADY_ACTIVE and returns
 * `already_resolved: true` WITHOUT writing anything — by design, since it exists
 * to roll a stalled pointer forward, not to reconstruct missing evidence.
 *
 * The result is the forbidden pair: authority changed, proof trail absent, and
 * no path that finalizes it. The existing CP5 fixture kills on the OTHER side of
 * the same rename and produces a liveness stall instead, which is why this hole
 * survived a crash matrix that already existed.
 *
 * ── FINDING 2 · the canonical ledger cannot survive a rotation ──────────────
 *
 * `verifyCanonicalChain` takes ONE `pubkeyPem` and verifies every entry against
 * it; entries carry no key identity and the chain has no notion of key
 * succession. After a rotation, `verifyCanonicalLedger` against the new active
 * key reports `signature_invalid` on the pre-rotation entries, and
 * `appendCanonicalReceipt` refuses to extend with `ledger_chain_broken`.
 *
 * This is measured on the unmodified base and is not caused by the rotation
 * repair — it CONSTRAINS it. The obvious repair for finding 1 is to emit
 * canonical transition evidence, and the commit half of that evidence would have
 * to be appended after the authority switch, which is exactly the append that
 * cannot succeed. Whether the ledger should carry key succession is a
 * cryptographic authority decision, not a test's call.
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

describe("ROW8-A · authority changes with no evidence, and recovery cannot finalize it", () => {
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

  it("ROW8-A3: PINNED DEFECT — authority changed and NO rotation receipt exists", async () => {
    await withHome(async (home) => {
      await seedKey(home);
      crashRotationAfterPointerCommit(home);
      assert.deepEqual(rotationReceipts(home), [],
        "PINNED: the transition is authoritative and unevidenced");
    });
  });

  it("ROW8-A4: PINNED DEFECT — resume reports already_resolved and finalizes nothing", async () => {
    await withHome(async (home) => {
      await seedKey(home);
      crashRotationAfterPointerCommit(home);

      const resumed = await resumeAuthorshipRotation({
        consent: KEY_ROTATE_RESUME_CONSENT_PHRASE,
        demaHome: home,
        resumedAt: "2026-08-11T00:05:00.000Z",
      });
      assert.equal(resumed.resumed, true);
      assert.equal(resumed.already_resolved, true,
        "resume classifies the state as settled because the pointer already moved");
      assert.deepEqual(rotationReceipts(home), [],
        "PINNED: recovery creates no evidence, so the gap is permanent, not transient");
    });
  });

  it("ROW8-A5: the transition emits no canonical ledger entry even when it COMPLETES", async () => {
    await withHome(async (home) => {
      await seedKey(home);
      const before = await loadCanonicalLedger({ demaHome: home });
      const r = await rotate(home);
      assert.equal(r.rotated, true);
      const after = await loadCanonicalLedger({ demaHome: home });
      assert.equal(after.length, before.length,
        "this is what the Row-8 producer measures: the authoritative transition touches no canonical ledger");
    });
  });
});

describe("ROW8-B · the canonical ledger cannot survive a rotation", () => {
  const append = (home, body, now) => appendCanonicalReceipt({
    canonicalBody: body,
    truthLabel: LABEL,
    whatProves: "characterization probe entry",
    whatDoesNotProve: "anything beyond this probe",
    consent: CANONICAL_RECEIPT_CONSENT_PHRASE,
    demaHome: home,
    now,
  });

  it("ROW8-B1: PINNED — a rotation invalidates every pre-rotation ledger entry", async () => {
    await withHome(async (home) => {
      await seedKey(home);
      const a = await append(home, { probe: "pre-rotation" }, "2026-08-11T00:00:00.000Z");
      assert.equal(a.appended, true, a.error ?? "");

      // NON-VACUITY: an empty ledger verifies as a "verified empty chain", so a
      // pass on an empty ledger would prove nothing at all.
      const entries = await loadCanonicalLedger({ demaHome: home });
      assert.equal(entries.length, 1, "the ledger must be non-empty for the verify to mean anything");

      const before = await verifyCanonicalLedger({ demaHome: home, pubkeyPem: await loadPublicKey(home) });
      assert.equal(before.verified, true, "POSITIVE CONTROL: the chain verifies before the rotation");

      const r = await rotate(home);
      assert.equal(r.rotated, true, r.error ?? "");

      const after = await verifyCanonicalLedger({ demaHome: home, pubkeyPem: await loadPublicKey(home) });
      assert.equal(after.verified, false, "PINNED: the chain no longer verifies against the new active key");
      assert.equal(after.error ?? after.reason, "signature_invalid");
    });
  });

  it("ROW8-B2: PINNED — no canonical receipt can be appended after a rotation", async () => {
    await withHome(async (home) => {
      await seedKey(home);
      assert.equal((await append(home, { probe: "pre" }, "2026-08-11T00:00:00.000Z")).appended, true);
      assert.equal((await rotate(home)).rotated, true);

      const post = await append(home, { probe: "post" }, "2026-08-11T00:01:00.000Z");
      assert.equal(post.appended, false, "PINNED: the ledger is closed to further appends after a rotation");
      assert.equal(post.error, "ledger_chain_broken");
      // This is the constraint on the repair: the COMMIT half of any canonical
      // transition evidence would have to be appended here, and cannot be.
    });
  });

  it("ROW8-B3: the failure is key succession, not corruption — an empty ledger rotates fine", async () => {
    await withHome(async (home) => {
      await seedKey(home);
      assert.equal((await rotate(home)).rotated, true);
      const v = await verifyCanonicalLedger({ demaHome: home, pubkeyPem: await loadPublicKey(home) });
      assert.equal(v.verified, true, "with no pre-rotation entries there is nothing signed by the retired key");
      assert.equal(v.total_entries, 0);
      // So B1/B2 are caused by entries signed under the RETIRED key, not by the
      // rotation damaging the ledger file.
      const post = await append(home, { probe: "post-only" }, "2026-08-11T00:02:00.000Z");
      assert.equal(post.appended, true, "and a ledger started after the rotation works normally");
    });
  });
});
