import { removeSetup } from "../../../../packages/installer/src/setup.js";

function argValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

export async function cmd_uninstall(ctx) {
  const { argv } = ctx;
  const consent = argValue(argv, "--consent") ?? "";
  const dryRun = argv.includes("--dry-run");
  const result = await removeSetup(undefined, { consent, dryRun });
  console.log(JSON.stringify(result, null, 2));
  if (!result.removed && result.reason !== "dry_run") process.exitCode = 1;
  process.exit(process.exitCode ?? 0);
}
