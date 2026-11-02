import { createNode0Adapter } from "../../../../packages/node-adapter/src/node0-adapter.js";
import {
  formatStatus,
  shouldUseColor,
} from "../../../../packages/core/src/status.js";
import {
  buildSystemSnapshot,
  formatSystemSnapshot,
} from "../../../../packages/core/src/system-snapshot.js";
import { wantsJson } from "../../../../packages/core/src/output-mode.js";
import { statusWithLocalIdentity } from "../lib/status-identity.js";
import { loadBirthLoopFace } from "../lib/birth-loop-profile.js";
import { defaultDemaHome } from "../../../../packages/core/src/operator-profile.js";

const adapter = createNode0Adapter();

export async function cmd_status(ctx) {
  const { argv } = ctx;
  if (argv.includes("--full")) {
    const snapshot = buildSystemSnapshot();
    if (wantsJson(argv)) {
      console.log(JSON.stringify(snapshot, null, 2));
    } else {
      console.log(formatSystemSnapshot(snapshot));
    }
    process.exit(process.exitCode ?? 0);
  }
  const status = await statusWithLocalIdentity(adapter);
  const { node_state } = await loadBirthLoopFace(defaultDemaHome());
  const color = argv.includes("--no-color") ? false : shouldUseColor();
  console.log(formatStatus(status, { color, node_state }));
  process.exit(process.exitCode ?? 0);
}

export async function cmd_status_json(ctx) {
  const status = await statusWithLocalIdentity(adapter);
  const { node_state } = await loadBirthLoopFace(defaultDemaHome());
  console.log(JSON.stringify({ ...status, node_state }, null, 2));
  process.exit(process.exitCode ?? 0);
}
