// NODE0-CLOSURE-INVARIANTS-1A — the ten booleans that decide closure.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateNode0ClosureInvariants,
  verifyClosureVerdict,
  CLOSURE_INVARIANTS,
  INVARIANT_IDS,
  INVARIANT_STATUS,
  NODE0_CLOSURE_INVARIANTS_SCHEMA,
} from "../packages/core/src/node0-closure-invariants.js";

const obs = (v, source = "test-fixture", scope = null) =>
  scope ? { observed: v, source, scope } : { observed: v, source };

/// The scope an invariant declares. Fixtures that mean to test a VALUE must carry
/// the right scope, or they measure the scope gate instead and pass vacuously.
const scopeOf = (id) => CLOSURE_INVARIANTS.find((i) => i.id === id).required_scope;

/// A fully satisfying set, used as the positive control. Note the two inverted
/// invariants: authority_delta must be 0 and remote_write must be false.
function allSatisfied(overrides = {}) {
  const e = {};
  for (const inv of CLOSURE_INVARIANTS) {
    e[inv.id] = obs(inv.required, "test-fixture", inv.required_scope ?? null);
  }
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
  // authority_delta must be exactly 0 — not "falsy", not 1, not "0". The fixture
  // carries the declared scope so this measures the VALUE rule; without it the
  // scope gate would refuse first and the test would pass without ever comparing.
  for (const bad of [1, "0", false, null]) {
    const r = evaluateNode0ClosureInvariants({
      ...allSatisfied(),
      authority_delta: obs(bad, "test-fixture", scopeOf("authority_delta")),
    });
    const row = r.invariants.find((i) => i.id === "authority_delta");
    assert.equal(
      row.status,
      INVARIANT_STATUS.VIOLATED,
      `authority_delta ${JSON.stringify(bad)} must be compared and rejected, not skipped`,
    );
    assert.equal(r.node0_closed, false, `authority_delta ${JSON.stringify(bad)} must not pass`);
  }
  // remote_write true is a violation, not merely unknown.
  const w = evaluateNode0ClosureInvariants({
    ...allSatisfied(),
    remote_write: obs(
      true,
      "deployment-fixture",
      "node0_deployment_remote_write",
    ),
  });
  const row = w.invariants.find((i) => i.id === "remote_write");
  assert.equal(row.status, INVARIANT_STATUS.VIOLATED);
});

test("NCI-08 a violation is reported as violation, distinct from unknown", () => {
  const r = evaluateNode0ClosureInvariants({
    ...allSatisfied(),
    worker_is_replaceable: obs(
      false,
      "kill-test-2026-08-09",
      scopeOf("worker_is_replaceable"),
    ),
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

test("NCI-12 every invariant declares the observation scope that can settle it", () => {
  // TASK-060 gave remote_write a required_scope because a narrow source scan had
  // tried to settle a deployment question. Nothing made that a rule, so the other
  // nine stayed open to the same promotion. A scope-less invariant is a row any
  // observation can claim.
  for (const inv of CLOSURE_INVARIANTS) {
    assert.equal(
      typeof inv.required_scope,
      "string",
      `${inv.id} must declare a required_scope`,
    );
    assert.ok(inv.required_scope.length > 0, `${inv.id} required_scope is empty`);
  }
  // The scopes are distinct: two invariants sharing one scope would let evidence
  // gathered for one settle the other.
  const scopes = CLOSURE_INVARIANTS.map((i) => i.required_scope);
  assert.equal(new Set(scopes).size, scopes.length, "scopes must be distinct");
  // The shipped remote_write scope is load-bearing for NCI-11 and must not drift.
  const rw = CLOSURE_INVARIANTS.find((i) => i.id === "remote_write");
  assert.equal(rw.required_scope, "node0_deployment_remote_write");
});

test("NCI-13 the scope rule is general, not a remote_write special case", () => {
  // The generalization control. Without it, nine rows could still be settled by
  // an observation that never says what kind of thing it looked at.
  for (const inv of CLOSURE_INVARIANTS) {
    const missing = evaluateNode0ClosureInvariants({
      ...allSatisfied(),
      [inv.id]: { observed: inv.required, source: "plausible-sounding-source" },
    });
    const missingRow = missing.invariants.find((r) => r.id === inv.id);
    assert.equal(
      missingRow.status,
      INVARIANT_STATUS.UNKNOWN,
      `${inv.id} accepted an observation with no scope`,
    );
    assert.equal(missingRow.reason, "observation_scope_mismatch");
    assert.equal(missing.node0_closed, false);

    // A scope borrowed from a different invariant is equally refused, so the
    // check is a match and not merely a presence test.
    const borrowed = CLOSURE_INVARIANTS.find((i) => i.id !== inv.id).required_scope;
    const wrong = evaluateNode0ClosureInvariants({
      ...allSatisfied(),
      [inv.id]: { observed: inv.required, source: "s", scope: borrowed },
    });
    const wrongRow = wrong.invariants.find((r) => r.id === inv.id);
    assert.equal(wrongRow.status, INVARIANT_STATUS.UNKNOWN, `${inv.id} accepted a borrowed scope`);
    assert.equal(wrongRow.reason, "observation_scope_mismatch");
  }
});

test("NCI-14 NEGATIVE CONTROL — forged SATISFIED rows are caught, not just a forged summary", () => {
  // NCI-09 forges the SUMMARY over honest rows. Measured on 097447d: forging the
  // ROWS instead returned {ok:true} — ten rows claiming SATISFIED while carrying
  // no source, no scope, an observed value that is not the required one, and
  // reason "no_evidence", under a summary that still said satisfied_count 0. The
  // verifier compared the flag to the rows and never asked the rows for evidence.
  const forged = {
    schema: NODE0_CLOSURE_INVARIANTS_SCHEMA,
    node0_closed: true,
    verdict: "CLOSED",
    satisfied_count: 10,
    violated_count: 0,
    unknown_count: 0,
    total: 10,
    blocked_by: [],
    invariants: CLOSURE_INVARIANTS.map((inv) => ({
      id: inv.id,
      status: INVARIANT_STATUS.SATISFIED,
      required: inv.required,
      observed: inv.required,
      source: null,
      scope: null,
      required_scope: inv.required_scope,
      reason: null,
    })),
  };
  const v = verifyClosureVerdict(forged);
  assert.equal(v.ok, false, "an unsourced row may not be certified SATISFIED");
  assert.equal(v.reason, "row_status_not_supported_by_row_evidence");

  // Supplying a source but not the declared scope must fail the same way: this is
  // TASK-060's rule enforced at the verifier as well as the evaluator.
  const scopeless = {
    ...forged,
    invariants: forged.invariants.map((r) => ({ ...r, source: "plausible" })),
  };
  assert.equal(verifyClosureVerdict(scopeless).reason, "row_status_not_supported_by_row_evidence");

  // A row may not redefine what its own invariant requires.
  const redefined = {
    ...forged,
    invariants: forged.invariants.map((r, i) =>
      i === 0 ? { ...r, source: "s", scope: r.required_scope, required: "anything-i-say" } : r,
    ),
  };
  assert.equal(verifyClosureVerdict(redefined).reason, "invariant_definition_mismatch");

  const rescoped = {
    ...forged,
    invariants: forged.invariants.map((r, i) =>
      i === 0 ? { ...r, source: "s", scope: "my_own_scope", required_scope: "my_own_scope" } : r,
    ),
  };
  assert.equal(verifyClosureVerdict(rescoped).reason, "invariant_definition_mismatch");

  // A foreign schema cannot borrow this verifier's authority.
  const openReport = evaluateNode0ClosureInvariants({});
  assert.equal(
    verifyClosureVerdict({ ...openReport, schema: "something.else.v0.1" }).reason,
    "schema_mismatch",
  );
});

test("NCI-15 the summary is re-derived from the rows, field by field", () => {
  // Every number the report publishes must be the one its rows produce. Without
  // this, a reader who trusts the counts is trusting an assertion.
  const honest = evaluateNode0ClosureInvariants(allSatisfied());
  assert.deepEqual(verifyClosureVerdict(honest), { ok: true });

  for (const [field, value] of [
    ["satisfied_count", 9],
    ["violated_count", 1],
    ["unknown_count", 1],
    ["total", 11],
  ]) {
    assert.equal(
      verifyClosureVerdict({ ...honest, [field]: value }).reason,
      "summary_not_supported_by_rows",
      `edited ${field} must be caught`,
    );
  }

  // blocked_by must be exactly the non-satisfied rows — neither padded nor pruned.
  assert.equal(
    verifyClosureVerdict({
      ...honest,
      blocked_by: [{ id: "remote_write", status: "UNKNOWN", reason: "no_evidence" }],
    }).reason,
    "blocked_by_not_supported_by_rows",
  );
  const open = evaluateNode0ClosureInvariants({});
  assert.equal(
    verifyClosureVerdict({ ...open, blocked_by: [] }).reason,
    "blocked_by_not_supported_by_rows",
    "hiding the blockers must not read as clean",
  );
  // And the honest OPEN report still verifies.
  assert.deepEqual(verifyClosureVerdict(open), { ok: true });
});

test("NCI-11 source-scoped evidence cannot satisfy deployment remote_write", () => {
  // Direct-bypass control: callers must not be able to wrap a CLEAR source scan
  // in the generic observation shape and thereby promote it at the ledger edge.
  const r = evaluateNode0ClosureInvariants({
    ...allSatisfied(),
    remote_write: {
      observed: false,
      source: "NODE0-SOURCE-LISTENER-SCAN-1A CLEAR",
    },
  });
  const row = r.invariants.find((i) => i.id === "remote_write");
  assert.equal(row.status, INVARIANT_STATUS.UNKNOWN);
  assert.equal(row.reason, "observation_scope_mismatch");
  assert.equal(r.node0_closed, false);
});
