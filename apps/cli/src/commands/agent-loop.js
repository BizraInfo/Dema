import {
  buildAgentDualLoopPreview,
  formatAgentDualLoopPreview,
} from "../../../../packages/core/src/agent-dual-loop-preview.js";
import { wantsJson } from "../../../../packages/core/src/output-mode.js";

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

  throw new Error(
    "Unknown agent-loop command. Use `dema agent-loop dual-preview [--json]`.",
  );
}
