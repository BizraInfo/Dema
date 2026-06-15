import {
  writeLocalAssetInventory,
  renderLocalAssetInventorySummary,
} from "../../../../packages/core/src/local-asset-awareness.js";
import { wantsJson } from "../../../../packages/core/src/output-mode.js";

function argValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

export async function cmd_assets(ctx) {
  const { argv } = ctx;
  const sub = argv[1] ?? "";
  const wantJsonLocalAssets = wantsJson(argv);
  if (sub !== "scan") {
    console.error("Usage: dema assets scan --root <path> [--json]");
    process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }

  const root = argValue(argv, "--root") || process.env.DEMA_LOCAL_ASSET_ROOT;
  const result = await writeLocalAssetInventory({ root });
  if (wantJsonLocalAssets) {
    console.log(JSON.stringify(result, null, 2));
  } else if (result.written) {
    console.log(renderLocalAssetInventorySummary(result));
  } else {
    console.error(
      `Dema local assets: inventory not written · ${result.error ?? "unknown_error"}`,
    );
    process.exitCode = 1;
  }
  process.exit(process.exitCode ?? 0);
}
