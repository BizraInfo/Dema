// `dema state` command handler — extracted from index.js (④).
import { buildNode0StatePreview } from "../../../../packages/core/src/state.js";
import {
  wantsJson,
  humanHintLine,
} from "../../../../packages/core/src/output-mode.js";
import { humanizeNextAction } from "../../../../packages/core/src/next-action-humanizer.js";

export async function cmd_state(ctx) {
  const { argv } = ctx;
  const statePreview = buildNode0StatePreview();
  if (wantsJson(argv)) {
    console.log(JSON.stringify(statePreview, null, 2));
    process.exit(process.exitCode ?? 0);
  }
  console.log(
    [
      "Dema state",
      `  Node: ${statePreview.node} · Operator: ${statePreview.operator}`,
      `  Mission-centered: ${statePreview.mission_centered}`,
      `  Runtime autonomous daemon: ${statePreview.runtime.autonomous_daemon}`,
      `  Federation: ${statePreview.runtime.federation}`,
      `  Minting: ${statePreview.runtime.minting}`,
      `  Next safe action: ${humanizeNextAction(statePreview.next_safe_action)}`,
      humanHintLine("state"),
    ].join("\n"),
  );
  process.exit(process.exitCode ?? 0);
}
