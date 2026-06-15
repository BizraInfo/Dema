import {
  buildNetworkBlueprint,
  formatNetworkBlueprint,
} from "../../../../packages/core/src/network-blueprint.js";
import {
  buildOfflineNetworkFixturePreview,
  formatOfflineNetworkFixturePreview,
} from "../../../../packages/core/src/network-fixture-preview.js";
import {
  buildNetworkRefusalMatrixPreview,
  formatNetworkRefusalMatrixPreview,
} from "../../../../packages/core/src/network-refusal-matrix-preview.js";

export async function cmd_network(ctx) {
  const { argv, subcommand } = ctx;
  if (subcommand === "blueprint") {
    const blueprint = buildNetworkBlueprint();
    console.log(
      argv.includes("--json")
        ? JSON.stringify(blueprint, null, 2)
        : formatNetworkBlueprint(blueprint),
    );
    process.exit(process.exitCode ?? 0);
  }
  if (subcommand === "fixture" && argv[2] === "preview") {
    const preview = buildOfflineNetworkFixturePreview();
    console.log(
      argv.includes("--json")
        ? JSON.stringify(preview, null, 2)
        : formatOfflineNetworkFixturePreview(preview),
    );
    process.exit(process.exitCode ?? 0);
  }
  if (subcommand === "refusal" && argv[2] === "preview") {
    const preview = buildNetworkRefusalMatrixPreview();
    console.log(
      argv.includes("--json")
        ? JSON.stringify(preview, null, 2)
        : formatNetworkRefusalMatrixPreview(preview),
    );
    process.exit(process.exitCode ?? 0);
  }
  throw new Error(
    "Unknown network command. Use `dema network blueprint [--json]`, `dema network fixture preview [--json]`, or `dema network refusal preview [--json]`.",
  );
}
