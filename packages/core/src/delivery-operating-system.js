// DELIVERY-OPERATING-SYSTEM-1A · machine-readable delivery / DevOps / QA control plane.
//
// PURE policy kernel. NO file write. NO network. NO subprocess. NO model call.
// It DESCRIBES Dema's existing quality machinery as a governed manifest; it does
// NOT run any gate. `current_status` stays UNKNOWN unless a caller supplies
// measured results. The CLI may read package.json and pass `scripts` to
// annotateDeliveryStatus — this kernel never touches disk.
//
// Every gate.command binds to a real, verified surface on disk:
//   npm scripts in package.json, or the CI secret-scan (.github/workflows/gitleaks.yml).
// No invented commands. The router/scripts remain authoritative.

import { buildPreviewBoundary } from "./preview-boundary.js";

export const DELIVERY_OPERATING_SYSTEM_SCHEMA =
  "bizra.dema.delivery_operating_system.v0.1";

// The 12 quality-gate categories this control plane must cover.
export const REQUIRED_GATE_CATEGORIES = Object.freeze([
  "tests",
  "static_check",
  "coverage",
  "security",
  "env_hygiene",
  "claims",
  "artifact_safety",
  "release_readiness",
  "delivery_readiness",
  "performance",
  "proof_seal",
  "operator_prep",
]);

// The four Proof-of-Truth rails. Every gate maps to exactly one.
export const DELIVERY_RAILS = Object.freeze([
  "formal",
  "cryptographic_evidence",
  "empirical",
  "economic_designed_not_live",
]);

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

// Gate definitions — each binds to a verified command. `current_status` is
// added at build time (UNKNOWN unless measured results are supplied).
const GATE_DEFS = Object.freeze([
  {
    id: "tests",
    command: "npm test",
    npm_script: "test",
    ci_enforced: true,
    category: "tests",
    rail: "formal",
    purpose: "Behavioral + boundary coverage across tests/*.test.js.",
    blocks_release: true,
    evidence_artifact: "TAP test log (node --test tests/*.test.js)",
    failure_policy: "fail_closed",
    owner_role: "engineering",
    cadence: "per_pr",
    notes: "Harness classifier triages known-harness failures after the run.",
  },
  {
    id: "static-check",
    command: "npm run check",
    npm_script: "check",
    ci_enforced: true,
    category: "static_check",
    rail: "formal",
    purpose:
      "Structural checks: kernel purity, schema/truth-label, agent-dna-root coherence.",
    blocks_release: true,
    evidence_artifact: "scripts/check.mjs output + classifier log",
    failure_policy: "fail_closed",
    owner_role: "engineering",
    cadence: "per_pr",
    notes: "Aggregate static gate wired in CI (.github/workflows/check.yml).",
  },
  {
    id: "coverage",
    command: "npm run coverage",
    npm_script: "coverage",
    ci_enforced: true,
    category: "coverage",
    rail: "formal",
    purpose: "Enforce coverage floors (lines >=95, branches >=84, functions >=95).",
    blocks_release: true,
    evidence_artifact: "experimental-test-coverage TAP report",
    failure_policy: "fail_closed",
    owner_role: "engineering",
    cadence: "per_pr",
    notes: "Thresholds defined in the coverage npm script.",
  },
  {
    id: "claims",
    command: "npm run claim:check",
    npm_script: "claim:check",
    ci_enforced: true,
    category: "claims",
    rail: "cryptographic_evidence",
    purpose: "Every public claim binds to evidence in the claim ledger.",
    blocks_release: true,
    evidence_artifact: "claim-ledger-check report",
    failure_policy: "fail_closed",
    owner_role: "engineering",
    cadence: "per_pr",
    notes: "Anti-ZANN: no claim ships without a bound evidence source.",
  },
  {
    id: "proof-seal",
    command: "npm run pre-push:seal",
    npm_script: "pre-push:seal",
    ci_enforced: false,
    category: "proof_seal",
    rail: "cryptographic_evidence",
    purpose: "Hash-chained pre-push proof seal over the working tree state.",
    blocks_release: true,
    evidence_artifact: "pre-push-proof-seal receipt",
    failure_policy: "fail_closed",
    owner_role: "engineering",
    cadence: "pre_push",
    notes: "Refuses to seal a dirty or unverified tree.",
  },
  {
    id: "operator-prep",
    command: "npm run layer-a5:prep",
    npm_script: "layer-a5:prep",
    ci_enforced: false,
    category: "operator_prep",
    rail: "cryptographic_evidence",
    purpose: "Operator readiness snapshot (Layer A5) for hand-off.",
    blocks_release: false,
    evidence_artifact: "layer-a5-operator-prep JSON",
    failure_policy: "warn_only",
    owner_role: "operator",
    cadence: "periodic",
    notes: "Informational readiness; does not block a merge.",
  },
  {
    id: "security",
    command: "gitleaks detect --source . --no-banner --verbose --exit-code 1 --redact",
    npm_script: null,
    ci_enforced: true,
    category: "security",
    rail: "empirical",
    purpose: "Secret-scan the full branch history for leaked credentials.",
    blocks_release: true,
    evidence_artifact: ".github/workflows/gitleaks.yml (gitleaks v8 detect step)",
    failure_policy: "fail_closed",
    owner_role: "security",
    cadence: "per_pr",
    notes: "Exact CI command from gitleaks.yml; enforced in CI, not a local npm script.",
  },
  {
    id: "env-hygiene",
    command: "npm run env-hygiene",
    npm_script: "env-hygiene",
    ci_enforced: true,
    category: "env_hygiene",
    rail: "empirical",
    purpose: "All env vars referenced are registered/known; no unapproved reads.",
    blocks_release: true,
    evidence_artifact: "env-hygiene-check report",
    failure_policy: "fail_closed",
    owner_role: "engineering",
    cadence: "per_pr",
    notes: "Unregistered env vars fail closed against KNOWN_DEMA_ENV_VARS.",
  },
  {
    id: "artifact-safety",
    command: "npm run eval:layer1",
    npm_script: "eval:layer1",
    ci_enforced: true,
    category: "artifact_safety",
    rail: "empirical",
    purpose: "No raw corpus / sensitive payload included in shipped artifacts.",
    blocks_release: true,
    evidence_artifact: "artifact-safety-check report",
    failure_policy: "fail_closed",
    owner_role: "engineering",
    cadence: "per_pr",
    notes: "Layer-1 artifact safety scan.",
  },
  {
    id: "release-readiness",
    command: "npm run release:readiness",
    npm_script: "release:readiness",
    ci_enforced: false,
    category: "release_readiness",
    rail: "empirical",
    purpose: "Composite release-readiness assessment before tagging.",
    blocks_release: true,
    evidence_artifact: "release-readiness report",
    failure_policy: "fail_closed",
    owner_role: "release",
    cadence: "pre_release",
    notes: "Run before cutting a release.",
  },
  {
    id: "delivery-readiness",
    command: "npm run delivery:readiness-gate",
    npm_script: "delivery:readiness-gate",
    ci_enforced: false,
    category: "delivery_readiness",
    rail: "empirical",
    purpose: "Delivery-readiness score for the first-look companion surface.",
    blocks_release: false,
    evidence_artifact: "delivery-readiness-score report",
    failure_policy: "warn_only",
    owner_role: "engineering",
    cadence: "per_pr",
    notes: "Composes ux/proof/security/performance sub-gates; advisory in 1A.",
  },
  {
    id: "performance",
    command: "npm run delivery:perf-gate",
    npm_script: "delivery:perf-gate",
    ci_enforced: false,
    category: "performance",
    rail: "empirical",
    purpose: "Performance-budget gate (CI headroom, not a hard ceiling).",
    blocks_release: false,
    evidence_artifact: "performance-budget-gate report",
    failure_policy: "warn_only",
    owner_role: "engineering",
    cadence: "per_pr",
    notes: "Warning-only: tracks budget headroom (local 150 / CI 250).",
  },
]);

const RAIL_DESCRIPTIONS = Object.freeze({
  formal:
    "Deterministic checks: tests, static analysis, coverage floors. Pass/fail is mechanical.",
  cryptographic_evidence:
    "Hash-bound / content-addressed evidence: claim ledger, pre-push seal, operator prep.",
  empirical:
    "Measured scans and budgets: secret-scan, env hygiene, artifact safety, readiness, performance.",
  economic_designed_not_live:
    "PoI scoring, reward emission, token minting — DESIGNED, not live. No economic gate runs.",
});

function buildGateGroups(gates) {
  const groups = {};
  for (const rail of DELIVERY_RAILS) {
    if (rail === "economic_designed_not_live") {
      groups[rail] = {
        rail,
        description: RAIL_DESCRIPTIONS[rail],
        status: "DESIGNED_NOT_LIVE",
        gates: [],
      };
      continue;
    }
    groups[rail] = {
      rail,
      description: RAIL_DESCRIPTIONS[rail],
      status: "LIVE_LOCAL",
      gates: gates.filter((g) => g.rail === rail).map((g) => g.id),
    };
  }
  return groups;
}

const MANAGEMENT_BOK_MAPPING = Object.freeze({
  scope: "Feature slices carry explicit truth labels and boundaries; no scope creep past a slice.",
  quality: "tests + static-check + coverage + performance gates enforce quality mechanically.",
  risk: "Fail-closed gates and zann-prevention (claims, security) stop unproven work shipping.",
  integration: "Package scripts + docs + PR proof seal integrate the change into mainline.",
  stakeholder: "Operator consent (FATE), Daughter Test, and human-readable status serve the stakeholder.",
  communications: "CLI report + docs/TESTING.md + release notes communicate state.",
  procurement: "Dependency hygiene + no unapproved subprocess/network (kernel purity, env hygiene).",
  schedule: "Cadence per gate: per_pr, pre_push, pre_release, periodic.",
});

function buildCiCdMapping(gates) {
  const byCadence = {};
  for (const gate of gates) {
    (byCadence[gate.cadence] ??= []).push(gate.id);
  }
  return byCadence;
}

const DEVOPS_MAPPING = Object.freeze({
  continuous_integration: "tests, static-check, coverage, claims, env-hygiene, artifact-safety run per PR.",
  shift_left_security: "security secret-scan runs per PR in CI before merge.",
  release_governance: "release-readiness + proof-seal gate the path to a tagged release.",
  observability: "operator-prep + delivery-readiness give a readable readiness snapshot.",
});

const QUALITY_ASSURANCE_MAPPING = Object.freeze({
  static_analysis: "static-check",
  automated_tests: "tests",
  coverage_floor: "coverage",
  regression_prevention: "tests + claims (no claim without bound evidence)",
  performance_budget: "performance",
  release_gate: "release-readiness",
});

const NEXT_SAFE_ACTIONS = Object.freeze([
  "Run `npm test` and `npm run check` before opening any PR.",
  "Run `npm run pre-push:seal` before pushing a branch.",
  "Run `npm run release:readiness` before tagging a release.",
  "Pass measured gate results into `dema delivery status` to render a real go/no-go.",
]);

export function buildDeliveryOperatingSystem({ measured = {} } = {}) {
  const gates = GATE_DEFS.map((def) =>
    Object.freeze({
      ...def,
      current_status:
        typeof measured[def.id] === "string" ? measured[def.id] : "UNKNOWN",
    }),
  );
  const release_blockers = gates.filter((g) => g.blocks_release).map((g) => g.id);
  const warning_only = gates.filter((g) => !g.blocks_release).map((g) => g.id);

  const proof_of_truth_mapping = {};
  for (const rail of DELIVERY_RAILS) {
    proof_of_truth_mapping[rail] = {
      description: RAIL_DESCRIPTIONS[rail],
      gates: gates.filter((g) => g.rail === rail).map((g) => g.id),
    };
  }

  const envelope = {
    schema: DELIVERY_OPERATING_SYSTEM_SCHEMA,
    truth_label: "DEMA_DELIVERY_OPERATING_SYSTEM_LOCAL_ONLY",
    mode: "policy_only",
    maturity_stage: "node0_delivery_control_plane",
    delivery_gates: gates,
    gate_groups: buildGateGroups(gates),
    release_blockers,
    warning_only,
    proof_of_truth_mapping,
    management_bok_mapping: MANAGEMENT_BOK_MAPPING,
    ci_cd_mapping: buildCiCdMapping(gates),
    devops_mapping: DEVOPS_MAPPING,
    quality_assurance_mapping: QUALITY_ASSURANCE_MAPPING,
    next_safe_actions: NEXT_SAFE_ACTIONS,
    boundary: buildPreviewBoundary(),
    what_this_proves:
      "The Dema delivery process is formalized as a machine-readable policy: every quality gate binds to a real command, maps to one Proof-of-Truth rail, and declares whether it blocks release.",
    what_this_does_not_prove:
      "Does not prove any gate passed (current_status is UNKNOWN unless measured results are supplied), does not prove release readiness by itself, does not activate CI/CD automation, and runs no task, deployment, or economic rail.",
  };
  return deepFreeze(envelope);
}

// Pure status annotation. The CLI reads package.json and passes `scripts`;
// this function never touches disk. Marks which gate commands are wired,
// and which release-blockers are currently failing.
export function annotateDeliveryStatus(policy, { scripts = {} } = {}) {
  const gates = policy.delivery_gates.map((gate) => {
    const script_wired =
      gate.npm_script != null && Object.hasOwn(scripts, gate.npm_script);
    return Object.freeze({
      id: gate.id,
      command: gate.command,
      category: gate.category,
      rail: gate.rail,
      blocks_release: gate.blocks_release,
      current_status: gate.current_status,
      ci_enforced: gate.ci_enforced === true,
      script_wired,
    });
  });
  const failing_blockers = gates
    .filter((g) => g.blocks_release && g.current_status === "FAIL")
    .map((g) => g.id);
  const release_ready = gates
    .filter((g) => g.blocks_release)
    .every((g) => g.current_status === "PASS");
  return deepFreeze({
    schema: "bizra.dema.delivery_operating_system_status.v0.1",
    truth_label: policy.truth_label,
    mode: "policy_only",
    gates,
    failing_blockers,
    release_ready,
    boundary: buildPreviewBoundary(),
  });
}
