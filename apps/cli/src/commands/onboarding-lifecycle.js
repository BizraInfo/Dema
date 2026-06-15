// `dema onboarding-lifecycle` command handler — extracted from index.js (④).
import { buildOnboardingLifecyclePreview } from "../../../../packages/core/src/onboarding-lifecycle.js";
import {
  formatOnboardingLifecyclePreview,
  resolveFormatterOptsFromEnv,
} from "../../../../packages/core/src/tui-formatter.js";

export async function cmd_onboarding_lifecycle(ctx) {
  const { argv } = ctx;
  const preview = buildOnboardingLifecyclePreview();
  if (argv.includes("--json")) {
    console.log(JSON.stringify(preview, null, 2));
    process.exit(process.exitCode ?? 0);
  }
  // Default: pretty TUI on TTY, JSON when redirected
  if (process.stdout.isTTY) {
    console.log(
      formatOnboardingLifecyclePreview(preview, resolveFormatterOptsFromEnv()),
    );
  } else {
    console.log(JSON.stringify(preview, null, 2));
  }
  process.exit(process.exitCode ?? 0);
}
