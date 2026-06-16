// `dema bootstrap` command handler — the model-less ephemeral onboarding preview.
//
// Surfaces the pure Bootstrap Mode kernel (packages/core/src/bootstrap-mode.js)
// through the CLI. Default = human-readable; --summary = compact line;
// --json = the schema-tagged frozen envelope. Writes nothing, invokes no
// model, opens no network — the kernel is pure and this handler only reads it.

import { buildBootstrapModePreview } from "../../../../packages/core/src/bootstrap-mode.js";
import { wantsJson } from "../../../../packages/core/src/output-mode.js";

function formatBootstrap(preview) {
  return [
    "Bootstrap Mode preview (ephemeral · model-less)",
    `  schema:       ${preview.schema}`,
    `  model status: ${preview.model_status}`,
    `  stages:       ${preview.stages.length} · ${preview.stages.join(" → ")}`,
    `  boundary:     all ${Object.keys(preview.boundary).length} effects false (no write · no model · no network)`,
    "",
    `Next safe action: ${preview.next_safe_message}`,
  ].join("\n");
}

function formatBootstrapSummary(preview) {
  return `Bootstrap Mode · ${preview.mode} · model ${preview.model_status} · ${preview.stages.length} stages · ${preview.next_safe_message}`;
}

export function cmd_bootstrap(ctx) {
  const { argv } = ctx;
  const preview = buildBootstrapModePreview();
  if (wantsJson(argv)) {
    console.log(JSON.stringify(preview, null, 2));
  } else if (argv.includes("--summary")) {
    console.log(formatBootstrapSummary(preview));
  } else {
    console.log(formatBootstrap(preview));
  }
  process.exit(process.exitCode ?? 0);
}
