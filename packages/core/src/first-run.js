// dema first-run — composes the 5 honest first steps for a non-technical
// user into one entry command. Pure plan builder + formatter. Execution
// happens at the CLI layer (apps/cli/src/index.js); this module only
// describes the plan and renders the human/JSON output around it.

export const FIRST_RUN_SCHEMA = "bizra.dema.first_run.v0.1";

// Canonical 5-step plan. The labels mirror README "First run" exactly so
// the prose and the runtime cannot drift.
export const FIRST_RUN_STEPS = Object.freeze([
  Object.freeze({
    id: "welcome",
    label: "Welcome",
    command: "dema welcome",
    description: "Read the product promise. No side effects."
  }),
  Object.freeze({
    id: "setup",
    label: "Setup",
    command: "dema setup",
    description: "Create ~/.dema/ (idempotent, non-destructive). Writes only inside DEMA_HOME."
  }),
  Object.freeze({
    id: "status",
    label: "Status",
    command: "dema status",
    description: "Show what is ready and what is blocked. Read-only."
  }),
  Object.freeze({
    id: "doctor",
    label: "Doctor",
    command: "dema doctor",
    description: "Row-by-row readiness check with fix hints. Read-only."
  }),
  Object.freeze({
    id: "next",
    label: "Next safe action",
    command: "(suggestion only)",
    description: "Single suggested next command based on the doctor verdict."
  })
]);

const BOUNDARY = Object.freeze({
  read_only: false, // setup writes to DEMA_HOME on first run
  network: false,
  mint: false,
  external_send: false,
  urp_runtime: false,
  filesystem_write_performed_by_setup: true
});

const DRY_RUN_BOUNDARY = Object.freeze({
  ...BOUNDARY,
  read_only: true,
  filesystem_write_performed_by_setup: false
});

export function buildFirstRunPlan({ dry_run = false } = {}) {
  return Object.freeze({
    schema: FIRST_RUN_SCHEMA,
    mode: dry_run ? "DRY_RUN" : "EXECUTE",
    steps: FIRST_RUN_STEPS,
    next_safe_action: "Run `dema first-run` to step through · `--dry-run` to preview only · `--json` for machine output",
    boundary: dry_run ? DRY_RUN_BOUNDARY : BOUNDARY
  });
}

export function formatFirstRunPlan(plan) {
  const lines = [
    "DEMA · first-run plan",
    "",
    `Schema: ${plan.schema}`,
    `Mode:   ${plan.mode}`,
    "",
    "Steps:"
  ];
  plan.steps.forEach((s, i) => {
    lines.push(`  ${i + 1}. ${s.label.padEnd(18)} ${s.command}`);
    lines.push(`     ${s.description}`);
  });
  lines.push(
    "",
    `Next: ${plan.next_safe_action}`,
    "",
    "Boundary:",
    `  read_only:                              ${plan.boundary.read_only}`,
    `  network:                                ${plan.boundary.network}`,
    `  mint:                                   ${plan.boundary.mint}`,
    `  external_send:                          ${plan.boundary.external_send}`,
    `  urp_runtime:                            ${plan.boundary.urp_runtime}`,
    `  filesystem_write_performed_by_setup:    ${plan.boundary.filesystem_write_performed_by_setup}`
  );
  return lines.join("\n");
}

export function summarizeFirstRunOutcome({ status, predicates, dry_run = false } = {}) {
  const failed = Array.isArray(predicates)
    ? predicates.filter((p) => p && p.status === "fail")
    : [];
  const ok = failed.length === 0;
  return Object.freeze({
    schema: "bizra.dema.first_run_outcome.v0.1",
    mode: dry_run ? "DRY_RUN" : "EXECUTE",
    ok,
    failed_predicates: Object.freeze(failed.map((p) => p.key)),
    suggested_next: ok
      ? "Try `dema journey \"Fix auth.py and run pytest\"` to preview a bounded mission"
      : `Resolve doctor predicates: ${failed.map((p) => p.key).join(", ")} (run \`dema doctor\` for fix hints)`,
    status_snapshot_present: status !== null && status !== undefined
  });
}
