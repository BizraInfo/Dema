import {
  buildMissionLoopPreview,
  buildMissionLoopSummary,
} from "../../../../packages/core/src/mission-loop-preview.js";

export async function cmd_mission_loop(ctx) {
  const { argv } = ctx;
  const preview = argv.includes("--summary")
    ? buildMissionLoopSummary()
    : buildMissionLoopPreview();
  console.log(JSON.stringify(preview, null, 2));
  process.exit(process.exitCode ?? 0);
}
