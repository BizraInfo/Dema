import { execFileSync } from "node:child_process";

const commands = [
  ["node", ["--test"]],
  ["npm", ["run", "coverage"]],
  ["node", ["apps/cli/src/index.js", "welcome"]],
  ["node", ["apps/cli/src/index.js", "help"]],
  ["node", ["apps/cli/src/index.js", "status"]],
  ["node", ["apps/cli/src/index.js", "mission", "propose"]],
  ["node", ["apps/cli/src/index.js", "monetize"]],
  ["node", ["scripts/review/actuator-check.mjs"]],
  ["node", ["scripts/review/canon-check.mjs"]],
  ["node", ["scripts/llm-guidance-check.mjs"]],
  ["node", ["scripts/node0-self-check.mjs", "--verify"]]
];

for (const [bin, args] of commands) {
  console.log(`> ${bin} ${args.join(" ")}`);
  execFileSync(bin, args, { stdio: "inherit" });
}
