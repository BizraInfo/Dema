import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyWorkUnit,
  planNextSafeWork,
  buildReliefBriefing,
  formatReliefBriefing,
  FOUNDER_RELIEF_SCHEMA,
  SOVEREIGN_EFFECT_CLASSES,
} from "../packages/core/src/dema-founder-relief-loop.js";

// The safety contract of Lane B: what may run while MuMu sleeps, and what must
// wait for one true sovereign gate. The default for anything unproven is WAIT.

// ── FRL-01 read-only work is autonomous (A0) ──────────────────────────────────
test("FRL-01: read_only work runs unattended as A0", () => {
  const c = classifyWorkUnit({ id: "repo-health", effect_class: "read_only" });
  assert.equal(c.disposition, "AUTONOMOUS");
  assert.equal(c.authority, "A0");
});

// ── FRL-02 reversible-local with declared undo is A1; without undo it waits ────
test("FRL-02: reversible_local is A1 only WITH a declared undo", () => {
  const withUndo = classifyWorkUnit({ id: "rename", effect_class: "reversible_local", undo: "git mv back" });
  assert.equal(withUndo.disposition, "AUTONOMOUS_BOUNDED");
  assert.equal(withUndo.authority, "A1");
  const noUndo = classifyWorkUnit({ id: "rename", effect_class: "reversible_local" });
  assert.equal(noUndo.disposition, "QUEUE_SOVEREIGN");
  assert.equal(noUndo.reason, "reversible_without_declared_undo");
});

// ── FRL-03 every sovereign effect class queues, never runs ────────────────────
test("FRL-03: privileged/destructive/external/financial/identity all QUEUE_SOVEREIGN", () => {
  for (const cls of SOVEREIGN_EFFECT_CLASSES) {
    const c = classifyWorkUnit({ id: cls, effect_class: cls });
    assert.equal(c.disposition, "QUEUE_SOVEREIGN", cls);
    assert.equal(c.authority, "A2", cls);
  }
});

// ── FRL-04 fail-closed: unknown class, ambiguous flag, malformed unit ──────────
test("FRL-04: unknown class and ambiguous flag are QUEUE_SOVEREIGN; malformed is REFUSED", () => {
  assert.equal(classifyWorkUnit({ effect_class: "teleport" }).reason, "unknown_effect_class:teleport");
  assert.equal(classifyWorkUnit({ effect_class: "teleport" }).disposition, "QUEUE_SOVEREIGN");
  assert.equal(classifyWorkUnit({ effect_class: "read_only", ambiguous: true }).disposition, "QUEUE_SOVEREIGN");
  assert.equal(classifyWorkUnit(null).disposition, "REFUSED");
  assert.equal(classifyWorkUnit([]).disposition, "REFUSED");
  assert.equal(classifyWorkUnit({}).reason, "effect_class_missing");
});

// ── FRL-05 plan picks the highest-priority A0/A1 unit, queues A2, never runs A2 ─
test("FRL-05: planNextSafeWork selects highest-priority safe unit and queues the sovereign ones", () => {
  const plan = planNextSafeWork([
    { id: "low-read", effect_class: "read_only", priority: 1 },
    { id: "push", effect_class: "external_network", priority: 99 }, // must NOT be picked despite priority
    { id: "hi-fix", effect_class: "reversible_local", undo: "revert", priority: 5 },
    { id: "key", effect_class: "identity_key", priority: 50 },
    { id: "junk" }, // malformed-ish: no class -> queued, not run
  ]);
  assert.equal(plan.schema, FOUNDER_RELIEF_SCHEMA);
  assert.equal(plan.next_safe_unit.id, "hi-fix", "highest-priority A0/A1 wins, never the A2 push");
  assert.equal(plan.runnable_count, 2);
  const queuedIds = plan.sovereign_queue.map((g) => g.id).sort();
  assert.deepEqual(queuedIds, ["junk", "key", "push"]);
  assert.equal(plan.authority_delta, 0);
});

// ── FRL-06 all-sovereign / empty queue yields nothing to run (loop must not stall) ─
test("FRL-06: when only A2 work remains, next_safe_unit is null and everything queues", () => {
  const plan = planNextSafeWork([
    { id: "merge", effect_class: "destructive", priority: 10 },
    { id: "mint", effect_class: "financial", priority: 8 },
  ]);
  assert.equal(plan.next_safe_unit, null);
  assert.equal(plan.runnable_count, 0);
  assert.equal(plan.sovereign_queue.length, 2);
  assert.deepEqual(planNextSafeWork([]).next_safe_unit, null);
  assert.deepEqual(planNextSafeWork("nonsense").next_safe_unit, null);
});

// ── FRL-07 briefing shapes the morning report with hard safety invariants ─────
test("FRL-07: buildReliefBriefing reports counts + the true gates + zero-authority invariants", () => {
  const b = buildReliefBriefing({
    completed: [{ id: "a" }, { id: "b" }],
    failed_safely: [{ id: "c" }],
    sovereign_queue: [{ id: "publish-branch-X" }],
    learned: [{ id: "recovery-pattern" }],
    now: "2026-08-13T07:00:00Z",
  });
  assert.equal(b.done, 2);
  assert.equal(b.failed_safely, 1);
  assert.equal(b.needs_you, 1);
  assert.deepEqual(b.needs_you_gates, ["publish-branch-X"]);
  assert.equal(b.unauthorized_actions, 0);
  assert.equal(b.unverified_consequential_effects, 0);
  assert.equal(b.authority_delta, 0);
});

// ── FRL-08 the morning report renders intent + gates, never machinery ─────────
test("FRL-08: formatReliefBriefing renders the human morning report", () => {
  const text = formatReliefBriefing(
    buildReliefBriefing({
      completed: [{ id: "a" }],
      sovereign_queue: [{ id: "publish-branch-X" }],
      now: "2026-08-13T07:00:00Z",
    }),
  );
  assert.match(text, /GOOD MORNING MUMU · 2026-08-13T07:00:00Z/);
  assert.match(text, /NEEDS YOU \(1 gate\)/);
  assert.match(text, /- publish-branch-X/);
  assert.match(text, /authority delta {2,}0/);
});
