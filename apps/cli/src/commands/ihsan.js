import {
  DEFAULT_IHSAN_FLOOR,
  evaluateIhsanFloorPreview,
  formatIhsanFloorPreview,
} from "../../../../packages/verifier/src/ihsan-floor-preview.js";

function argValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

export async function cmd_ihsan(ctx) {
  const { argv } = ctx;
  const floorCommand = argv[1];
  const floorSubcommand = argv[2];
  if (floorCommand !== "floor" || floorSubcommand !== "preview") {
    throw new Error(
      "Unknown ihsan command. Use `dema ihsan floor preview [--score N] [--json]`.",
    );
  }
  const scoreArg = argValue(argv, "--score");
  const score = scoreArg === undefined ? DEFAULT_IHSAN_FLOOR : Number(scoreArg);
  const preview = evaluateIhsanFloorPreview({ score });
  console.log(
    argv.includes("--json")
      ? JSON.stringify(preview, null, 2)
      : formatIhsanFloorPreview(preview),
  );
  process.exit(process.exitCode ?? 0);
}
