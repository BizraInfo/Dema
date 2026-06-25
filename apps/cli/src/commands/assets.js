import {
  buildLocalAssetInventory,
  writeLocalAssetInventory,
} from "../../../../packages/core/src/local-asset-awareness.js";
import {
  buildHomebaseAssetAwareness,
  renderHomebaseAssetAwarenessSummary,
} from "../../../../packages/core/src/homebase-asset-awareness.js";
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
  if (!root) {
    const err = { error: "missing_scan_root", hint: "pass --root <path>" };
    if (wantJsonLocalAssets) {
      console.log(JSON.stringify(err, null, 2));
    } else {
      console.error("Usage: dema assets scan --root <path> [--json]");
    }
    process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }

  const inventory = await buildLocalAssetInventory({ root });
  const awareness = buildHomebaseAssetAwareness({ inventory });

  let output = awareness;
  let writeResult = null;
  if (inventory.valid) {
    writeResult = await writeLocalAssetInventory({
      root,
      inventoryOverride: inventory,
    });
    output = {
      ...awareness,
      inventory_write: Object.freeze({
        written: writeResult.written === true,
        artifact_path: writeResult.artifact_path ?? null,
        inventory_id: writeResult.inventory_id ?? null,
      }),
    };
  }

  if (wantJsonLocalAssets) {
    console.log(JSON.stringify(output, null, 2));
    process.exitCode = awareness.valid ? 0 : 1;
    process.exit(process.exitCode ?? 0);
  }

  if (!awareness.valid) {
    console.error(
      `Dema homebase assets: scan failed · ${awareness.error ?? inventory.error ?? "unknown_error"}`,
    );
    process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }

  console.log(renderHomebaseAssetAwarenessSummary(awareness));
  if (writeResult?.written && writeResult.artifact_path) {
    console.log(`inventory artifact: ${writeResult.artifact_path}`);
  }
  process.exit(process.exitCode ?? 0);
}
