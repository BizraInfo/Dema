import {
  gatherDevRoadmapState,
  formatDevRoadmapReport,
} from "../../../../packages/core/src/roadmap-dev.js";
import {
  buildOptimizationRoadmapPreview,
  formatOptimizationRoadmapPreview,
} from "../../../../packages/core/src/optimization-roadmap.js";

export async function cmd_roadmap(ctx) {
  const { argv, subcommand } = ctx;
  if (subcommand === "preview") {
    const report = buildOptimizationRoadmapPreview();
    console.log(
      argv.includes("--json")
        ? JSON.stringify(report, null, 2)
        : formatOptimizationRoadmapPreview(report),
    );
    process.exit(process.exitCode ?? 0);
  }
  if (subcommand === "dev") {
    const state = await gatherDevRoadmapState({ cwd: process.cwd() });
    console.log(
      argv.includes("--json")
        ? JSON.stringify(state, null, 2)
        : formatDevRoadmapReport(state),
    );
    process.exit(process.exitCode ?? 0);
  }
  throw new Error(
    "Unknown roadmap command. Use `dema roadmap preview [--json]` or `dema roadmap dev [--json]`.",
  );
}
