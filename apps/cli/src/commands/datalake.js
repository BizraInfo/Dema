import {
  gatherDatalakeDualLoopPreview,
  renderDatalakeDualLoopPreview,
} from "../../../../packages/core/src/datalake-dual-loop-preview.js";
import { wantsJson } from "../../../../packages/core/src/output-mode.js";
import { shouldUseColor } from "../../../../packages/core/src/status.js";

export async function cmd_datalake(ctx) {
  const { argv, subcommand } = ctx;
  const wantJson = wantsJson(argv);
  const noColor = !shouldUseColor(argv);

  if (subcommand === "dual-loop-preview") {
    const preview = await gatherDatalakeDualLoopPreview();
    if (wantJson) {
      console.log(JSON.stringify(preview, null, 2));
      process.exit(process.exitCode ?? 0);
    }
    console.log(renderDatalakeDualLoopPreview(preview, { useColor: !noColor }));
    process.exit(process.exitCode ?? 0);
  }

  throw new Error(
    "Unknown datalake command. Use `dema datalake dual-loop-preview [--json] [--no-color]`.",
  );
}
