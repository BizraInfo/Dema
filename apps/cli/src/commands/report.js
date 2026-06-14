import {
  buildSafetyReportPreview,
  formatSafetyReportPreview,
} from "../../../../packages/core/src/safety-report.js";

export async function cmd_report(ctx) {
  const { argv, subcommand } = ctx;
  if (subcommand !== "safety") {
    throw new Error(
      "Unknown report command. Use `dema report safety [--json]`.",
    );
  }
  const report = buildSafetyReportPreview();
  console.log(
    argv.includes("--json")
      ? JSON.stringify(report, null, 2)
      : formatSafetyReportPreview(report),
  );
  process.exit(process.exitCode ?? 0);
}
