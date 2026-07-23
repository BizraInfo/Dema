import { execFileSync } from "node:child_process";
import { writeSync } from "node:fs";
import { pathToFileURL } from "node:url";
import {
  CHECK_GATE_EVIDENCE_FD_ENV,
  checkGateComplete,
  checkGateFailure,
  checkGateStart,
} from "./ci/check-gate-evidence.mjs";

function writeCheckGateEvidence(record) {
  const rawFd = process.env[CHECK_GATE_EVIDENCE_FD_ENV];
  if (rawFd === undefined) return;
  const fd = /^\d+$/.test(rawFd) ? Number(rawFd) : Number.NaN;
  if (!Number.isSafeInteger(fd) || fd < 3) {
    throw new Error(`${CHECK_GATE_EVIDENCE_FD_ENV} must name an inherited fd >= 3`);
  }
  writeSync(fd, `${JSON.stringify(record)}\n`);
}

export const commands = [
  ["node", ["scripts/review/env-hygiene-check.mjs", "--strict"]],
  ["node", ["scripts/review/identity-pair-coherence-check.mjs"]],
  ["node", ["scripts/review/cli-consent-matrix-check.mjs"]],
  ["node", ["scripts/review/operator-bridge-threat-model-check.mjs"]],
  ["node", ["scripts/review/consent-bridge-parity-check.mjs"]],
  ["node", ["scripts/review/node0-activation-chain-smoke.mjs"]],
  ["node", ["scripts/review/pat-sat-blackboard-dry-run-check.mjs"]],
  ["node", ["scripts/review/bizra-genesis-blueprint-check.mjs"]],
  ["node", ["scripts/review/contribution-ladder-compose-gate.mjs"]],
  ["node", ["scripts/review/unstructured-asset-scan-modes-check.mjs"]],
  ["node", ["scripts/review/unstructured-asset-awareness-check.mjs"]],
  ["node", ["scripts/review/multi-device-asset-awareness-check.mjs"]],
  ["node", ["scripts/review/node0-multi-device-urp-resource-manifest-preview-check.mjs"]],
  ["node", ["scripts/review/aasr-node0-state-router-preview-check.mjs"]],
  ["node", ["scripts/review/apr-node0-route-refinery-preview-check.mjs"]],
  ["node", ["scripts/review/node0-governed-reversible-action-preview-check.mjs"]],
  ["node", ["scripts/review/node0-reversible-execute-gate-check.mjs"]],
  ["node", ["scripts/review/node0-undo-proven-preview-check.mjs"]],
  ["node", ["scripts/review/proof-of-spend-1a-check.mjs"]],
  ["node", ["scripts/review/dual-token-poi-economy-check.mjs"]],
  ["node", ["scripts/review/node0-receipt-signing-ed25519-check.mjs"]],
  ["node", ["scripts/review/node0-proof-chain-link-check.mjs"]],
  ["node", ["scripts/review/node0-signed-chain-head-check.mjs"]],
  ["node", ["scripts/review/node0-spine-runner-check.mjs"]],
  ["node", ["scripts/review/node0-space-index-check.mjs"]],
  ["node", ["scripts/review/node0-evidence-source-registry-check.mjs"]],
  ["node", ["scripts/review/node0-local-closure-readiness-check.mjs"]],
  ["node", ["scripts/review/dema-stand-check.mjs"]],
  ["node", ["scripts/review/dema-steward-chain-check.mjs"]],
  ["node", ["scripts/review/poi-time-compression-check.mjs"]],
  ["node", ["scripts/review/away-contract-check.mjs"]],
  ["node", ["scripts/review/absence-steward-readiness-check.mjs"]],
  ["node", ["scripts/review/absence-steward-return-review-check.mjs"]],
  ["node", ["scripts/review/absence-steward-queue-check.mjs"]],
  ["node", ["scripts/review/repo-claude-config-check.mjs"]],
  ["node", ["scripts/review/dema-fde-forwarder-diagnostic-check.mjs"]],
  ["node", ["scripts/review/preview-receipt-signing-check.mjs"]],
  ["node", ["scripts/review/local-model-adapter-preview-check.mjs"]],
  ["node", ["scripts/review/capability-blast-radius-check.mjs"]],
  ["node", ["scripts/review/receipt-monitor-preview-check.mjs"]],
  ["node", ["scripts/review/monitor-gatherer-check.mjs"]],
  ["node", ["scripts/review/reward-eligibility-contract-preview-check.mjs"]],
  ["node", ["scripts/review/sat5-constitutional-verifier-set-preview-check.mjs"]],
  ["node", ["scripts/review/node0-nodespace-boundary-preview-check.mjs"]],
  ["node", ["scripts/review/dema-active-workloop-composer-preview-check.mjs"]],
  ["node", ["scripts/review/node0-consented-inventory-gatherer-preview-check.mjs"]],
  ["node", ["scripts/review/dema-self-eval-baseline-preview-check.mjs"]],
  ["node", ["scripts/review/dema-verified-answer-receipt-cache-preview-check.mjs"]],
  ["node", ["scripts/review/dema-isnad-modern-design-canon-check.mjs"]],
  ["node", ["scripts/review/dema-first-light-front-door-preview-check.mjs"]],
  ["node", ["scripts/review/dema-socratic-critic-process-supervision-preview-check.mjs"]],
  ["node", ["scripts/review/dema-zero-overclaim-response-policy-check.mjs"]],
  ["node", ["scripts/review/urp-supply-side-resource-reward-contract-preview-check.mjs"]],
  ["node", ["scripts/review/dema-receipt-signature-anchor-preview-check.mjs"]],
  ["node", ["scripts/review/node0-urp-genesis-root-activation-preview-check.mjs"]],
  ["node", ["scripts/review/node0-urp-genesis-root-composition-gate-preview-check.mjs"]],
  ["node", ["scripts/review/node0-first-real-local-mission-pulse-preview-check.mjs"]],
  ["node", ["scripts/review/node0-local-mission-harness-preview-check.mjs"]],
  ["node", ["scripts/review/node0-mission-harness-return-review-preview-check.mjs"]],
  ["node", ["scripts/review/node0-local-urp-shelf-index-preview-check.mjs"]],
  ["node", ["scripts/review/node0-receipt-shelf-compaction-state-preview-check.mjs"]],
  ["node", ["scripts/review/untrusted-corpus-sanitizer-preview-check.mjs"]],
  ["node", ["scripts/review/public-metric-claim-gate-preview-check.mjs"]],
  ["node", ["scripts/review/materialization-pulse-receipt-schema-preview-check.mjs"]],
  ["node", ["scripts/review/local-model-pulse-binding-preview-check.mjs"]],
  ["node", ["scripts/review/plan-branch-preview-check.mjs"]],
  ["node", ["scripts/review/node0-materialization-pulse-e2e-preview-check.mjs"]],
  ["node", ["scripts/review/node0-local-mission-artifact-emission-preview-check.mjs"]],
  ["node", ["scripts/review/node0-local-mission-emit-cli-adapter-check.mjs"]],
  ["node", ["scripts/review/node0-mission-pilot-cockpit-preview-check.mjs"]],
  ["node", ["scripts/review/node0-mission-pilot-cockpit-cli-adapter-check.mjs"]],
  ["node", ["scripts/review/sovereign-voice-turn-preview-check.mjs"]],
  ["node", ["scripts/review/node0-founder-impact-loop-check.mjs"]],
  ["node", ["scripts/review/dema-skillopt-edit-ledger-preview-check.mjs"]],
  ["node", ["scripts/review/root-bound-consent-envelope-preview-check.mjs"]],
  ["node", ["scripts/review/root-clause-trace-preview-check.mjs"]],
  ["node", ["scripts/review/fde-isnad-replay-capsule-preview-check.mjs"]],
  ["node", ["scripts/review/node0-realm-state-kernel-check.mjs"]],
  ["node", ["scripts/review/node0-metrics-baseline-check.mjs"]],
  ["node", ["scripts/review/dema-recovery-mission-engine-check.mjs"]],
  ["node", ["scripts/review/dema-recovery-mission-gatherer-check.mjs"]],
  ["node", ["scripts/review/dema-capability-truth-registry-check.mjs"]],
  ["node", ["scripts/review/boundary-vocab-unification-check.mjs"]],
  ["node", ["scripts/review/dema-fde-dual-diagnostic-check.mjs"]],
  ["node", ["scripts/review/node0-ci-vendor-availability-check.mjs"]],
  ["node", ["scripts/review/dema-home-node-space-ontology-check.mjs"]],
  ["node", ["scripts/review/dema-node-space-bonding-file-steward-check.mjs"]],
  ["node", ["scripts/review/node0-killer-demo-value-loop-compose-gate.mjs"]],
  ["node", ["scripts/review/node0-killer-demo-value-loop-cli-check.mjs"]],
  ["node", ["scripts/review/node0-killer-demo-value-loop-proof-convergence-check.mjs"]],
  ["node", ["scripts/review/node0-proof-snapshot-attachment-check.mjs"]],
  ["node", ["scripts/review/node0-ci-evidence-attestation-check.mjs"]],
  ["node", ["scripts/review/node0-ci-rail-aggregation-check.mjs"]],
  ["node", ["scripts/review/node0-release-verdict-check.mjs"]],
  ["node", ["scripts/review/node0-proof-artifact-export-check.mjs"]],
  ["node", ["scripts/review/node0-proof-of-truth-control-plane-check.mjs"]],
  ["node", ["scripts/review/zero-dep-gate.mjs"]],
  ["node", ["scripts/review/style-pillar-check.mjs"]],
  ["node", ["scripts/review/mobile-companion-register-1a-check.mjs"]],
  ["node", ["scripts/review/npc-intent-binder-hardening-check.mjs"]],
  ["node", ["scripts/review/kernel-purity-check.mjs"]],
  ["node", ["scripts/review/no-overclaim.mjs"]],
  ["node", ["scripts/review/proof-scope.mjs"]],
  ["node", ["scripts/review/agent-dna-root-coherence.mjs"]],
  ["node", ["scripts/review/negative-verdict-reason-gate.mjs"]],
  ["node", ["scripts/review/doc-freshness-gate.mjs"]],
  ["node", ["scripts/review/doc-staleness-gate.mjs"]],
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
  // Classify the exact auto-discovery command against its own fresh log before
  // returning to the aggregate owner. A proved environmental exit 1 normalizes
  // to zero here, so every later gate still runs; all other exits stay fatal.
  [
    "node",
    [
      "scripts/ci/run-with-classifier.mjs",
      "--temp-log",
      "--",
      "node",
      "--test",
      "--test-reporter=tap",
    ],
  ],
  ["npm", ["run", "coverage"]],
  ["node", ["apps/cli/src/index.js", "welcome"]],
  ["node", ["apps/cli/src/index.js", "help"]],
  ["node", ["apps/cli/src/index.js", "onboard"]],
  ["node", ["apps/cli/src/index.js", "onboard", "--json"]],
  ["node", ["apps/cli/src/index.js", "roadmap", "preview"]],
  ["node", ["apps/cli/src/index.js", "roadmap", "preview", "--json"]],
  ["node", ["apps/cli/src/index.js", "models"]],
  ["node", ["apps/cli/src/index.js", "models", "readiness"]],
  ["node", ["apps/cli/src/index.js", "models", "readiness", "--json"]],
  [
    "node",
    [
      "apps/cli/src/index.js",
      "talk",
      "what is SAT?",
      "--profile",
      "canon",
      "--json",
    ],
  ],
  ["node", ["apps/cli/src/index.js", "assets", "scan", "--root", ".", "--json"]],
  [
    "node",
    ["apps/cli/src/index.js", "assets", "shareability", "--root", ".", "--json"],
  ],
  ["node", ["apps/cli/src/index.js", "contribute", "preview", "--json"]],
  ["node", ["apps/cli/src/index.js", "contribute", "receipt-plan", "--json"]],
  ["node", ["apps/cli/src/index.js", "contribute", "receipt-draft", "--json"]],
  ["node", ["apps/cli/src/index.js", "contribute", "receipt-seal-preview", "--json"]],
  ["node", ["apps/cli/src/index.js", "demo", "node0-value-loop", "--json"]],
  [
    "node",
    ["apps/cli/src/index.js", "demo", "node0-value-loop", "convergence", "--json"],
  ],
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
  ["node", ["scripts/review/canonical-json-v1-check.mjs"]],
  ["node", ["scripts/review/mission-corridor-check.mjs"]],
  ["node", ["scripts/review/dema-program-graph-check.mjs"]],
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

export function runChecks(
  checks = commands,
  {
    execute = execFileSync,
    log = console.log,
    evidence = writeCheckGateEvidence,
  } = {},
) {
  evidence(checkGateStart(checks.length));
  for (const [index, entry] of checks.entries()) {
    const [bin, args, extraEnv] = entry;
    log(`> ${bin} ${args.join(" ")}`);
    const childEnv = { ...process.env };
    if (extraEnv && typeof extraEnv === "object") {
      Object.assign(childEnv, extraEnv);
    }
    delete childEnv[CHECK_GATE_EVIDENCE_FD_ENV];
    const options = { stdio: "inherit", env: childEnv };
    try {
      execute(bin, args, options);
    } catch (error) {
      const normalNonzeroExit =
        Number.isInteger(error?.status) &&
        error.status > 0 &&
        !error?.signal;
      const exitCode = normalNonzeroExit ? error.status : 1;
      try {
        evidence(
          checkGateFailure({
            index,
            command: [bin, ...args],
            exitCode,
            maskPolicy: "authoritative",
          }),
        );
      } catch {
        log(
          "[DEMA_CHECK_GATE_EVIDENCE_ERROR] failure evidence could not be written; the classifier will fail closed",
        );
      }
      throw error;
    }
  }
  evidence(checkGateComplete(checks.length));
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  runChecks();
}
