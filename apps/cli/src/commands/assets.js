import {
  buildLocalAssetInventory,
  writeLocalAssetInventory,
} from "../../../../packages/core/src/local-asset-awareness.js";
import { buildHomebaseScanConsent } from "../../../../packages/core/src/homebase-scan-consent.js";
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

/** Set process.exitCode and return — never process.exit mid-evidence. */
function finish(code) {
  process.exitCode = code;
}

async function runAssetScan({ root, wantJson, offeredConsent }) {
  const consent = buildHomebaseScanConsent({ offeredConsent, scanRoot: root });
  if (!consent.scan_allowed) {
    const refused = offeredConsent !== null && !consent.consent_verified;
    if (wantJson) {
      console.log(
        JSON.stringify(
          { ...consent, scan_performed: false, scan_result: null },
          null,
          2,
        ),
      );
    } else {
      const instruction = refused
        ? `Refused — the phrase did not match exactly. Expected: "${consent.expected_consent_phrase}"`
        : `To proceed: add --consent "${consent.expected_consent_phrase}" to this command.`;
      console.log([...consent.explanation_lines, instruction].join("\n"));
    }
    finish(refused ? 1 : 0);
    return;
  }

  const inventory = await buildLocalAssetInventory({ root });
  const awareness = buildHomebaseAssetAwareness({ inventory });

  let output = {
    ...awareness,
    consent_verified: true,
    scan_performed: true,
  };
  let writeResult = null;
  if (inventory.valid) {
    writeResult = await writeLocalAssetInventory({
      root,
      inventoryOverride: inventory,
    });
    output = {
      ...output,
      inventory_write: Object.freeze({
        written: writeResult.written === true,
        artifact_path: writeResult.artifact_path ?? null,
        inventory_id: writeResult.inventory_id ?? null,
      }),
    };
  }

  if (wantJson) {
    console.log(JSON.stringify(output, null, 2));
    finish(awareness.valid ? 0 : 1);
    return;
  }

  if (!awareness.valid) {
    console.error(
      `Dema homebase assets: scan failed · ${awareness.error ?? inventory.error ?? "unknown_error"}`,
    );
    finish(1);
    return;
  }

  console.log(renderHomebaseAssetAwarenessSummary(awareness));
  if (writeResult?.written && writeResult.artifact_path) {
    console.log(`inventory artifact: ${writeResult.artifact_path}`);
  }
  finish(0);
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
    finish(shareability.valid ? 0 : 1);
    return;
  }

  if (!shareability.valid) {
    console.error(
      `Dema homebase shareability: failed · ${shareability.error ?? awareness.error ?? "unknown_error"}`,
    );
    finish(1);
    return;
  }

  console.log(renderHomebaseShareabilitySummary(shareability));
  finish(0);
}

export async function cmd_assets(ctx) {
  const { argv } = ctx;
  const sub = argv[1] ?? "";
  const wantJson = wantsJson(argv);
  const root = argValue(argv, "--root") || process.env.DEMA_LOCAL_ASSET_ROOT;
  const offeredConsent = argValue(argv, "--consent") ?? null;

  if (sub === "scan") {
    if (!root) {
      const err = { error: "missing_scan_root", hint: "pass --root <path>" };
      if (wantJson) console.log(JSON.stringify(err, null, 2));
      else {
        console.error(
          'Usage: dema assets scan --root <path> [--consent "<phrase>"] [--json]',
        );
      }
      finish(1);
      return;
    }
    await runAssetScan({ root, wantJson, offeredConsent });
    return;
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
      finish(1);
      return;
    }
    await runAssetShareability({ root, wantJson });
    return;
  }

  console.error(
    'Usage: dema assets scan --root <path> [--consent "<phrase>"] [--json]\n' +
      "       dema assets shareability --root <path> [--json]",
  );
  finish(1);
}
