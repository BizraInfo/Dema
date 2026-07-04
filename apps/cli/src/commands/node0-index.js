import {
  buildNode0SpaceIndex,
  renderNode0SpaceIndexSummary,
} from "../../../../packages/core/src/node0-space-index.js";
import { wantsJson } from "../../../../packages/core/src/output-mode.js";

function argValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

function fail(argv, message) {
  const payload = {
    schema: "bizra.dema.node0_space_index_cli_error.v0.1",
    truth_label: "NODE0_LOCAL_SEED_UNAVAILABLE",
    error: message,
  };
  if (wantsJson(argv)) console.log(JSON.stringify(payload, null, 2));
  else console.error(`Dema node0-index: ${message}`);
  process.exitCode = 1;
  process.exit(process.exitCode);
}

export async function cmd_node0_index(ctx) {
  const argv = ctx.argv || [];
  const root = argValue(argv, "--root");
  if (!root) fail(argv, "missing_root");

  const out = await buildNode0SpaceIndex({
    root,
    hashContent: argv.includes("--hash-content"),
    consentPhrase: argValue(argv, "--consent") || "",
    demaHome: process.env.DEMA_HOME,
    checkpoint: !argv.includes("--no-checkpoint"),
  });

  if (wantsJson(argv)) console.log(JSON.stringify(out, null, 2));
  else console.log(renderNode0SpaceIndexSummary(out));

  process.exitCode = out.error ? 1 : 0;
  process.exit(process.exitCode);
}
