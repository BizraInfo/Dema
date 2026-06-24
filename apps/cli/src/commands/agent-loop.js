import {
  buildAgentDualLoopPreview,
  formatAgentDualLoopPreview,
} from "../../../../packages/core/src/agent-dual-loop-preview.js";
import { buildPatSatBlackboardDryRun } from "../../../../packages/core/src/pat-sat-blackboard-dry-run.js";
import { wantsJson } from "../../../../packages/core/src/output-mode.js";

function argValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

function formatBlackboard(report) {
  const lines = [
    "Dema · PAT/SAT blackboard dry-run (PREVIEW_ONLY)",
    "",
    `  seed.pain: ${report.seed.pain ?? "(missing)"}`,
    `  seed.goal: ${report.seed.goal ?? "(missing)"}`,
    "",
    "  board:",
  ];
  for (const entry of report.board) {
    lines.push(
      `    ${entry.step}. [${entry.loop}] ${entry.source_id} -> ${entry.entry_type}: ${entry.summary}`,
    );
  }
  if (report.board.length === 0) {
    lines.push("    (empty)");
  }
  lines.push("");
  lines.push(`  final_state: ${report.final_state}`);
  lines.push("  boundary: all-false; no model, no runtime, no reward");
  return lines.join("\n");
}

export async function cmd_agent_loop(ctx) {
  const { argv, subcommand } = ctx;

  if (subcommand === "dual-preview") {
    const preview = buildAgentDualLoopPreview();
    if (wantsJson(argv)) {
      console.log(JSON.stringify(preview, null, 2));
    } else {
      console.log(formatAgentDualLoopPreview(preview));
    }
    process.exit(process.exitCode ?? 0);
  }

  if (subcommand === "blackboard") {
    const report = buildPatSatBlackboardDryRun({
      pain: argValue(argv, "--pain") ?? null,
      goal: argValue(argv, "--goal") ?? null,
    });
    if (wantsJson(argv)) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(formatBlackboard(report));
    }
    process.exit(process.exitCode ?? 0);
  }

  throw new Error(
    "Unknown agent-loop command. Use `dema agent-loop dual-preview [--json]` or `dema agent-loop blackboard [--pain ...] [--goal ...] [--json]`.",
  );
}
