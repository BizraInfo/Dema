// BOUNDED-TASK-RUNNER-1A — the formal, fail-closed lifecycle for executing a
// registered bounded task.
//
// This is the harness, not a new capability. It runs the SAME registered tasks
// that exist today (e.g. the read-only downloads.audit.preview); it adds no
// shell exec, no mutation, no network of its own. The "bounded" is the autonomy
// gate: L0-L2 auto-run, L3+ require approval, L5 is refused from the shell, and
// a malformed/missing autonomy_level is REFUSED (never silently downgraded).
//
// It is a pure orchestrator: the interactive approver and the receipt verifier
// are injected (defaulting to the real ones), so the lifecycle is testable
// without stdin or the live verifier. The task's own `run()` produces the
// receipt; this runner only gates, runs, and verifies.

import {
  highestLevel,
  levelLabel,
  requestApproval,
} from "../../core/src/approval-gate.js";
import { verifyReceipt } from "../../verifier/src/sat-placeholder.js";

export const BOUNDED_TASK_RUN_SCHEMA = "bizra.dema.bounded_task_run.v0.1";

export function validateBoundedTask(task) {
  if (!task || typeof task !== "object") {
    return { valid: false, problems: ["task must be an object"] };
  }
  const problems = [];
  if (typeof task.id !== "string" || task.id.length === 0) problems.push("id");
  if (typeof task.autonomy_level !== "string") problems.push("autonomy_level");
  if (typeof task.run !== "function") problems.push("run");
  return { valid: problems.length === 0, problems };
}

function refusal(reason, detail, extra = {}) {
  return Object.freeze({
    schema: BOUNDED_TASK_RUN_SCHEMA,
    ran: false,
    refused: true,
    reason,
    detail,
    ...extra,
  });
}

export async function runBoundedTask(
  task,
  { approver = requestApproval, verify = verifyReceipt } = {},
) {
  const shape = validateBoundedTask(task);
  if (!shape.valid) {
    return refusal(
      "malformed_task",
      `task is missing or has an invalid: ${shape.problems.join(", ")}`,
    );
  }

  // Fail-closed: an unparseable autonomy_level is refused, not downgraded.
  const level = highestLevel(task.autonomy_level);
  if (level === null) {
    return refusal(
      "malformed_autonomy_level",
      `expected L0..L5, got ${JSON.stringify(task.autonomy_level)}`,
      { task_id: task.id },
    );
  }

  // L0-L2 auto-run; L3+ (incl. L5, which the approver refuses) require approval.
  if (level >= 3) {
    const approval = await approver({
      autonomyLevel: levelLabel(level),
      action: `task ${task.id}`,
      scope: task.scope ?? task.description ?? null,
      requireExactPhrase: task.requireExactPhrase,
    });
    if (!approval || approval.approved !== true) {
      return refusal("approval_denied", approval?.refused_reason ?? "not approved", {
        task_id: task.id,
        autonomy_level: levelLabel(level),
      });
    }
  }

  const receipt = await task.run();
  const verdict = verify(receipt);
  return Object.freeze({
    schema: BOUNDED_TASK_RUN_SCHEMA,
    ran: true,
    refused: false,
    task_id: task.id,
    autonomy_level: levelLabel(level),
    receipt,
    verdict,
  });
}
