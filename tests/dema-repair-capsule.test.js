import test from "node:test";
import assert from "node:assert/strict";
import { runRepairCapsule, REPAIR_CAPSULE_SCHEMA } from "../packages/core/src/dema-repair-capsule.js";
import { createTask } from "../packages/core/src/dema-task-lifecycle.js";

const NOW = "2026-08-13T06:00:00Z";
const lease = {
  capability_ids: ["repo.patch_bounded"], scope: "/wt/relief",
  expires_at: "2026-08-13T09:00:00Z", max_blast_radius: { files: 3, bytes: 20000 }, granted_by: "mumu",
};
const okAuthority = {
  effect_class: "reversible_local", capability_id: "repo.patch_bounded",
  exact_scope: "/wt/relief/x.js", standing_lease: lease,
  measured_blast_radius: { files: 1, bytes: 500, reversible: true }, machine_state: { ready: true },
};
const okExec = () => ({ ok: true, content_hash: "sha256:deadbeef" });
const okVerify = () => ({ ok: true });
let execCalls;
const spyExec = (r) => { execCalls++; return okExec(r); };

// ── RC-01 ALLOW drives the full lifecycle and RETIRES a one-shot repair ────────
test("RC-01: an authorized one-shot repair runs, verifies, receipts, and RETIRES", () => {
  execCalls = 0;
  const task = createTask({ task_id: "fix-whitespace", recurrence_policy: { kind: "once" }, now: NOW });
  const r = runRepairCapsule({ task, authority: okAuthority, reversible_plan: { p: 1 }, executeReversible: spyExec, verifyReceipt: okVerify, now: NOW });
  assert.equal(r.schema, REPAIR_CAPSULE_SCHEMA);
  assert.equal(r.proceeded, true);
  assert.equal(r.verified, true);
  assert.equal(execCalls, 1);
  assert.equal(r.task.state, "RETIRED");
  assert.equal(r.capsule_receipt.undo_available, true);
  assert.equal(r.authority_delta, 0);
});

// ── RC-02 no lease -> WAITING_SOVEREIGN, executor NEVER called ─────────────────
test("RC-02: without a standing lease the capsule queues and executes nothing", () => {
  execCalls = 0;
  const task = createTask({ task_id: "fix", now: NOW });
  const r = runRepairCapsule({ task, authority: { ...okAuthority, standing_lease: null }, reversible_plan: {}, executeReversible: spyExec, verifyReceipt: okVerify, now: NOW });
  assert.equal(r.proceeded, false);
  assert.equal(r.task.state, "WAITING_SOVEREIGN");
  assert.equal(execCalls, 0, "no execution without authority");
  assert.equal(r.verdict.reason, "no_standing_lease");
});

// ── RC-03 identity_key can NEVER run through the capsule (hard sovereign) ───────
test("RC-03: an identity_key repair is hard-sovereign — never executed by the capsule", () => {
  execCalls = 0;
  const task = createTask({ task_id: "migrate", now: NOW });
  const r = runRepairCapsule({
    task,
    authority: { ...okAuthority, effect_class: "identity_key", capability_id: "authorship.migration" },
    reversible_plan: {}, executeReversible: spyExec, verifyReceipt: okVerify, now: NOW,
  });
  assert.equal(r.proceeded, false);
  assert.equal(r.task.state, "WAITING_SOVEREIGN");
  assert.equal(execCalls, 0);
  assert.match(r.verdict.reason, /hard_sovereign_effect:identity_key/);
});

// ── RC-04 out-of-scope DENY -> queued, nothing executed ───────────────────────
test("RC-04: an out-of-scope request is denied and queued, not executed", () => {
  execCalls = 0;
  const task = createTask({ task_id: "fix", now: NOW });
  const r = runRepairCapsule({ task, authority: { ...okAuthority, exact_scope: "/etc/passwd" }, reversible_plan: {}, executeReversible: spyExec, verifyReceipt: okVerify, now: NOW });
  assert.equal(r.proceeded, false);
  assert.equal(execCalls, 0);
  assert.equal(r.verdict.verdict, "DENY");
});

// ── RC-05 execute failure -> FAILED_SAFE, verify not attempted ────────────────
test("RC-05: a failing reversible execution ends FAILED_SAFE without verifying", () => {
  const task = createTask({ task_id: "fix", now: NOW });
  let verifyCalled = 0;
  const r = runRepairCapsule({
    task, authority: okAuthority, reversible_plan: {},
    executeReversible: () => ({ ok: false, error: "rename_conflict" }),
    verifyReceipt: () => { verifyCalled++; return { ok: true }; }, now: NOW,
  });
  assert.equal(r.executed, true);
  assert.equal(r.verified, false);
  assert.equal(r.task.state, "FAILED_SAFE");
  assert.equal(verifyCalled, 0, "verify never runs on a failed execution");
});

// ── RC-06 verify failure -> FAILED_SAFE ───────────────────────────────────────
test("RC-06: a repair whose verification fails ends FAILED_SAFE", () => {
  const task = createTask({ task_id: "fix", now: NOW });
  const r = runRepairCapsule({ task, authority: okAuthority, reversible_plan: {}, executeReversible: okExec, verifyReceipt: () => ({ ok: false }), now: NOW });
  assert.equal(r.verified, false);
  assert.equal(r.task.state, "FAILED_SAFE");
});

// ── RC-07 a recurring repair RESCHEDULES instead of retiring ───────────────────
test("RC-07: a recurring authorized repair reschedules (not retired)", () => {
  const task = createTask({ task_id: "sweep", recurrence_policy: { kind: "interval", interval_ms: 3600_000 }, now: NOW });
  const r = runRepairCapsule({ task, authority: okAuthority, reversible_plan: {}, executeReversible: okExec, verifyReceipt: okVerify, now: NOW });
  assert.equal(r.verified, true);
  assert.equal(r.task.state, "PENDING");
  assert.equal(r.task.next_eligible_at, "2026-08-13T07:00:00.000Z");
});
