// `dema start` command handler — DEMA-BIRTH-LOOP-1A.
//
// Reads the local operator profile (DEMA_HOME/profile.json), classifies the
// node state via the pure birth-loop kernel, and greets/routes accordingly.
// Preview-only: it performs no home-base scan, no model invocation, no task,
// and activates no runtime. The filesystem read lives in birth-loop-profile.js
// so packages/core/src/dema-birth-loop.js stays pure under kernel-purity-check.
import {
  wantsJson,
  humanHintLine,
} from "../../../../packages/core/src/output-mode.js";
import { humanizeNextAction } from "../../../../packages/core/src/next-action-humanizer.js";
import { loadBirthLoopFace } from "../lib/birth-loop-profile.js";

export async function cmd_start(ctx) {
  const { argv } = ctx;
  const { birth_loop: env } = await loadBirthLoopFace();

  if (wantsJson(argv)) {
    console.log(JSON.stringify(env, null, 2));
    process.exit(process.exitCode ?? 0);
  }

  console.log(
    [
      env.greeting,
      `  Node state: ${env.node_state}`,
      "  Next safe actions:",
      ...env.next_safe_actions.map((a) => `    • ${humanizeNextAction(a)}`),
      "  (Preview only — no scan, model, task, or runtime was performed.)",
      humanHintLine("start"),
    ].join("\n"),
  );
  process.exit(process.exitCode ?? 0);
}
