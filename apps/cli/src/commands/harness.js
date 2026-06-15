// `dema harness` command handler — extracted from index.js (④).
import {
  buildHarnessIntegration,
  buildHarnessIntegrationSummary,
  formatHarnessIntegration,
  formatHarnessIntegrationSummary,
} from "../../../../packages/core/src/harness-integration.js";

export async function cmd_harness(ctx) {
  const { argv } = ctx;
  const harness = argv.includes("--summary")
    ? buildHarnessIntegrationSummary()
    : buildHarnessIntegration();
  if (argv.includes("--json")) {
    console.log(JSON.stringify(harness, null, 2));
  } else if (argv.includes("--summary")) {
    console.log(formatHarnessIntegrationSummary(harness));
  } else {
    console.log(formatHarnessIntegration(harness));
  }
  process.exit(process.exitCode ?? 0);
}
