import {
  getRubricPack,
  formatRubricPackReport,
} from "../../../../packages/core/src/eval-layer2-rubrics.js";
import {
  validatePastedJudgeVerdict,
  formatVerdictReport,
} from "../../../../packages/core/src/eval-layer2-verdict-validator.js";

export async function cmd_eval(ctx) {
  const { argv } = ctx;
  const evalCommand = argv[1];
  const evalSubcommand = argv[2];
  const asJson = argv.includes("--json");

  if (evalCommand === "baseline") {
    // MODEL-EVAL-BASELINE-1A — local-only model evaluation baseline.
    const { gatherModelEvalBaseline } = await import("./eval-baseline-gatherer.js");
    const { buildModelEvalBaseline } = await import(
      "../../../../packages/core/src/model-eval-baseline.js"
    );
    const suiteIdx = argv.indexOf("--suite");
    const suiteId = suiteIdx !== -1 && argv[suiteIdx + 1] ? argv[suiteIdx + 1] : "bizra-local-small";
    const includeExternalProviders = argv.includes("--include-external");
    const maxIdx = argv.indexOf("--max-models");
    const maxModels = maxIdx !== -1 && Number.isInteger(Number(argv[maxIdx + 1])) && Number(argv[maxIdx + 1]) > 0 ? Number(argv[maxIdx + 1]) : undefined;
    const input = await gatherModelEvalBaseline({ suiteId, includeExternalProviders, ...(maxModels ? { maxModels } : {}) });
    const report = buildModelEvalBaseline(input);
    if (asJson) {
      console.log(JSON.stringify(report, null, 2));
      process.exit(process.exitCode ?? 0);
    }
    console.log(`Model eval baseline (${report.truth_label}) — suite ${report.suite_id}`);
    console.log(`  models: ${report.models_tested.length} tested · ${report.metrics.models_reachable_count} reachable`);
    for (const m of Object.keys(report.results_by_model)) {
      const e = report.results_by_model[m];
      console.log(`  ${m.slice(0, 44).padEnd(44)} pass ${e.pass_count}/6 · ${e.latency_ms_avg ?? "—"}ms`);
    }
    const h = report.routing_hints;
    console.log(`  fastest: ${h.fastest_reachable ?? "—"} · best-json: ${h.best_json_obedience ?? "—"}`);
    console.log(`  baseline_hash: ${report.baseline_hash.slice(0, 16)}…  (LOCAL ONLY · not a leaderboard · does not prove correctness)`);
    process.exit(process.exitCode ?? 0);
  }

  if (evalCommand === "compare") {
    const baseIdx = argv.indexOf("--baseline");
    const candIdx = argv.indexOf("--candidate");
    const basePath = baseIdx !== -1 ? argv[baseIdx + 1] : undefined;
    const candPath = candIdx !== -1 ? argv[candIdx + 1] : undefined;
    if (!basePath || !candPath) {
      throw new Error(
        "Missing paths. Use `dema eval compare --baseline <abs.json> --candidate <abs.json> [--json]`.",
      );
    }
    const { isAbsolute, resolve } = await import("node:path");
    if (!isAbsolute(basePath) || !isAbsolute(candPath)) {
      throw new Error(
        "`dema eval compare` requires absolute paths to both the baseline and candidate JSON files.",
      );
    }
    const { readFile } = await import("node:fs/promises");
    const { compareModelEvalBaselines } = await import(
      "../../../../packages/core/src/model-eval-baseline.js"
    );
    let oldReport, newReport;
    try {
      oldReport = JSON.parse(await readFile(resolve(basePath), "utf8"));
      newReport = JSON.parse(await readFile(resolve(candPath), "utf8"));
    } catch (readErr) {
      throw new Error(`Failed to read or parse a baseline file: ${readErr && readErr.message ? readErr.message : readErr}`);
    }
    const delta = compareModelEvalBaselines(oldReport, newReport);
    if (asJson) {
      console.log(JSON.stringify(delta, null, 2));
    } else if (delta.rejected) {
      console.log(`eval compare → REJECTED (${delta.reason_code})`);
    } else {
      console.log(`eval compare → suite_match=${delta.suite_match} · models +${delta.models_added.length}/-${delta.models_removed.length}`);
      for (const m of Object.keys(delta.per_model_delta)) {
        const d = delta.per_model_delta[m].pass_rate;
        console.log(`  ${m.slice(0, 44).padEnd(44)} pass_rate ${d.before}→${d.after} (${d.delta >= 0 ? "+" : ""}${d.delta})`);
      }
    }
    if (delta.rejected) process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }

  if (evalCommand === "route") {
    // MODEL-ROUTING-PREVIEW-1A — deterministic role->model PREVIEW from a baseline.
    const baseIdx = argv.indexOf("--baseline");
    const basePath = baseIdx !== -1 ? argv[baseIdx + 1] : undefined;
    if (!basePath) {
      throw new Error("Missing path. Use `dema eval route --baseline <abs.json> [--json]`.");
    }
    const { isAbsolute, resolve } = await import("node:path");
    if (!isAbsolute(basePath)) {
      throw new Error("`dema eval route` requires an absolute path to the baseline JSON file.");
    }
    const { readFile } = await import("node:fs/promises");
    const { buildModelRoutingPreview } = await import(
      "../../../../packages/core/src/model-routing-preview.js"
    );
    let baseline;
    try {
      baseline = JSON.parse(await readFile(resolve(basePath), "utf8"));
    } catch (readErr) {
      throw new Error(`Failed to read or parse the baseline file: ${readErr && readErr.message ? readErr.message : readErr}`);
    }
    const generated_at_iso = new Date().toISOString(); // clock lives in the CLI, never the kernel
    const preview = buildModelRoutingPreview({ baseline, generated_at_iso });
    if (asJson) {
      console.log(JSON.stringify(preview, null, 2));
      process.exit(preview.rejected ? 1 : process.exitCode ?? 0);
    }
    if (preview.rejected) {
      console.log(`eval route → REJECTED (${preview.reason_code})`);
      process.exitCode = 1;
    } else {
      console.log(`Model routing PREVIEW (${preview.truth_label}) — baseline ${preview.baseline_hash.slice(0, 16)}…`);
      for (const role of preview.roles) {
        const a = preview.assignments[role];
        console.log(`  ${role.padEnd(16)} → ${a.model ?? "—"}   ${a.reason}`);
      }
      if (preview.unassigned_roles.length) {
        console.log(`  unassigned: ${preview.unassigned_roles.join(", ")} (no qualifying model)`);
      }
      console.log(`  preview_hash: ${preview.preview_hash.slice(0, 16)}…  (PREVIEW · LOCAL ONLY · routes no live traffic · no MoE/council/federation/runtime)`);
    }
    process.exit(process.exitCode ?? 0);
  }

  if (evalCommand !== "layer2") {
    throw new Error(
      "Unknown eval command. Use `dema eval baseline [--suite bizra-local-small] [--json]`, `dema eval compare --baseline <abs.json> --candidate <abs.json> [--json]`, `dema eval route --baseline <abs.json> [--json]`, or `dema eval layer2 prompts|verify ...`.",
    );
  }

  if (evalSubcommand === "prompts") {
    const pack = getRubricPack();
    console.log(
      asJson ? JSON.stringify(pack, null, 2) : formatRubricPackReport(pack),
    );
    process.exit(process.exitCode ?? 0);
  }

  if (evalSubcommand === "verify") {
    const verdictPath = argv[3];
    if (!verdictPath) {
      throw new Error(
        "Missing <abs-path>. Use `dema eval layer2 verify <abs-path-to-pasted-verdict.json> [--json]`.",
      );
    }
    const { isAbsolute: pathIsAbsolute, resolve: pathResolve } =
      await import("node:path");
    if (!pathIsAbsolute(verdictPath)) {
      throw new Error(
        "`dema eval layer2 verify` requires an absolute path to the pasted verdict file.",
      );
    }
    const { readFile: readVerdictFile } = await import("node:fs/promises");
    let parsed;
    try {
      const raw = await readVerdictFile(pathResolve(verdictPath), "utf8");
      parsed = JSON.parse(raw);
    } catch (readErr) {
      throw new Error(
        `Failed to read or parse verdict file at ${verdictPath}: ${readErr && readErr.message ? readErr.message : readErr}`,
      );
    }
    const result = validatePastedJudgeVerdict(parsed);
    console.log(
      asJson ? JSON.stringify(result, null, 2) : formatVerdictReport(result),
    );
    // Exit 0 only when the documented success state holds. truth_label is
    // the authoritative contract surface (see docs/TESTING.md row); gating
    // on it directly prevents drift if a future truth_label value is added.
    if (result.truth_label !== "MEASURED") {
      process.exitCode = 1;
    }
    process.exit(process.exitCode ?? 0);
  }

  throw new Error(
    "Unknown eval layer2 subcommand. Use `dema eval layer2 prompts [--json]` or `dema eval layer2 verify <abs-path> [--json]`.",
  );
}
