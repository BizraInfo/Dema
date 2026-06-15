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
  const color = argv.includes("--no-color") ? false : shouldUseColor();
  console.log(formatStatus(status, { color }));
  process.exit(process.exitCode ?? 0);
}

export async function cmd_status_json(ctx) {
  const status = await statusWithLocalIdentity(adapter);
  console.log(JSON.stringify(status, null, 2));
  process.exit(process.exitCode ?? 0);
}
