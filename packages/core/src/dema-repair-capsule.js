// DEMA-FOUNDER-RELIEF-REPAIR-CAPSULE-0E — the A1 repair capsule. Composes the
// THREE existing kernels into one gated, reversible, receipted, self-retiring
// repair transition — it invents no new execution engine:
//
//   authorityVerdict (dema-capability-lease) — may this bounded act proceed?
//        + the reversible execute-gate primitive (executeReversible/verifyReceipt, INJECTED)
//        + task lifecycle (dema-task-lifecycle) — claim->run->verify->retire
//
// PURE ORCHESTRATION + INJECTED EXECUTOR. The capsule NEVER touches real files
// itself; the reversible executor + fs are injected, so unattended runs use a
// fixture. A real repair requires an ALLOW verdict, which requires a standing
// lease the operator granted (an A2, awake) — so autonomous bounded repair is
// possible without ever letting effect risk alone become execution authority.

import { authorityVerdict } from "./dema-capability-lease.js";
import { advanceTask, settleVerifiedTask } from "./dema-task-lifecycle.js";

export const REPAIR_CAPSULE_SCHEMA = "bizra.dema.repair_capsule.v0.1";

/**
 * Run one repair capsule. `authority` carries the lease-verdict inputs; the
 * reversible primitive is injected (`executeReversible(plan) -> receipt`,
 * `verifyReceipt(receipt) -> {ok}`). Returns the driven task + receipts.
 * A non-ALLOW verdict routes the task to WAITING_SOVEREIGN and NEVER executes.
 */
export function runRepairCapsule({
  task, authority = {}, reversible_plan = null,
  executeReversible, verifyReceipt, now = null,
} = {}) {
  if (!task || typeof task !== "object") {
    return Object.freeze({ error: "task_required", authority_delta: 0 });
  }
  const verdict = authorityVerdict({ ...authority, now });

  // Not authorized to act autonomously -> queue for the sovereign, execute nothing.
  if (verdict.verdict !== "ALLOW") {
    const blocked = advanceTask(task, "BLOCK_SOVEREIGN", { now });
    return Object.freeze({
      schema: REPAIR_CAPSULE_SCHEMA, proceeded: false, verdict,
      task: blocked, executed: false, authority_delta: 0,
    });
  }
  if (typeof executeReversible !== "function" || typeof verifyReceipt !== "function") {
    return Object.freeze({ schema: REPAIR_CAPSULE_SCHEMA, error: "executor_required", authority_delta: 0 });
  }

  // Authorized: drive the lifecycle around the injected reversible primitive.
  let t = advanceTask(task, "CLAIM", { now });
  t = advanceTask(t, "START", { now });

  let execute_receipt, execOk = false;
  try { execute_receipt = executeReversible(reversible_plan); execOk = !!execute_receipt && execute_receipt.ok !== false; }
  catch (e) { execute_receipt = Object.freeze({ ok: false, error: String((e && e.message) || e) }); }

  if (!execOk) {
    t = advanceTask(t, "COMPLETE_FAIL", { now });
    // The act did not complete. Distinct from "it completed and did not verify"
    // below, and a reader must be able to tell those apart without guessing.
    return Object.freeze({ schema: REPAIR_CAPSULE_SCHEMA, proceeded: true, verdict, executed: true, verified: false, reason: "execute_failed", execute_receipt, task: t, authority_delta: 0 });
  }

  t = advanceTask(t, "COMPLETE_OK", { now });
  let verified = false;
  try { const vr = verifyReceipt(execute_receipt); verified = !!vr && vr.ok === true; } catch { verified = false; }

  if (!verified) {
    t = advanceTask(t, "VERIFY_FAIL", { now });
    // The act DID complete and its verification refused it. The undo path still
    // matters here in a way it does not above, which is why the reason differs.
    return Object.freeze({ schema: REPAIR_CAPSULE_SCHEMA, proceeded: true, verdict, executed: true, verified: false, reason: "verify_failed", execute_receipt, task: t, authority_delta: 0 });
  }

  t = advanceTask(t, "VERIFY_OK", { now, result_hash: (execute_receipt && execute_receipt.content_hash) || null });
  t = settleVerifiedTask(t, { now }); // one-shot RETIRES, recurring RESCHEDULES

  const capsule_receipt = Object.freeze({
    schema: REPAIR_CAPSULE_SCHEMA,
    task_id: task.task_id,
    capability_id: authority.capability_id || null,
    verdict: "ALLOW",
    verified: true,
    undo_available: true, // the reversible gate's undoReversibleRename path exists
    final_state: t.state,
    at: typeof now === "string" ? now : null,
    authority_delta: 0,
  });
  return Object.freeze({ schema: REPAIR_CAPSULE_SCHEMA, proceeded: true, verdict, executed: true, verified: true, execute_receipt, capsule_receipt, task: t, authority_delta: 0 });
}
