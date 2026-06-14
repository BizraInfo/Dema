import { createNode0Adapter } from "../../../../packages/node-adapter/src/node0-adapter.js";
import { recordTodayTick } from "../../../../packages/core/src/today.js";
import { summarizeMemory } from "../../../../packages/memory/src/memory-store.js";
import {
  wantsJson,
  humanHintLine,
} from "../../../../packages/core/src/output-mode.js";
import { statusWithLocalIdentity } from "../lib/status-identity.js";

const adapter = createNode0Adapter();

export async function cmd_today(ctx) {
  const { argv } = ctx;
  const status = await statusWithLocalIdentity(adapter);
  const result = await recordTodayTick({ status });
  const memory = await summarizeMemory();
  if (wantsJson(argv)) {
    console.log(JSON.stringify({ ...result, memory }, null, 2));
    process.exit(process.exitCode ?? 0);
  }
  const tick = result.tick;
  console.log(
    [
      "Dema today",
      `  Continuity tick recorded — ${tick.date}`,
      `  NODE0_READY=${tick.node0Ready} · Activation gate: ${tick.activationGate}`,
      `  ${memory.count} memory entries summarized at ${result.path}`,
      `  Next artifact: ${tick.nextArtifact}`,
      humanHintLine("today"),
    ].join("\n"),
  );
  process.exit(process.exitCode ?? 0);
}
