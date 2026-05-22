import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const commands = [
  ["node", ["scripts/review/env-hygiene-check.mjs"]],
  ["node", ["--test"]],
  ["npm", ["run", "coverage"]],
  ["node", ["apps/cli/src/index.js", "welcome"]],
  ["node", ["apps/cli/src/index.js", "help"]],
  ["node", ["apps/cli/src/index.js", "onboard"]],
  ["node", ["apps/cli/src/index.js", "onboard", "--json"]],
  ["node", ["apps/cli/src/index.js", "roadmap", "preview"]],
  ["node", ["apps/cli/src/index.js", "roadmap", "preview", "--json"]],
  ["node", ["apps/cli/src/index.js", "models"]],
  ["node", ["apps/cli/src/index.js", "evidence", "receipt", "preview"]],
  ["node", ["apps/cli/src/index.js", "evidence", "receipt", "preview", "--json"]],
  ["node", ["apps/cli/src/index.js", "ihsan", "floor", "preview", "--score", "0.97"]],
  ["node", ["apps/cli/src/index.js", "ihsan", "floor", "preview", "--score", "0.97", "--json"]],
  ["node", ["apps/cli/src/index.js", "behavior", "modulation", "preview", "--consent", "GO: preview behavioral modulation only", "--score", "0.97", "Adjust tone to prioritize safety reminders"]],
  ["node", ["apps/cli/src/index.js", "behavior", "modulation", "preview", "--consent", "GO: preview behavioral modulation only", "--score", "0.97", "--json", "Adjust tone to prioritize safety reminders"]],
  ["node", ["apps/cli/src/index.js", "diagnostics", "plan"]],
  ["node", ["apps/cli/src/index.js", "diagnostics", "plan", "--json"]],
  ["node", ["apps/cli/src/index.js", "consent", "plan", "Fix auth.py and run pytest"]],
  ["node", ["apps/cli/src/index.js", "mission", "draft", "Fix auth.py and run pytest"]],
  ["node", ["apps/cli/src/index.js", "mission", "draft", "--json", "Fix auth.py and run pytest"]],
  ["node", ["apps/cli/src/index.js", "ambient"]],
  ["node", ["apps/cli/src/index.js", "report", "safety"]],
  ["node", ["apps/cli/src/index.js", "mcp", "blueprint"]],
  ["node", ["apps/cli/src/index.js", "mcp", "blueprint", "--json"]],
  ["node", ["apps/cli/src/index.js", "network", "blueprint"]],
  ["node", ["apps/cli/src/index.js", "network", "blueprint", "--json"]],
  ["node", ["apps/cli/src/index.js", "network", "fixture", "preview"]],
  ["node", ["apps/cli/src/index.js", "network", "fixture", "preview", "--json"]],
  ["node", ["apps/cli/src/index.js", "network", "refusal", "preview"]],
  ["node", ["apps/cli/src/index.js", "network", "refusal", "preview", "--json"]],
  ["node", ["apps/cli/src/index.js", "amana", "contracts", "preview"]],
  ["node", ["apps/cli/src/index.js", "amana", "contracts", "preview", "--json"]],
  ["node", ["apps/cli/src/index.js", "design", "emulate-loop"]],
  ["node", ["apps/cli/src/index.js", "status"]],
  ["node", ["apps/cli/src/index.js", "mission", "propose"]],
  ["node", ["apps/cli/src/index.js", "monetize"]],
  ["node", ["scripts/review/actuator-check.mjs"]],
  ["node", ["scripts/review/canon-check.mjs"]],
  ["node", ["scripts/review/integration-check.mjs"]],
  ["node", ["scripts/llm-guidance-check.mjs"]],
  ["node", ["scripts/gtm-readiness-check.mjs"]],
  ["node", ["scripts/urp-shared-discovery.mjs"]],
  ["node", ["scripts/proof-room-bundle.mjs", "--json"]],
  ["node", ["scripts/node0-self-check.mjs", "--verify"]]
];

export function runChecks(checks = commands) {
  for (const [bin, args] of checks) {
    console.log(`> ${bin} ${args.join(" ")}`);
    execFileSync(bin, args, { stdio: "inherit" });
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  runChecks();
}
