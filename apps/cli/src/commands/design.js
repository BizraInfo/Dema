import {
  emulateLoopDesign,
  formatLoopDesignEmulation,
} from "../../../../packages/core/src/loop-emulator.js";

export async function cmd_design(ctx) {
  const { argv, subcommand } = ctx;
  if (subcommand !== "emulate-loop") {
    throw new Error(
      "Unknown design command. Use `dema design emulate-loop [--json]`.",
    );
  }
  const report = emulateLoopDesign();
  console.log(
    argv.includes("--json")
      ? JSON.stringify(report, null, 2)
      : formatLoopDesignEmulation(report),
  );
  process.exit(process.exitCode ?? 0);
}
