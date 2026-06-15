// `dema setup` command handler — extracted from index.js (④).
import { runSetup } from "../../../../packages/installer/src/setup.js";
import { runSetupWizard } from "../../../../packages/core/src/setup-wizard.js";

export async function cmd_setup(ctx) {
  const { argv } = ctx;
  const isJsonMode = argv.includes("--json") || !process.stdout.isTTY;
  if (isJsonMode) {
    console.log(JSON.stringify(await runSetup(), null, 2));
  } else {
    await runSetupWizard();
    await runSetup();
  }
  process.exit(process.exitCode ?? 0);
}
