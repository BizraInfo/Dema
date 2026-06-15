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

  if (evalCommand !== "layer2") {
    throw new Error(
      "Unknown eval command. Use `dema eval layer2 prompts [--json]` or `dema eval layer2 verify <abs-path> [--json]`.",
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
