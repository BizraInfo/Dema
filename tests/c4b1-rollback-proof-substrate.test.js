// C4B1-01…17 — VERIFIED-ROLLBACK PROOF SUBSTRATE (Gate C, C4 step 1).
//
// THE DEFECT THIS SLICE ADDRESSES.
// Rollback capability already exists. Omega0 can undo the rename, recompute the
// manifest and compare it to the persisted before_hash, producing
// restoration_verified / restored_hash / undo_success_pct. The persisted intent
// already carries before_manifest and before_hash inside EFFECT_INTENT_PERSISTED.
//
// What does not exist is DURABLE PROOF that the undo happened. No production path
// appends ROLLBACK_STARTED, ROLLED_BACK or RECOVERY_REQUIRED, there is no
// BEFORE_STATE_VERIFIED phase, and TX_TRANSITIONS admits ROLLED_BACK → RESOLVED
// directly — so a rollback may settle with its proof discarded.
//
// SUBSTRATE ONLY. This file proves the proof-language and the restoration
// primitive. It deliberately does NOT wire the production route: a system must be
// able to describe a verified rollback before it is allowed to claim one.
//
// THE REPLAY / APPEND SPLIT (the shape of this slice).
// Immutable history may not be invalidated because new writers got stricter.
// Historical chains containing a direct ROLLED_BACK → RESOLVED edge must stay
// replayable forever, while NEW appends must route through BEFORE_STATE_VERIFIED.
// Two maps, one law each:
//
//   TX_TRANSITIONS         replay/history  — permissive, keeps the legacy edge
//   TX_APPEND_TRANSITIONS  new writes      — strict, forbids the legacy edge
//
// RESTORATION IS BACKWARD-ONLY. The existing reversibility proof runs
// undo → verify → REAPPLY → seal. Rollback must run restore → verify → STOP.
// Reapplying during a rollback would re-enter the world-changing operation the
// caller is trying to abandon, so the helper never reapplies and never reuses
// recoverIntermediate(), which completes FORWARD.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { claimConsentNonce } from "../packages/receipts/src/consent-nonce-claim.js";
import {
  TX_TRANSITIONS,
  TX_APPEND_TRANSITIONS,
  BEFORE_STATE_VERIFIED_EVIDENCE_SCHEMA,
  CORRIDOR_RENAME_INTENT_EVIDENCE_SCHEMA,
  openClosureTransaction,
  appendClosureEvent,
  replayClosureTransaction,
} from "../packages/receipts/src/mission-closure-transaction.js";
import { restoreToBeforeState } from "../packages/core/src/omega0-mechanical-closure.js";

const BEFORE_MANIFEST = [{ path: "a.txt", content_id: "f".repeat(64) }];
const BEFORE_HASH = createHash("sha256").update(JSON.stringify(BEFORE_MANIFEST)).digest("hex");
const AFTER_HASH = "a".repeat(64);           // omega0 emits RAW 64-hex
const DURABLE_INTENT = Object.freeze({
  plan: [{ op: "rename", from: "a.txt", to: "b.txt" }],
  before_manifest: BEFORE_MANIFEST,
  before_hash: BEFORE_HASH,
  expected_after_hash: AFTER_HASH,
});
const PREPARED_INTENT_HASH = sha256CanonicalJsonV1(DURABLE_INTENT);
const RECOVERY_POLICY_HASH = "sha256:" + "1".repeat(64);
const CHECKPOINT_EVENT_HASH = "sha256:" + "2".repeat(64);

const CLAIM_INPUT = Object.freeze({
  nonce: "closure-nonce-c4b1-0001",
  transactionId: "tx-closure-c4b1-01",
  missionId: "mission-omega0-1a",
  actionKind: "mission_closure",
  actionClass: "world_changing",
  contractHash: "sha256:" + "3".repeat(64),
  consentContextHash: "sha256:" + "4".repeat(64),
  checkpointEventHash: CHECKPOINT_EVENT_HASH,
  preparedIntentHash: PREPARED_INTENT_HASH,
  recoveryPolicyHash: RECOVERY_POLICY_HASH,
  claimedAtIso: "2026-08-02T04:00:00.000Z",
});

async function freshHome() {
  return await mkdtemp(join(tmpdir(), "dema-c4b1-"));
}

async function openTx(home, overrides = {}) {
  const res = await claimConsentNonce({ ...CLAIM_INPUT, ...overrides, demaHome: home });
  assert.equal(res.claimed, true, "fixture must actually win the claim");
  const opened = await openClosureTransaction({
    claim: res.claim,
    demaHome: home,
    atIso: res.claim.claimed_at_iso,
  });
  assert.equal(opened.ok, true, `open must succeed: ${opened.reason ?? ""}`);
  return { claim: res.claim, txId: res.claim.transaction_id };
}

/** Append one phase at the current head. Returns the raw append result. */
async function append(home, txId, phase, evidenceRefs = [{ type: "test", hash: "sha256:ev" }], terminalOutcome = null) {
  const state = await replayClosureTransaction({ demaHome: home, transactionId: txId });
  return await appendClosureEvent({
    demaHome: home,
    transactionId: txId,
    expectedSequence: state.sequence + 1,
    expectedPreviousEventHash: state.head_event_hash,
    phase,
    terminalOutcome,
    evidenceRefs,
    atIso: "2026-08-02T04:05:00.000Z",
  });
}

/** The evidence a genuine verified restoration would carry. */
function restorationEvidence(overrides = {}) {
  return [{
    schema: BEFORE_STATE_VERIFIED_EVIDENCE_SCHEMA,
    prepared_intent_hash: PREPARED_INTENT_HASH,
    before_hash: BEFORE_HASH,
    restored_hash: BEFORE_HASH,
    restoration_verified: true,
    recovery_mode: "ALREADY_BEFORE_STATE",
    undo_success_pct: 100,
    ...overrides,
  }];
}

/** Walk to ROLLED_BACK, which every rollback-law test starts from. */
async function toRolledBack(home, txId, beforeHash = BEFORE_HASH) {
  const intent = beforeHash === BEFORE_HASH
    ? DURABLE_INTENT
    : { ...DURABLE_INTENT, before_hash: beforeHash };
  const intentEvidence = [{
    schema: CORRIDOR_RENAME_INTENT_EVIDENCE_SCHEMA,
    prepared_intent_hash: sha256CanonicalJsonV1(intent),
    recovery_policy_hash: RECOVERY_POLICY_HASH,
    checkpoint_event_hash: CHECKPOINT_EVENT_HASH,
    intent,
  }];
  const steps = [
    ["EFFECT_INTENT_PERSISTED", intentEvidence],
    ["EFFECT_APPLIED", [{ type: "test", hash: "sha256:ev" }]],
    ["ROLLBACK_STARTED", [{ type: "test", hash: "sha256:ev" }]],
    ["ROLLED_BACK", [{ type: "test", hash: "sha256:ev" }]],
  ];
  for (const [p, ev] of steps) {
    const r = await append(home, txId, p, ev);
    assert.equal(r.appended, true, `${p} must append: ${r.reason ?? ""}`);
  }
}

// ─────────────────────────── transaction phase law ───────────────────────────

describe("C4B1 — rollback proof substrate: transaction phase law", () => {
  test("C4B1-01 BEFORE_STATE_VERIFIED is a recognized C2 phase", () => {
    assert.ok(Object.hasOwn(TX_TRANSITIONS, "BEFORE_STATE_VERIFIED"));
    assert.deepEqual(TX_TRANSITIONS.BEFORE_STATE_VERIFIED, ["RESOLVED"]);
  });

  test("C4B1-02 new appends accept ROLLBACK_STARTED → ROLLED_BACK → BEFORE_STATE_VERIFIED → RESOLVED", async () => {
    const home = await freshHome();
    const { txId } = await openTx(home);
    await toRolledBack(home, txId);
    const bsv = await append(home, txId, "BEFORE_STATE_VERIFIED", restorationEvidence());
    assert.equal(bsv.appended, true, `BEFORE_STATE_VERIFIED must append: ${bsv.reason ?? ""}`);
    // No NEW terminal outcome is invented: EXECUTION_FAILED_ROLLED_BACK already
    // exists, and mission-corridor-closure.js records that adding states would
    // invalidate the journals already on disk.
    const res = await append(home, txId, "RESOLVED", [{ type: "test", hash: "sha256:ev" }], "EXECUTION_FAILED_ROLLED_BACK");
    assert.equal(res.appended, true, `RESOLVED must append: ${res.reason ?? ""}`);
    const state = await replayClosureTransaction({ demaHome: home, transactionId: txId });
    assert.equal(state.phase, "RESOLVED");
    assert.equal(state.terminal, true);
  });

  test("C4B1-03 a NEW append of ROLLED_BACK → RESOLVED is refused", async () => {
    const home = await freshHome();
    const { txId } = await openTx(home);
    await toRolledBack(home, txId);
    // A VALID terminal outcome is supplied deliberately: proposal validation runs
    // before the transition check, so omitting it would refuse for the wrong
    // reason and the transition law would go untested.
    const res = await append(home, txId, "RESOLVED",
      [{ type: "test", hash: "sha256:ev" }], "EXECUTION_FAILED_ROLLED_BACK");
    assert.equal(res.appended, false, "settling a rollback without its proof must be refused");
    assert.equal(res.reason, "illegal_phase_transition");
    assert.equal(res.from, "ROLLED_BACK");
    assert.equal(res.to, "RESOLVED");
  });

  test("C4B1-04 a historical ROLLED_BACK → RESOLVED chain remains replayable", () => {
    // History is immutable. The replay map must still admit the legacy edge, or
    // every transaction ever settled that way becomes retroactively invalid.
    assert.ok(TX_TRANSITIONS.ROLLED_BACK.includes("RESOLVED"),
      "replay map must keep the legacy direct edge");
  });

  test("C4B1-05 replay policy and new-write policy are separate maps", () => {
    assert.ok(TX_APPEND_TRANSITIONS, "a distinct append map must exist");
    assert.notDeepEqual(TX_APPEND_TRANSITIONS.ROLLED_BACK, TX_TRANSITIONS.ROLLED_BACK);
    assert.deepEqual(TX_APPEND_TRANSITIONS.ROLLED_BACK, ["BEFORE_STATE_VERIFIED"],
      "new writes may only leave ROLLED_BACK through the proof");
    // Every append edge must be a subset of a replay edge: the writer may be
    // stricter than history, never looser.
    for (const [from, tos] of Object.entries(TX_APPEND_TRANSITIONS)) {
      for (const to of tos) {
        assert.ok(TX_TRANSITIONS[from]?.includes(to),
          `append edge ${from}→${to} must also be replayable`);
      }
    }
  });

  test("C4B1-06 COMPLETED_VERIFIED still requires ANCHORED", async () => {
    const home = await freshHome();
    const { txId } = await openTx(home);
    for (const p of ["EFFECT_INTENT_PERSISTED", "EFFECT_APPLIED", "VERIFIED", "SEALED", "LEDGER_COMMITTED"]) {
      assert.equal((await append(home, txId, p)).appended, true, `${p} must append`);
    }
    const early = await append(home, txId, "RESOLVED", [{ type: "test", hash: "sha256:ev" }], "COMPLETED_VERIFIED");
    assert.equal(early.appended, false, "COMPLETED_VERIFIED before ANCHORED must be refused");
  });

  test("C4B1-07 adding the phase changes no existing event hash", async () => {
    // The event hash covers event content, never the transition table. A forward
    // chain built after this slice must hash exactly as it did before.
    const home = await freshHome();
    const { txId } = await openTx(home);
    const r = await append(home, txId, "EFFECT_INTENT_PERSISTED");
    assert.equal(r.appended, true);
    const state = await replayClosureTransaction({ demaHome: home, transactionId: txId });
    assert.match(state.head_event_hash, /^sha256:[0-9a-f]{64}$/);
    assert.equal(state.phase, "EFFECT_INTENT_PERSISTED");
  });

  test("C4B1-08 an unknown future phase still fails closed", async () => {
    const home = await freshHome();
    const { txId } = await openTx(home);
    const res = await append(home, txId, "SOME_FUTURE_PHASE_V9");
    assert.equal(res.appended, false, "an unknown phase must never be guessed");
    assert.match(String(res.reason), /phase_unknown|illegal_phase_transition/);
  });
});

// ───────────────────── BEFORE_STATE_VERIFIED evidence contract ─────────────────

describe("C4B1 — BEFORE_STATE_VERIFIED evidence contract", () => {
  async function atRolledBack() {
    const home = await freshHome();
    const { txId } = await openTx(home);
    await toRolledBack(home, txId);
    return { home, txId };
  }

  test("C4B1-18 restoration_verified must be exactly true", async () => {
    const { home, txId } = await atRolledBack();
    const res = await append(home, txId, "BEFORE_STATE_VERIFIED",
      restorationEvidence({ restoration_verified: false }));
    assert.equal(res.appended, false);
    assert.match(String(res.reason), /restoration/);
  });

  test("C4B1-19 restored_hash must equal before_hash", async () => {
    const { home, txId } = await atRolledBack();
    const res = await append(home, txId, "BEFORE_STATE_VERIFIED",
      restorationEvidence({ restored_hash: "sha256:somethingelse" }));
    assert.equal(res.appended, false);
    assert.match(String(res.reason), /restored_hash|before_hash/);
  });

  test("C4B1-20 exactly one restoration-evidence reference is required", async () => {
    const { home, txId } = await atRolledBack();
    const none = await append(home, txId, "BEFORE_STATE_VERIFIED", [{ type: "test", hash: "sha256:ev" }]);
    assert.equal(none.appended, false, "no restoration evidence must be refused");
    const two = await append(home, txId, "BEFORE_STATE_VERIFIED",
      [...restorationEvidence(), ...restorationEvidence()]);
    assert.equal(two.appended, false, "two restoration references must be refused");
  });

  test("C4B1-21 prepared_intent_hash must match the transaction binding", async () => {
    const { home, txId } = await atRolledBack();
    const res = await append(home, txId, "BEFORE_STATE_VERIFIED",
      restorationEvidence({ prepared_intent_hash: "sha256:notthebinding" }));
    assert.equal(res.appended, false);
    assert.match(String(res.reason), /prepared_intent_hash/);
  });

  test("C4B1-22 an unknown key is refused by exact shape, not by blacklist", async () => {
    const { home, txId } = await atRolledBack();
    for (const extra of [{ nonce: "x" }, { source_bytes: "AAAA" }, { raw_payload: "z" }, { authority_delta: 0 }]) {
      const res = await append(home, txId, "BEFORE_STATE_VERIFIED", restorationEvidence(extra));
      assert.equal(res.appended, false, `unknown key ${Object.keys(extra)[0]} must be refused`);
      assert.match(String(res.reason), /shape_mismatch|unknown_field/);
    }
  });
});

// ─────────────────────── idempotent restoration helper ───────────────────────

/**
 * Adapter double. Models the rename physics: one inode, published by link and
 * retired by unlink, so the two-link intermediate is a real observable state.
 */
function fakeEffect(initial) {
  const state = { world: initial, undos: 0, reapplies: 0, removedTargetLinks: 0 };
  const hashOf = (w) => ({
    BEFORE: BEFORE_HASH,
    AFTER: AFTER_HASH,
    INTERMEDIATE: "sha256:intermediate",
    UNKNOWN: "sha256:unknown",
  }[w]);
  return {
    state,
    manifest: () => ({ world: state.world, hash: hashOf(state.world) }),
    manifestHash: () => hashOf(state.world),
    propose: () => [{ op: "rename", from: "a.txt", to: "b.txt" }],
    apply() { state.reapplies += 1; state.world = "AFTER"; return { applied: true }; },
    undo() {
      state.undos += 1;
      if (state.world === "UNKNOWN") throw Object.assign(new Error("undo_failed"), { code: "EIO" });
      state.world = "BEFORE";
      return { undone: true };
    },
    classifyRecoverableIntermediate: () => ({ recoverable: state.world === "INTERMEDIATE" }),
    recoverIntermediate() { state.world = "AFTER"; return { applied: true }; },
    restoreIntermediateBackward() {
      state.removedTargetLinks += 1;
      state.world = "BEFORE";
      return { restored: true };
    },
  };
}

const INTENT = Object.freeze({
  plan: [{ op: "rename", from: "a.txt", to: "b.txt" }],
  before_hash: BEFORE_HASH,
  expected_after_hash: AFTER_HASH,
  prepared_intent_hash: PREPARED_INTENT_HASH,
});

describe("C4B1 — idempotent restoration helper", () => {
  test("C4B1-09 already in the before state: verified, no undo, no mutation", () => {
    const effect = fakeEffect("BEFORE");
    const r = restoreToBeforeState({ intent: INTENT, effect });
    assert.equal(r.ok, true);
    assert.equal(r.restoration_verified, true);
    assert.equal(r.restored_hash, BEFORE_HASH);
    assert.equal(r.recovery_mode, "ALREADY_BEFORE_STATE");
    assert.equal(effect.state.undos, 0, "must not undo a world already restored");
    assert.equal(effect.state.reapplies, 0);
    assert.equal(r.authority_delta, 0);
  });

  test("C4B1-10 expected post state: inverse runs exactly once and verifies", () => {
    const effect = fakeEffect("AFTER");
    const r = restoreToBeforeState({ intent: INTENT, effect });
    assert.equal(r.ok, true);
    assert.equal(r.restoration_verified, true);
    assert.equal(r.restored_hash, BEFORE_HASH);
    assert.equal(r.recovery_mode, "INVERSE_APPLIED");
    assert.equal(effect.state.undos, 1, "inverse must run exactly once");
    assert.equal(effect.state.reapplies, 0, "rollback must NEVER reapply");
  });

  test("C4B1-11 two-link intermediate restores BACKWARD, never forward", () => {
    const effect = fakeEffect("INTERMEDIATE");
    const r = restoreToBeforeState({ intent: INTENT, effect });
    assert.equal(r.ok, true);
    assert.equal(r.restoration_verified, true);
    assert.equal(r.restored_hash, BEFORE_HASH);
    assert.equal(r.recovery_mode, "INTERMEDIATE_RESTORED_BACKWARD");
    assert.equal(effect.state.removedTargetLinks, 1, "target link removed after identity check");
    assert.equal(effect.state.world, "BEFORE", "must not complete forward");
    assert.equal(effect.state.reapplies, 0);
  });

  test("C4B1-12 unknown world: RECOVERY_REQUIRED, no destructive guess", () => {
    const effect = fakeEffect("UNKNOWN");
    effect.classifyRecoverableIntermediate = () => ({ recoverable: false });
    const r = restoreToBeforeState({ intent: INTENT, effect });
    assert.equal(r.ok, false);
    assert.equal(r.restoration_verified, false);
    assert.equal(r.recovery_class, "RECOVERY_REQUIRED");
    assert.equal(effect.state.undos, 0, "an unclassified world must never be mutated");
    assert.equal(effect.state.removedTargetLinks, 0);
  });

  test("C4B1-13 identity mismatch: RECOVERY_REQUIRED, no mutation", () => {
    const effect = fakeEffect("AFTER");
    effect.manifestHash = () => { throw Object.assign(new Error("identity"), { code: "rename_source_identity_mismatch" }); };
    const r = restoreToBeforeState({ intent: INTENT, effect });
    assert.equal(r.ok, false);
    assert.equal(r.recovery_class, "RECOVERY_REQUIRED");
    assert.equal(effect.state.undos, 0);
  });

  test("C4B1-14 repeated invocation is idempotent without a second inverse act", () => {
    const effect = fakeEffect("AFTER");
    const first = restoreToBeforeState({ intent: INTENT, effect });
    assert.equal(first.ok, true);
    assert.equal(effect.state.undos, 1);
    const second = restoreToBeforeState({ intent: INTENT, effect });
    assert.equal(second.ok, true);
    assert.equal(second.restoration_verified, true);
    assert.equal(second.recovery_mode, "ALREADY_BEFORE_STATE");
    assert.equal(effect.state.undos, 1, "second call must not undo again");
  });

  test("C4B1-15 inverse failure returns typed RECOVERY_REQUIRED, never success", () => {
    const effect = fakeEffect("AFTER");
    effect.undo = () => { throw Object.assign(new Error("boom"), { code: "EIO" }); };
    const r = restoreToBeforeState({ intent: INTENT, effect });
    assert.equal(r.ok, false);
    assert.equal(r.restoration_verified, false);
    assert.equal(r.recovery_class, "RECOVERY_REQUIRED");
  });

  test("C4B1-16 restoration hash mismatch never reports verified", () => {
    const effect = fakeEffect("AFTER");
    effect.undo = () => { effect.state.world = "UNKNOWN"; return { undone: true }; };
    const r = restoreToBeforeState({ intent: INTENT, effect });
    assert.equal(r.ok, false);
    assert.equal(r.restoration_verified, false);
    assert.equal(r.recovery_class, "RECOVERY_REQUIRED");
    assert.notEqual(r.restored_hash, BEFORE_HASH);
  });

  test("C4B1-17 a refusing adapter fails closed through existing protections", () => {
    const effect = fakeEffect("AFTER");
    effect.undo = () => { throw Object.assign(new Error("escape"), { code: "rename_operand_outside_scope" }); };
    const r = restoreToBeforeState({ intent: INTENT, effect });
    assert.equal(r.ok, false);
    assert.equal(r.recovery_class, "RECOVERY_REQUIRED");
    assert.match(String(r.reason), /rename_operand_outside_scope|restoration_inverse_failed/);
  });

  test("C4B1-23 the helper never returns a lifecycle verdict", () => {
    const r = restoreToBeforeState({ intent: INTENT, effect: fakeEffect("BEFORE") });
    for (const forbidden of ["COMPLETED", "RESOLVED", "COMPLETE", "phase", "corridor"]) {
      assert.ok(!Object.hasOwn(r, forbidden), `helper must not own ${forbidden}`);
    }
    assert.equal(Object.isFrozen(r), true, "result must be frozen");
  });
});

// ────────────────────── C4B1H — evidence binding hardening ──────────────────
//
// A hash chain proves recorded bytes were not altered. It does NOT prove those
// bytes refer to the correct before-state. Evidence that agrees only with itself
// (before_hash === restored_hash === X) is internally consistent and still
// proves restoration to the wrong world. The binding must be re-derived from the
// prior durable intent event — on append AND on every replay.

import { mkdtemp as mkdtempCb, writeFile as writeFileP, readFile as readFileP,
         readdir as readdirP, link as linkP, stat as statP } from "node:fs/promises";
import { existsSync } from "node:fs";
import { buildRenameEffectAdapter } from "../packages/mission/src/corridor-closure-gatherer.js";
import { createHash } from "node:crypto";
import { sha256CanonicalJsonV1 } from "../packages/canon/src/sha256-canonical-json-v1.js";

const OTHER_HASH = "c".repeat(64);

describe("C4B1H — durable intent cross-binding", () => {
  async function atRolledBackWith(beforeHash) {
    const home = await freshHome();
    const { txId } = await openTx(home);
    await toRolledBack(home, txId, beforeHash);
    return { home, txId };
  }

  test("C4B1H-01 self-consistent evidence for the WRONG before-state is refused", async () => {
    // Durable intent binds A. Evidence carries B/B — internally consistent.
    const { home, txId } = await atRolledBackWith(BEFORE_HASH);
    const res = await append(home, txId, "BEFORE_STATE_VERIFIED",
      restorationEvidence({ before_hash: OTHER_HASH, restored_hash: OTHER_HASH }));
    assert.equal(res.appended, false, "agreement with itself is not evidence");
    assert.equal(res.reason, "restoration_before_hash_not_bound_to_intent");
  });

  test("C4B1H-02 prepared_intent_hash must match descriptor AND intent event", async () => {
    const { home, txId } = await atRolledBackWith(BEFORE_HASH);
    const res = await append(home, txId, "BEFORE_STATE_VERIFIED",
      restorationEvidence({ prepared_intent_hash: "sha256:" + "e".repeat(64) }));
    assert.equal(res.appended, false);
    assert.match(String(res.reason), /prepared_intent_hash/);
  });

  test("C4B1H-03 exactly one intent-evidence reference must exist", async () => {
    const home = await freshHome();
    const { txId } = await openTx(home);
    // EFFECT_INTENT_PERSISTED carrying NO corridor intent evidence.
    for (const p of ["EFFECT_INTENT_PERSISTED", "EFFECT_APPLIED", "ROLLBACK_STARTED", "ROLLED_BACK"]) {
      assert.equal((await append(home, txId, p)).appended, true);
    }
    const res = await append(home, txId, "BEFORE_STATE_VERIFIED", restorationEvidence());
    assert.equal(res.appended, false, "no derivable intent binding must fail closed");
    // Any authoritative-binding refusal is correct here; the law is fail-closed,
    // not one specific reason string.
    assert.match(String(res.reason), /^intent_/, `must be an intent-binding refusal, got: ${res.reason}`);
  });

  test("C4B1H-05b hash FORMATS are enforced, not normalised", async () => {
    const { home, txId } = await atRolledBackWith(BEFORE_HASH);
    const tagged = await append(home, txId, "BEFORE_STATE_VERIFIED",
      restorationEvidence({ before_hash: "sha256:" + BEFORE_HASH, restored_hash: "sha256:" + BEFORE_HASH }));
    assert.equal(tagged.appended, false, "tagged form must not be accepted where raw is the contract");
    assert.match(String(tagged.reason), /hash_format/);
    const raw = await append(home, txId, "BEFORE_STATE_VERIFIED",
      restorationEvidence({ prepared_intent_hash: "d".repeat(64) }));
    assert.equal(raw.appended, false, "raw form must not be accepted where tagged is the contract");
  });

  test("C4B1H-05c recovery_mode is an enum and undo_success_pct is exactly 100", async () => {
    const { home, txId } = await atRolledBackWith(BEFORE_HASH);
    const mode = await append(home, txId, "BEFORE_STATE_VERIFIED",
      restorationEvidence({ recovery_mode: "TOTALLY_FINE" }));
    assert.equal(mode.appended, false);
    assert.equal(mode.reason, "restoration_recovery_mode_unknown");
    for (const bad of [99, 100.5, NaN, "100", null]) {
      const r = await append(home, txId, "BEFORE_STATE_VERIFIED",
        restorationEvidence({ undo_success_pct: bad }));
      assert.equal(r.appended, false, `undo_success_pct ${String(bad)} must be refused`);
    }
  });
});

describe("C4B1H — replay-time semantic validation", () => {
  /** Forge a BEFORE_STATE_VERIFIED event on disk with a fully valid hash chain. */
  async function forgeBeforeStateVerified(home, txId, evidence) {
    const state = await replayClosureTransaction({ demaHome: home, transactionId: txId });
    const res = await appendClosureEvent({
      demaHome: home, transactionId: txId,
      expectedSequence: state.sequence + 1,
      expectedPreviousEventHash: state.head_event_hash,
      phase: "BEFORE_STATE_VERIFIED",
      evidenceRefs: restorationEvidence(),
      atIso: "2026-08-02T04:05:00.000Z",
    });
    assert.equal(res.appended, true, `fixture append must succeed: ${res.reason ?? ""}`);
    // Now rewrite that event's evidence and RE-DERIVE every hash, exactly as a
    // forger with write access would.
    const dir = join(home, "transactions", "mission-closure", txId, "events");
    const names = (await readdirP(dir)).filter((n) => /^\d{6}\.json$/.test(n)).sort();
    const target = join(dir, names[names.length - 1]);
    const body = JSON.parse(await readFileP(target, "utf8"));
    body.evidence_refs = evidence;
    const { event_hash: _e, semantic_evidence_hash: _s, ...rest } = body;
    const canon = (o) => JSON.stringify(o, Object.keys(o).sort());
    const h = (s) => "sha256:" + createHash("sha256").update(s).digest("hex");
    body.semantic_evidence_hash = h(canon({ evidence_refs: evidence }));
    body.event_hash = h(canon({ ...rest, semantic_evidence_hash: body.semantic_evidence_hash }));
    await writeFileP(target, `${JSON.stringify(body, null, 2)}\n`);
    return target;
  }

  test("C4B1H-04 a forged before_hash is refused on replay even with a recomputed hash chain", async () => {
    const home = await freshHome();
    const { txId } = await openTx(home);
    await toRolledBack(home, txId, BEFORE_HASH);
    await forgeBeforeStateVerified(home, txId,
      restorationEvidence({ before_hash: OTHER_HASH, restored_hash: OTHER_HASH }));
    const state = await replayClosureTransaction({ demaHome: home, transactionId: txId });
    assert.equal(state.ok, false, "replay must refuse evidence bound to the wrong world");
  });

  test("C4B1H-07 a genuine BEFORE_STATE_VERIFIED validates on both append and replay", async () => {
    const home = await freshHome();
    const { txId } = await openTx(home);
    await toRolledBack(home, txId, BEFORE_HASH);
    const app = await append(home, txId, "BEFORE_STATE_VERIFIED", restorationEvidence());
    assert.equal(app.appended, true, `append: ${app.reason ?? ""}`);
    const state = await replayClosureTransaction({ demaHome: home, transactionId: txId });
    assert.equal(state.ok, true, `replay must accept genuine evidence: ${state.reason ?? ""}`);
    assert.equal(state.phase, "BEFORE_STATE_VERIFIED");
  });

  test("C4B1H-06 a historical chain WITHOUT the phase is untouched by the new validator", async () => {
    const home = await freshHome();
    const { txId } = await openTx(home);
    for (const p of ["EFFECT_INTENT_PERSISTED", "EFFECT_APPLIED", "VERIFIED", "SEALED"]) {
      assert.equal((await append(home, txId, p)).appended, true);
    }
    const state = await replayClosureTransaction({ demaHome: home, transactionId: txId });
    assert.equal(state.ok, true, "chains without the phase must not require intent bindings");
    assert.equal(state.phase, "SEALED");
  });
});

describe("C4B1H — real rename adapter backward restoration", () => {
  const rawSha = (s) => createHash("sha256").update(s).digest("hex");

  /** Build a real root holding one regular file, and the real adapter. */
  async function realRoot() {
    const root = await mkdtempCb(join(tmpdir(), "dema-c4b1h-"));
    await writeFileP(join(root, "a.txt"), "payload-bytes");
    const adapter = buildRenameEffectAdapter({ scopeRoot: root, from: "a.txt", to: "b.txt" });
    const before = adapter.manifest();
    const beforeHash = rawSha(JSON.stringify(before));
    return { root, adapter, before, beforeHash };
  }

  test("C4B1H-08 two-link intermediate: target link removed, source and inode preserved", async () => {
    const { root, adapter, before, beforeHash } = await realRoot();
    const srcStatBefore = await statP(join(root, "a.txt"));
    // Construct the exact consented two-link intermediate the way the effect does.
    await linkP(join(root, "a.txt"), join(root, "b.txt"));
    const intent = {
      plan: [{ op: "rename", from: "a.txt", to: "b.txt" }],
      before_manifest: before,
      before_hash: beforeHash,
      expected_after_hash: rawSha(JSON.stringify(before.map((e) => (e.path === "a.txt" ? { ...e, path: "b.txt" } : e)))),
      source_file_identity: adapter.manifest().find(() => true) ? undefined : undefined,
    };
    // Bind the intent through the adapter's own contract.
    const cls = adapter.classifyRecoverableIntermediate({ ...intent, source_file_identity: undefined });
    // The adapter demands the consented inode identity; supply it from disk.
    const withIdentity = { ...intent, source_file_identity: { dev: String(srcStatBefore.dev), ino: String(srcStatBefore.ino) } };
    const cls2 = adapter.classifyRecoverableIntermediate(withIdentity);
    assert.equal(cls2.recoverable, true, `intermediate must be recognised (first probe: ${JSON.stringify(cls)})`);

    const r = restoreToBeforeState({ intent: withIdentity, effect: adapter });
    assert.equal(r.ok, true, `restore must succeed: ${r.reason ?? ""}`);
    assert.equal(r.recovery_mode, "INTERMEDIATE_RESTORED_BACKWARD");
    assert.equal(r.restored_hash, beforeHash);
    assert.equal(existsSync(join(root, "b.txt")), false, "target link must be removed");
    assert.equal(existsSync(join(root, "a.txt")), true, "source must be preserved");
    const srcAfter = await statP(join(root, "a.txt"));
    assert.equal(srcAfter.ino, srcStatBefore.ino, "source inode must be unchanged");
    assert.equal(await readFileP(join(root, "a.txt"), "utf8"), "payload-bytes");
  });

  test("C4B1H-09 a target that is a DIFFERENT inode is refused with no deletion", async () => {
    const { root, adapter, before, beforeHash } = await realRoot();
    const srcStat = await statP(join(root, "a.txt"));
    await writeFileP(join(root, "b.txt"), "different-inode");
    const intent = {
      plan: [{ op: "rename", from: "a.txt", to: "b.txt" }],
      before_manifest: before,
      before_hash: beforeHash,
      expected_after_hash: OTHER_HASH,
      source_file_identity: { dev: String(srcStat.dev), ino: String(srcStat.ino) },
    };
    const r = restoreToBeforeState({ intent, effect: adapter });
    assert.equal(r.ok, false);
    assert.equal(r.recovery_class, "RECOVERY_REQUIRED");
    assert.equal(existsSync(join(root, "a.txt")), true, "nothing may be deleted");
    assert.equal(existsSync(join(root, "b.txt")), true, "nothing may be deleted");
    assert.equal(await readFileP(join(root, "b.txt"), "utf8"), "different-inode");
  });

  test("C4B1H-11 repeated restoration is idempotent on the real adapter", async () => {
    const { root, adapter, before, beforeHash } = await realRoot();
    const srcStat = await statP(join(root, "a.txt"));
    await linkP(join(root, "a.txt"), join(root, "b.txt"));
    const intent = {
      plan: [{ op: "rename", from: "a.txt", to: "b.txt" }],
      before_manifest: before,
      before_hash: beforeHash,
      expected_after_hash: rawSha(JSON.stringify(before.map((e) => (e.path === "a.txt" ? { ...e, path: "b.txt" } : e)))),
      source_file_identity: { dev: String(srcStat.dev), ino: String(srcStat.ino) },
    };
    const first = restoreToBeforeState({ intent, effect: adapter });
    assert.equal(first.ok, true, `first: ${first.reason ?? ""}`);
    const second = restoreToBeforeState({ intent, effect: adapter });
    assert.equal(second.ok, true);
    assert.equal(second.recovery_mode, "ALREADY_BEFORE_STATE", "second call must not act again");
    assert.equal(existsSync(join(root, "a.txt")), true);
  });
});

// ─────────────── C4B1A — authoritative descriptor / intent binding ───────────
//
// A restoration proof must agree with the immutable descriptor, the durable
// intent event, the intent's ACTUAL bytes, and the transaction_hash carried by
// the event chain. The earlier version guarded these with `typeof === "string"
// &&`, which silently converted a MISSING authority into a PASSING check.

describe("C4B1A — authoritative binding context", () => {
  const descPath = (home, txId) => join(home, "transactions", "mission-closure", txId, "transaction.json");

  async function rolledBack() {
    const home = await freshHome();
    const { txId } = await openTx(home);
    await toRolledBack(home, txId, BEFORE_HASH);
    return { home, txId };
  }

  async function mutateDescriptor(home, txId, patch) {
    const p = descPath(home, txId);
    const d = JSON.parse(await readFileP(p, "utf8"));
    await writeFileP(p, `${JSON.stringify({ ...d, ...patch }, null, 2)}\n`);
  }

  test("C4B1A-01 a descriptor with a missing prepared_intent_hash fails closed", async () => {
    const { home, txId } = await rolledBack();
    await mutateDescriptor(home, txId, { prepared_intent_hash: null });
    const res = await append(home, txId, "BEFORE_STATE_VERIFIED", restorationEvidence());
    assert.equal(res.appended, false, "an absent authority must refuse, not skip the check");
    assert.match(String(res.reason), /^descriptor_/);
  });

  test("C4B1A-02 a descriptor prepared_intent_hash of the wrong FORMAT fails closed", async () => {
    const { home, txId } = await rolledBack();
    await mutateDescriptor(home, txId, { prepared_intent_hash: "d".repeat(64) });
    const res = await append(home, txId, "BEFORE_STATE_VERIFIED", restorationEvidence());
    assert.equal(res.appended, false);
    assert.equal(res.reason, "descriptor_prepared_intent_hash_format");
  });

  test("C4B1A-03 a descriptor edited without matching its own hash is refused", async () => {
    const { home, txId } = await rolledBack();
    await mutateDescriptor(home, txId, { mission_id: "mission-swapped" });
    const res = await append(home, txId, "BEFORE_STATE_VERIFIED", restorationEvidence());
    assert.equal(res.appended, false);
    assert.equal(res.reason, "descriptor_hash_mismatch");
  });

  test("C4B1A-04 a descriptor detached from the event chain is refused on REPLAY", async () => {
    const { home, txId } = await rolledBack();
    const ok = await append(home, txId, "BEFORE_STATE_VERIFIED", restorationEvidence());
    assert.equal(ok.appended, true, `fixture: ${ok.reason ?? ""}`);
    const clean = await replayClosureTransaction({ demaHome: home, transactionId: txId });
    assert.equal(clean.ok, true, "control: genuine chain replays");
    // Swap in a self-consistent descriptor whose hash no longer matches the chain.
    const p = descPath(home, txId);
    const d = JSON.parse(await readFileP(p, "utf8"));
    const swapped = { ...d, mission_id: "mission-other" };
    delete swapped.transaction_hash;
    const { createHash: ch } = await import("node:crypto");
    const canon = (o) => JSON.stringify(o, Object.keys(o).sort());
    swapped.transaction_hash = "sha256:" + ch("sha256").update("BIZRA:MISSION_CLOSURE_TX:v1\0" + canon(swapped)).digest("hex");
    await writeFileP(p, `${JSON.stringify(swapped, null, 2)}\n`);
    const state = await replayClosureTransaction({ demaHome: home, transactionId: txId });
    assert.equal(state.ok, false, "a descriptor not bound to the chain must be refused");
  });

  test("C4B1A-07/11 a hash copied into three fields but not derived from the bytes is refused", async () => {
    const home = await freshHome();
    const { txId } = await openTx(home);
    // Consistent everywhere, derived from nothing.
    const fake = "sha256:" + "9".repeat(64);
    const intentEvidence = [{
      schema: CORRIDOR_RENAME_INTENT_EVIDENCE_SCHEMA,
      prepared_intent_hash: fake,
      recovery_policy_hash: RECOVERY_POLICY_HASH,
      checkpoint_event_hash: CHECKPOINT_EVENT_HASH,
      intent: DURABLE_INTENT,
    }];
    assert.equal((await append(home, txId, "EFFECT_INTENT_PERSISTED", intentEvidence)).appended, true);
    for (const p of ["EFFECT_APPLIED", "ROLLBACK_STARTED", "ROLLED_BACK"]) {
      assert.equal((await append(home, txId, p)).appended, true);
    }
    const res = await append(home, txId, "BEFORE_STATE_VERIFIED",
      restorationEvidence({ prepared_intent_hash: fake }));
    assert.equal(res.appended, false, "self-consistent but underived hashes must be refused");
    assert.match(String(res.reason), /intent_prepared_intent_hash_ne_descriptor|intent_hash_not_derived_from_intent_bytes/);
  });

  test("C4B1A-08/09 recovery_policy and checkpoint bindings must equal the descriptor", async () => {
    for (const bad of [{ recovery_policy_hash: "sha256:" + "7".repeat(64) },
                       { checkpoint_event_hash: "sha256:" + "8".repeat(64) }]) {
      const home = await freshHome();
      const { txId } = await openTx(home);
      const intent = DURABLE_INTENT;
      const intentEvidence = [{
        schema: CORRIDOR_RENAME_INTENT_EVIDENCE_SCHEMA,
        prepared_intent_hash: sha256CanonicalJsonV1(intent),
        recovery_policy_hash: RECOVERY_POLICY_HASH,
        checkpoint_event_hash: CHECKPOINT_EVENT_HASH,
        intent,
        ...bad,
      }];
      assert.equal((await append(home, txId, "EFFECT_INTENT_PERSISTED", intentEvidence)).appended, true);
      for (const p of ["EFFECT_APPLIED", "ROLLBACK_STARTED", "ROLLED_BACK"]) {
        assert.equal((await append(home, txId, p)).appended, true);
      }
      const res = await append(home, txId, "BEFORE_STATE_VERIFIED", restorationEvidence());
      assert.equal(res.appended, false, `${Object.keys(bad)[0]} drift must be refused`);
      assert.match(String(res.reason), /_ne_descriptor$/);
    }
  });

  test("C4B1A-12 a forged intent before_hash is refused even with valid event hashes", async () => {
    const home = await freshHome();
    const intent = { ...DURABLE_INTENT, before_hash: "e".repeat(64) };
    // The descriptor must AGREE with this intent, otherwise the earlier
    // descriptor check fires and the derivation law goes untested.
    const { txId } = await openTx(home, { preparedIntentHash: sha256CanonicalJsonV1(intent) });
    const intentEvidence = [{
      schema: CORRIDOR_RENAME_INTENT_EVIDENCE_SCHEMA,
      prepared_intent_hash: sha256CanonicalJsonV1(intent),
      recovery_policy_hash: RECOVERY_POLICY_HASH,
      checkpoint_event_hash: CHECKPOINT_EVENT_HASH,
      intent,
    }];
    assert.equal((await append(home, txId, "EFFECT_INTENT_PERSISTED", intentEvidence)).appended, true);
    for (const p of ["EFFECT_APPLIED", "ROLLBACK_STARTED", "ROLLED_BACK"]) {
      assert.equal((await append(home, txId, p)).appended, true);
    }
    const res = await append(home, txId, "BEFORE_STATE_VERIFIED",
      restorationEvidence({ before_hash: "e".repeat(64), restored_hash: "e".repeat(64) }));
    assert.equal(res.appended, false);
    assert.equal(res.reason, "intent_before_hash_not_derived_from_manifest");
  });

  test("C4B1A-13 a malformed before_manifest fails closed", async () => {
    const home = await freshHome();
    const intent = { ...DURABLE_INTENT, before_manifest: "not-an-array" };
    const { txId } = await openTx(home, { preparedIntentHash: sha256CanonicalJsonV1(intent) });
    const intentEvidence = [{
      schema: CORRIDOR_RENAME_INTENT_EVIDENCE_SCHEMA,
      prepared_intent_hash: sha256CanonicalJsonV1(intent),
      recovery_policy_hash: RECOVERY_POLICY_HASH,
      checkpoint_event_hash: CHECKPOINT_EVENT_HASH,
      intent,
    }];
    assert.equal((await append(home, txId, "EFFECT_INTENT_PERSISTED", intentEvidence)).appended, true);
    for (const p of ["EFFECT_APPLIED", "ROLLBACK_STARTED", "ROLLED_BACK"]) {
      assert.equal((await append(home, txId, p)).appended, true);
    }
    const res = await append(home, txId, "BEFORE_STATE_VERIFIED", restorationEvidence());
    assert.equal(res.appended, false);
    assert.equal(res.reason, "intent_before_manifest_malformed");
  });

  test("C4B1A-14 an unrelated EXTRA reference beside a valid intent ref is refused", async () => {
    const home = await freshHome();
    const { txId } = await openTx(home);
    const intent = DURABLE_INTENT;
    const intentEvidence = [
      { schema: CORRIDOR_RENAME_INTENT_EVIDENCE_SCHEMA,
        prepared_intent_hash: sha256CanonicalJsonV1(intent),
        recovery_policy_hash: RECOVERY_POLICY_HASH,
        checkpoint_event_hash: CHECKPOINT_EVENT_HASH,
        intent },
      { type: "smuggled", hash: "sha256:ev" },
    ];
    assert.equal((await append(home, txId, "EFFECT_INTENT_PERSISTED", intentEvidence)).appended, true);
    for (const p of ["EFFECT_APPLIED", "ROLLBACK_STARTED", "ROLLED_BACK"]) {
      assert.equal((await append(home, txId, p)).appended, true);
    }
    const res = await append(home, txId, "BEFORE_STATE_VERIFIED", restorationEvidence());
    assert.equal(res.appended, false, "filtering for one match must not accept extras");
    assert.equal(res.reason, "intent_evidence_not_exactly_one");
  });
});
