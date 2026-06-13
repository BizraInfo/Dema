// `dema node-registry` command handler — extracted from index.js (④).
import { buildNodeRegistryPreview } from "../../../../packages/core/src/node-registry-preview.js";
import {
  formatNodeRegistryPreview,
  resolveFormatterOptsFromEnv,
} from "../../../../packages/core/src/tui-formatter.js";

export async function cmd_node_registry(ctx) {
  const { argv } = ctx;
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
