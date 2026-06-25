// `dema genesis` command handler — extracted from index.js (④).
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { wantsJson } from "../../../../packages/core/src/output-mode.js";
import {
  buildGenesisCompositionBlueprintPreview,
  formatGenesisCompositionBlueprintPreview,
} from "../../../../packages/core/src/genesis-composition-blueprint-preview.js";
import { assessBlock0LiveReadiness } from "../../../../packages/genesis/src/block0-live-readiness.js";
import { assessNode0GenesisKeyCeremonyPreflight } from "../../../../packages/genesis/src/node0-genesis-key-ceremony-preflight.js";
import {
  buildBlock0SealCeremonyDryRun,
  formatBlock0SealCeremonyDryRun,
} from "../../../../packages/genesis/src/block0-seal-ceremony-dry-run.js";
import { buildLocalAssetInventory } from "../../../../packages/core/src/local-asset-awareness.js";
import { buildHomebaseAssetAwareness } from "../../../../packages/core/src/homebase-asset-awareness.js";
import {
  buildNode0HistoricalContributionVerification,
  formatNode0HistoricalContributionVerification,
} from "../../../../packages/core/src/node0-historical-contribution-verification.js";
import {
  gatherCanonWitnessMarkers,
  gatherGitTimeSpanEvidence,
} from "./node0-historical-gatherer.js";
import { gatherNode0HardwareObservations } from "./hardware-profile-gatherer.js";

function argValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

function resolveDemaHome() {
  return process.env.DEMA_HOME || join(homedir(), ".dema");
}

// Mirror scripts/node0-genesis-key-ceremony-preflight.mjs — fail closed: missing
// or unreadable provenance → BLOCKED rather than silently proceed.
function loadProvenanceNextGate() {
  const path = join(
    process.cwd(),
    "docs/08-quality/CROSS_REPO_GENESIS_PROVENANCE_2026_06_05.json",
  );
  if (!existsSync(path)) return "BLOCKED_BY_UNRESOLVED_PROVENANCE";
  try {
    const doc = JSON.parse(readFileSync(path, "utf8"));
    return doc.next_gate?.gate ?? "BLOCKED_BY_UNRESOLVED_PROVENANCE";
  } catch {
    return "BLOCKED_BY_UNRESOLVED_PROVENANCE";
  }
}

export async function cmd_genesis(ctx) {
  const { argv } = ctx;
  const genesisSub = argv[1] ?? "";
  const genesisAction = argv[2] ?? "";
  const wantJsonG = wantsJson(argv);
  if (genesisSub === "composition" && genesisAction === "blueprint") {
    const preview = buildGenesisCompositionBlueprintPreview();
    console.log(
      wantJsonG
        ? JSON.stringify(preview, null, 2)
        : formatGenesisCompositionBlueprintPreview(preview),
    );
    process.exit(process.exitCode ?? 0);
  }
  if (genesisSub === "seal" && genesisAction === "preview") {
    // Read-only: assemble the dry-run signing-ceremony preview. No private key is
    // read, no signature is produced, no Block0 is sealed.
    const demaHome = resolveDemaHome();
    const readiness = await assessBlock0LiveReadiness({ demaHome });
    const preflight = await assessNode0GenesisKeyCeremonyPreflight({
      demaHome,
      provenanceNextGate: loadProvenanceNextGate(),
    });
    const preview = buildBlock0SealCeremonyDryRun({ readiness, preflight });
    console.log(
      wantJsonG
        ? JSON.stringify(preview, null, 2)
        : formatBlock0SealCeremonyDryRun(preview),
    );
    process.exit(process.exitCode ?? 0);
  }
  if (genesisSub === "verify-node0") {
    const root = argValue(argv, "--root") || process.cwd();
    const lookbackYears = Number(argValue(argv, "--years") ?? "3");
    const inventory = await buildLocalAssetInventory({ root });
    const awareness = buildHomebaseAssetAwareness({ inventory });
    const git_evidence = await gatherGitTimeSpanEvidence({
      root,
      lookback_years: Number.isFinite(lookbackYears) ? lookbackYears : 3,
    });
    const canon_witnesses = gatherCanonWitnessMarkers({ root });
    const hardware_observation = await gatherNode0HardwareObservations();
    const report = buildNode0HistoricalContributionVerification({
      awareness,
      git_evidence,
      canon_witnesses,
      hardware_observation,
      lookback_years: Number.isFinite(lookbackYears) ? lookbackYears : 3,
    });
    console.log(
      wantJsonG
        ? JSON.stringify(report, null, 2)
        : formatNode0HistoricalContributionVerification(report),
    );
    process.exitCode = report.valid ? 0 : 1;
    process.exit(process.exitCode ?? 0);
  }
  console.error(
    "Usage: dema genesis composition blueprint [--json]\n" +
      "       dema genesis seal preview [--json]\n" +
      "       dema genesis verify-node0 --root <path> [--years 3] [--json]",
  );
  process.exitCode = 1;
  process.exit(process.exitCode ?? 0);
}
