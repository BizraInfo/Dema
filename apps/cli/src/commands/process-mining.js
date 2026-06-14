import {
  buildProcessMiningPreview,
  buildProcessMiningSummary,
} from "../../../../packages/core/src/process-mining-preview.js";

export async function cmd_process_mining(ctx) {
  const { argv } = ctx;
  const preview = argv.includes("--summary")
    ? buildProcessMiningSummary()
    : buildProcessMiningPreview();
  console.log(JSON.stringify(preview, null, 2));
  process.exit(process.exitCode ?? 0);
}
