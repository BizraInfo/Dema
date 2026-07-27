import test from "node:test";
import assert from "node:assert/strict";

import {
  BLUEPRINT_SCHEMA,
  TRUTH_TONES,
  buildBlueprintFacts,
  renderStaleness,
} from "../packages/core/src/node0-fullstack-blueprint.js";

const OBS = {
  measured_at: "2026-07-25T12:00:00.000Z",
  tests: { pass: 7791, fail: 20, source: "npm test", observed_at: "2026-07-25T12:00:00.000Z" },
  dependencies: { prod: 0, dev: 0, source: "package.json", observed_at: "2026-07-25T12:00:00.000Z" },
  workflows: { names: ["check.yml", "codeql.yml"], source: "fs", observed_at: "2026-07-25T12:00:00.000Z" },
};

/* ── the failure this kernel exists to prevent ────────────────────────────── */

test("a MEASURED row must carry an observation — a typed constant is refused", () => {
  assert.throws(
    () => buildBlueprintFacts({ ...OBS, tests: undefined }),
    /OBSERVATION_REQUIRED/,
  );
});

test("a fact carries its own source and observation time", () => {
  const f = buildBlueprintFacts(OBS);
  const t = f.facts.find((x) => x.key === "tests");
  assert.equal(t.source, "npm test");
  assert.equal(t.observed_at, "2026-07-25T12:00:00.000Z");
  assert.equal(t.truth, "MEASURED");
});

test("a failing suite is never rendered as a passing count", () => {
  const f = buildBlueprintFacts(OBS);
  const t = f.facts.find((x) => x.key === "tests");
  assert.equal(t.value, "7791 pass · 20 fail");
  assert.equal(t.green, false);
});

test("a green suite renders green", () => {
  const f = buildBlueprintFacts({ ...OBS, tests: { ...OBS.tests, fail: 0 } });
  const t = f.facts.find((x) => x.key === "tests");
  assert.equal(t.green, true);
  assert.equal(t.value, "7791 pass · 0 fail");
});

/* ── truth tones ──────────────────────────────────────────────────────────── */

test("every declared tone has a blurb and no tone claims live runtime", () => {
  for (const [k, v] of Object.entries(TRUTH_TONES)) {
    assert.ok(v.blurb.length > 0, k);
  }
  assert.equal(TRUTH_TONES.SIMULATION_ONLY.blurb.includes("Animated"), true);
});

test("rows the node cannot honestly measure stay DESIGNED_NOT_LIVE", () => {
  const f = buildBlueprintFacts(OBS);
  const dora = f.dora.filter((d) => /failure rate|restore/i.test(d.metric));
  assert.equal(dora.length, 2);
  for (const d of dora) {
    assert.equal(d.truth, "DESIGNED_NOT_LIVE");
    assert.equal(d.value, "NOT_MEASURABLE_ON_ONE_NODE");
  }
});

test("the pipeline animation is labelled SIMULATION_ONLY and claims no build", () => {
  const f = buildBlueprintFacts(OBS);
  assert.equal(f.pipeline.truth, "SIMULATION_ONLY");
  assert.equal(f.pipeline.runs_a_real_build, false);
});

/* ── staleness: the operator's rule, enforced ─────────────────────────────── */

test("a fact older than the freshness window is marked stale, not silently shown", () => {
  const s = renderStaleness("2026-07-25T00:00:00.000Z", "2026-07-25T12:00:00.000Z", 6);
  assert.equal(s.stale, true);
  assert.equal(s.age_hours, 12);
});

test("a fresh fact is not marked stale", () => {
  const s = renderStaleness("2026-07-25T11:00:00.000Z", "2026-07-25T12:00:00.000Z", 6);
  assert.equal(s.stale, false);
});

test("the blueprint reports how many of its own facts are stale", () => {
  const f = buildBlueprintFacts({
    ...OBS,
    tests: { ...OBS.tests, observed_at: "2026-07-20T00:00:00.000Z" },
  });
  assert.ok(f.staleness.stale_fact_count >= 1);
  assert.ok(f.staleness.facts_stale.includes("tests"));
});

/* ── boundary ─────────────────────────────────────────────────────────────── */

test("the blueprint declares what it does not prove", () => {
  const f = buildBlueprintFacts(OBS);
  assert.equal(f.schema, BLUEPRINT_SCHEMA);
  for (const claim of ["live CI run", "production DORA telemetry", "economic-layer activation"]) {
    assert.ok(f.does_not_prove.some((d) => d.includes(claim)), claim);
  }
});

test("no fact is emitted without a truth label", () => {
  const f = buildBlueprintFacts(OBS);
  for (const row of [...f.facts, ...f.gates, ...f.dora, ...f.pmbok]) {
    assert.ok(Object.keys(TRUTH_TONES).includes(row.truth), `${row.key ?? row.metric ?? row.area} has no tone`);
  }
});

test("building twice from one observation is deterministic", () => {
  assert.deepEqual(buildBlueprintFacts(OBS), buildBlueprintFacts(OBS));
});

/* ── the overclaim caught on the shipped page ─────────────────────────────── */

test("dependency counts are per tier — a single total would hide the UI supply chain", () => {
  const f = buildBlueprintFacts({
    ...OBS,
    dependencies: {
      prod: 51, dev: 9,
      by_tier: { kernel: { prod: 0, dev: 0 }, ui: { prod: 51, dev: 9 } },
      source: "package.json + packages/dema-ui/package.json",
      observed_at: OBS.measured_at,
    },
  });
  const d = f.facts.find((x) => x.key === "dependencies");
  assert.ok(d.value.includes("kernel 0"), d.value);
  assert.ok(d.value.includes("ui 51"), d.value);
  assert.ok(/kernel tier only/.test(d.note), "must state which tier the zero belongs to");
});

test("a non-zero kernel dependency count is not rendered green", () => {
  const f = buildBlueprintFacts({
    ...OBS,
    dependencies: { prod: 3, dev: 0, by_tier: { kernel: { prod: 3, dev: 0 }, ui: { prod: 0, dev: 0 } }, source: "s", observed_at: OBS.measured_at },
  });
  assert.equal(f.facts.find((x) => x.key === "dependencies").green, false);
});
