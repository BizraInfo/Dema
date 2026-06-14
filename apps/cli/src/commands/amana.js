import {
  buildAmanaContractsPreview,
  formatAmanaContractsPreview,
} from "../../../../packages/core/src/amana-contracts-preview.js";

export async function cmd_amana(ctx) {
  const { argv } = ctx;
  const amanaCommand = argv[1];
  const amanaSubcommand = argv[2];
  if (amanaCommand !== "contracts" || amanaSubcommand !== "preview") {
    throw new Error(
      "Unknown amana command. Use `dema amana contracts preview [--json]`.",
    );
  }
  const preview = buildAmanaContractsPreview();
  console.log(
    argv.includes("--json")
      ? JSON.stringify(preview, null, 2)
      : formatAmanaContractsPreview(preview),
  );
  process.exit(process.exitCode ?? 0);
}
