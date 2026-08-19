import test from "node:test";
import assert from "node:assert/strict";
import {
  createTask, advanceTask, settleVerifiedTask, isEligible, selectEligible, resultChanged,
  TASK_LIFECYCLE_SCHEMA,
} from "../packages/core/src/dema-task-lifecycle.js";

const T0 = "2026-08-13T05:00:00Z";

// ── TL-01 a new task starts PENDING and eligible ──────────────────────────────
test("TL-01: createTask yields a PENDING, eligible task; missing id fails closed", () => {
  const t = createTask({ task_id: "health", now: T0 });
  assert.equal(t.state, "PENDING");
  assert.equal(t.schema, TASK_LIFECYCLE_SCHEMA);
  assert.equal(isEligible(t, T0), true);
  assert.equal(createTask({}).error, "task_id_required");
});

// ── TL-02 the happy path claim->start->complete->verify->settle ───────────────
test("TL-02: a one-shot task RETIRES after verify (never re-counted)", () => {
  let t = createTask({ task_id: "repair", recurrence_policy: { kind: "once" }, now: T0 });
  t = advanceTask(t, "CLAIM", { now: T0 });
  assert.equal(t.state, "CLAIMED");
  assert.equal(t.attempt_count, 1);
  t = advanceTask(t, "START", { now: T0 });
  t = advanceTask(t, "COMPLETE_OK", { now: T0 });
  t = advanceTask(t, "VERIFY_OK", { now: T0, result_hash: "sha256:abc" });
  assert.equal(t.state, "VERIFIED");
  assert.equal(t.last_result_hash, "sha256:abc");
  t = settleVerifiedTask(t, { now: T0 });
  assert.equal(t.state, "RETIRED");
  assert.equal(isEligible(t, "2027-01-01T00:00:00Z"), false, "a retired task never runs again");
});

// ── TL-03 a recurring monitor re-runs INTENTIONALLY after its interval ────────
test("TL-03: a recurring task reschedules and is eligible only after next_eligible_at", () => {
  let t = createTask({ task_id: "monitor", recurrence_policy: { kind: "interval", interval_ms: 1800_000 }, now: T0 });
  for (const ev of ["CLAIM", "START", "COMPLETE_OK"]) t = advanceTask(t, ev, { now: T0 });
  t = advanceTask(t, "VERIFY_OK", { now: T0, result_hash: "h1" });
  t = settleVerifiedTask(t, { now: T0 });
  assert.equal(t.state, "PENDING");
  assert.equal(t.next_eligible_at, "2026-08-13T05:30:00.000Z");
  assert.equal(isEligible(t, "2026-08-13T05:15:00Z"), false, "not yet — inside the interval");
  assert.equal(isEligible(t, "2026-08-13T05:31:00Z"), true, "eligible once the interval elapsed");
});

// ── TL-04 illegal transitions are refused, task unchanged ─────────────────────
test("TL-04: illegal transitions and unknown events fail closed", () => {
  const t = createTask({ task_id: "x", now: T0 });
  assert.equal(advanceTask(t, "VERIFY_OK", { now: T0 }).error, "illegal_transition:PENDING->VERIFY_OK");
  assert.equal(advanceTask(t, "NONSENSE", { now: T0 }).error, "unknown_event:NONSENSE");
  assert.equal(advanceTask({ state: "GARBAGE" }, "CLAIM").error, "task_malformed");
});

// ── TL-05 sovereign block does not block unrelated work ───────────────────────
test("TL-05: a WAITING_SOVEREIGN task is skipped; other tasks stay eligible", () => {
  const blocked = advanceTask(createTask({ task_id: "migrate", now: T0 }), "BLOCK_SOVEREIGN", { now: T0 });
  assert.equal(blocked.state, "WAITING_SOVEREIGN");
  assert.equal(isEligible(blocked, T0), false);
  const free = createTask({ task_id: "health", now: T0 });
  const runnable = selectEligible([blocked, free], T0);
  assert.deepEqual(runnable.map((t) => t.task_id), ["health"], "the block does not stall the rest");
  // operator grants the lease -> unblock -> eligible again
  const unblocked = advanceTask(blocked, "UNBLOCK", { now: T0 });
  assert.equal(unblocked.state, "PENDING");
});

// ── TL-06 bounded retry ───────────────────────────────────────────────────────
test("TL-06: a failed task retries within max_attempts then exhausts", () => {
  let t = createTask({ task_id: "repair", now: T0 });
  t = advanceTask(t, "CLAIM", { now: T0 });          // attempt 1
  t = advanceTask(t, "START", { now: T0 });
  t = advanceTask(t, "COMPLETE_FAIL", { now: T0 });
  assert.equal(t.state, "FAILED_SAFE");
  t = advanceTask(t, "RETRY", { now: T0, max_attempts: 2 });
  assert.equal(t.state, "RETRYABLE");
  t = advanceTask(t, "CLAIM", { now: T0 });          // attempt 2
  assert.equal(t.attempt_count, 2);
  t = advanceTask(t, "START", { now: T0 });
  t = advanceTask(t, "COMPLETE_FAIL", { now: T0 });
  assert.equal(advanceTask(t, "RETRY", { now: T0, max_attempts: 2 }).error, "max_attempts_exhausted");
});

// ── TL-07 idempotency: a recurring monitor with an unchanged result is detectable ─
test("TL-07: resultChanged distinguishes new value from repeated polling", () => {
  let t = createTask({ task_id: "m", recurrence_policy: { kind: "interval", interval_ms: 1000 }, now: T0 });
  for (const ev of ["CLAIM", "START", "COMPLETE_OK"]) t = advanceTask(t, ev, { now: T0 });
  t = advanceTask(t, "VERIFY_OK", { now: T0, result_hash: "same" });
  assert.equal(resultChanged(t, "same"), false, "same result = no new value to report");
  assert.equal(resultChanged(t, "different"), true, "a changed result IS worth reporting");
});
