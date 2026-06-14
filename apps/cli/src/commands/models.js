import {
  buildLocalModelInventoryScan,
  buildLocalModelInventorySummary,
} from "../../../../packages/core/src/local-model-inventory-scan.js";
import {
  collectModelInventory,
  formatModelInventory,
} from "../../../../packages/models/src/model-inventory.js";
import { createSpinner } from "../../../../packages/core/src/spinner.js";
import {
  wantsJson,
  humanHintLine,
} from "../../../../packages/core/src/output-mode.js";

export async function cmd_models(ctx) {
  const { argv, subcommand } = ctx;
  // dema models scan [--json]      → C1.5 · schema-tagged local inventory scan
  // dema models                    → existing human-readable inventory
  if (subcommand === "scan") {
    const spinner = createSpinner({
      stdout: process.stdout,
      label: "Scanning local model inventory…",
    });
    spinner.start();
    const scan = await buildLocalModelInventoryScan();
    spinner.stop();
    const scanOutput = argv.includes("--summary")
      ? buildLocalModelInventorySummary(scan)
      : scan;
    if (wantsJson(argv)) {
      console.log(JSON.stringify(scanOutput, null, 2));
      process.exit(process.exitCode ?? 0);
    }
    const providers = scan.providers || {};
    const ollama = providers.ollama || {};
    const lms = providers.lm_studio || {};
    const dl = providers.downloads || {};
    console.log(
      [
        "Dema models scan",
        `  Total models found: ${scan.total_models ?? 0}`,
        `  Ollama: ${ollama.reachable ? "reachable" : "unreachable"} · ${ollama.model_count ?? 0} model(s)`,
        `  LM Studio: ${lms.reachable ? "reachable" : "unreachable"} · ${lms.model_count ?? 0} model(s)`,
        `  Downloads: ${dl.model_count ?? 0} GGUF file(s)`,
        `  Boundary: read-only; local probes only; no model invoked`,
        humanHintLine("models scan"),
      ].join("\n"),
    );
    process.exit(process.exitCode ?? 0);
  }
  const inventory = await collectModelInventory();
  console.log(formatModelInventory(inventory));
  process.exit(process.exitCode ?? 0);
}
