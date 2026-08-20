// `dema state` command handler — extracted from index.js (④).
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import { buildNode0StatePreview } from "../../../../packages/core/src/state.js";
import {
  wantsJson,
  humanHintLine,
} from "../../../../packages/core/src/output-mode.js";
import { humanizeNextAction } from "../../../../packages/core/src/next-action-humanizer.js";

// Same candidate order as dema-realm-home.js: canonical profile.json first,
// legacy memory/profile.json second. A silent default here hid an unbound read
// ("MoMo" printed for every real home) — same defect family as the realm card.
async function readProfileName() {
  const home = process.env.DEMA_HOME || join(homedir(), ".dema");
  for (const candidate of [join(home, "profile.json"), join(home, "memory", "profile.json")]) {
    try {
      const profile = JSON.parse(await readFile(candidate, "utf8"));
      const name = profile?.preferred_name || profile?.name;
      if (typeof name === "string" && name.length > 0) return name;
    } catch {
      // unreadable/absent candidate — try the next; kernel default is the last resort
    }
  }
  return undefined;
}

export async function cmd_state(ctx) {
  const { argv } = ctx;
  const operator = await readProfileName();
  const statePreview = buildNode0StatePreview(operator ? { operator } : {});
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
