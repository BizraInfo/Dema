// NODE0-CLOSURE-INVARIANTS-1A — the ten booleans that decide closure.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateNode0ClosureInvariants,
  verifyClosureVerdict,
  CLOSURE_INVARIANTS,
  INVARIANT_IDS,
  INVARIANT_STATUS,
} from "../packages/core/src/node0-closure-invariants.js";

const obs = (v, source = "test-fixture") => ({ observed: v, source });

/// A fully satisfying set, used as the positive control. Note the two inverted
/// invariants: authority_delta must be 0 and remote_write must be false.
function allSatisfied(overrides = {}) {
  const e = {};
  for (const inv of CLOSURE_INVARIANTS) e[inv.id] = obs(inv.required);
  return { ...e, ...overrides };
}

test("NCI-01 the ten are exactly the ten, in order", () => {
  assert.equal(CLOSURE_INVARIANTS.length, 10);
  assert.deepEqual(INVARIANT_IDS, [
    "mission_is_primary_state",
    "worker_is_replaceable",
    "contract_is_immutable",
    "acceptance_is_model_blind",
    "verification_is_external",
    "authority_delta",
    "recovery_after_worker_exit",
    "receipt_per_transition",
    "full_history_replayable",
    "remote_write",
  ]);
  // The two inverted ones must stay inverted.
  const byId = Object.fromEntries(CLOSURE_INVARIANTS.map((i) => [i.id, i.required]));
  assert.equal(byId.authority_delta, 0);
  assert.equal(byId.remote_write, false);
});

test("NCI-02 POSITIVE CONTROL — a fully evidenced set reads CLOSED", () => {
  // Without this, every OPEN assertion below would be satisfied by a verifier
  // that can only ever say OPEN.
  const r = evaluateNode0ClosureInvariants(allSatisfied());
  assert.equal(r.node0_closed, true);
  assert.equal(r.verdict, "CLOSED");
  assert.equal(r.satisfied_count, 10);
  assert.equal(r.blocked_by.length, 0);
  assert.deepEqual(verifyClosureVerdict(r), { ok: true });
});

test("NCI-03 SILENCE IS NOT SATISFACTION — no evidence reads OPEN", () => {
  const r = evaluateNode0ClosureInvariants({});
  assert.equal(r.node0_closed, false);
  assert.equal(r.unknown_count, 10);
  assert.equal(r.satisfied_count, 0);
  for (const row of r.invariants) {
    assert.equal(row.status, INVARIANT_STATUS.UNKNOWN);
    assert.equal(row.reason, "no_evidence");
  }
  // Absent evidence must block exactly as a violation does.
  assert.equal(r.blocked_by.length, 10);
});

test("NCI-04 one unknown among nine satisfied is still OPEN", () => {
  const e = allSatisfied();
  delete e.remote_write;
  const r = evaluateNode0ClosureInvariants(e);
  assert.equal(r.satisfied_count, 9);
  assert.equal(r.unknown_count, 1);
  assert.equal(r.node0_closed, false, "nine of ten is not closure");
  assert.deepEqual(r.blocked_by, [
    { id: "remote_write", status: "UNKNOWN", reason: "no_evidence" },
  ]);
});

test("NCI-05 a bare boolean is an unsourced assertion, not evidence", () => {
  // The exact shape of self-certification: claiming an invariant without
  // saying where the observation came from.
  const r = evaluateNode0ClosureInvariants({
    ...allSatisfied(),
    verification_is_external: true,
  });
  const row = r.invariants.find((i) => i.id === "verification_is_external");
  assert.equal(row.status, INVARIANT_STATUS.UNKNOWN);
  assert.equal(row.reason, "unsourced_assertion");
  assert.equal(r.node0_closed, false);
});

test("NCI-06 an observation without a source is refused", () => {
  const r = evaluateNode0ClosureInvariants({
    ...allSatisfied(),
    receipt_per_transition: { observed: true },
  });
  const row = r.invariants.find((i) => i.id === "receipt_per_transition");
  assert.equal(row.reason, "no_source");
  assert.equal(r.node0_closed, false);
});

test("NCI-07 the inverted invariants cannot be satisfied by truthiness", () => {
  // authority_delta must be exactly 0 — not "falsy", not 1, not "0".
  for (const bad of [1, "0", false, null]) {
    const r = evaluateNode0ClosureInvariants({
      ...allSatisfied(),
      authority_delta: obs(bad),
    });
    assert.equal(r.node0_closed, false, `authority_delta ${JSON.stringify(bad)} must not pass`);
  }
  // remote_write true is a violation, not merely unknown.
  const w = evaluateNode0ClosureInvariants({
    ...allSatisfied(),
    remote_write: obs(true),
  });
  const row = w.invariants.find((i) => i.id === "remote_write");
  assert.equal(row.status, INVARIANT_STATUS.VIOLATED);
});

test("NCI-08 a violation is reported as violation, distinct from unknown", () => {
  const r = evaluateNode0ClosureInvariants({
    ...allSatisfied(),
    worker_is_replaceable: obs(false, "kill-test-2026-08-09"),
  });
  const row = r.invariants.find((i) => i.id === "worker_is_replaceable");
  assert.equal(row.status, INVARIANT_STATUS.VIOLATED);
  assert.equal(row.observed, false);
  assert.equal(row.source, "kill-test-2026-08-09");
  assert.equal(r.violated_count, 1);
  assert.equal(r.unknown_count, 0);
});

test("NCI-09 NEGATIVE CONTROL — a hand-edited CLOSED verdict is caught", () => {
  const open = evaluateNode0ClosureInvariants({});
  const forged = { ...open, node0_closed: true, verdict: "CLOSED" };
  assert.equal(verifyClosureVerdict(forged).ok, false);
  assert.equal(verifyClosureVerdict(forged).reason, "verdict_not_supported_by_rows");

  // Dropping an invariant to make the set look complete is also caught.
  const short = { ...open, invariants: open.invariants.slice(1) };
  assert.equal(verifyClosureVerdict(short).reason, "invariant_row_count_mismatch");

  const renamed = {
    ...open,
    invariants: open.invariants.map((r, i) => (i === 0 ? { ...r, id: "something_else" } : r)),
  };
  assert.equal(verifyClosureVerdict(renamed).reason, "invariant_set_mismatch");
});

test("NCI-10 the report refuses to overclaim what it checked", () => {
  const r = evaluateNode0ClosureInvariants(allSatisfied());
  assert.match(r.what_this_does_not_prove, /endurance/i);
  assert.match(r.what_this_does_not_prove, /federation/i);
  // The honest limit: it audits the answers, not the instruments.
  assert.match(r.what_this_does_not_prove, /not the instruments/i);
});
