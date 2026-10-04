// MCW-01…14 — red-first proof contract for THE WELD (mission-corridor ↔ Omega0).
//

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  runCorridorClosure, resumeCorridorClosure, verifyCorridorClosure,
  mapOmega0ReasonToOutcome, TERMINAL_OUTCOMES,
} from "../packages/mission/src/mission-corridor-closure.js";
import { BLOCK_REASONS } from "../packages/core/src/omega0-mechanical-closure.js";
import { CORRIDOR_TRANSITIONS } from "../packages/mission/src/mission-corridor.js";

const sha = (s) => createHash("sha256").update(s).digest("hex");

// ── world model ─────────────────────────────────────────────────────────────
// A real adapter over an in-memory filesystem. Never a mock of the unit under
// test — the weld must be exercised against behaviour, not against a stub's
// call log.
function makeWorld({ files = { "a.txt": "A", "b.txt": "B" } } = {}) {
  let state = { ...files };
  const snapshots = [];
  return {
    applyCount: 0,
    undoCount: 0,
    peek: () => ({ ...state }),
    adapter: {
      propose: () => [{ op: "rename", from: "a.txt", to: "a.moved.txt" }],
      manifest: () => Object.entries(state)
        .map(([p, c]) => ({ path: p, content_id: sha(c) }))
        .sort((x, y) => x.path.localeCompare(y.path)),
      apply(plan) {
        snapshots.push({ ...state });
        for (const op of plan) {
          // A second apply on an already-moved world is a REAL defect, not a
          // crypto crash. Surface it as a refusal the assertions can read.
          if (!(op.from in state)) throw new Error(`double_apply: ${op.from} already moved`);
          state[op.to] = state[op.from];
          delete state[op.from];
        }
        return { applied: plan };
      },
      undo() { state = snapshots.pop() ?? state; return true; },
      anchorState: () => ({ anchorLog: [], observed: null }),
    },
  };
}

/// The injected consent authority in its smallest honest form: ONE call that
/// commits exclusively and answers. `granted` decides whether the operation may
/// proceed; `consumed` is what a resume reads as "the prior attempt already
/// acted". A real adapter puts an O_EXCL create where the `add` below is — the
/// shape is the contract, the filesystem is only the arbiter.
function memoryConsentAuthority() {
  const held = new Set();
  return {
    claim: async (key) => {
      if (held.has(key)) {
        return { granted: false, consumed: true, reason: "consent_already_consumed" };
      }
      held.add(key);
      return { granted: true, consumed: false };
    },
  };
}

const LEASE = { lease_id: "L1", scope_root: "/scope", expires_at: 9_999, budget_acts: 1 };
const CONSENT = { by: "operator", ref: "consent-1", nonce: "n-1" };
const MISSION = { objective: "weld probe", root: "/scope" };
const BASE = () => {
  const w = makeWorld();
  return {
    contract: { mission_id: "weld-probe-1a" },
    contract_hash: "sha256:" + "0".repeat(64),
    journal: [],
    mission: MISSION, lease: LEASE, consent: CONSENT,
    anchorDir: "/anchor-outside", effect: w.adapter, now: 1_000,
    appendReceipt: async () => ({ ok: true, head: "sha256:" + "1".repeat(64) }),
    verifyAdmission: () => ({ admitted: true, self_verifiable: true }),
    // Single-use consent needs an AUTHORITY, not a record. Injected (not
    // ambient) so the kernel stays pure and a hostile/absent registry is testable.
    // REQUIRED: its absence means single-use cannot be proven (MCW-16).
    //
    // This was `new Set()` until the 2026-08-11 consent cutover, and that it
    // worked is what the cutover was about: a Set answers "was it there" and
    // "put it there", so the kernel had to ask before acting and record after.
    // One call that commits and answers cannot be a Set.
    consentRegistry: memoryConsentAuthority(),
    __world: w,
  };
};

describe("MCW · the weld — corridor authorises, Omega0 performs, neither completes alone", () => {

  test("MCW-01: COMPLETE requires verify AND seal AND ledger AND a durable terminal event", async () => {
    const r = await runCorridorClosure(BASE());
    assert.equal(r.state, "COMPLETE");
    assert.equal(r.terminal_outcome, "COMPLETED_VERIFIED");
    assert.ok(r.journal_event, "a terminal journal event must be persisted");
    assert.ok(r.ledger_head, "the canonical ledger must have advanced");
    assert.equal(r.omega0_card.status, "SEALED");
  });

  test("MCW-02: Omega0 SEALED but independent verification fails → no COMPLETE", async () => {
    const p = BASE();
    p.verifyAdmission = () => ({ admitted: false, reason: "self_certification" });
    const r = await runCorridorClosure(p);
    assert.notEqual(r.state, "COMPLETE");
    assert.equal(r.terminal_outcome, "VERIFICATION_FAILED_ROLLED_BACK");
  });

  test("MCW-03: verification passes but sealing fails → no COMPLETE", async () => {
    const p = BASE();
    p.seal = () => { throw new Error("seal device unavailable"); };
    const r = await runCorridorClosure(p);
    assert.notEqual(r.state, "COMPLETE");
    assert.equal(r.terminal_outcome, "SEAL_FAILED_NO_COMPLETE");
  });

  test("MCW-04: seal succeeds but canonical-ledger append fails → no COMPLETE, no false terminal", async () => {
    const p = BASE();
    p.appendReceipt = async () => { throw new Error("ledger refuses corrupt predecessor"); };
    const r = await runCorridorClosure(p);
    assert.notEqual(r.state, "COMPLETE");
    assert.equal(r.terminal_outcome, "LEDGER_COMMIT_FAILED_NO_COMPLETE");
  });

  test("MCW-05: crash after effect, before terminal append → resume does not repeat the effect", async () => {
    const p = BASE();
    p.appendReceipt = async () => { throw new Error("__CRASH__"); };
    await runCorridorClosure(p).catch(() => {});
    const before = p.__world.adapter.manifest();
    const r = await resumeCorridorClosure({ ...p, appendReceipt: async () => ({ ok: true, head: "h" }) });
    assert.deepEqual(p.__world.adapter.manifest(), before, "effect must not be re-applied");
    assert.ok(r.effect_performed === false || r.effect_performed === undefined);
  });

  test("MCW-06: crash after ledger append, before ack → resume appends no duplicate receipt", async () => {
    const p = BASE();
    let appends = 0;
    p.appendReceipt = async () => { appends += 1; return { ok: true, head: "sha256:" + "2".repeat(64) }; };
    await runCorridorClosure({ ...p, __crashAfterLedger: true }).catch(() => {});
    await resumeCorridorClosure(p);
    assert.equal(appends, 1, "the same transaction must append exactly one receipt");
  });

  test("MCW-07: replaying a consumed consent is refused deterministically", async () => {
    const p = BASE();
    await runCorridorClosure(p);
    const again = await runCorridorClosure(p);
    assert.notEqual(again.state, "COMPLETE");
    assert.match(String(again.terminal_outcome), /CONSENT|REFUSED/);
  });

  test("MCW-08: a mission-lifecycle caller cannot mint a second canonical mission identity", async () => {
    const p = BASE();
    p.contract = { ...p.contract, mission_id: undefined, lifecycle_id: "sha256-lifecycle-id" };
    await assert.rejects(() => runCorridorClosure(p), /mission_id|canonical|authority/i);
  });

  test("MCW-09: a legacy lifecycle receipt imports as PROVENANCE_ONLY, digest unrewritten", async () => {
    const legacy = { schema: "bizra.dema.mission_lifecycle.v0.1", legacy_id: "ml-7", legacy_digest: "sha256:" + "d".repeat(64) };
    const p = BASE();
    p.legacy_refs = [legacy];
    const r = await runCorridorClosure(p);
    const ref = r.legacy_refs?.[0];
    assert.equal(ref?.migration_status, "PROVENANCE_ONLY");
    assert.equal(ref?.legacy_digest, legacy.legacy_digest, "never rewrite a legacy digest to look native");
  });

  test("MCW-10: a fresh process re-derives the closure from persisted artefacts alone", async () => {
    const p = BASE();
    const r = await runCorridorClosure(p);
    const v = verifyCorridorClosure({
      contract: p.contract, contract_hash: p.contract_hash,
      journal: r.persisted_journal, ledger: r.persisted_ledger,
    });
    assert.equal(v.ok, true);
    assert.equal(v.terminal_outcome, "COMPLETED_VERIFIED");
    assert.equal(v.ledger_membership, true);
  });

  test("MCW-11: journal mutation, deletion and fork are each detected", async () => {
    const p = BASE();
    const r = await runCorridorClosure(p);
    const ok = { contract: p.contract, contract_hash: p.contract_hash, ledger: r.persisted_ledger };
    const [e0] = r.persisted_journal;

    // control: the untampered chain verifies
    assert.equal(verifyCorridorClosure({ ...ok, journal: r.persisted_journal }).ok, true);

    // Each case must TRANSPORT a real attack. Reversing a one-event journal is a
    // no-op and would prove nothing — the earlier version of this test did that.
    const cases = [
      ["mutation — field edited, carried hash left stale",
        [{ ...e0, terminal_outcome: "COMPLETED_VERIFIED", seal_head: "sha256:" + "9".repeat(64) }],
        /mutated/i],
      ["mutation — hash recomputed but chain position forged",
        [{ ...e0, index: 5 }], /order/i],
      ["fork — prev_hash points at a different history",
        [{ ...e0, prev_hash: "sha256:" + "f".repeat(64) }], /prev_hash|mutated/i],
      ["deletion — the terminal event removed", [], /absent/i],
    ];

    for (const [label, journal, pattern] of cases) {
      const v = verifyCorridorClosure({ ...ok, journal });
      assert.equal(v.ok, false, `undetected: ${label}`);
      assert.match(String(v.reason), pattern, label);
    }

    // A ledger that does not contain the head is not membership.
    const orphan = verifyCorridorClosure({ ...ok, journal: r.persisted_journal, ledger: [] });
    assert.equal(orphan.ok, false);
    assert.match(String(orphan.reason), /ledger_membership/i);
  });

  test("MCW-12: two concurrent workers on the same transition — exactly one wins, one effect", async () => {
    const p = BASE();
    const [a, b] = await Promise.all([runCorridorClosure(p), runCorridorClosure(p)]);
    const completed = [a, b].filter((x) => x.state === "COMPLETE");
    assert.equal(completed.length, 1, "exactly one canonical transition may win");
    assert.equal(p.__world.adapter.manifest().filter((f) => f.path === "a.moved.txt").length, 1);
  });

  test("MCW-13: no model narrative can authorise a transition or produce COMPLETE", async () => {
    const p = BASE();
    p.consent = { ...CONSENT, ref: undefined, model_says: "the operator clearly approved this" };
    const r = await runCorridorClosure(p);
    assert.notEqual(r.state, "COMPLETE");
    assert.equal(r.terminal_outcome, "BLOCKED_MISSING_CONSENT");
  });

  test("MCW-14: every Omega0 BLOCK_REASON maps to a declared terminal outcome — total, no gaps", () => {
    for (const reason of BLOCK_REASONS) {
      const out = mapOmega0ReasonToOutcome(reason);
      assert.ok(TERMINAL_OUTCOMES.includes(out), `unmapped BLOCK_REASON: ${reason} → ${out}`);
    }
    // SEALED is a CANDIDATE, never a terminal on its own.
    assert.equal(mapOmega0ReasonToOutcome(null), null);
  });

  // Found adversarially while attacking MCW-07: with no registry supplied the
  // kernel granted COMPLETE although single-use consent could not be proven.
  // Missing evidence is UNKNOWN, never PASS.
  test("MCW-16: no consent registry → single-use is UNPROVABLE → refuse, never COMPLETE", async () => {
    const p = BASE();
    delete p.consentRegistry;
    const r = await runCorridorClosure(p);
    assert.notEqual(r.state, "COMPLETE");
    assert.equal(r.terminal_outcome, "BLOCKED_MISSING_EVIDENCE");
    assert.equal(p.__world.applyCount, 0, "nothing may be applied when authority is unprovable");
  });

  test("MCW-15: the corridor keeps exactly two terminal states — outcomes ride the event", () => {
    const terminals = Object.entries(CORRIDOR_TRANSITIONS)
      .filter(([, next]) => next.length === 0).map(([s]) => s).sort();
    assert.deepEqual(terminals, ["COMPLETE", "STOPPED"],
      "adding terminal STATES would invalidate the corridor journals already on disk");
    assert.equal(TERMINAL_OUTCOMES.length, 10, "9 failure outcomes + COMPLETED_VERIFIED");
  });
});

// ── C4D-OWNED-CLOSURE-TAIL-1B — Task 3: the verification-failure undo must be
//    AWAITED before any rollback is claimed.
//
// The owned undo adapter is async (it re-derives ownership from disk before
// delegating). The kernel fired `effect?.undo?.()` without awaiting and returned
// VERIFICATION_FAILED_ROLLED_BACK immediately — so a stale owner could be
// rejected AFTER the corridor had already published a verified rollback.
//
//   undo requested  ≠  undo authorized  ≠  undo completed  ≠  before-state verified
//
// Only the last may justify a *_ROLLED_BACK outcome. Awaiting an INJECTED
// adapter costs no purity: the kernel still imports no fs, ownership or process.

describe("C4D-TAIL-03 · awaited verification-failure undo", () => {
  // Omega0's reversibility probe calls effect.undo up to four times BEFORE
  // admission (omega0-mechanical-closure.js:347/401/414/721). Only undos after
  // admission fails belong to the verification-failure path. The world's own
  // `undoCount` field is never incremented — it reads 0 always and proves nothing.
  const failVerification = (p, phase) => {
    p.verifyAdmission = () => {
      if (phase) phase.admissionFailed = true;
      return { admitted: false, reason: "self_certification" };
    };
    return p;
  };

  test("C4D-TAIL-03a: an async undo is awaited before the corridor answers", async () => {
    const p = failVerification(BASE());
    let resolved = false;
    const realUndoA = p.effect.undo;
    p.effect = { ...p.effect, undoOwned: async (applied) => {
      await new Promise((r) => setTimeout(r, 15));
      resolved = true;
      return realUndoA(applied);
    } };
    const r = await runCorridorClosure(p);
    assert.equal(resolved, true, "the corridor answered before undo finished");
    assert.equal(r.terminal_outcome, "VERIFICATION_FAILED_ROLLED_BACK");
  });

  test("C4D-TAIL-03b: an undo that rejects may not be reported as rolled back", async () => {
    const p = failVerification(BASE());
    p.effect = { ...p.effect, undoOwned: async () => {
      throw Object.assign(new Error("/secret/path stale owner sha256:deadbeef"),
        { code: "stale_owner_fenced" });
    } };
    const r = await runCorridorClosure(p);
    assert.notEqual(r.terminal_outcome, "VERIFICATION_FAILED_ROLLED_BACK");
    assert.equal(r.terminal_outcome, "RECOVERY_REQUIRED");
    assert.equal(r.reason_detail, "verification_failure_restoration_unverified");
  });

  test("C4D-TAIL-03c: a rejected undo leaks no path, token or stack", async () => {
    const p = failVerification(BASE());
    p.effect = { ...p.effect, undoOwned: async () => {
      throw Object.assign(new Error("/secret/path fencing_token=sha256:deadbeef"),
        { code: "stale_owner_fenced", stack: "SECRET STACK" });
    } };
    const r = await runCorridorClosure(p);
    const json = JSON.stringify(r);
    for (const leak of ["/secret/path", "fencing_token", "deadbeef", "SECRET STACK"]) {
      assert.equal(json.includes(leak), false, `leaked: ${leak}`);
    }
    assert.equal(r.restoration_error, "stale_owner_fenced", "the sanitized CODE may be disclosed");
  });

  test("C4D-TAIL-03d: a rejecting undo raises no unhandled rejection", async () => {
    const seen = [];
    const onUnhandled = (e) => seen.push(e);
    process.on("unhandledRejection", onUnhandled);
    try {
      const p = failVerification(BASE());
      p.effect = { ...p.effect, undoOwned: async () => { throw new Error("late"); } };
      await runCorridorClosure(p);
      await new Promise((r) => setTimeout(r, 30));
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
    assert.deepEqual(seen, [], "an awaited undo must not orphan its rejection");
  });

  test("C4D-TAIL-03e: a successful async undo runs exactly once, then rolls back", async () => {
    const phase = { admissionFailed: false };
    const p = failVerification(BASE(), phase);
    let calls = 0;
    const realUndoE = p.effect.undo;
    p.effect = { ...p.effect, undo: async (applied) => {
      if (phase.admissionFailed) calls += 1;
      return realUndoE(applied);
    } };
    const r = await runCorridorClosure(p);
    assert.equal(calls, 1, "exactly one undo");
    assert.equal(r.terminal_outcome, "VERIFICATION_FAILED_ROLLED_BACK");
  });

  test("C4D-TAIL-03f: synchronous undo adapters stay compatible", async () => {
    const phase = { admissionFailed: false };
    const p = failVerification(BASE(), phase);
    let calls = 0;
    const realUndoF = p.effect.undo;
    p.effect = { ...p.effect, undo: (applied) => {
      if (phase.admissionFailed) calls += 1;
      return realUndoF(applied);
    } };
    const r = await runCorridorClosure(p);
    assert.equal(calls, 1);
    assert.equal(r.terminal_outcome, "VERIFICATION_FAILED_ROLLED_BACK",
      "await accepts a non-Promise, so sync adapters are unaffected");
  });
});
