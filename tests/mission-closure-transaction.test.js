// TXJ-01…15 — IMMUTABLE MISSION-CLOSURE TRANSACTION HISTORY (Gate C, C2).
//
// C1 established the ONE authority-consumption fact: the nonces-v1 claim.
// C2 records what happened AFTER consumption. The two must never impersonate
// each other:
//
//   nonce claim exists      = authority was irreversibly consumed
//   PREPARED event exists   = a recoverable transaction was established
//   EFFECT_APPLIED exists   = the world-changing operation occurred
//
// SUBORDINATION (the decision that shapes this file):
// The corridor already owns a closed transition map — CORRIDOR_TRANSITIONS in
// packages/mission/src/mission-corridor.js:36-46 — and the tree carries an
// explicit law against adding lifecycle states ("nine more states would
// invalidate every corridor journal", mission-corridor.js:189).
//
// So this transaction log does NOT invent a parallel lifecycle. It REFINES the
// single CHECKPOINT → COMPLETE corridor edge and terminates by resolving to one
// of the ten existing TERMINAL_OUTCOMES. There is no CORRIDOR_COMPLETED phase
// here. One authority answers "where is this closure".
//
// Timestamps are NOT semantic. Two workers racing the identical transition
// produce different at_iso and therefore different bytes; byte equality would
// make the idempotent path unreachable and escalate every benign race. Semantic
// equality is carried separately by semantic_evidence_hash.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  link as fsLink,
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  readdir,
  unlink as fsUnlink,
} from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { claimConsentNonce } from "../packages/receipts/src/consent-nonce-claim.js";
import { TERMINAL_OUTCOMES } from "../packages/mission/src/mission-corridor-closure.js";

import {
  MISSION_CLOSURE_TX_SCHEMA,
  MISSION_CLOSURE_TX_EVENT_SCHEMA,
  MISSION_CLOSURE_TX_EVENT_DOMAIN,
  TX_TRANSITIONS,
  openClosureTransaction,
  appendClosureEvent,
  replayClosureTransaction,
  _internal,
} from "../packages/receipts/src/mission-closure-transaction.js";

const NONCE = "closure-nonce-txj-0001";

const CLAIM_INPUT = Object.freeze({
  nonce: NONCE,
  transactionId: "tx-closure-0001",
  missionId: "mission-omega0-1a",
  actionKind: "mission_closure",
  actionClass: "world_changing",
  contractHash: "sha256:cccc0001",
  consentContextHash: "sha256:ecec0001",
  checkpointEventHash: "sha256:kkkk0001",
  preparedIntentHash: "sha256:pppp0001",
  recoveryPolicyHash: "sha256:rrrr0001",
  claimedAtIso: "2026-08-02T04:00:00.000Z",
});

async function freshHome() {
  return await mkdtemp(join(tmpdir(), "dema-txj-"));
}

/** A real claim, created the only way authority is ever created. */
async function claimed(home, overrides = {}) {
  const res = await claimConsentNonce({ ...CLAIM_INPUT, ...overrides, demaHome: home });
  assert.equal(res.claimed, true, "fixture must actually win the claim");
  return res.claim;
}

const eventsDir = (home, txId) => join(_internal.transactionDir(home, txId), "events");
const eventPath = (home, txId, seq) => join(eventsDir(home, txId), `${String(seq).padStart(6, "0")}.json`);

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function fsError(code) {
  return Object.assign(new Error(code), { code });
}

function publicationOps(overrides = {}) {
  return {
    linkFile: fsLink,
    unlinkTemp: fsUnlink,
    fsyncDir: async () => {},
    ...overrides,
  };
}

/** Drive the happy chain forward n phases, returning the replay state. */
async function advance(home, txId, phases) {
  for (const phase of phases) {
    const state = await replayClosureTransaction({ demaHome: home, transactionId: txId });
    const res = await appendClosureEvent({
      demaHome: home,
      transactionId: txId,
      expectedSequence: state.sequence + 1,
      expectedPreviousEventHash: state.head_event_hash,
      phase,
      evidenceRefs: [{ type: "test", hash: `sha256:ev-${phase}` }],
    });
    assert.equal(res.appended, true, `advance to ${phase} must append: ${res.reason ?? ""}`);
  }
  return await replayClosureTransaction({ demaHome: home, transactionId: txId });
}

describe("TXJ — mission-closure transaction history (C2)", () => {
  test("TXJ-01 claim exists, transaction absent → reconstruct transaction.json and PREPARED", async () => {
    const home = await freshHome();
    const claim = await claimed(home);

    const res = await openClosureTransaction({ claim, demaHome: home });

    assert.equal(res.ok, true, res.reason);
    const dir = _internal.transactionDir(home, claim.transaction_id);
    const descriptor = await readJson(join(dir, "transaction.json"));

    assert.equal(descriptor.schema, MISSION_CLOSURE_TX_SCHEMA);
    assert.equal(descriptor.consent_claim_hash, claim.claim_hash);
    assert.equal(descriptor.nonce_digest, claim.nonce_digest);
    assert.equal(descriptor.mission_id, claim.mission_id);
    assert.equal(descriptor.prepared_intent_hash, claim.prepared_intent_hash);
    assert.equal(descriptor.recovery_policy_hash, claim.recovery_policy_hash);

    const zero = await readJson(eventPath(home, claim.transaction_id, 0));
    assert.equal(zero.schema, MISSION_CLOSURE_TX_EVENT_SCHEMA);
    assert.equal(zero.domain, MISSION_CLOSURE_TX_EVENT_DOMAIN);
    assert.equal(zero.phase, "PREPARED");
    assert.equal(zero.sequence, 0);
    assert.equal(zero.previous_event_hash, null);
    assert.equal(zero.consent_claim_hash, claim.claim_hash);
    assert.equal(zero.transaction_hash, descriptor.transaction_hash);
  });

  test("TXJ-01b reopening is idempotent — never a second PREPARED", async () => {
    const home = await freshHome();
    const claim = await claimed(home);

    const first = await openClosureTransaction({ claim, demaHome: home });
    const second = await openClosureTransaction({ claim, demaHome: home });

    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(second.reason, "already_prepared");
    const files = await readdir(eventsDir(home, claim.transaction_id));
    assert.deepEqual(files.sort(), ["000000.json"]);
  });

  test("TXJ-02 transaction.json does not match claim → transaction_binding_mismatch", async () => {
    const home = await freshHome();
    const claim = await claimed(home);
    await openClosureTransaction({ claim, demaHome: home });

    // Re-aim the descriptor at a different mission, keeping its hash self-consistent
    // is not even required: any disagreement with the claim must fail closed.
    const dir = _internal.transactionDir(home, claim.transaction_id);
    const tampered = { ...(await readJson(join(dir, "transaction.json"))), mission_id: "mission-OTHER" };
    await writeFile(join(dir, "transaction.json"), JSON.stringify(tampered, null, 2));

    const res = await openClosureTransaction({ claim, demaHome: home });
    assert.equal(res.ok, false);
    assert.equal(res.reason, "transaction_binding_mismatch");
    assert.equal(res.escalate_to_human, true);
  });

  test("TXJ-03 first event that is not PREPARED → refuse", async () => {
    const home = await freshHome();
    const claim = await claimed(home);

    const res = await appendClosureEvent({
      demaHome: home,
      transactionId: claim.transaction_id,
      expectedSequence: 0,
      expectedPreviousEventHash: null,
      phase: "EFFECT_APPLIED",
    });

    assert.equal(res.appended, false);
    assert.equal(res.reason, "first_event_must_be_prepared");
    assert.equal(existsSync(eventPath(home, claim.transaction_id, 0)), false);
  });

  test("TXJ-04 sequence gap → refuse", async () => {
    const home = await freshHome();
    const claim = await claimed(home);
    await openClosureTransaction({ claim, demaHome: home });
    const state = await replayClosureTransaction({ demaHome: home, transactionId: claim.transaction_id });

    const res = await appendClosureEvent({
      demaHome: home,
      transactionId: claim.transaction_id,
      expectedSequence: 5, // head is 0; 5 skips four
      expectedPreviousEventHash: state.head_event_hash,
      phase: "EFFECT_INTENT_PERSISTED",
    });

    assert.equal(res.appended, false);
    assert.equal(res.reason, "sequence_not_contiguous");
    assert.equal(existsSync(eventPath(home, claim.transaction_id, 5)), false);
  });

  test("TXJ-05 previous_event_hash mismatch → refuse (stale head cannot append)", async () => {
    const home = await freshHome();
    const claim = await claimed(home);
    await openClosureTransaction({ claim, demaHome: home });

    const res = await appendClosureEvent({
      demaHome: home,
      transactionId: claim.transaction_id,
      expectedSequence: 1,
      expectedPreviousEventHash: "sha256:" + "0".repeat(64),
      phase: "EFFECT_INTENT_PERSISTED",
    });

    assert.equal(res.appended, false);
    assert.equal(res.reason, "previous_event_hash_mismatch");
    assert.equal(existsSync(eventPath(home, claim.transaction_id, 1)), false);
  });

  test("TXJ-06 illegal phase transition → refuse with no event written", async () => {
    const home = await freshHome();
    const claim = await claimed(home);
    await openClosureTransaction({ claim, demaHome: home });
    const state = await replayClosureTransaction({ demaHome: home, transactionId: claim.transaction_id });

    // PREPARED → SEALED skips the effect entirely.
    const res = await appendClosureEvent({
      demaHome: home,
      transactionId: claim.transaction_id,
      expectedSequence: 1,
      expectedPreviousEventHash: state.head_event_hash,
      phase: "SEALED",
    });

    assert.equal(res.appended, false);
    assert.equal(res.reason, "illegal_phase_transition");
    assert.equal(existsSync(eventPath(home, claim.transaction_id, 1)), false);
  });

  test("TXJ-07 event transaction_id mismatch → history invalid", async () => {
    const home = await freshHome();
    const claim = await claimed(home);
    await openClosureTransaction({ claim, demaHome: home });

    const zeroPath = eventPath(home, claim.transaction_id, 0);
    const forged = { ...(await readJson(zeroPath)), transaction_id: "tx-SOMEONE-ELSE" };
    await writeFile(zeroPath, JSON.stringify(forged, null, 2));

    const state = await replayClosureTransaction({ demaHome: home, transactionId: claim.transaction_id });
    assert.equal(state.ok, false);
    assert.equal(state.reason, "event_transaction_id_mismatch");
  });

  test("TXJ-08 partial/malformed event file → RECOVERY_REQUIRED without overwrite", async () => {
    const home = await freshHome();
    const claim = await claimed(home);
    await openClosureTransaction({ claim, demaHome: home });

    const zeroPath = eventPath(home, claim.transaction_id, 0);
    const truncated = (await readFile(zeroPath, "utf8")).slice(0, 40); // a crash mid-write
    await writeFile(zeroPath, truncated);

    const state = await replayClosureTransaction({ demaHome: home, transactionId: claim.transaction_id });
    assert.equal(state.ok, false);
    assert.equal(state.reason, "event_unparseable");
    assert.equal(state.escalate_to_human, true);
    assert.equal(state.terminal_outcome, "RECOVERY_REQUIRED");

    // The damaged bytes are evidence. Nothing may repair them in place.
    assert.equal(await readFile(zeroPath, "utf8"), truncated);

    const res = await appendClosureEvent({
      demaHome: home,
      transactionId: claim.transaction_id,
      expectedSequence: 1,
      expectedPreviousEventHash: null,
      phase: "EFFECT_INTENT_PERSISTED",
    });
    assert.equal(res.appended, false, "no event may append onto an unverifiable history");
  });

  test("TXJ-09 two workers, same semantic event → one file, loser idempotent", async () => {
    const home = await freshHome();
    const claim = await claimed(home);
    await openClosureTransaction({ claim, demaHome: home });
    const state = await replayClosureTransaction({ demaHome: home, transactionId: claim.transaction_id });

    const proposal = {
      demaHome: home,
      transactionId: claim.transaction_id,
      expectedSequence: 1,
      expectedPreviousEventHash: state.head_event_hash,
      phase: "EFFECT_INTENT_PERSISTED",
      evidenceRefs: [{ type: "intent", hash: "sha256:same-evidence" }],
    };

    const [a, b] = await Promise.all([
      appendClosureEvent({ ...proposal, atIso: "2026-08-02T04:00:01.000Z" }),
      appendClosureEvent({ ...proposal, atIso: "2026-08-02T04:00:09.999Z" }), // different clock
    ]);

    const files = await readdir(eventsDir(home, claim.transaction_id));
    assert.deepEqual(files.sort(), ["000000.json", "000001.json"], "exactly one canonical event 1");

    const outcomes = [a, b].map((r) => (r.appended ? "won" : r.reason));
    assert.equal(outcomes.filter((o) => o === "won").length, 1, "exactly one winner");
    assert.equal(
      outcomes.filter((o) => o === "already_applied_idempotently").length,
      1,
      `loser must be idempotent despite differing at_iso, got ${JSON.stringify(outcomes)}`,
    );
  });

  test("TXJ-10 two workers, different transitions → one file, conflict escalated", async () => {
    const home = await freshHome();
    const claim = await claimed(home);
    await openClosureTransaction({ claim, demaHome: home });
    const state = await replayClosureTransaction({ demaHome: home, transactionId: claim.transaction_id });

    const base = {
      demaHome: home,
      transactionId: claim.transaction_id,
      expectedSequence: 1,
      expectedPreviousEventHash: state.head_event_hash,
    };

    const [a, b] = await Promise.all([
      appendClosureEvent({ ...base, phase: "EFFECT_INTENT_PERSISTED" }),
      appendClosureEvent({ ...base, phase: "RESOLVED", terminalOutcome: "REFUSED_POLICY" }),
    ]);

    const files = await readdir(eventsDir(home, claim.transaction_id));
    assert.equal(files.length, 2, "exactly one canonical event 1");

    const loser = [a, b].find((r) => !r.appended);
    assert.equal([a, b].filter((r) => r.appended).length, 1, "exactly one winner");
    assert.equal(loser.reason, "transaction_transition_conflict");
    assert.equal(loser.escalate_to_human, true);
  });

  test("TXJ-11 crash before publication → no canonical event, temp not authoritative", async () => {
    const home = await freshHome();
    const claim = await claimed(home);
    await openClosureTransaction({ claim, demaHome: home });

    // Exactly what a process death between write and link leaves behind.
    const dir = eventsDir(home, claim.transaction_id);
    await writeFile(join(dir, ".tmp-000001-abandoned.json"), '{"phase":"EFFECT_APPLIED"}');

    const state = await replayClosureTransaction({ demaHome: home, transactionId: claim.transaction_id });
    assert.equal(state.ok, true, "an abandoned temp must not invalidate the history");
    assert.equal(state.phase, "PREPARED", "temp file must not advance the phase");
    assert.equal(state.sequence, 0);
    assert.equal(existsSync(eventPath(home, claim.transaction_id, 1)), false);
  });

  test("TXJ-12 fresh replay derives the exact phase from disk alone", async () => {
    const home = await freshHome();
    const claim = await claimed(home);
    await openClosureTransaction({ claim, demaHome: home });

    await advance(home, claim.transaction_id, [
      "EFFECT_INTENT_PERSISTED",
      "EFFECT_APPLIED",
      "VERIFIED",
      "SEALED",
    ]);

    // No in-memory carry-over: read the store as a cold process would.
    const cold = await replayClosureTransaction({ demaHome: home, transactionId: claim.transaction_id });
    assert.equal(cold.ok, true, cold.reason);
    assert.equal(cold.phase, "SEALED");
    assert.equal(cold.sequence, 4);
    assert.equal(cold.terminal, false);
    assert.equal(cold.consent_claim_hash, claim.claim_hash);
  });

  test("TXJ-13 unexpected file in events directory → refuse, never silently include", async () => {
    const home = await freshHome();
    const claim = await claimed(home);
    await openClosureTransaction({ claim, demaHome: home });

    // A duplicate numeric alias is the dangerous case: 1.json vs 000001.json.
    await writeFile(join(eventsDir(home, claim.transaction_id), "1.json"), '{"phase":"ANCHORED"}');

    const state = await replayClosureTransaction({ demaHome: home, transactionId: claim.transaction_id });
    assert.equal(state.ok, false);
    assert.equal(state.reason, "events_dir_unexpected_entry");
    assert.equal(state.escalate_to_human, true);
  });

  test("TXJ-14 the raw nonce never appears in any transaction artifact", async () => {
    const home = await freshHome();
    const claim = await claimed(home);
    await openClosureTransaction({ claim, demaHome: home });
    await advance(home, claim.transaction_id, ["EFFECT_INTENT_PERSISTED", "EFFECT_APPLIED"]);

    const dir = _internal.transactionDir(home, claim.transaction_id);
    const bodies = [await readFile(join(dir, "transaction.json"), "utf8")];
    for (const f of await readdir(join(dir, "events"))) {
      bodies.push(await readFile(join(dir, "events", f), "utf8"));
    }

    for (const body of bodies) {
      assert.equal(body.includes(NONCE), false, "raw nonce leaked into transaction artifacts");
    }
    assert.equal(JSON.stringify(bodies).includes(claim.nonce_digest), true, "digest is the only nonce reference");
  });

  test("TXJ-16 retry after crash-post-publication is idempotent, not a sequence error", async () => {
    const home = await freshHome();
    const claim = await claimed(home);
    await openClosureTransaction({ claim, demaHome: home });
    const before = await replayClosureTransaction({ demaHome: home, transactionId: claim.transaction_id });

    const proposal = {
      demaHome: home,
      transactionId: claim.transaction_id,
      expectedSequence: 1,
      expectedPreviousEventHash: before.head_event_hash,
      phase: "EFFECT_INTENT_PERSISTED",
      evidenceRefs: [{ type: "intent", hash: "sha256:retry-evidence" }],
    };

    const first = await appendClosureEvent({ ...proposal, atIso: "2026-08-02T04:00:01.000Z" });
    assert.equal(first.appended, true);

    // The worker died here — after publication, before it recorded success.
    // A fresh process replays and re-proposes the SAME transition. Its head is
    // now stale by one, but the work is already done: this is recovery, not a
    // caller bug, and it must not be reported as a sequence fault.
    const retry = await appendClosureEvent({ ...proposal, atIso: "2026-08-02T04:07:42.000Z" });

    assert.equal(retry.appended, false);
    assert.equal(retry.reason, "already_applied_idempotently");
    assert.equal(retry.idempotent, true);

    const files = await readdir(eventsDir(home, claim.transaction_id));
    assert.deepEqual(files.sort(), ["000000.json", "000001.json"], "retry must not duplicate");

    // A DIFFERENT transition at the same consumed sequence is still a conflict.
    const divergent = await appendClosureEvent({ ...proposal, phase: "RESOLVED", terminalOutcome: "REFUSED_POLICY" });
    assert.equal(divergent.appended, false);
    assert.equal(divergent.reason, "transaction_transition_conflict");
    assert.equal(divergent.escalate_to_human, true);
  });

  test("TXJ-15 SUBORDINATION — COMPLETED_VERIFIED is unreachable without ANCHORED", async () => {
    const home = await freshHome();
    const claim = await claimed(home);
    await openClosureTransaction({ claim, demaHome: home });
    const state = await advance(home, claim.transaction_id, [
      "EFFECT_INTENT_PERSISTED",
      "EFFECT_APPLIED",
      "VERIFIED",
      "SEALED",
      "LEDGER_COMMITTED",
    ]);

    // Success claimed one step early — the ledger is committed but nothing anchored.
    const early = await appendClosureEvent({
      demaHome: home,
      transactionId: claim.transaction_id,
      expectedSequence: state.sequence + 1,
      expectedPreviousEventHash: state.head_event_hash,
      phase: "RESOLVED",
      terminalOutcome: "COMPLETED_VERIFIED",
    });
    assert.equal(early.appended, false);
    assert.equal(early.reason, "completed_verified_requires_anchored");

    // And every terminal this log may emit is one the corridor already knows.
    for (const phase of Object.keys(TX_TRANSITIONS)) {
      assert.equal(phase.startsWith("CORRIDOR_"), false, `${phase} duplicates corridor state vocabulary`);
    }
    assert.equal(TERMINAL_OUTCOMES.includes("COMPLETED_VERIFIED"), true);
  });

  test("TXJ-17 unavailable native no-replace publication fails closed without advancing state", async () => {
    for (const code of ["EXDEV", "EPERM", "EIO"]) {
      const home = await freshHome();
      const claim = await claimed(home, { nonce: `${NONCE}-${code}`, transactionId: `tx-${code}` });
      await openClosureTransaction({ claim, demaHome: home });
      const before = await replayClosureTransaction({ demaHome: home, transactionId: claim.transaction_id });
      const cleaned = [];
      let renameCalls = 0;

      const result = await _internal.appendClosureEventWithPublicationOps({
        demaHome: home,
        transactionId: claim.transaction_id,
        expectedSequence: 1,
        expectedPreviousEventHash: before.head_event_hash,
        phase: "EFFECT_INTENT_PERSISTED",
      }, publicationOps({
          linkFile: async () => { throw fsError(code); },
          unlinkTemp: async (path) => {
            cleaned.push(path);
            await fsUnlink(path);
          },
          renameFile: async () => { renameCalls += 1; },
        }));

      assert.deepEqual(result, {
        appended: false,
        reason: `event_publication_unavailable:${code}`,
        escalate_to_human: true,
      });
      assert.equal(cleaned.length, 1, `${code}: cleanup must be attempted`);
      assert.equal(renameCalls, 0, `${code}: rename fallback must stay unreachable`);
      assert.equal(existsSync(eventPath(home, claim.transaction_id, 1)), false);
      const after = await replayClosureTransaction({ demaHome: home, transactionId: claim.transaction_id });
      assert.equal(after.ok, true);
      assert.equal(after.sequence, before.sequence);
      assert.equal(after.head_event_hash, before.head_event_hash);
    }
  });

  test("TXJ-18 EEXIST with a valid semantic winner settles idempotently", async () => {
    const home = await freshHome();
    const claim = await claimed(home, { nonce: `${NONCE}-eexist-same`, transactionId: "tx-eexist-same" });
    await openClosureTransaction({ claim, demaHome: home });
    const before = await replayClosureTransaction({ demaHome: home, transactionId: claim.transaction_id });

    const result = await _internal.appendClosureEventWithPublicationOps({
      demaHome: home,
      transactionId: claim.transaction_id,
      expectedSequence: 1,
      expectedPreviousEventHash: before.head_event_hash,
      phase: "EFFECT_INTENT_PERSISTED",
    }, publicationOps({
        linkFile: async (temp, finalPath) => {
          await fsLink(temp, finalPath);
          throw fsError("EEXIST");
        },
      }));

    assert.equal(result.appended, false);
    assert.equal(result.reason, "already_applied_idempotently");
    assert.equal(result.idempotent, true);
    const after = await replayClosureTransaction({ demaHome: home, transactionId: claim.transaction_id });
    assert.equal(after.ok, true);
    assert.equal(after.phase, "EFFECT_INTENT_PERSISTED");
  });

  test("TXJ-19 EEXIST with a valid different winner settles as a transition conflict", async () => {
    const home = await freshHome();
    const claim = await claimed(home, { nonce: `${NONCE}-eexist-other`, transactionId: "tx-eexist-other" });
    await openClosureTransaction({ claim, demaHome: home });
    const before = await replayClosureTransaction({ demaHome: home, transactionId: claim.transaction_id });

    const result = await _internal.appendClosureEventWithPublicationOps({
      demaHome: home,
      transactionId: claim.transaction_id,
      expectedSequence: 1,
      expectedPreviousEventHash: before.head_event_hash,
      phase: "EFFECT_INTENT_PERSISTED",
    }, publicationOps({
        linkFile: async (candidateTemp, finalPath) => {
          const winner = JSON.parse(await readFile(candidateTemp, "utf8"));
          winner.phase = "RESOLVED";
          winner.terminal_outcome = "REFUSED_POLICY";
          winner.semantic_evidence_hash = _internal.hashSemantic(winner);
          winner.event_hash = _internal.hashEvent(winner);
          const competitorTemp = `${candidateTemp}-competitor`;
          await writeFile(competitorTemp, `${JSON.stringify(winner, null, 2)}\n`);
          await fsLink(competitorTemp, finalPath);
          await fsUnlink(competitorTemp);
          throw fsError("EEXIST");
        },
      }));

    assert.equal(result.appended, false);
    assert.equal(result.reason, "transaction_transition_conflict");
    assert.equal(result.escalate_to_human, true);
    const after = await replayClosureTransaction({ demaHome: home, transactionId: claim.transaction_id });
    assert.equal(after.ok, true);
    assert.equal(after.phase, "RESOLVED");
  });

  test("TXJ-20 cleanup failure preserves both diagnoses and leaves temporary bytes non-authoritative", async () => {
    const home = await freshHome();
    const claim = await claimed(home, { nonce: `${NONCE}-cleanup`, transactionId: "tx-cleanup" });
    await openClosureTransaction({ claim, demaHome: home });
    const before = await replayClosureTransaction({ demaHome: home, transactionId: claim.transaction_id });

    const result = await _internal.appendClosureEventWithPublicationOps({
      demaHome: home,
      transactionId: claim.transaction_id,
      expectedSequence: 1,
      expectedPreviousEventHash: before.head_event_hash,
      phase: "EFFECT_INTENT_PERSISTED",
    }, publicationOps({
        linkFile: async () => { throw fsError("EIO"); },
        unlinkTemp: async () => { throw fsError("EPERM"); },
      }));

    assert.deepEqual(result, {
      appended: false,
      reason: "event_publication_unavailable:EIO",
      cleanup_failure: "event_temp_cleanup_failed:EPERM",
      escalate_to_human: true,
    });
    assert.equal(existsSync(eventPath(home, claim.transaction_id, 1)), false);
    const entries = await readdir(eventsDir(home, claim.transaction_id));
    assert.equal(entries.some((name) => name.startsWith(".tmp-")), true);
    const after = await replayClosureTransaction({ demaHome: home, transactionId: claim.transaction_id });
    assert.equal(after.ok, true);
    assert.equal(after.sequence, before.sequence);
    assert.equal(after.head_event_hash, before.head_event_hash);
  });

  test("TXJ-21 directory fsync uncertainty is not acknowledged and replay never duplicates", async () => {
    const home = await freshHome();
    const claim = await claimed(home, { nonce: `${NONCE}-dirsync`, transactionId: "tx-dirsync" });
    await openClosureTransaction({ claim, demaHome: home });
    const before = await replayClosureTransaction({ demaHome: home, transactionId: claim.transaction_id });
    const proposal = {
      demaHome: home,
      transactionId: claim.transaction_id,
      expectedSequence: 1,
      expectedPreviousEventHash: before.head_event_hash,
      phase: "EFFECT_INTENT_PERSISTED",
    };
    let cleanupAttempts = 0;

    const uncertain = await _internal.appendClosureEventWithPublicationOps(
      proposal,
      publicationOps({
        fsyncDir: async () => { throw fsError("EIO"); },
        unlinkTemp: async (path) => {
          cleanupAttempts += 1;
          await fsUnlink(path);
        },
      }),
    );

    assert.deepEqual(uncertain, {
      appended: false,
      reason: "event_publication_durability_uncertain:EIO",
      durability_uncertain: true,
      canonical_event_visible: true,
      effect_retry_forbidden: true,
      replay_required: true,
      escalate_to_human: true,
    });
    assert.equal(cleanupAttempts, 1);
    const replayed = await replayClosureTransaction({ demaHome: home, transactionId: claim.transaction_id });
    assert.equal(replayed.ok, true);
    assert.equal(replayed.sequence, 1);
    assert.equal(replayed.phase, "EFFECT_INTENT_PERSISTED");

    const retry = await appendClosureEvent(proposal);
    assert.equal(retry.appended, false);
    assert.equal(retry.reason, "already_applied_idempotently");
    assert.deepEqual((await readdir(eventsDir(home, claim.transaction_id))).sort(), ["000000.json", "000001.json"]);
  });

  test("TXJ-22 EEXIST winner is chain-verified before semantic settlement", async () => {
    const home = await freshHome();
    const claim = await claimed(home, { nonce: `${NONCE}-winner-invalid`, transactionId: "tx-winner-invalid" });
    await openClosureTransaction({ claim, demaHome: home });
    const before = await replayClosureTransaction({ demaHome: home, transactionId: claim.transaction_id });

    const result = await _internal.appendClosureEventWithPublicationOps({
      demaHome: home,
      transactionId: claim.transaction_id,
      expectedSequence: 1,
      expectedPreviousEventHash: before.head_event_hash,
      phase: "EFFECT_INTENT_PERSISTED",
    }, publicationOps({
      linkFile: async (candidateTemp, finalPath) => {
        const winner = JSON.parse(await readFile(candidateTemp, "utf8"));
        winner.event_hash = "sha256:" + "0".repeat(64);
        const competitorTemp = `${candidateTemp}-invalid-winner`;
        await writeFile(competitorTemp, `${JSON.stringify(winner, null, 2)}\n`);
        await fsLink(competitorTemp, finalPath);
        await fsUnlink(competitorTemp);
        throw fsError("EEXIST");
      },
    }));

    assert.deepEqual(result, {
      appended: false,
      reason: "event_published_winner_invalid:event_hash_mismatch",
      escalate_to_human: true,
    });
  });

  test("TXJ-23 EEXIST cannot settle when the loser cannot make the winner durable", async () => {
    const home = await freshHome();
    const claim = await claimed(home, { nonce: `${NONCE}-winner-dirsync`, transactionId: "tx-winner-dirsync" });
    await openClosureTransaction({ claim, demaHome: home });
    const before = await replayClosureTransaction({ demaHome: home, transactionId: claim.transaction_id });

    const result = await _internal.appendClosureEventWithPublicationOps({
      demaHome: home,
      transactionId: claim.transaction_id,
      expectedSequence: 1,
      expectedPreviousEventHash: before.head_event_hash,
      phase: "EFFECT_INTENT_PERSISTED",
    }, publicationOps({
      linkFile: async (temp, finalPath) => {
        await fsLink(temp, finalPath);
        throw fsError("EEXIST");
      },
      fsyncDir: async () => { throw fsError("EIO"); },
    }));

    assert.deepEqual(result, {
      appended: false,
      reason: "event_publication_durability_uncertain:EIO",
      durability_uncertain: true,
      canonical_event_visible: true,
      effect_retry_forbidden: true,
      replay_required: true,
      escalate_to_human: true,
    });
  });

  test("TXJ-24 a forged semantic evidence hash cannot manufacture idempotence", async () => {
    const home = await freshHome();
    const claim = await claimed(home, { nonce: `${NONCE}-semantic-forgery`, transactionId: "tx-semantic-forgery" });
    await openClosureTransaction({ claim, demaHome: home });
    const before = await replayClosureTransaction({ demaHome: home, transactionId: claim.transaction_id });

    const result = await _internal.appendClosureEventWithPublicationOps({
      demaHome: home,
      transactionId: claim.transaction_id,
      expectedSequence: 1,
      expectedPreviousEventHash: before.head_event_hash,
      phase: "EFFECT_INTENT_PERSISTED",
    }, publicationOps({
      linkFile: async (candidateTemp, finalPath) => {
        const winner = JSON.parse(await readFile(candidateTemp, "utf8"));
        winner.evidence_refs = [{ type: "forged", hash: "sha256:not-the-candidate" }];
        winner.event_hash = _internal.hashEvent(winner);
        const competitorTemp = `${candidateTemp}-semantic-forgery`;
        await writeFile(competitorTemp, `${JSON.stringify(winner, null, 2)}\n`);
        await fsLink(competitorTemp, finalPath);
        await fsUnlink(competitorTemp);
        throw fsError("EEXIST");
      },
    }));

    assert.deepEqual(result, {
      appended: false,
      reason: "event_published_winner_invalid:semantic_evidence_hash_mismatch",
      escalate_to_human: true,
    });
  });

  test("TXJ-25 durable publication stays acknowledged when only temp cleanup fails", async () => {
    const home = await freshHome();
    const claim = await claimed(home, { nonce: `${NONCE}-cleanup-after-success`, transactionId: "tx-cleanup-after-success" });
    await openClosureTransaction({ claim, demaHome: home });
    const before = await replayClosureTransaction({ demaHome: home, transactionId: claim.transaction_id });
    const proposal = {
      demaHome: home,
      transactionId: claim.transaction_id,
      expectedSequence: 1,
      expectedPreviousEventHash: before.head_event_hash,
      phase: "EFFECT_INTENT_PERSISTED",
    };

    const result = await _internal.appendClosureEventWithPublicationOps(
      proposal,
      publicationOps({ unlinkTemp: async () => { throw fsError("EPERM"); } }),
    );

    assert.equal(result.appended, true);
    assert.equal(result.cleanup_failure, "event_temp_cleanup_failed:EPERM");
    const replayed = await replayClosureTransaction({ demaHome: home, transactionId: claim.transaction_id });
    assert.equal(replayed.ok, true);
    assert.equal(replayed.sequence, 1);
    const retry = await appendClosureEvent(proposal);
    assert.equal(retry.appended, false);
    assert.equal(retry.reason, "already_applied_idempotently");
  });

  test("TXJ-26 stale retry remains durability-uncertain when directory fsync still fails", async () => {
    const home = await freshHome();
    const claim = await claimed(home, { nonce: `${NONCE}-stale-dirsync`, transactionId: "tx-stale-dirsync" });
    await openClosureTransaction({ claim, demaHome: home });
    const before = await replayClosureTransaction({ demaHome: home, transactionId: claim.transaction_id });
    const proposal = {
      demaHome: home,
      transactionId: claim.transaction_id,
      expectedSequence: 1,
      expectedPreviousEventHash: before.head_event_hash,
      phase: "EFFECT_INTENT_PERSISTED",
    };

    const first = await _internal.appendClosureEventWithPublicationOps(
      proposal,
      publicationOps({ fsyncDir: async () => { throw fsError("EIO"); } }),
    );
    assert.equal(first.reason, "event_publication_durability_uncertain:EIO");

    const retry = await _internal.appendClosureEventWithPublicationOps(
      proposal,
      publicationOps({
        linkFile: async () => { throw new Error("stale retry must not publish"); },
        fsyncDir: async () => { throw fsError("EPERM"); },
      }),
    );

    assert.deepEqual(retry, {
      appended: false,
      reason: "event_publication_durability_uncertain:EPERM",
      durability_uncertain: true,
      canonical_event_visible: true,
      effect_retry_forbidden: true,
      replay_required: true,
      escalate_to_human: true,
    });
    assert.deepEqual((await readdir(eventsDir(home, claim.transaction_id))).sort(), ["000000.json", "000001.json"]);

    const recovered = await appendClosureEvent(proposal);
    assert.equal(recovered.appended, false);
    assert.equal(recovered.reason, "already_applied_idempotently");
  });

  test("TXJ-27 PREPARED recovery re-establishes directory durability before success", async () => {
    const home = await freshHome();
    const claim = await claimed(home, { nonce: `${NONCE}-prepared-dirsync`, transactionId: "tx-prepared-dirsync" });

    const first = await _internal.openClosureTransactionWithPublicationOps(
      { claim, demaHome: home },
      publicationOps({ fsyncDir: async () => { throw fsError("EIO"); } }),
    );
    assert.equal(first.ok, false);
    assert.equal(first.reason, "event_publication_durability_uncertain:EIO");
    assert.equal(first.durability_uncertain, true);

    const visible = await replayClosureTransaction({ demaHome: home, transactionId: claim.transaction_id });
    assert.equal(visible.ok, true);
    assert.equal(visible.sequence, 0);
    assert.equal(visible.phase, "PREPARED");

    const stillUncertain = await _internal.openClosureTransactionWithPublicationOps(
      { claim, demaHome: home },
      publicationOps({
        linkFile: async () => { throw new Error("visible PREPARED must not be republished"); },
        fsyncDir: async () => { throw fsError("EPERM"); },
      }),
    );
    assert.equal(stillUncertain.ok, false);
    assert.equal(stillUncertain.reason, "event_publication_durability_uncertain:EPERM");
    assert.equal(stillUncertain.durability_uncertain, true);

    const recovered = await openClosureTransaction({ claim, demaHome: home });
    assert.equal(recovered.ok, true);
    assert.equal(recovered.reason, "already_prepared");
    assert.deepEqual((await readdir(eventsDir(home, claim.transaction_id))).sort(), ["000000.json"]);
  });

  test("TXJ-28 replay rejects an event-hash-valid event with an extra field", async () => {
    const home = await freshHome();
    const claim = await claimed(home, { nonce: `${NONCE}-shape`, transactionId: "tx-shape" });
    await openClosureTransaction({ claim, demaHome: home });

    const zeroPath = eventPath(home, claim.transaction_id, 0);
    const forged = { ...(await readJson(zeroPath)), injected_authority: true };
    forged.event_hash = _internal.hashEvent(forged);
    await writeFile(zeroPath, `${JSON.stringify(forged, null, 2)}\n`);

    const replayed = await replayClosureTransaction({ demaHome: home, transactionId: claim.transaction_id });
    assert.equal(replayed.ok, false);
    assert.equal(replayed.reason, "event_shape_mismatch");
  });

  test("TXJ-29 replay rejects an event-hash-valid predecessor with stale semantic evidence", async () => {
    const home = await freshHome();
    const claim = await claimed(home, { nonce: `${NONCE}-predecessor`, transactionId: "tx-predecessor" });
    await openClosureTransaction({ claim, demaHome: home });

    const zeroPath = eventPath(home, claim.transaction_id, 0);
    const forged = await readJson(zeroPath);
    forged.evidence_refs = [{ type: "forged", hash: "sha256:changed" }];
    forged.event_hash = _internal.hashEvent(forged);
    await writeFile(zeroPath, `${JSON.stringify(forged, null, 2)}\n`);

    const replayed = await replayClosureTransaction({ demaHome: home, transactionId: claim.transaction_id });
    assert.equal(replayed.ok, false);
    assert.equal(replayed.reason, "semantic_evidence_hash_mismatch");
  });

  test("TXJ-30 EEXIST settlement rejects an event-hash-valid malformed winner", async () => {
    const home = await freshHome();
    const claim = await claimed(home, { nonce: `${NONCE}-winner-shape`, transactionId: "tx-winner-shape" });
    await openClosureTransaction({ claim, demaHome: home });
    const before = await replayClosureTransaction({ demaHome: home, transactionId: claim.transaction_id });

    const result = await _internal.appendClosureEventWithPublicationOps({
      demaHome: home,
      transactionId: claim.transaction_id,
      expectedSequence: 1,
      expectedPreviousEventHash: before.head_event_hash,
      phase: "EFFECT_INTENT_PERSISTED",
    }, publicationOps({
      linkFile: async (candidateTemp, finalPath) => {
        const winner = JSON.parse(await readFile(candidateTemp, "utf8"));
        winner.injected_authority = true;
        winner.event_hash = _internal.hashEvent(winner);
        const competitorTemp = `${candidateTemp}-malformed-winner`;
        await writeFile(competitorTemp, `${JSON.stringify(winner, null, 2)}\n`);
        await fsLink(competitorTemp, finalPath);
        await fsUnlink(competitorTemp);
        throw fsError("EEXIST");
      },
    }));

    assert.deepEqual(result, {
      appended: false,
      reason: "event_published_winner_invalid:event_shape_mismatch",
      escalate_to_human: true,
    });
  });

  test("TXJ-31 stale malformed proposals fail closed without throwing or publishing", async () => {
    const home = await freshHome();
    const claim = await claimed(home, { nonce: `${NONCE}-candidate`, transactionId: "tx-candidate" });
    await openClosureTransaction({ claim, demaHome: home });
    const before = await replayClosureTransaction({ demaHome: home, transactionId: claim.transaction_id });
    const base = {
      demaHome: home,
      transactionId: claim.transaction_id,
      expectedSequence: 1,
      expectedPreviousEventHash: before.head_event_hash,
      phase: "EFFECT_INTENT_PERSISTED",
    };
    assert.equal((await appendClosureEvent(base)).appended, true);

    const bigint = await appendClosureEvent({ ...base, evidenceRefs: [{ value: 1n }] });
    assert.deepEqual(bigint, {
      appended: false,
      reason: "event_candidate_invalid:value_bigint",
    });

    const cyclic = {};
    cyclic.self = cyclic;
    const cycle = await appendClosureEvent({ ...base, evidenceRefs: [cyclic] });
    assert.deepEqual(cycle, {
      appended: false,
      reason: "event_candidate_invalid:circular_reference",
    });

    const hostileHash = await appendClosureEvent({
      ...base,
      expectedPreviousEventHash: Symbol("hostile"),
    });
    assert.deepEqual(hostileHash, {
      appended: false,
      reason: "expected_previous_event_hash_invalid",
    });
    assert.deepEqual((await readdir(eventsDir(home, claim.transaction_id))).sort(), ["000000.json", "000001.json"]);
  });
});
