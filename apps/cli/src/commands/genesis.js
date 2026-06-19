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
  console.error(
    "Usage: dema genesis composition blueprint [--json]\n" +
      "       dema genesis seal preview [--json]",
  );
  process.exitCode = 1;
  process.exit(process.exitCode ?? 0);
}
