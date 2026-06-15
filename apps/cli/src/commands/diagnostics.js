import {
  buildDiagnosticsMissionPlan,
  formatDiagnosticsMissionPlan,
} from "../../../../packages/mission/src/diagnostics-plan.js";

export async function cmd_diagnostics(ctx) {
  const { argv, subcommand } = ctx;
  if (subcommand !== "plan") {
    throw new Error(
      "Unknown diagnostics command. Use `dema diagnostics plan [--json]`.",
    );
  }
  const plan = buildDiagnosticsMissionPlan();
  console.log(
    argv.includes("--json")
      ? JSON.stringify(plan, null, 2)
      : formatDiagnosticsMissionPlan(plan),
  );
  process.exit(process.exitCode ?? 0);
}
