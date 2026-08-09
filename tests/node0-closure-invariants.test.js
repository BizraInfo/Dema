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
  // no source and no scope, even though each copied the required value. The
  // verifier compared the flag to the rows and never asked the rows for evidence.
  const canonicalEnvelope = evaluateNode0ClosureInvariants(allSatisfied());
  const forged = {
    ...canonicalEnvelope,
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

test("NCI-16 blocked_by comparison is structural, not delimiter serialization", () => {
  const evidence = allSatisfied();
  delete evidence.mission_is_primary_state;
  delete evidence.worker_is_replaceable;
  const open = evaluateNode0ClosureInvariants(evidence);

  // On 021e2f1 this single object serializes to the same delimiter-joined bytes
  // as the two real blockers, so pruning one blocker verifies as {ok:true}.
  const forged = {
    ...open,
    blocked_by: [
      {
        id: "mission_is_primary_state",
        status: INVARIANT_STATUS.UNKNOWN,
        reason: "no_evidence~worker_is_replaceable|UNKNOWN|no_evidence",
      },
    ],
  };
  assert.equal(
    verifyClosureVerdict(forged).reason,
    "blocked_by_not_supported_by_rows",
  );
});

test("NCI-17 every row has the exact canonical own-key shape", () => {
  const violation = evaluateNode0ClosureInvariants({
    ...allSatisfied(),
    worker_is_replaceable: obs(
      false,
      "kill-test-2026-08-09",
      scopeOf("worker_is_replaceable"),
    ),
  });
  const missingObserved = {
    ...violation,
    invariants: violation.invariants.map((row) => {
      if (row.id !== "worker_is_replaceable") return row;
      const { observed: _discarded, ...withoutObserved } = row;
      return withoutObserved;
    }),
  };
  assert.equal(verifyClosureVerdict(missingObserved).reason, "row_shape_mismatch");

  const closed = evaluateNode0ClosureInvariants(allSatisfied());
  const extraKey = {
    ...closed,
    invariants: closed.invariants.map((row, index) =>
      index === 0 ? { ...row, verifier_hint: "trust-me" } : row,
    ),
  };
  assert.equal(verifyClosureVerdict(extraKey).reason, "row_shape_mismatch");
});

test("NCI-18 UNKNOWN rows use the canonical null envelope and closed reason vocabulary", () => {
  const open = evaluateNode0ClosureInvariants({});
  const hiddenObserved = {
    ...open,
    invariants: open.invariants.map((row, index) =>
      index === 0 ? { ...row, observed: true } : row,
    ),
  };
  assert.equal(
    verifyClosureVerdict(hiddenObserved).reason,
    "row_unknown_shape_not_canonical",
  );

  const inventedReason = {
    ...open,
    invariants: open.invariants.map((row, index) =>
      index === 0 ? { ...row, reason: "operator_authorized" } : row,
    ),
    blocked_by: open.blocked_by.map((blocker, index) =>
      index === 0 ? { ...blocker, reason: "operator_authorized" } : blocker,
    ),
  };
  assert.equal(
    verifyClosureVerdict(inventedReason).reason,
    "row_reason_not_supported_by_row_evidence",
  );
});

test("NCI-19 settled rows require reason to be exactly null", () => {
  const closed = evaluateNode0ClosureInvariants(allSatisfied());
  for (const badReason of ["", 0, {}, undefined]) {
    const forged = {
      ...closed,
      invariants: closed.invariants.map((row, index) =>
        index === 0 ? { ...row, reason: badReason } : row,
      ),
    };
    assert.equal(
      verifyClosureVerdict(forged).reason,
      "row_reason_not_supported_by_row_evidence",
      `settled reason ${JSON.stringify(badReason)} must not verify`,
    );
  }
});

test("NCI-20 truth label and proof boundaries are canonical report fields", () => {
  const honest = evaluateNode0ClosureInvariants(allSatisfied());
  assert.equal(
    verifyClosureVerdict({ ...honest, truth_label: "VERIFIED_CLOSED" }).reason,
    "truth_label_mismatch",
  );
  assert.equal(
    verifyClosureVerdict({ ...honest, what_this_proves: "Everything." }).reason,
    "proof_boundary_mismatch",
  );
  assert.equal(
    verifyClosureVerdict({ ...honest, what_this_does_not_prove: "Nothing." }).reason,
    "proof_boundary_mismatch",
  );
});

test("NCI-21 report and blocker envelopes reject extra or inherited fields", () => {
  const honest = evaluateNode0ClosureInvariants({});
  assert.equal(
    verifyClosureVerdict({ ...honest, operator_override: true }).reason,
    "report_shape_mismatch",
  );

  const extraBlockerField = {
    ...honest,
    blocked_by: honest.blocked_by.map((blocker, index) =>
      index === 0 ? { ...blocker, authority: "self-certified" } : blocker,
    ),
  };
  assert.equal(
    verifyClosureVerdict(extraBlockerField).reason,
    "blocked_by_not_supported_by_rows",
  );

  const inheritedOnly = Object.create(honest);
  assert.equal(verifyClosureVerdict(inheritedOnly).reason, "report_shape_mismatch");

  const inheritedReportExtra = Object.assign(
    Object.create({ operator_override: true }),
    honest,
  );
  assert.equal(
    verifyClosureVerdict(inheritedReportExtra).reason,
    "report_shape_mismatch",
  );

  const inheritedRowExtra = Object.assign(
    Object.create({ verifier_hint: "trust-me" }),
    honest.invariants[0],
  );
  assert.equal(
    verifyClosureVerdict({
      ...honest,
      invariants: [inheritedRowExtra, ...honest.invariants.slice(1)],
    }).reason,
    "row_shape_mismatch",
  );

  const inheritedBlockerExtra = Object.assign(
    Object.create({ authority: "self-certified" }),
    honest.blocked_by[0],
  );
  assert.equal(
    verifyClosureVerdict({
      ...honest,
      blocked_by: [inheritedBlockerExtra, ...honest.blocked_by.slice(1)],
    }).reason,
    "blocked_by_not_supported_by_rows",
  );
});

test("NCI-22 canonical records contain enumerable data properties, never accessors", () => {
  const honest = evaluateNode0ClosureInvariants({});

  const nonEnumerable = { ...honest };
  Object.defineProperty(nonEnumerable, "truth_label", {
    value: honest.truth_label,
    enumerable: false,
  });
  assert.equal(verifyClosureVerdict(nonEnumerable).reason, "report_shape_mismatch");

  let reportGetterCalls = 0;
  const accessorReport = { ...honest };
  Object.defineProperty(accessorReport, "truth_label", {
    enumerable: true,
    get() {
      reportGetterCalls += 1;
      return honest.truth_label;
    },
  });
  assert.equal(verifyClosureVerdict(accessorReport).reason, "report_shape_mismatch");
  assert.equal(reportGetterCalls, 0, "shape validation must not invoke report getters");

  const accessorRow = { ...honest.invariants[0] };
  Object.defineProperty(accessorRow, "source", {
    enumerable: true,
    get() {
      return null;
    },
  });
  assert.equal(
    verifyClosureVerdict({
      ...honest,
      invariants: [accessorRow, ...honest.invariants.slice(1)],
    }).reason,
    "row_shape_mismatch",
  );

  const accessorBlocker = { ...honest.blocked_by[0] };
  Object.defineProperty(accessorBlocker, "reason", {
    enumerable: true,
    get() {
      return "no_evidence";
    },
  });
  assert.equal(
    verifyClosureVerdict({
      ...honest,
      blocked_by: [accessorBlocker, ...honest.blocked_by.slice(1)],
    }).reason,
    "blocked_by_not_supported_by_rows",
  );
});

test("NCI-23 invariant and blocker arrays are dense canonical data arrays", () => {
  const honest = evaluateNode0ClosureInvariants({});

  // On the pre-fix verifier, Array#every skips every hole and this verifies
  // despite publishing none of the ten required blocker identities.
  const sparseBlockers = new Array(honest.blocked_by.length);
  assert.equal(
    verifyClosureVerdict({ ...honest, blocked_by: sparseBlockers }).reason,
    "blocked_by_not_supported_by_rows",
  );

  const annotatedBlockers = [...honest.blocked_by];
  annotatedBlockers.operator_override = true;
  assert.equal(
    verifyClosureVerdict({ ...honest, blocked_by: annotatedBlockers }).reason,
    "blocked_by_not_supported_by_rows",
  );

  const annotatedRows = [...honest.invariants];
  annotatedRows.operator_override = true;
  assert.equal(
    verifyClosureVerdict({ ...honest, invariants: annotatedRows }).reason,
    "invariant_array_shape_mismatch",
  );

  const accessorBlockers = [...honest.blocked_by];
  Object.defineProperty(accessorBlockers, "0", {
    enumerable: true,
    get() {
      return honest.blocked_by[0];
    },
  });
  assert.equal(
    verifyClosureVerdict({ ...honest, blocked_by: accessorBlockers }).reason,
    "blocked_by_not_supported_by_rows",
  );
});

test("NCI-24 schema v0.3 preserves its original canonical proof boundary", () => {
  const current = evaluateNode0ClosureInvariants({});
  const originalV03 = {
    ...current,
    what_this_does_not_prove:
      "Does not prove endurance, federation readiness, activation, or that any observation was itself honestly measured; it checks the ledger of answers, not the instruments that produced them.",
  };
  assert.deepEqual(verifyClosureVerdict(originalV03), { ok: true });
});

test("NCI-25 unreadable reflective inputs refuse instead of throwing", () => {
  const honest = evaluateNode0ClosureInvariants({});
  const { proxy, revoke } = Proxy.revocable(honest, {});
  revoke();
  let result;
  assert.doesNotThrow(() => {
    result = verifyClosureVerdict(proxy);
  });
  assert.deepEqual(result, { ok: false, reason: "unreadable_report" });
});

test("NCI-26 live Proxies cannot split the verified view from the consumed view", () => {
  const closed = evaluateNode0ClosureInvariants(allSatisfied());
  const open = evaluateNode0ClosureInvariants({});
  const masked = (target, overrides) =>
    new Proxy(target, {
      get(object, key, receiver) {
        return Object.hasOwn(overrides, key)
          ? overrides[key]
          : Reflect.get(object, key, receiver);
      },
    });

  // The descriptor view is an honest CLOSED report; normal reads and JSON see a
  // forged OPEN one. Before the Proxy guard the verifier read only descriptors
  // and returned {ok:true} for an object whose consumed view said something else.
  const splitReport = masked(
    { ...closed },
    { truth_label: "VERIFIED_CLOSED", node0_closed: false, verdict: "OPEN" },
  );
  assert.equal(splitReport.truth_label, "VERIFIED_CLOSED");
  assert.equal(JSON.parse(JSON.stringify(splitReport)).node0_closed, false);
  assert.deepEqual(
    verifyClosureVerdict(splitReport),
    { ok: false, reason: "unreadable_report" },
  );

  const splitRow = masked(
    { ...closed.invariants[0] },
    { source: null, status: INVARIANT_STATUS.UNKNOWN },
  );
  assert.equal(
    verifyClosureVerdict({
      ...closed,
      invariants: [splitRow, ...closed.invariants.slice(1)],
    }).reason,
    "row_shape_mismatch",
  );

  const splitRows = masked([...closed.invariants], { 0: splitRow });
  assert.equal(
    verifyClosureVerdict({ ...closed, invariants: splitRows }).reason,
    "invariant_array_shape_mismatch",
  );

  const splitBlocker = masked(
    { ...open.blocked_by[0] },
    { reason: "operator_authorized" },
  );
  assert.equal(
    verifyClosureVerdict({
      ...open,
      blocked_by: [splitBlocker, ...open.blocked_by.slice(1)],
    }).reason,
    "blocked_by_not_supported_by_rows",
  );

  const splitBlockers = masked([...open.blocked_by], { 0: splitBlocker });
  assert.equal(
    verifyClosureVerdict({ ...open, blocked_by: splitBlockers }).reason,
    "blocked_by_not_supported_by_rows",
  );
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
