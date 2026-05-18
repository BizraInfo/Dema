import { test } from "node:test";
import assert from "node:assert/strict";

import { buildHomebasePreview } from "../packages/core/src/homebase-preview.js";
import { isCanonicalBoundary } from "../packages/core/src/preview-boundary.js";

const FIXED_TS = new Date("2026-05-18T12:42:00Z");

function makeGather(overrides = {}) {
  const base = {
    schema_version: "bizra.dema.homebase_gather.v0.1",
    ts: FIXED_TS,
    partial: false,
    warnings: [],
    profile: { name: null, node: "Node0", source_present: false },
    memory_recent: [],
    state: null,
    receipts: { count: 0, last_id: null, gateway_issued: 0 },
    process_mining: null,
    models: null,
    memory_size: { bytes: 0, entries: 0 },
    env_flags: { no_color: false, term_dumb: false, tty: true },
  };
  return { ...base, ...overrides };
}

test("TDD-01: schema === bizra.dema.homebase_v0_1.v0.1", () => {
  const out = buildHomebasePreview({ gather: makeGather() });
  assert.equal(out.schema, "bizra.dema.homebase_v0_1.v0.1");
});

test("TDD-02: boundary has exactly 16 canonical keys, all false", () => {
  const out = buildHomebasePreview({ gather: makeGather() });
  assert.equal(isCanonicalBoundary(out.boundary), true);
  for (const k of Object.keys(out.boundary)) {
    assert.equal(out.boundary[k], false, `boundary.${k} must be false`);
  }
});

test("TDD-03: output is deep-frozen at every depth", () => {
  const out = buildHomebasePreview({
    gather: makeGather({
      profile: { name: "Mumu", node: "Node0", source_present: true },
      memory_recent: [{ name: "entry-1", mtime_ms: 1, summary: "hello" }],
      memory_size: { bytes: 1024, entries: 5 },
    }),
  });
  assert.equal(Object.isFrozen(out), true);
  assert.equal(Object.isFrozen(out.header), true);
  assert.equal(Object.isFrozen(out.greeting), true);
  assert.equal(Object.isFrozen(out.memory3), true);
  assert.equal(Object.isFrozen(out.memory3.entries), true);
  assert.equal(Object.isFrozen(out.status), true);
  assert.equal(Object.isFrozen(out.status.ring), true);
  assert.equal(Object.isFrozen(out.status.gateway), true);
  assert.equal(Object.isFrozen(out.status.memory_bar), true);
  assert.equal(Object.isFrozen(out.next_action), true);
  assert.equal(Object.isFrozen(out.affordances), true);
  assert.equal(Object.isFrozen(out.affordances[0]), true);
  assert.equal(Object.isFrozen(out.viewport), true);
  assert.equal(Object.isFrozen(out.boundary), true);
  assert.equal(Object.isFrozen(out.warnings), true);
});

test("TDD-04: deterministic — buildHomebasePreview byte-equal across runs given identical input", () => {
  const g1 = makeGather({ profile: { name: "Mumu", node: "Node0", source_present: true } });
  const g2 = makeGather({ profile: { name: "Mumu", node: "Node0", source_present: true } });
  const a = JSON.stringify(buildHomebasePreview({ gather: g1 }));
  const b = JSON.stringify(buildHomebasePreview({ gather: g2 }));
  assert.equal(a, b);
});

test("TDD-05: truth_label === NODE0_LOCAL_SEED", () => {
  const out = buildHomebasePreview({ gather: makeGather() });
  assert.equal(out.truth_label, "NODE0_LOCAL_SEED");
});

test("TDD-06: mode === preview_only", () => {
  const out = buildHomebasePreview({ gather: makeGather() });
  assert.equal(out.mode, "preview_only");
});

test("TDD-07: rendered_at parseable by new Date()", () => {
  const out = buildHomebasePreview({ gather: makeGather() });
  const parsed = new Date(out.rendered_at);
  assert.ok(!Number.isNaN(parsed.getTime()), "rendered_at must be a valid ISO date");
  assert.equal(parsed.getTime(), FIXED_TS.getTime());
});

test("TDD-08: viewport cols_target=76, rows_target=22", () => {
  const out = buildHomebasePreview({ gather: makeGather() });
  assert.equal(out.viewport.cols_target, 76);
  assert.equal(out.viewport.rows_target, 22);
});

test("TDD-09: missing profile yields greeting Welcome. + has_name=false + name_source=absent", () => {
  const out = buildHomebasePreview({
    gather: makeGather({ profile: { name: null, node: "Node0", source_present: false } }),
  });
  assert.equal(out.greeting.text, "Welcome.");
  assert.equal(out.greeting.has_name, false);
  assert.equal(out.greeting.name_source, "absent");
});

test("TDD-10: profile.name=Mumu yields Welcome back, Mumu. + name_source=profile_json", () => {
  const out = buildHomebasePreview({
    gather: makeGather({ profile: { name: "Mumu", node: "Node0", source_present: true } }),
  });
  assert.equal(out.greeting.text, "Welcome back, Mumu.");
  assert.equal(out.greeting.has_name, true);
  assert.equal(out.greeting.name_source, "profile_json");
});

test("TDD-11: empty memory_recent yields memory3.fallback_text === 'no prior sessions'", () => {
  const out = buildHomebasePreview({ gather: makeGather({ memory_recent: [] }) });
  assert.deepEqual(out.memory3.entries, []);
  assert.equal(out.memory3.fallback_text, "no prior sessions");
});

test("TDD-12: status.gateway always reachable=false + by_design=true", () => {
  const out = buildHomebasePreview({ gather: makeGather() });
  assert.equal(out.status.gateway.reachable, false);
  assert.equal(out.status.gateway.by_design, true);
});

test("TDD-13: next_action falls back to 'press ? to see available actions' when process_mining absent", () => {
  const out = buildHomebasePreview({ gather: makeGather({ process_mining: null }) });
  assert.equal(out.next_action.text, "press ? to see available actions");
  assert.equal(out.next_action.source, "fallback");
  assert.equal(out.next_action.command, null);
});

test("TDD-14: affordances has exactly 6 entries with keys m,j,r,b,?,q", () => {
  const out = buildHomebasePreview({ gather: makeGather() });
  assert.equal(out.affordances.length, 6);
  const keys = out.affordances.map((a) => a.key);
  assert.deepEqual(keys, ["m", "j", "r", "b", "?", "q"]);
  for (const a of out.affordances) {
    assert.equal(typeof a.key, "string");
    assert.equal(typeof a.label, "string");
    assert.equal(typeof a.command, "string");
    assert.equal(typeof a.boundary_level, "string");
  }
});

test("ADV-01: buildHomebasePreview({gather: null}) throws TypeError synchronously", () => {
  assert.throws(() => buildHomebasePreview({ gather: null }), TypeError);
});

test("ADV-02: gather with invalid ts throws TypeError synchronously", () => {
  assert.throws(
    () => buildHomebasePreview({ gather: makeGather({ ts: "not-a-date" }) }),
    TypeError,
  );
});

test("ADV-03: mutating input warnings array does not affect output (defensive copy)", () => {
  const inputWarnings = ["initial"];
  const g = makeGather({ warnings: inputWarnings, partial: true });
  const out = buildHomebasePreview({ gather: g });
  inputWarnings.push("smuggled");
  assert.deepEqual(out.warnings, ["initial"]);
  assert.equal(out.warnings.includes("smuggled"), false);
});

test("ADV-04: prototype pollution attempt does not leak into output", () => {
  const dirty = makeGather();
  Object.defineProperty(dirty, "__proto__", { value: { evil: "yes" }, enumerable: true });
  const out = buildHomebasePreview({ gather: dirty });
  assert.equal("evil" in out, false);
  assert.equal(Object.getPrototypeOf(out), Object.prototype);
});

test("ADV-05: enormously long profile.name (10000 chars) does not crash; output still deep-frozen", () => {
  const longName = "A".repeat(10000);
  const out = buildHomebasePreview({
    gather: makeGather({ profile: { name: longName, node: "Node0", source_present: true } }),
  });
  assert.equal(Object.isFrozen(out), true);
  assert.equal(Object.isFrozen(out.greeting), true);
  assert.ok(out.greeting.text.startsWith("Welcome back,"));
  assert.equal(out.greeting.has_name, true);
});

test("ADV-06: next_action surfaces process_mining.next_step_observable when present", () => {
  const out = buildHomebasePreview({
    gather: makeGather({
      process_mining: {
        next_step_observable: "Ring 1 candidate response observable in inbox",
        ring_advancement_status: "Ring 0 verified · Ring 1 candidate sent",
      },
    }),
  });
  assert.equal(out.next_action.text, "Ring 1 candidate response observable in inbox");
  assert.equal(out.next_action.source, "process_mining_preview");
});

test("warnings/partial propagate from gather to preview", () => {
  const out = buildHomebasePreview({
    gather: makeGather({ partial: true, warnings: ["disk-flake-one"] }),
  });
  assert.equal(out.partial, true);
  assert.deepEqual(out.warnings, ["disk-flake-one"]);
});
