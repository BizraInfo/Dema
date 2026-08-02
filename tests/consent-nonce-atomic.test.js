// CNA-01…06 — D3 / backlog task-017: single-use consent must be ATOMIC.
//
// Proven a weld prerequisite: mission-corridor-closure can only enforce single-use
// consent as strongly as this registry does. Today the registry is a
// read-modify-write over ONE shared JSON file (consent-nonce-registry.js:153-184),
// which loses under concurrency in two distinct ways.
//
// TARGET selects which implementation is under test:
//   TARGET=current  → the worktree's live registry   (expect CNA-01/02 RED)
//   TARGET=atomic   → the staged replacement          (expect all GREEN)

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const TARGET = process.env.CNA_TARGET ?? "atomic";

const mod = TARGET === "current"
  ? "../packages/receipts/src/consent-nonce-registry.js"
  : "../packages/receipts/src/consent-nonce-registry-atomic.js";
const { recordConsentNonce, isConsentNonceUsed } = await import(mod);

const home = () => mkdtemp(join(tmpdir(), "cna-"));
const REC = (nonce, demaHome) => recordConsentNonce({
  nonce, actionType: "C3_LOCAL_WRITE", targetHash: "t".repeat(64),
  consentProofHash: "c".repeat(64), demaHome, consumedAtIso: "2026-08-02T00:00:00.000Z",
});

describe(`consent-nonce single-use atomicity [${TARGET}]`, () => {

  test("CNA-01: 100 concurrent claims on the SAME nonce → exactly one winner", async () => {
    const demaHome = await home();
    const results = await Promise.all(
      Array.from({ length: 100 }, () => REC("same-nonce", demaHome)),
    );
    const winners = results.filter((r) => r.recorded === true);
    assert.equal(winners.length, 1,
      `TOCTOU: ${winners.length} callers each believed they consumed the same nonce`);
    assert.equal(results.filter((r) => r.recorded === false).length, 99);
  });

  test("CNA-02: concurrent claims on DISTINCT nonces → no lost update", async () => {
    const demaHome = await home();
    const nonces = Array.from({ length: 60 }, (_, i) => `n-${i}`);
    const results = await Promise.all(nonces.map((n) => REC(n, demaHome)));
    assert.equal(results.filter((r) => r.recorded).length, 60, "all distinct claims must record");

    // The real damage: a lost update silently UN-consumes a nonce that was
    // reported consumed, so it can be replayed later.
    const stillUsed = await Promise.all(
      nonces.map((n) => isConsentNonceUsed({ nonce: n, demaHome })),
    );
    const lost = stillUsed.filter((u) => u !== true).length;
    assert.equal(lost, 0, `${lost} nonces were reported consumed then silently un-consumed`);
  });

  test("CNA-03: a burnt nonce stays burnt on a later, separate call", async () => {
    const demaHome = await home();
    assert.equal((await REC("burnt", demaHome)).recorded, true);
    const again = await REC("burnt", demaHome);
    assert.equal(again.recorded, false);
    assert.equal(again.error, "consent_nonce_already_used");
    assert.equal(await isConsentNonceUsed({ nonce: "burnt", demaHome }), true);
  });

  test("CNA-04: a path-escaping nonce is refused, never written outside the registry", async () => {
    const demaHome = await home();
    for (const bad of ["../escape", "a/b", "..", ".", "", "a\0b", "/abs"]) {
      const r = await REC(bad, demaHome).catch((e) => ({ recorded: false, threw: String(e.message) }));
      assert.notEqual(r.recorded, true, `path-escaping nonce accepted: ${JSON.stringify(bad)}`);
    }
  });

  test("CNA-05: an unreadable/corrupt entry fails CLOSED — never reported unused", async () => {
    const demaHome = await home();
    await REC("corrupt-me", demaHome);
    // Corrupt the stored entry in whatever shape the implementation uses.
    const dir = join(demaHome, "consent");
    await mkdir(dir, { recursive: true }).catch(() => {});
    for (const f of ["used-nonces.json", "nonces/corrupt-me.json"]) {
      await writeFile(join(dir, f), "{ not json", "utf8").catch(() => {});
    }
    const used = await isConsentNonceUsed({ nonce: "corrupt-me", demaHome });
    assert.notEqual(used, false,
      "a corrupt registry reporting 'unused' lets a consumed consent be replayed");
  });

  test("CNA-06: return shape stays drop-in compatible with the live callers", async () => {
    const demaHome = await home();
    const ok = await REC("shape", demaHome);
    assert.equal(ok.recorded, true);
    assert.match(ok.registry_entry_hash, /^[0-9a-f]{64}$/);
    const dup = await REC("shape", demaHome);
    assert.equal(dup.recorded, false);
    assert.equal(dup.error, "consent_nonce_already_used");
    assert.equal(typeof dup.existing_entry, "object");
    assert.equal(dup.existing_entry.action_type, "C3_LOCAL_WRITE");
  });
});
