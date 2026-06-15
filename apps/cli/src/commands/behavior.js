import {
  buildBehavioralModulationPreview,
  formatBehavioralModulationPreview,
} from "../../../../packages/core/src/behavioral-modulation.js";

function argValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

export async function cmd_behavior(ctx) {
  const { argv } = ctx;
  const behaviorCommand = argv[1];
  const behaviorSubcommand = argv[2];
  if (behaviorCommand !== "modulation" || behaviorSubcommand !== "preview") {
    throw new Error(
      'Unknown behavior command. Use `dema behavior modulation preview [--consent TEXT] [--score N] [--json] "<intent>"`.',
    );
  }
  const consentPhrase = argValue(argv, "--consent") ?? "";
  const scoreArg = argValue(argv, "--score");
  const ihsanScore = scoreArg === undefined ? 0.95 : Number(scoreArg);
  const intentParts = [];
  for (let index = 3; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") continue;
    if (arg === "--consent" || arg === "--score") {
      index += 1;
      continue;
    }
    intentParts.push(arg);
  }
  const preview = buildBehavioralModulationPreview({
    intent: intentParts.join(" ").trim(),
    consentPhrase,
    ihsanScore,
  });
  console.log(
    argv.includes("--json")
      ? JSON.stringify(preview, null, 2)
      : formatBehavioralModulationPreview(preview),
  );
  process.exit(process.exitCode ?? 0);
}
