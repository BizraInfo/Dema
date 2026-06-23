import { TASK_REGISTRY } from "../../../../packages/tasks/src/downloads-audit-preview.js";
import { formatVerdict } from "../../../../packages/verifier/src/sat-placeholder.js";
import { requestApproval } from "../../../../packages/core/src/approval-gate.js";
import { runBoundedTask } from "../../../../packages/tasks/src/bounded-task-runner.js";
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

  // BOUNDED-TASK-RUNNER-1A: the gate → run → verify lifecycle is the tested
  // kernel runBoundedTask (autonomy gate fail-closed, L5 refused, malformed
  // refused). The CLI only wires the interactive approver + formats the result.
  // The only registered task is read-only L0/L1, so no approval prompt fires
  // under the spinner today.
  const taskSpinner = createSpinner({
    stdout: process.stdout,
    label: `Running ${task.id}…`,
  });
  taskSpinner.start();
  const result = await runBoundedTask(task, { approver: requestApproval });
  taskSpinner.stop();

  if (result.refused) {
    console.log(`Refused: ${result.detail ?? result.reason}`);
    return { refused: true, reason: result.reason };
  }

  console.log(task.format(result.receipt));
  console.log("");
  console.log(formatVerdict(result.verdict));
  process.exit(process.exitCode ?? 0);
}
