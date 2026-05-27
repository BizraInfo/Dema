import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildPATReflectionWitnessPreview,
  buildPATReflectionWitnessSummary,
  buildPATReflectionWitnessEffectCap,
  buildPATReflectionWitnessKernel,
  composeDailyReflection,
  PAT_REFLECTION_WITNESS_PERSONA,
} from "../packages/core/src/pat-reflection-witness.js";
import { isCanonicalBoundary } from "../packages/core/src/preview-boundary.js";

test("PAT-7 canonical schema · pat_number=7 · role=reflection_witness", () => {
  const p = buildPATReflectionWitnessPreview();
  assert.equal(p.schema, "bizra.dema.pat_reflection_witness.v0.1");
  assert.equal(p.persona.pat_number, 7);
  assert.equal(p.persona.role_name, "reflection_witness");
});

test("PAT-7 boundary canonical + deep frozen", () => {
  const p = buildPATReflectionWitnessPreview();
  assert.ok(isCanonicalBoundary(p.boundary));
  assert.ok(Object.isFrozen(p));
});

test("PAT-7 refusals: never judge · never claim without evidence · never modify history", () => {
  const p = buildPATReflectionWitnessPreview();
  assert.ok(p.persona.primary_refusals.includes("judge_the_operator"));
  assert.ok(
    p.persona.primary_refusals.includes(
      "claim_doctrine_catch_without_evidence",
    ),
  );
  assert.ok(p.persona.primary_refusals.includes("modify_observed_history"));
  assert.ok(
    p.persona.primary_refusals.includes("extrapolate_pattern_from_n_eq_1"),
  );
  assert.ok(p.persona.primary_refusals.includes("score_or_grade_the_operator"));
});

test("PAT-7 EffectCap blocks judge · modify-history · infer-from-silence · score", () => {
  const cap = buildPATReflectionWitnessEffectCap();
  assert.equal(cap.valid, true);
  assert.ok(cap.blocked_effects.includes("judge_operator"));
  assert.ok(cap.blocked_effects.includes("modify_observed_history"));
  assert.ok(cap.blocked_effects.includes("infer_intent_from_silence"));
  assert.ok(cap.blocked_effects.includes("score_operator_performance"));
});

test("PAT-7 kernel pre-configured correctly", () => {
  const k = buildPATReflectionWitnessKernel({
    mission_intent: "compose reflection",
  });
  assert.equal(k.agent_id, "pat-7-reflection-witness");
});

test("composeDailyReflection · valid input · canonical schema", () => {
  const r = composeDailyReflection({
    date: "2026-05-18",
    commits_today: [{ sha: "abc", title: "test" }],
    doctrine_catches: [],
    memory_writes_today: ["today.json"],
  });
  assert.equal(r.schema, "bizra.dema.daily_reflection.v0.1");
  assert.equal(r.truth_label, "NODE0_LOCAL_SEED");
  assert.equal(r.date, "2026-05-18");
  assert.equal(r.summary.commit_count, 1);
  assert.equal(r.summary.memory_writes_count, 1);
});

test("composeDailyReflection · catch WITH evidence_pointer → V-grade", () => {
  const r = composeDailyReflection({
    doctrine_catches: [
      {
        claim: "boundary violated",
        evidence_pointer: "packages/core/x.js:42",
        doctrine_canon_referenced: "preview-boundary",
      },
    ],
  });
  assert.equal(r.verified_catches.length, 1);
  assert.equal(r.assumed_catches.length, 0);
  assert.equal(r.verified_catches[0].evidence_grade, "V");
});

test("composeDailyReflection · catch WITHOUT evidence_pointer → A-grade (downgraded)", () => {
  const r = composeDailyReflection({
    doctrine_catches: [
      { claim: "something happened", doctrine_canon_referenced: "any-canon" },
    ],
  });
  assert.equal(r.verified_catches.length, 0);
  assert.equal(r.assumed_catches.length, 1);
  assert.equal(r.assumed_catches[0].evidence_grade, "A");
});

test("composeDailyReflection · pattern detection requires N≥2 same canon", () => {
  const r = composeDailyReflection({
    doctrine_catches: [
      {
        claim: "x",
        evidence_pointer: "a:1",
        doctrine_canon_referenced: "key-maker",
      },
      {
        claim: "y",
        evidence_pointer: "b:1",
        doctrine_canon_referenced: "key-maker",
      },
      {
        claim: "z",
        evidence_pointer: "c:1",
        doctrine_canon_referenced: "law-of-assumption",
      },
    ],
  });
  // key-maker has N=2 · key-maker pattern fires
  // law-of-assumption has N=1 · does NOT fire
  assert.equal(r.repeating_patterns.length, 1);
  assert.equal(r.repeating_patterns[0].canon_referenced, "key-maker");
  assert.equal(r.repeating_patterns[0].occurrences, 2);
});

test("composeDailyReflection · NEVER offers operator_judgment", () => {
  const r = composeDailyReflection({ doctrine_catches: [] });
  assert.equal(r.operator_judgment_offered, false);
});

test("composeDailyReflection · session_metrics propagated honestly · null when absent", () => {
  const r = composeDailyReflection({
    session_metrics: {
      tests_pass: 1000,
      gates_green: true,
      spine_surfaces: 12,
    },
  });
  assert.equal(r.summary.session_metrics.tests_pass, 1000);
  assert.equal(r.summary.session_metrics.gates_green, true);
  assert.equal(r.summary.session_metrics.spine_surfaces, 12);

  const empty = composeDailyReflection({});
  assert.equal(empty.summary.session_metrics.tests_pass, null);
  assert.equal(empty.summary.session_metrics.gates_green, false);
});

test("Adversarial · non-array commits coerced to empty", () => {
  const r = composeDailyReflection({ commits_today: "not-array" });
  assert.equal(r.summary.commit_count, 0);
});

test("Adversarial · non-object catches filtered out", () => {
  const r = composeDailyReflection({
    doctrine_catches: [
      { claim: "valid", evidence_pointer: "x:1" },
      "not-an-object",
      null,
      undefined,
    ],
  });
  assert.equal(r.doctrine_catches_classified.length, 1);
});

test("Reflection output deep-frozen + canonical boundary", () => {
  const r = composeDailyReflection({});
  assert.ok(Object.isFrozen(r));
  assert.ok(Object.isFrozen(r.doctrine_catches_classified));
  assert.ok(Object.isFrozen(r.repeating_patterns));
  assert.ok(isCanonicalBoundary(r.boundary));
});

test("Summary fits within line budget · exports frozen", () => {
  const s = buildPATReflectionWitnessSummary();
  assert.ok(JSON.stringify(s, null, 2).split("\n").length <= 40);
  assert.ok(Object.isFrozen(PAT_REFLECTION_WITNESS_PERSONA));
  assert.equal(PAT_REFLECTION_WITNESS_PERSONA.pat_number, 7);
});
