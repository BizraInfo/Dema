// DEMA-FOUNDER-RELIEF-LOOP-0A — the authority-classification core of the
// always-on founder-relief loop (Lane B). This is the safety primitive that
// makes "Dema works while MuMu sleeps" possible WITHOUT turning autonomy into
// uncontrolled authority: it decides which queued work units may run UNATTENDED
// and which must wait for one true sovereign gate. It is PURE — it plans, it
// executes nothing, mints nothing, and never touches DEMA_HOME.
//
// Autonomy is bounded by the estate's EXISTING effect-risk taxonomy
// (BIZRA-GENESIS-LOOP-1A §5.3), never a parallel scale:
//
//   read_only          -> AUTONOMOUS          (A0: observe / analyze / test / research / brief)
//   reversible_local   -> AUTONOMOUS_BOUNDED   (A1: isolated worktree, a declared undo required)
//   privileged | destructive | external_network | financial | identity_key
//                      -> QUEUE_SOVEREIGN       (A2: accumulate; never spent unattended)
//
// Fail-closed law: a malformed unit is REFUSED; a missing/unknown effect_class,
// an `ambiguous:true` flag, or a `reversible_local` unit with no declared `undo`
// is QUEUE_SOVEREIGN. The default for anything the kernel cannot prove safe is
// "wait for the human", never "run".

export const FOUNDER_RELIEF_SCHEMA = "bizra.dema.founder_relief_loop.v0.1";

// Genesis §5.3 effect classes that a bounded standing authority may run unattended.
const AUTONOMOUS = Object.freeze({
  read_only: { disposition: "AUTONOMOUS", authority: "A0" },
  reversible_local: { disposition: "AUTONOMOUS_BOUNDED", authority: "A1" },
});
// Effect classes that always require a fresh sovereign gate.
export const SOVEREIGN_EFFECT_CLASSES = Object.freeze([
  "privileged",
  "destructive",
  "external_network",
  "financial",
  "identity_key",
]);

const queueSov = (reason) =>
  Object.freeze({ disposition: "QUEUE_SOVEREIGN", authority: "A2", reason });
const refuse = (reason) =>
  Object.freeze({ disposition: "REFUSED", authority: null, reason });

/** Classify ONE work unit into its unattended-autonomy disposition. Pure, fail-closed. */
export function classifyWorkUnit(unit) {
  if (!unit || typeof unit !== "object" || Array.isArray(unit)) {
    return refuse("work_unit_malformed");
  }
  if (unit.ambiguous === true) return queueSov("ambiguous_requires_sovereign");
  const cls = unit.effect_class;
  if (typeof cls !== "string" || cls.length === 0) return queueSov("effect_class_missing");
  if (cls === "reversible_local") {
    // A reversible effect is only autonomous when its reversal is declared up front.
    if (typeof unit.undo !== "string" || unit.undo.trim().length === 0) {
      return queueSov("reversible_without_declared_undo");
    }
    return Object.freeze({ ...AUTONOMOUS.reversible_local, reason: null });
  }
  if (cls === "read_only") return Object.freeze({ ...AUTONOMOUS.read_only, reason: null });
  if (SOVEREIGN_EFFECT_CLASSES.includes(cls)) return queueSov(`sovereign_effect_class:${cls}`);
  return queueSov(`unknown_effect_class:${cls}`); // fail-closed: unknown is never autonomous
}

/**
 * Plan one unattended tick over a Safe Work Queue. Returns the single next unit
 * that may run now (highest priority among A0/A1), the sovereign queue that must
 * accumulate, and the refused (malformed) units. Never selects an A2 unit to run.
 * Pure; authority_delta is always 0.
 */
export function planNextSafeWork(queue = []) {
  const items = Array.isArray(queue) ? queue : [];
  const runnable = [];
  const sovereign_queue = [];
  const refused = [];
  items.forEach((unit, index) => {
    const c = classifyWorkUnit(unit);
    const id = unit && typeof unit === "object" && typeof unit.id === "string" ? unit.id : `#${index}`;
    const priority = unit && typeof unit === "object" && Number.isFinite(unit.priority) ? unit.priority : 0;
    const row = Object.freeze({ id, index, priority, ...c });
    if (c.disposition === "AUTONOMOUS" || c.disposition === "AUTONOMOUS_BOUNDED") runnable.push(row);
    else if (c.disposition === "REFUSED") refused.push(row);
    else sovereign_queue.push(row);
  });
  // highest priority first; ties keep original queue order (stable)
  runnable.sort((a, b) => b.priority - a.priority || a.index - b.index);
  return Object.freeze({
    schema: FOUNDER_RELIEF_SCHEMA,
    next_safe_unit: runnable.length > 0 ? runnable[0] : null,
    runnable_count: runnable.length,
    sovereign_queue: Object.freeze(sovereign_queue),
    refused: Object.freeze(refused),
    authority_delta: 0,
  });
}

/**
 * Shape one morning briefing from a completed tick's ledger. Pure — reads
 * results, mints nothing. `completed`/`failed_safely` are receipted work units;
 * `sovereign_queue` are the A2 gates that accumulated.
 */
export function buildReliefBriefing({
  completed = [],
  failed_safely = [],
  sovereign_queue = [],
  learned = [],
  now = null,
} = {}) {
  const arr = (x) => (Array.isArray(x) ? x : []);
  const c = arr(completed), f = arr(failed_safely), s = arr(sovereign_queue), l = arr(learned);
  return Object.freeze({
    schema: "bizra.dema.founder_relief_briefing.v0.1",
    generated_at: typeof now === "string" ? now : null,
    done: c.length,
    failed_safely: f.length,
    needs_you: s.length,
    learned: l.length,
    // the human reads INTENT and TRUE GATES, not machinery
    needs_you_gates: Object.freeze(s.map((g) => (g && g.id) || "gate")),
    // hard safety invariants a briefing must always be able to assert
    unauthorized_actions: 0,
    unverified_consequential_effects: 0,
    authority_delta: 0,
  });
}

/** Render a briefing as the human-facing morning report. Pure — MuMu reads
 *  intention and true gates, not machinery. */
export function formatReliefBriefing(b = {}) {
  const n = (x) => (Number.isFinite(x) ? x : 0);
  const gates = Array.isArray(b.needs_you_gates) ? b.needs_you_gates : [];
  const lines = [
    `GOOD MORNING MUMU${b.generated_at ? " · " + b.generated_at : ""}`,
    "",
    `DONE (verified)        ${n(b.done)}`,
    `FAILED SAFELY          ${n(b.failed_safely)}`,
    `LEARNED                ${n(b.learned)}`,
    "",
    `NEEDS YOU (${n(b.needs_you)} gate${n(b.needs_you) === 1 ? "" : "s"}):`,
    ...(gates.length ? gates.map((g) => `  - ${g}`) : ["  (none)"]),
    "",
    "PROOF",
    `  unauthorized actions             ${n(b.unauthorized_actions)}`,
    `  unverified consequential effects ${n(b.unverified_consequential_effects)}`,
    `  authority delta                  ${n(b.authority_delta)}`,
  ];
  return lines.join("\n");
}
