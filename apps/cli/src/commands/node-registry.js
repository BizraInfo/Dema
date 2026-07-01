// `dema node-registry` command handler — extracted from index.js (④).
import { buildNodeRegistryPreview } from "../../../../packages/core/src/node-registry-preview.js";
import {
  buildMobileCompanionRegisterPreview,
  renderMobileCompanionRegisterPreview,
} from "../../../../packages/core/src/mobile-companion-register-preview.js";
import {
  formatNodeRegistryPreview,
  resolveFormatterOptsFromEnv,
} from "../../../../packages/core/src/tui-formatter.js";
import { wantsJson } from "../../../../packages/core/src/output-mode.js";

function argValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

export async function cmd_node_registry(ctx) {
  const { argv, subcommand } = ctx;

  if (subcommand === "companion-register") {
    const preview = buildMobileCompanionRegisterPreview({
      offered_consent: argValue(argv, "--consent") ?? null,
    });
    if (wantsJson(argv)) {
      console.log(JSON.stringify(preview, null, 2));
      process.exit(process.exitCode ?? 0);
    }
    console.log(renderMobileCompanionRegisterPreview(preview));
    process.exit(process.exitCode ?? 0);
  }

  const preview = buildNodeRegistryPreview();
  if (argv.includes("--pretty")) {
    console.log(
      formatNodeRegistryPreview(preview, resolveFormatterOptsFromEnv()),
    );
    process.exit(process.exitCode ?? 0);
  }
  console.log(JSON.stringify(preview, null, 2));
  process.exit(process.exitCode ?? 0);
}
