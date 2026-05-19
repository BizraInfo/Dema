// Shared output-mode helpers for the Dema CLI.
//
// wantsJson(argv)    — true when the caller has explicitly opted into machine
//                      output via --json. Does not consult TTY, env colour
//                      flags, or anything else: the choice is explicit.
//
// humanHintLine(cmd) — trailing line that tells operators how to get JSON.

export function wantsJson(argv) {
  if (!Array.isArray(argv)) return false;
  return argv.includes("--json");
}

export function humanHintLine(commandName) {
  return `Type \`dema ${commandName} --json\` for machine-readable output.`;
}
