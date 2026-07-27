/**
 * NODE0-FULLSTACK-BLUEPRINT-1A — pure facts kernel.
 *
 * The design-project blueprint (`blueprint/data.jsx`) is honestly truth-labelled
 * but its MEASURED rows are TRANSCRIBED CONSTANTS — "2618 / 2618 pass",
 * "104 / 104 micro-checks". On 2026-07-25 the real suite was 7,791 pass / 20 fail.
 * Shipping the constant would have published a stale claim wearing a MEASURED
 * label, which is the exact failure mode this repo exists to prevent.
 *
 * So the production blueprint does not accept numbers. It accepts OBSERVATIONS,
 * each carrying its own source and timestamp, and it refuses to emit a MEASURED
 * row without one. Anything a single node cannot honestly measure — fleet
 * failure rate, restore time — stays DESIGNED_NOT_LIVE with an explicit
 * NOT_MEASURABLE_ON_ONE_NODE value rather than a plausible-looking figure.
 *
 * Pure: no fs, no clock, no network. The gatherer observes; this only shapes.
 */

export const BLUEPRINT_SCHEMA = "bizra.dema.node0_fullstack_blueprint.v0.1";

export const TRUTH_TONES = Object.freeze({
  MEASURED: { tone: "measured", blurb: "Observed on this node, with a source and a timestamp." },
  DERIVED: { tone: "derived", blurb: "Computed from measured facts." },
  ROLLOUT: { tone: "rollout", blurb: "Hard-gated mid-rollout." },
  DESIGNED_NOT_LIVE: { tone: "designed", blurb: "Designed; needs production telemetry this node cannot supply." },
  SIMULATION_ONLY: { tone: "sim", blurb: "Animated demonstration of control flow. Not a build." },
});

class BlueprintError extends Error {
  constructor(code, detail) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = "BlueprintError";
    this.code = code;
  }
}

const require1 = (obs, key) => {
  const o = obs?.[key];
  if (!o || typeof o.source !== "string" || typeof o.observed_at !== "string") {
    throw new BlueprintError("OBSERVATION_REQUIRED", `${key} needs {source, observed_at}`);
  }
  return o;
};

/** Age of a fact against the render time. A number without freshness is a claim. */
export function renderStaleness(observedAt, renderedAt, windowHours = 24) {
  const age = (Date.parse(renderedAt) - Date.parse(observedAt)) / 3_600_000;
  return { age_hours: Math.round(age * 100) / 100, stale: age > windowHours };
}

/** The 8-stage value stream. Topology is design; the gate names are real script names. */
const STAGES = Object.freeze([
  { id: "plan", phase: "Plan", title: "Propose + ADR", where: "local", tool: "docs/06-adr" },
  { id: "build", phase: "Build", title: "Compose change", where: "local", tool: "src + tests" },
  { id: "test", phase: "Test", title: "Unit + boundary", where: "local", tool: "node --test" },
  { id: "seal", phase: "Seal", title: "Pre-push seal", where: "local", tool: "pre-push-proof-seal" },
  { id: "integrate", phase: "Integrate", title: "CI matrix", where: "ci", tool: "check.yml" },
  { id: "gate", phase: "Gate", title: "Delivery gate", where: "ci", tool: "delivery:check" },
  { id: "release", phase: "Release", title: "Merge to main", where: "ci", tool: "release-readiness" },
  { id: "prove", phase: "Prove", title: "Receipt sealed", where: "ci", tool: "receipts/*" },
]);

const GATES = Object.freeze([
  { key: "perf", name: "Performance", evidence: "perf-bench --a-plus", truth: "MEASURED" },
  { key: "coverage", name: "Coverage", evidence: "--test-coverage-* in CI", truth: "MEASURED" },
  { key: "release", name: "Release", evidence: "release-readiness.mjs", truth: "MEASURED" },
  { key: "seal", name: "Pre-push seal", evidence: "pre-push-proof-seal.mjs", truth: "MEASURED" },
  { key: "gates", name: "Local suite", evidence: "scripts/review/*", truth: "MEASURED" },
  { key: "covenant", name: "Covenant", evidence: "covenant-gate", truth: "MEASURED" },
]);

const PMBOK = Object.freeze([
  { area: "Integration", line: "propose → seal → receipt; every change ties to an ADR.", truth: "MEASURED" },
  { area: "Scope", line: "ADR register defines boundaries; claim-ledger gate blocks drift.", truth: "MEASURED" },
  { area: "Schedule", line: "Ring checkpoints as epochs; the pre-push seal is the cadence.", truth: "DERIVED" },
  { area: "Quality", line: "Quality is a gate that fails closed, not a review step.", truth: "MEASURED" },
  { area: "Risk", line: "Blast-radius evaluation, fail-closed builders, SAST per PR.", truth: "MEASURED" },
  { area: "Procurement", line: "Kernel tier has zero dependencies by construction; the UI tier carries a real supply chain and needs scanning.", truth: "DERIVED" },
  { area: "Communications", line: "Receipts are the immutable audit log.", truth: "MEASURED" },
  { area: "Stakeholder", line: "Exact-string consent before any bounded action.", truth: "MEASURED" },
  { area: "Cost", line: "Local-first execution. The economic layer is not live.", truth: "DESIGNED_NOT_LIVE" },
  { area: "Resource", line: "Shared-compute allocation is designed, not running.", truth: "DESIGNED_NOT_LIVE" },
]);

export function buildBlueprintFacts(observations) {
  if (!observations || typeof observations.measured_at !== "string") {
    throw new BlueprintError("MEASURED_AT_REQUIRED");
  }
  const at = observations.measured_at;

  const tests = require1(observations, "tests");
  const deps = require1(observations, "dependencies");
  const flows = require1(observations, "workflows");

  const facts = [
    {
      key: "tests",
      label: "Tests",
      // A failing suite is never rendered as a passing count. Today's real
      // numbers ship as they are, red included.
      value: `${tests.pass} pass · ${tests.fail} fail`,
      green: tests.fail === 0,
      truth: "MEASURED",
      source: tests.source,
      observed_at: tests.observed_at,
    },
    {
      key: "dependencies",
      label: "Dependencies",
      // Per tier, never a single figure. "0 / 0" is true of the kernels and
      // false of the UI that renders this page — a total would hide that.
      value: deps.by_tier
        ? `kernel ${deps.by_tier.kernel?.prod ?? 0} · ui ${deps.by_tier.ui?.prod ?? 0} prod`
        : `${deps.prod} prod · ${deps.dev} dev`,
      green: (deps.by_tier?.kernel?.prod ?? deps.prod) === 0,
      note: deps.by_tier
        ? "the zero-dependency property belongs to the kernel tier only; the UI tier carries a real supply chain"
        : null,
      truth: "MEASURED",
      source: deps.source,
      observed_at: deps.observed_at,
    },
    {
      key: "workflows",
      label: "CI workflows",
      value: `${flows.names.length} · ${flows.names.join(" · ")}`,
      green: true,
      truth: "MEASURED",
      source: flows.source,
      observed_at: flows.observed_at,
    },
  ];

  const dora = [
    { metric: "Deployment frequency", value: "per sealed merge", note: "Cadence is gate-bound.", truth: "DERIVED" },
    { metric: "Lead time for change", value: "commit → receipt", note: "Wall-clock not instrumented.", truth: "DERIVED" },
    {
      metric: "Change failure rate",
      value: "NOT_MEASURABLE_ON_ONE_NODE",
      note: "A single node cannot measure fleet failure honestly.",
      truth: "DESIGNED_NOT_LIVE",
    },
    {
      metric: "Time to restore",
      value: "NOT_MEASURABLE_ON_ONE_NODE",
      note: "Restore time is a production-fleet metric.",
      truth: "DESIGNED_NOT_LIVE",
    },
  ];

  const staleness = {
    window_hours: 24,
    facts_stale: facts.filter((f) => renderStaleness(f.observed_at, at, 24).stale).map((f) => f.key),
  };
  staleness.stale_fact_count = staleness.facts_stale.length;

  return Object.freeze({
    schema: BLUEPRINT_SCHEMA,
    truth_label: "LOCAL_OBSERVED_BLUEPRINT",
    measured_at: at,
    facts: Object.freeze(facts),
    stages: STAGES,
    gates: GATES,
    pmbok: PMBOK,
    dora: Object.freeze(dora),
    pipeline: Object.freeze({
      truth: "SIMULATION_ONLY",
      runs_a_real_build: false,
      note: "The stage animation demonstrates gate control flow. It executes nothing.",
    }),
    staleness: Object.freeze(staleness),
    does_not_prove: Object.freeze([
      "a live CI run — this surface executes no build",
      "production DORA telemetry — change-failure and restore need a fleet",
      "economic-layer activation — the token and URP layers are not live",
      "that a MEASURED row is currently true — check observed_at against now",
    ]),
  });
}
