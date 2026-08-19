// DEMA-FOUNDER-RELIEF-TASK-LIFECYCLE-0C — durable task semantics for the relief
// loop. Fixes the failure mode where a shift re-counts the same health checks as
// "DONE" forever: a recurring monitor re-runs INTENTIONALLY (recurrence_policy +
// next_eligible_at), a completed one-shot repair RETIRES (never re-counted), a
// sovereign-blocked task WAITS without blocking unrelated work, a failed repair
// becomes RETRYABLE within a bounded attempt count. PURE — no clock, no io; the
// caller passes `now`. This is the difference between a cron job and an organism.

export const TASK_STATES = Object.freeze([
  "PENDING", "CLAIMED", "RUNNING", "VERIFYING", "VERIFIED",
  "RETIRED", "FAILED_SAFE", "RETRYABLE", "WAITING_SOVEREIGN",
]);

export const TASK_LIFECYCLE_SCHEMA = "bizra.dema.task_lifecycle.v0.1";
const DEFAULT_MAX_ATTEMPTS = 3;

// event -> { from: [states], to: state }. BLOCK_SOVEREIGN is legal from any state.
const TRANSITIONS = Object.freeze({
  CLAIM: { from: ["PENDING", "RETRYABLE"], to: "CLAIMED" },
  START: { from: ["CLAIMED"], to: "RUNNING" },
  COMPLETE_OK: { from: ["RUNNING"], to: "VERIFYING" },
  COMPLETE_FAIL: { from: ["RUNNING"], to: "FAILED_SAFE" },
  VERIFY_OK: { from: ["VERIFYING"], to: "VERIFIED" },
  VERIFY_FAIL: { from: ["VERIFYING"], to: "FAILED_SAFE" },
  RETIRE: { from: ["VERIFIED"], to: "RETIRED" },      // one-shot done
  RESCHEDULE: { from: ["VERIFIED"], to: "PENDING" },  // recurring, sets next_eligible_at
  RETRY: { from: ["FAILED_SAFE"], to: "RETRYABLE" },  // bounded by attempt_count
  BLOCK_SOVEREIGN: { from: TASK_STATES, to: "WAITING_SOVEREIGN" },
  UNBLOCK: { from: ["WAITING_SOVEREIGN"], to: "PENDING" }, // operator granted the lease
});

export function createTask({
  mission_id = null, task_id, idempotency_key = null,
  recurrence_policy = { kind: "once" }, now = null,
} = {}) {
  if (typeof task_id !== "string" || task_id.length === 0) {
    return Object.freeze({ error: "task_id_required" });
  }
  const rp = recurrence_policy && recurrence_policy.kind === "interval"
    ? { kind: "interval", interval_ms: Number(recurrence_policy.interval_ms) || 0 }
    : { kind: "once" };
  return Object.freeze({
    schema: TASK_LIFECYCLE_SCHEMA,
    mission_id, task_id, idempotency_key,
    state: "PENDING", attempt_count: 0,
    recurrence_policy: Object.freeze(rp),
    last_result_hash: null, next_eligible_at: null,
    created_at: now, updated_at: now,
  });
}

const parseMs = (iso) => { const t = Date.parse(iso); return Number.isFinite(t) ? t : null; };

/** Pure, fail-closed transition. Returns the next frozen task or `{ error, task }`. */
export function advanceTask(task, event, opts = {}) {
  if (!task || typeof task !== "object" || !TASK_STATES.includes(task.state)) {
    return Object.freeze({ error: "task_malformed", task });
  }
  const t = TRANSITIONS[event];
  if (!t) return Object.freeze({ error: `unknown_event:${event}`, task });
  if (!t.from.includes(task.state)) {
    return Object.freeze({ error: `illegal_transition:${task.state}->${event}`, task });
  }
  const now = typeof opts.now === "string" ? opts.now : task.updated_at;
  const max = Number.isFinite(opts.max_attempts) ? opts.max_attempts : DEFAULT_MAX_ATTEMPTS;
  const next = { ...task, state: t.to, updated_at: now };

  if (event === "CLAIM") { next.attempt_count = task.attempt_count + 1; next.next_eligible_at = null; }
  if (event === "RETRY" && task.attempt_count >= max) {
    return Object.freeze({ error: "max_attempts_exhausted", task });
  }
  if (event === "VERIFY_OK" && typeof opts.result_hash === "string") {
    next.last_result_hash = opts.result_hash;
  }
  if (event === "RESCHEDULE") {
    const base = parseMs(now);
    const iv = task.recurrence_policy && task.recurrence_policy.interval_ms;
    next.next_eligible_at = base != null && iv ? new Date(base + iv).toISOString() : null;
  }
  return Object.freeze({ ...next, recurrence_policy: task.recurrence_policy });
}

/** Settle a VERIFIED task by its recurrence policy: one-shot RETIRES, recurring RESCHEDULES. */
export function settleVerifiedTask(task, opts = {}) {
  if (!task || task.state !== "VERIFIED") return Object.freeze({ error: "not_verified", task });
  return task.recurrence_policy && task.recurrence_policy.kind === "interval"
    ? advanceTask(task, "RESCHEDULE", opts)
    : advanceTask(task, "RETIRE", opts);
}

/** May this task be claimed to run now? RETIRED/WAITING_SOVEREIGN/future tasks are not eligible. */
export function isEligible(task, now) {
  if (!task || (task.state !== "PENDING" && task.state !== "RETRYABLE")) return false;
  if (!task.next_eligible_at) return true;
  const a = parseMs(task.next_eligible_at), n = parseMs(now);
  return a == null || n == null ? true : n >= a;
}

/** The tasks that may run this tick — a WAITING_SOVEREIGN task never blocks the rest. */
export function selectEligible(tasks = [], now = null) {
  return (Array.isArray(tasks) ? tasks : []).filter((t) => isEligible(t, now));
}

/** Has this recurring monitor produced a NEW result vs last time? (unique value, not polling.) */
export function resultChanged(task, result_hash) {
  return !task || task.last_result_hash !== result_hash;
}
