import {
  buildPeakSelfLoopPreview,
  renderPeakSelfLoopPreview,
} from "../../../../packages/core/src/peak-self-loop-preview.js";
import { wantsJson } from "../../../../packages/core/src/output-mode.js";
import { shouldUseColor } from "../../../../packages/core/src/status.js";

export async function cmd_peak_self_loop(ctx) {
  const { argv } = ctx;
  const preview = buildPeakSelfLoopPreview();
  if (
    wantsJson(argv) ||
    !process.stdout.isTTY ||
    process.env.DEMA_NO_TUI === "1"
  ) {
    console.log(JSON.stringify(preview, null, 2));
  } else {
    console.log(
      renderPeakSelfLoopPreview(preview, { useColor: shouldUseColor() }),
    );
  }
  process.exit(process.exitCode ?? 0);
}
