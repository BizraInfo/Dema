// `dema genesis` command handler — extracted from index.js (④).
import { wantsJson } from "../../../../packages/core/src/output-mode.js";
import {
  buildGenesisCompositionBlueprintPreview,
  formatGenesisCompositionBlueprintPreview,
} from "../../../../packages/core/src/genesis-composition-blueprint-preview.js";

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
  console.error("Usage: dema genesis composition blueprint [--json]");
  process.exitCode = 1;
  process.exit(process.exitCode ?? 0);
}
