import {
  buildLocalModelInventoryScan,
  buildLocalModelInventorySummary,
} from "../../../../packages/core/src/local-model-inventory-scan.js";
import { buildModelCatalogEntry } from "../../../../packages/core/src/model-catalog.js";
import {
  collectModelInventory,
  formatModelInventory,
} from "../../../../packages/models/src/model-inventory.js";
import { createSpinner } from "../../../../packages/core/src/spinner.js";
import {
  wantsJson,
  humanHintLine,
} from "../../../../packages/core/src/output-mode.js";

function argValue(argv, name) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

export async function cmd_models(ctx) {
  const { argv, subcommand } = ctx;
  // dema models scan [--json]      → C1.5 · schema-tagged local inventory scan
  // dema models catalog ...        → provider-aware name annotate/validate
  // dema models                    → existing human-readable inventory
  if (subcommand === "catalog") {
    // PROVIDER-AWARE-MODEL-CATALOG-1A — annotate/validate a (provider, model)
    // pairing. No subprocess, no network, no model call. Router stays authoritative.
    const entry = buildModelCatalogEntry({
      provider: argValue(argv, "--provider"),
      model: argValue(argv, "--model"),
    });
    if (wantsJson(argv)) {
      console.log(JSON.stringify(entry, null, 2));
      process.exit(process.exitCode ?? 0);
    }
    const p = entry.parsed;
    console.log(
      [
        "Dema models catalog (annotate/validate · no subprocess · no network · no model call)",
        `  Provider: ${entry.provider ?? entry.requested_provider} (known: ${entry.provider_known}${entry.provider_is_legacy ? " · legacy" : ""})`,
        `  Model: ${entry.model || "(none)"} · shape: ${entry.name_shape}`,
        `  Parsed: publisher=${p.publisher ?? "-"} · family=${p.family ?? "-"} · tag=${p.tag ?? "-"} · quant=${p.quant ?? "-"} · gguf=${p.is_gguf}`,
        `  Router allows (authoritative): ${entry.router_model_allowed} · shape typical: ${entry.shape_typical_for_provider}`,
        `  Compatibility: ${entry.compatibility}`,
        ...entry.annotations.map((a) => `    • ${a}`),
        humanHintLine("models catalog"),
      ].join("\n"),
    );
    process.exit(process.exitCode ?? 0);
  }
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
