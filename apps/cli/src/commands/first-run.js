import { createNode0Adapter } from "../../../../packages/node-adapter/src/node0-adapter.js";
import {
  formatStatus,
  shouldUseColor,
} from "../../../../packages/core/src/status.js";
import {
  buildFirstRunPlan,
  formatFirstRunPlan,
  summarizeFirstRunOutcome,
} from "../../../../packages/core/src/first-run.js";
import {
  buildOnboardingGuide,
  formatOnboardingGuide,
} from "../../../../packages/core/src/onboarding.js";
import { runSetup } from "../../../../packages/installer/src/setup.js";
import {
  evaluatePredicates,
  formatDoctorDashboard,
} from "../../../../packages/core/src/doctor-dashboard.js";
import { statusWithLocalIdentity } from "../lib/status-identity.js";

const adapter = createNode0Adapter();

export async function cmd_first_run(ctx) {
  const { argv } = ctx;
  const dryRun = argv.includes("--dry-run");
  const wantJson = argv.includes("--json");
  const plan = buildFirstRunPlan({ dry_run: dryRun });

  if (wantJson && argv.includes("--plan-only")) {
    console.log(JSON.stringify(plan, null, 2));
    process.exit(process.exitCode ?? 0);
  }

  // Human header. In JSON mode we still emit the header on stderr so
  // stdout stays machine-parseable.
  const headerStream = wantJson ? process.stderr : process.stdout;
  headerStream.write(formatFirstRunPlan(plan) + "\n\n");

  // Step 1: welcome
  headerStream.write("==> 1. Welcome\n");
  headerStream.write(formatOnboardingGuide(buildOnboardingGuide()) + "\n\n");

  // Step 2: setup (skipped under --dry-run)
  headerStream.write("==> 2. Setup\n");
  if (dryRun) {
    headerStream.write(
      "[dry-run] would call runSetup() · would create ~/.dema/ if missing\n\n",
    );
  } else {
    const result = await runSetup();
    headerStream.write(JSON.stringify(result, null, 2) + "\n\n");
  }

  // Step 3: status
  headerStream.write("==> 3. Status\n");
  const status = await statusWithLocalIdentity(adapter);
  const color = !argv.includes("--no-color") && shouldUseColor();
  headerStream.write(formatStatus(status, { color }) + "\n\n");

  // Step 4: doctor
  headerStream.write("==> 4. Doctor\n");
  const predicates = evaluatePredicates(status);
  const noColor =
    Boolean(process.env.NO_COLOR) ||
    process.env.TERM === "dumb" ||
    argv.includes("--no-color");
  headerStream.write(
    formatDoctorDashboard(predicates, { color: !noColor }) + "\n\n",
  );

  // Step 5: next safe action
  headerStream.write("==> 5. Next safe action\n");
  const outcome = summarizeFirstRunOutcome({
    status,
    predicates,
    dry_run: dryRun,
  });
  headerStream.write(outcome.suggested_next + "\n");

  if (wantJson) {
    // stdout payload (machine-parseable) — separate from human header.
    console.log(JSON.stringify({ plan, outcome, predicates, status }, null, 2));
  }

  // first-run exit semantics: the COMMAND succeeded if it walked all 5
  // steps. Doctor verdicts are informational and surfaced via
  // outcome.suggested_next, not via exit code. The operator should
  // never see a "first-run failed" error simply because the system
  // is not yet fully ready — that's exactly the state first-run is
  // designed to help diagnose.
  process.exitCode = 0;
  process.exit(process.exitCode ?? 0);
}
