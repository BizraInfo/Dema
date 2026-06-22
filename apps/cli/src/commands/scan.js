// `dema scan` command — HOMEBASE-SCAN-CONSENT-1A.
//
// Consent-gated homebase metadata scan. With no consent it shows the ceremony
// (what Dema will and will NOT do) and stops. With the exact phrase it runs the
// EXISTING metadata-only scanner (local-asset-awareness.js) — no file content
// read, no symlink follow, no scanned-root mutation, writing only an inventory
// artifact under DEMA_HOME. Any other phrase is refused. The consent decision
// is the pure kernel's; the filesystem work lives only here.
import { homedir } from "node:os";
import { join } from "node:path";
import { buildHomebaseScanConsent } from "../../../../packages/core/src/homebase-scan-consent.js";
import {
  writeLocalAssetInventory,
  renderLocalAssetInventorySummary,
} from "../../../../packages/core/src/local-asset-awareness.js";
import { wantsJson } from "../../../../packages/core/src/output-mode.js";

function argValue(argv, name) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

// Mirrors local-asset-awareness.js defaultRoot(): the homebase root the scanner
// will inspect, disclosed up front so consent is informed.
function resolveScanRoot() {
  return process.env.DEMA_LOCAL_ASSET_ROOT || join(homedir(), "Downloads");
}

export async function cmd_scan(ctx) {
  const { argv } = ctx;
  const offeredConsent = argValue(argv, "--consent") ?? null;
  const scanRoot = resolveScanRoot();
  const consent = buildHomebaseScanConsent({ offeredConsent, scanRoot });
  const json = wantsJson(argv);

  if (!consent.scan_allowed) {
    const refused = offeredConsent !== null && !consent.consent_verified;
    if (json) {
      console.log(
        JSON.stringify(
          { ...consent, scan_performed: false, scan_result: null },
          null,
          2,
        ),
      );
    } else {
      const lines = [...consent.explanation_lines];
      lines.push(
        refused
          ? `Refused — the phrase did not match exactly. Expected: "${consent.expected_consent_phrase}"`
          : `To proceed: dema scan --consent "${consent.expected_consent_phrase}"`,
      );
      console.log(lines.join("\n"));
    }
    // Refused attempt is exit 1 so scripts can detect it; the bare ceremony
    // (no consent offered) is informational, exit 0.
    process.exit(refused ? 1 : (process.exitCode ?? 0));
  }

  // Exact consent verified — run the existing metadata-only scanner + write the
  // inventory under DEMA_HOME. Its result carries its own verified boundary.
  const scanResult = await writeLocalAssetInventory({ root: scanRoot });

  if (json) {
    console.log(
      JSON.stringify(
        { ...consent, scan_performed: true, scan_result: scanResult },
        null,
        2,
      ),
    );
  } else {
    console.log(
      [
        renderLocalAssetInventorySummary(scanResult),
        "Metadata only · no file contents read · no upload · no symlink follow · scanned root not mutated.",
      ].join("\n"),
    );
  }
  process.exit(process.exitCode ?? 0);
}
