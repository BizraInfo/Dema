import { TASK_REGISTRY } from "../../../../packages/tasks/src/downloads-audit-preview.js";
import {
  formatVerdict,
  verifyReceipt,
} from "../../../../packages/verifier/src/sat-placeholder.js";
import {
  highestLevel,
  levelLabel,
  requestApproval,
} from "../../../../packages/core/src/approval-gate.js";
import { createSpinner } from "../../../../packages/core/src/spinner.js";

export async function cmd_task(ctx) {
  const { subcommand } = ctx;
  if (!subcommand) {
    // List tasks.
    const list = Object.values(TASK_REGISTRY).map((t) => ({
      id: t.id,
      autonomy_level: t.autonomy_level,
      description: t.description,
    }));
    console.log(
      JSON.stringify(
        { schema: "bizra.dema.task_list.v0.1", tasks: list },
        null,
        2,
      ),
    );
    process.exit(process.exitCode ?? 0);
  }
  const task = TASK_REGISTRY[subcommand];
  if (!task) throw new Error(`Unknown task: ${subcommand}`);

  // Approval gate per A4.5 + B1.2 design. L0/L1/L2 auto-approve
  // (no prompt). L3+ requires interactive approval. L4 routes
  // through FATE evaluateConsent. L5 is unconditionally refused.
  // Fail-closed: a malformed/missing autonomy_level (highestLevel
  // returns null) is refused, not silently downgraded.
  const level = highestLevel(task.autonomy_level);
  if (level === null) {
    console.log(
      `Refused: task ${task.id} has malformed or missing autonomy_level ` +
        `(got: ${JSON.stringify(task.autonomy_level)}). Expected L0..L5.`,
    );
    return { refused: true, reason: "malformed_autonomy_level" };
  }
  if (level >= 3) {
    const approval = await requestApproval({
      autonomyLevel: levelLabel(level),
      action: `task ${task.id}`,
      scope: task.scope ?? task.description ?? null,
      requireExactPhrase: task.requireExactPhrase,
    });
    if (!approval.approved) {
      console.log(`Refused: ${approval.refused_reason}`);
      return { refused: true, reason: approval.refused_reason };
    }
  }

  const taskSpinner = createSpinner({
    stdout: process.stdout,
    label: `Running ${task.id}…`,
  });
  taskSpinner.start();
  const receipt = await task.run();
  taskSpinner.stop();
  // Route through verifyReceipt dispatcher (per v0.3.2 spec acceptance
  // criterion #5; see docs/02-architecture/sat-verifier-sibling-spec.md).
  // Dispatcher fails closed on unknown schema; task receipts route to the
  // placeholder logic, gateway-issued receipts route to the gateway-handoff
  // verifier. Caps at PARTIAL_PLACEHOLDER per spec — never returns PERMIT
  // from local logic; SAT-5 PERMIT is reserved for upstream Rust roster.
  const verdict = verifyReceipt(receipt);
  console.log(task.format(receipt));
  console.log("");
  console.log(formatVerdict(verdict));
  process.exit(process.exitCode ?? 0);
}
