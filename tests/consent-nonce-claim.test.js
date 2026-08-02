// NRC-01…12 — ONE CANONICAL ATOMIC CONSENT CLAIM (Gate C).
//
// Measured defect this replaces: the corridor had TWO replay authorities with
// different key derivations, so a nonce consumed by one was invisible to the other.
//
//   CLI reserveNonce      missions/consent-nonces/<sha256(nonce)>.json   (digest)
//   bound weld registry   consent/nonces/<raw nonce>.json               (raw)
//
// On disk after one closure: 8 CLI-consumed nonces, 1 in the weld store.
//
// The law here: ONE atomic O_EXCL create IS the claim. There is no has()-then-add()
// in an executing route — that sequence lets two callers both observe "unused",
// both act, and only then compete to record. A whole-mission lock does not fix it,
// because the race is ACROSS missions.
//
// "CONSUMED" is a PHASE of the closure transaction, not a second file here.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  claimConsentNonce,
  inspectConsentNonce,
  nonceDigest,
  CONSENT_NONCE_CLAIM_SCHEMA,
  CONSENT_NONCE_DOMAIN,
  LEGACY_NAMESPACES,
} from "../packages/receipts/src/consent-nonce-claim.js";

const home = () => mkdtemp(join(tmpdir(), "nrc-"));

const CLAIM = (over = {}) => ({
  nonce: "nrc-nonce-1",
  domain: CONSENT_NONCE_DOMAIN,
  actionClass: "C3_LOCAL_WRITE",
  actionKind: "COMPLETE",
  missionId: "nrc-mission-a",
  contractHash: `sha256:${"a".repeat(64)}`,
  consentContextHash: `sha256:${"c".repeat(64)}`,
  transactionId: `sha256:${"t".repeat(64)}`,
  checkpointEventHash: `sha256:${"e".repeat(64)}`,
  preparedIntentHash: `sha256:${"i".repeat(64)}`,
  recoveryPolicyHash: `sha256:${"r".repeat(64)}`,
  claimedAtIso: "2026-08-02T00:00:00.000Z",
  ...over,
});

describe("NRC · one canonical atomic consent claim", () => {

  test("NRC-01: the same nonce cannot authorize both ADVANCE and COMPLETE", async () => {
    const demaHome = await home();
    const a = await claimConsentNonce({ ...CLAIM({ actionKind: "ADVANCE" }), demaHome });
    assert.equal(a.claimed, true);
    // Same nonce, same transaction id, DIFFERENT action. A matching transaction
    // id must not let spent authority be re-aimed at another action.
    const b = await claimConsentNonce({ ...CLAIM({ actionKind: "COMPLETE" }), demaHome });
    assert.equal(b.claimed, false, "one raw nonce may authorize at most ONE action globally");
    assert.equal(b.reason, "consent_nonce_binding_mismatch");
    assert.equal(b.resumable, false, "a different action is never a resume");
    assert.deepEqual(b.drifted_fields, ["action_kind"]);
    // and a genuinely different transaction is plain replay
    const c = await claimConsentNonce({
      ...CLAIM({ actionKind: "COMPLETE", transactionId: `sha256:${"5".repeat(64)}` }), demaHome,
    });
    assert.equal(c.reason, "consent_nonce_already_claimed");
  });

  test("NRC-02: the same nonce cannot be reused across two different missions", async () => {
    const demaHome = await home();
    assert.equal((await claimConsentNonce({ ...CLAIM({ missionId: "nrc-mission-a" }), demaHome })).claimed, true);
    const second = await claimConsentNonce({ ...CLAIM({ missionId: "nrc-mission-b" }), demaHome });
    assert.equal(second.claimed, false, "a nonce is global, not per-mission");
    // and the refusal must name the mission that actually holds it
    assert.equal(second.existing_claim.mission_id, "nrc-mission-a");
  });

  test("NRC-03: N concurrent claims on one nonce yield exactly one winner", async () => {
    const demaHome = await home();
    const results = await Promise.all(
      Array.from({ length: 50 }, (_, i) =>
        claimConsentNonce({ ...CLAIM({ transactionId: `sha256:${String(i).padStart(64, "0")}` }), demaHome })),
    );
    assert.equal(results.filter((r) => r.claimed).length, 1, "the filesystem arbitrates; exactly one wins");
    assert.equal(results.filter((r) => !r.claimed).length, 49);
  });

  test("NRC-04: concurrent claims from DIFFERENT missions still yield one winner", async () => {
    const demaHome = await home();
    const results = await Promise.all(
      ["m-one", "m-two", "m-three", "m-four"].map((missionId) =>
        claimConsentNonce({ ...CLAIM({ missionId }), demaHome })),
    );
    assert.equal(results.filter((r) => r.claimed).length, 1,
      "exactly one mission may pass the authority boundary");
  });

  test("NRC-05: a nonce present only in the LEGACY digest namespace is refused", async () => {
    const demaHome = await home();
    const digest = nonceDigest("nrc-nonce-1");
    // The legacy CLI store keyed by sha256(nonce) — bytes preserved, never rewritten.
    const dir = join(demaHome, LEGACY_NAMESPACES.cliReservation);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, `${digest}.json`), JSON.stringify({ legacy: true, kind: "START" }));
    const r = await claimConsentNonce({ ...CLAIM(), demaHome });
    assert.equal(r.claimed, false);
    assert.equal(r.reason, "consent_nonce_legacy_consumed");
    assert.equal(r.legacy_refs[0].namespace, LEGACY_NAMESPACES.cliReservation);
    assert.equal(r.legacy_refs[0].status, "LEGACY_CONSUMED");
  });

  test("NRC-06: a nonce present only in the LEGACY raw namespace is refused", async () => {
    const demaHome = await home();
    const dir = join(demaHome, LEGACY_NAMESPACES.weldRegistry);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "nrc-nonce-1.json"), JSON.stringify({ legacy: true }));
    const r = await claimConsentNonce({ ...CLAIM(), demaHome });
    assert.equal(r.claimed, false);
    assert.equal(r.reason, "consent_nonce_legacy_consumed");
    assert.equal(r.legacy_refs[0].namespace, LEGACY_NAMESPACES.weldRegistry);
  });

  test("NRC-07: a malformed or unreadable existing claim fails CLOSED", async () => {
    const demaHome = await home();
    const dir = join(demaHome, "consent", "nonces-v1");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, `${nonceDigest("nrc-nonce-1")}.json`), "{ not json");
    const r = await claimConsentNonce({ ...CLAIM(), demaHome });
    assert.equal(r.claimed, false, "unreadable means USED — somebody wrote it");
    assert.equal(r.reason, "consent_nonce_claim_unreadable_escalate");
    assert.equal(r.escalate_to_human, true, "an untrusted claim body escalates; it never softens to reusable");
    const seen = await inspectConsentNonce({ nonce: "nrc-nonce-1", demaHome });
    assert.equal(seen.used, true);
    assert.equal(seen.corrupt, true);
  });

  test("NRC-08: resume is by transaction_id — same transaction re-reads its own claim", async () => {
    const demaHome = await home();
    const first = await claimConsentNonce({ ...CLAIM(), demaHome });
    assert.equal(first.claimed, true);
    // A crash after the claim: the SAME transaction must recognise its own claim
    // rather than being told the nonce is spent by a stranger.
    const resumed = await claimConsentNonce({ ...CLAIM(), demaHome });
    assert.equal(resumed.claimed, false);
    assert.equal(resumed.reason, "consent_nonce_claimed_by_this_transaction");
    assert.equal(resumed.resumable, true);
    assert.equal(resumed.existing_claim.transaction_id, CLAIM().transactionId);
  });

  test("NRC-09: a DIFFERENT transaction may never reuse the nonce", async () => {
    const demaHome = await home();
    await claimConsentNonce({ ...CLAIM(), demaHome });
    const other = await claimConsentNonce({
      ...CLAIM({ transactionId: `sha256:${"9".repeat(64)}` }), demaHome,
    });
    assert.equal(other.claimed, false);
    assert.equal(other.resumable, false, "replay is not recovery");
    assert.equal(other.reason, "consent_nonce_already_claimed");
  });

  test("NRC-10: replay stays refused deterministically across a fresh read", async () => {
    const demaHome = await home();
    const first = await claimConsentNonce({ ...CLAIM(), demaHome });
    const again = await claimConsentNonce({ ...CLAIM({ transactionId: `sha256:${"8".repeat(64)}` }), demaHome });
    const third = await claimConsentNonce({ ...CLAIM({ transactionId: `sha256:${"7".repeat(64)}` }), demaHome });
    assert.equal(again.claimed, false);
    assert.equal(third.claimed, false);
    assert.equal(again.existing_claim.claim_hash, first.claim.claim_hash, "the original claim hash is stable");
    assert.equal(third.existing_claim.claim_hash, first.claim.claim_hash);
  });

  test("NRC-11: a path-hostile raw nonce never becomes a path; the digest key stays safe", async () => {
    const demaHome = await home();
    for (const bad of ["../escape", "a/b", "..", "a\0b", "/abs"]) {
      const r = await claimConsentNonce({ ...CLAIM({ nonce: bad }), demaHome });
      // The raw value must never address a file. Either the shape policy refuses
      // it, or the digest absorbs it — but never a traversal.
      if (r.claimed) {
        const d = nonceDigest(bad);
        assert.match(d, /^[0-9a-f]{64}$/, "digest key must be path-safe hex");
        assert.equal(existsSync(join(demaHome, "consent", "nonces-v1", `${d}.json`)), true);
      } else {
        assert.equal(r.reason, "consent_nonce_malformed");
      }
      // in neither case may anything escape the registry directory
      assert.equal(existsSync(join(demaHome, "escape")), false);
      assert.equal(existsSync(join(demaHome, "consent", "escape")), false);
    }
  });

  test("NRC-12: an altered claim body is detected by claim_hash mismatch", async () => {
    const demaHome = await home();
    const r = await claimConsentNonce({ ...CLAIM(), demaHome });
    const path = join(demaHome, "consent", "nonces-v1", `${nonceDigest("nrc-nonce-1")}.json`);
    const body = JSON.parse(await readFile(path, "utf8"));
    assert.equal(body.schema, CONSENT_NONCE_CLAIM_SCHEMA);
    // Forge the binding: point the spent nonce at a different mission, keep the hash.
    await writeFile(path, JSON.stringify({ ...body, mission_id: "forged-mission" }));
    const seen = await inspectConsentNonce({ nonce: "nrc-nonce-1", demaHome });
    assert.equal(seen.used, true);
    assert.equal(seen.claim_hash_valid, false, "a re-derived claim hash must catch the edit");
    assert.equal(seen.escalate_to_human, true);
    // write-ahead genesis: the claim carries recovery intent, not just the fact
    assert.ok(body.prepared_intent_hash && body.recovery_policy_hash && body.checkpoint_event_hash);
    assert.equal(Object.prototype.hasOwnProperty.call(body, "nonce"), false, "raw nonce never persisted");
  });
});
