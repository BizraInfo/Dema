// `dema project-status` command handler — extracted from index.js (④).
import { buildProjectStatusPreview } from "../../../../packages/core/src/project-status-preview.js";
import {
  formatProjectStatusPreview,
  resolveFormatterOptsFromEnv,
} from "../../../../packages/core/src/tui-formatter.js";

export async function cmd_project_status(ctx) {
  const { argv } = ctx;
  const preview = buildProjectStatusPreview();
  if (argv.includes("--json")) {
    console.log(JSON.stringify(preview, null, 2));
    process.exit(process.exitCode ?? 0);
  }
  if (process.stdout.isTTY) {
    console.log(
      formatProjectStatusPreview(preview, resolveFormatterOptsFromEnv()),
    );
  } else {
    console.log(JSON.stringify(preview, null, 2));
  }
  process.exit(process.exitCode ?? 0);
}
