import {
  buildMcpIntegrationBlueprint,
  formatMcpIntegrationBlueprint,
} from "../../../../packages/core/src/mcp-blueprint.js";

export async function cmd_mcp(ctx) {
  const { argv, subcommand } = ctx;
  if (subcommand !== "blueprint") {
    throw new Error("Unknown mcp command. Use `dema mcp blueprint [--json]`.");
  }
  const blueprint = buildMcpIntegrationBlueprint();
  console.log(
    argv.includes("--json")
      ? JSON.stringify(blueprint, null, 2)
      : formatMcpIntegrationBlueprint(blueprint),
  );
  process.exit(process.exitCode ?? 0);
}
