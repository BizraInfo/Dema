import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const commands = [
  ["node", ["scripts/review/env-hygiene-check.mjs", "--strict"]],
  ["node", ["scripts/review/zero-dep-gate.mjs"]],
  ["node", ["scripts/review/kernel-purity-check.mjs"]],
  ["node", ["scripts/review/agent-dna-root-coherence.mjs"]],
  ["node", ["scripts/review/negative-verdict-reason-gate.mjs"]],
  ["node", ["scripts/review/doc-freshness-gate.mjs"]],
  ["node", ["scripts/review/proof-spine-guard.mjs"]],
  ["node", ["scripts/review/fuzz-lite-parser.mjs"]],
  ["node", ["scripts/review/homebase-asset-graph.mjs"]],
  ["node", ["scripts/review/datalake-dual-loop-preview.mjs"]],
  ["node", ["scripts/review/node0-mumu-journey.mjs"]],
  ["node", ["scripts/review/adk-agent-contract.mjs"]],
  ["node", ["scripts/review/adk-test-harness.mjs"]],
  ["node", ["scripts/review/ux-first-look-gate.mjs"]],
  ["node", ["scripts/review/delivery-readiness-gate.mjs"]],
  ["node", ["scripts/review/performance-budget-gate.mjs"]],
  ["node", ["scripts/claims/claim-register-check.mjs"]],
  ["node", ["scripts/claims/generate-public-claims.mjs", "--check"]],
  ["node", ["scripts/claims/claim-corpus-gate.mjs"]],
  ["node", ["--test", "--test-reporter=tap"]],
  ["npm", ["run", "coverage"]],
  ["node", ["apps/cli/src/index.js", "welcome"]],
  ["node", ["apps/cli/src/index.js", "help"]],
  ["node", ["apps/cli/src/index.js", "onboard"]],
  ["node", ["apps/cli/src/index.js", "onboard", "--json"]],
  ["node", ["apps/cli/src/index.js", "roadmap", "preview"]],
  ["node", ["apps/cli/src/index.js", "roadmap", "preview", "--json"]],
  ["node", ["apps/cli/src/index.js", "models"]],
  ["node", ["apps/cli/src/index.js", "evidence", "receipt", "preview"]],
  [
    "node",
    ["apps/cli/src/index.js", "evidence", "receipt", "preview", "--json"],
  ],
  [
    "node",
    ["apps/cli/src/index.js", "ihsan", "floor", "preview", "--score", "0.97"],
  ],
  [
    "node",
    [
      "apps/cli/src/index.js",
      "ihsan",
      "floor",
      "preview",
      "--score",
      "0.97",
      "--json",
    ],
  ],
  [
    "node",
    [
      "apps/cli/src/index.js",
      "behavior",
      "modulation",
      "preview",
      "--consent",
      "GO: preview behavioral modulation only",
      "--score",
      "0.97",
      "Adjust tone to prioritize safety reminders",
    ],
  ],
  [
    "node",
    [
      "apps/cli/src/index.js",
      "behavior",
      "modulation",
      "preview",
      "--consent",
      "GO: preview behavioral modulation only",
      "--score",
      "0.97",
      "--json",
      "Adjust tone to prioritize safety reminders",
    ],
  ],
  ["node", ["apps/cli/src/index.js", "diagnostics", "plan"]],
  ["node", ["apps/cli/src/index.js", "diagnostics", "plan", "--json"]],
  [
    "node",
    ["apps/cli/src/index.js", "consent", "plan", "Fix auth.py and run pytest"],
  ],
  [
    "node",
    ["apps/cli/src/index.js", "mission", "draft", "Fix auth.py and run pytest"],
  ],
  [
    "node",
    [
      "apps/cli/src/index.js",
      "mission",
      "draft",
      "--json",
      "Fix auth.py and run pytest",
    ],
  ],
  ["node", ["apps/cli/src/index.js", "ambient"]],
  ["node", ["apps/cli/src/index.js", "report", "safety"]],
  ["node", ["apps/cli/src/index.js", "mcp", "blueprint"]],
  ["node", ["apps/cli/src/index.js", "mcp", "blueprint", "--json"]],
  ["node", ["apps/cli/src/index.js", "network", "blueprint"]],
  ["node", ["apps/cli/src/index.js", "network", "blueprint", "--json"]],
  ["node", ["apps/cli/src/index.js", "network", "fixture", "preview"]],
  [
    "node",
    ["apps/cli/src/index.js", "network", "fixture", "preview", "--json"],
  ],
  ["node", ["apps/cli/src/index.js", "network", "refusal", "preview"]],
  [
    "node",
    ["apps/cli/src/index.js", "network", "refusal", "preview", "--json"],
  ],
  ["node", ["apps/cli/src/index.js", "amana", "contracts", "preview"]],
  [
    "node",
    ["apps/cli/src/index.js", "amana", "contracts", "preview", "--json"],
  ],
  ["node", ["apps/cli/src/index.js", "design", "emulate-loop"]],
  [
    "node",
    ["apps/cli/src/index.js", "agent-loop", "dual-preview", "--json"],
  ],
  ["node", ["apps/cli/src/index.js", "status"]],
  ["node", ["apps/cli/src/index.js", "bootstrap"]],
  ["node", ["apps/cli/src/index.js", "bootstrap", "--json"]],
  ["node", ["apps/cli/src/index.js", "bootstrap", "--summary"]],
  ["node", ["apps/cli/src/index.js", "seed"]],
  ["node", ["apps/cli/src/index.js", "seed", "--json"]],
  ["node", ["apps/cli/src/index.js", "seed", "--summary"]],
  ["node", ["apps/cli/src/index.js", "proof", "convergence"]],
  ["node", ["apps/cli/src/index.js", "proof", "convergence", "--json"]],
  ["node", ["apps/cli/src/index.js", "proof", "convergence", "--summary"]],
  ["node", ["apps/cli/src/index.js", "mission", "propose"]],
  ["node", ["apps/cli/src/index.js", "monetize"]],
  ["node", ["scripts/review/actuator-check.mjs"]],
  ["node", ["scripts/review/canon-check.mjs"]],
  ["node", ["scripts/review/integration-check.mjs"]],
  ["node", ["scripts/llm-guidance-check.mjs"]],
  ["node", ["scripts/gtm-readiness-check.mjs"]],
  ["node", ["scripts/urp-shared-discovery.mjs"]],
  ["node", ["scripts/review/transition-assurance-check.mjs"]],
  ["node", ["scripts/review/artifact-011-preflight-gate.mjs"]],
  ["node", ["scripts/proof-room-bundle.mjs", "--json"]],
  ["node", ["scripts/node0-self-check.mjs", "--verify"]],
  ["node", ["scripts/review/harness-gate.mjs"]],
  ["node", ["scripts/urp-stage3-closeout.mjs"]],
  ["node", ["scripts/urp-stage4-closeout.mjs"]],
  // Hermetic provenance and resource pool scans (important for root canon and A+ local state).
  // Run before perf so resource scans don't affect perf measurement.
  [
    "node",
    ["scripts/review/cross-repo-genesis-provenance.mjs", "--no-block0"],
    { CROSS_REPO_SKIP_GH: "1" },
  ],
  [
    "node",
    ["scripts/review/node0-local-resource-pool.mjs"],
    { NODE0_POOL_SKIP_SCAN: "1" },
  ],
  // PERF-MEASURE-1A regression-sanity gate: measures keyless hot-path latency +
  // process metrics and fails only on a gross regression (generous ceilings,
  // not SLOs). Runs last so a perf blip never masks a correctness failure.
  ["node", ["scripts/perf-bench.mjs"]],
];

export function runChecks(checks = commands) {
  for (const entry of checks) {
    const [bin, args, extraEnv] = entry;
    console.log(`> ${bin} ${args.join(" ")}`);
    const options = { stdio: "inherit" };
    if (extraEnv && typeof extraEnv === "object") {
      options.env = { ...process.env, ...extraEnv };
    }
    execFileSync(bin, args, options);
  }
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  runChecks();
}
