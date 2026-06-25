import {
  buildLocalAssetInventory,
  writeLocalAssetInventory,
} from "../../../../packages/core/src/local-asset-awareness.js";
import {
  buildHomebaseAssetAwareness,
  renderHomebaseAssetAwarenessSummary,
} from "../../../../packages/core/src/homebase-asset-awareness.js";
import {
  buildHomebaseShareability,
  renderHomebaseShareabilitySummary,
} from "../../../../packages/core/src/homebase-shareability.js";
import { wantsJson } from "../../../../packages/core/src/output-mode.js";

function argValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

async function runAssetScan({ root, wantJson }) {
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

  if (wantJson) {
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

async function runAssetShareability({ root, wantJson }) {
  const inventory = await buildLocalAssetInventory({ root });
  const awareness = buildHomebaseAssetAwareness({ inventory });
  const shareability = buildHomebaseShareability({ awareness });

  const output = Object.freeze({
    ...shareability,
    awareness_summary: Object.freeze({
      records_count: awareness.summary?.records_count ?? 0,
      clusters_count: awareness.clusters?.length ?? 0,
      risk_flags: awareness.risk_flags ?? [],
    }),
  });

  if (wantJson) {
    console.log(JSON.stringify(output, null, 2));
    process.exitCode = shareability.valid ? 0 : 1;
    process.exit(process.exitCode ?? 0);
  }

  if (!shareability.valid) {
    console.error(
      `Dema homebase shareability: failed · ${shareability.error ?? awareness.error ?? "unknown_error"}`,
    );
    process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }

  console.log(renderHomebaseShareabilitySummary(shareability));
  process.exit(process.exitCode ?? 0);
}

export async function cmd_assets(ctx) {
  const { argv } = ctx;
  const sub = argv[1] ?? "";
  const wantJson = wantsJson(argv);
  const root = argValue(argv, "--root") || process.env.DEMA_LOCAL_ASSET_ROOT;

  if (sub === "scan") {
    if (!root) {
      const err = { error: "missing_scan_root", hint: "pass --root <path>" };
      if (wantJson) console.log(JSON.stringify(err, null, 2));
      else console.error("Usage: dema assets scan --root <path> [--json]");
      process.exitCode = 1;
      process.exit(process.exitCode ?? 0);
    }
    await runAssetScan({ root, wantJson });
  }

  if (sub === "shareability") {
    if (!root) {
      const err = {
        error: "missing_shareability_root",
        hint: "pass --root <path>",
      };
      if (wantJson) console.log(JSON.stringify(err, null, 2));
      else {
        console.error("Usage: dema assets shareability --root <path> [--json]");
      }
      process.exitCode = 1;
      process.exit(process.exitCode ?? 0);
    }
    await runAssetShareability({ root, wantJson });
  }

  console.error(
    "Usage: dema assets scan --root <path> [--json]\n" +
      "       dema assets shareability --root <path> [--json]",
  );
  process.exitCode = 1;
  process.exit(process.exitCode ?? 0);
}
