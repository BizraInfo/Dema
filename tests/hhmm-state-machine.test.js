import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  buildHhmmStateMachine,
  classifyHhmmObservation,
  transitionHhmmState,
  runHhmmTrace,
  verifyHhmmMachine,
  HHMM_STATE_MACHINE_SCHEMA,
} from "../packages/core/src/hhmm-state-machine.js";

const SHA256_HEX = /^[a-f0-9]{64}$/;

test("1 · builds the canonical frozen Node0 lifecycle machine", () => {
  const m = buildHhmmStateMachine();
  assert.equal(m.schema, HHMM_STATE_MACHINE_SCHEMA);
  assert.equal(m.schema, "bizra.dema.hhmm_state_machine.v0.1");
  assert.equal(m.initial_state, "declared");
  for (const s of [
    "declared",
    "preview",
    "tested_preview",
    "gate_blocked",
    "merge_ready",
    "merged",
    "designed_not_live",
    "rejected",
  ]) {
    assert.ok(m.states.includes(s), `state ${s} present`);
  }
  assert.equal(Object.isFrozen(m), true);
  assert.equal(Object.isFrozen(m.states), true);
  assert.equal(Object.isFrozen(m.transitions), true);
  assert.equal(verifyHhmmMachine(m).valid, true);
});

test("2 · rejects an unknown current state (fail closed)", () => {
  const m = buildHhmmStateMachine();
  const r = transitionHhmmState({ machine: m, current_state: "not_a_state", observation: "tests_passed" });
  assert.equal(r.valid, false);
  assert.match(r.reason_code, /unknown_state/);
});

test("3 · verify rejects a machine whose transition targets an unknown state", () => {
  const broken = buildHhmmStateMachine({
    states: ["declared", "preview"],
    transitions: { declared: { code_anchor_present: { to: "ghost_state", reason_code: "x" } }, preview: {} },
    emissions: ["code_anchor_present"],
    initial_state: "declared",
  });
  const v = verifyHhmmMachine(broken);
  assert.equal(v.valid, false);
  assert.ok(v.blocked_by.some((b) => b.includes("transition_target_unknown")));
});

test("4 · classifies clean evidence into tested_preview then merge_ready", () => {
  const m = buildHhmmStateMachine();
  const a = runHhmmTrace({ machine: m, observations: ["code_anchor_present", "tests_passed"] });
  assert.equal(a.valid, true);
  assert.equal(a.final_state, "tested_preview");

  const b = runHhmmTrace({
    machine: m,
    observations: ["code_anchor_present", "tests_passed", "ci_green"],
  });
  assert.equal(b.valid, true);
  assert.equal(b.final_state, "merge_ready");
});

test("5 · keeps a DESIGNED_NOT_LIVE component from promoting to merged", () => {
  const m = buildHhmmStateMachine();
  // designed_only sends it to designed_not_live; a later pr_merged must NOT reach merged
  const trace = runHhmmTrace({
    machine: m,
    observations: ["code_anchor_present", "designed_only", "pr_merged"],
  });
  assert.notEqual(trace.final_state, "merged");
  assert.equal(trace.final_state, "designed_not_live");
  const lastStep = trace.path[trace.path.length - 1];
  assert.equal(lastStep.valid, false);
  assert.match(lastStep.reason_code, /invalid_transition/);
});

test("6 · gate failure transitions an active state to gate_blocked", () => {
  const m = buildHhmmStateMachine();
  const r = transitionHhmmState({ machine: m, current_state: "tested_preview", observation: "gate_failed" });
  assert.equal(r.valid, true);
  assert.equal(r.to, "gate_blocked");
  assert.equal(r.reason_code, "gate_failed");
});

test("7 · merge evidence transitions merge_ready -> merged", () => {
  const m = buildHhmmStateMachine();
  const r = transitionHhmmState({ machine: m, current_state: "merge_ready", observation: "pr_merged" });
  assert.equal(r.valid, true);
  assert.equal(r.to, "merged");
});

test("8 · trace hash is deterministic for identical inputs", () => {
  const m = buildHhmmStateMachine();
  const obs = ["code_anchor_present", "tests_passed", "ci_green", "pr_merged"];
  const a = runHhmmTrace({ machine: m, observations: obs });
  const b = runHhmmTrace({ machine: m, observations: obs });
  assert.match(a.trace_hash, SHA256_HEX);
  assert.equal(a.trace_hash, b.trace_hash);
  assert.equal(a.final_state, "merged");
});

test("9 · trace hash changes when an observation changes", () => {
  const m = buildHhmmStateMachine();
  const a = runHhmmTrace({ machine: m, observations: ["code_anchor_present", "tests_passed"] });
  const b = runHhmmTrace({ machine: m, observations: ["code_anchor_present", "gate_failed"] });
  assert.notEqual(a.trace_hash, b.trace_hash);
});

test("10 · module source has no forbidden side effects", async () => {
  const src = await readFile(
    new URL("../packages/core/src/hhmm-state-machine.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(src, /node:(fs|net|http|https|child_process|os|worker_threads)\b/);
  assert.doesNotMatch(src, /\bDate\.now\b|\bnew Date\b|\bMath\.random\b/);
  assert.doesNotMatch(src, /\bfetch\s*\(|\bimport\s*\(/);
});

test("11 · malformed observation rejects fail-closed", () => {
  const m = buildHhmmStateMachine();
  const r = transitionHhmmState({ machine: m, current_state: "declared", observation: 42 });
  assert.equal(r.valid, false);
  assert.match(r.reason_code, /malformed_observation|unsupported_emission/);

  const c = classifyHhmmObservation({ machine: m, observation: "not_an_emission" });
  assert.equal(c.valid, false);
  assert.match(c.reason_code, /unsupported_emission/);
});

test("12 · every negative verdict carries a reason_code", () => {
  const m = buildHhmmStateMachine();
  const negatives = [
    transitionHhmmState({ machine: m, current_state: "merged", observation: "pr_merged" }),
    transitionHhmmState({ machine: m, current_state: "declared", observation: "pr_merged" }),
    transitionHhmmState({ machine: m, current_state: "x", observation: "tests_passed" }),
    classifyHhmmObservation({ machine: m, observation: "bad" }),
  ];
  for (const n of negatives) {
    assert.equal(n.valid, false);
    assert.equal(typeof n.reason_code, "string");
    assert.ok(n.reason_code.length > 0);
  }
});

test("13 · does NOT claim neural / learned-probabilistic inference", async () => {
  const m = buildHhmmStateMachine();
  assert.equal(m.learned_probabilistic_inference, false);
  assert.equal(m.inference_method, "deterministic_rule_table");
  assert.ok(
    m.what_this_does_not_prove.some((line) => /not.*(neural|machine learning|learned|ml)/i.test(line)),
  );
  // confidence is a deterministic rule value, not a probability claim
  const r = transitionHhmmState({ machine: m, current_state: "merge_ready", observation: "pr_merged" });
  assert.equal(typeof r.confidence, "number");
  assert.ok(r.confidence >= 0 && r.confidence <= 1);
});

test("14 · boundary is entirely false", () => {
  const m = buildHhmmStateMachine();
  for (const [k, v] of Object.entries(m.boundary)) {
    assert.equal(v, false, `boundary.${k} must be false`);
  }
});

test("15 · verify fails closed on a tampered boundary AND on an ML-inference overclaim", () => {
  const m = buildHhmmStateMachine();

  const tamperedBoundary = JSON.parse(JSON.stringify(m));
  tamperedBoundary.boundary.runtime_execution_performed = true;
  const vb = verifyHhmmMachine(tamperedBoundary);
  assert.equal(vb.valid, false);
  assert.ok(vb.blocked_by.some((b) => b.includes("boundary_not_false")));

  const tamperedMl = JSON.parse(JSON.stringify(m));
  tamperedMl.learned_probabilistic_inference = true;
  const vm = verifyHhmmMachine(tamperedMl);
  assert.equal(vm.valid, false);
  assert.ok(vm.blocked_by.some((b) => b.includes("ml_inference_overclaim")));
});

test("16 · a valid transition always carries numeric confidence (no null-confidence fail-open)", () => {
  const m = buildHhmmStateMachine();
  const custom = JSON.parse(JSON.stringify(m));
  // an emission with a transition but NO confidence entry
  custom.emissions.push("mystery_signal");
  custom.transitions.declared.mystery_signal = { to: "preview", reason_code: "mystery" };

  const r = transitionHhmmState({ machine: custom, current_state: "declared", observation: "mystery_signal" });
  assert.equal(r.valid, false);
  assert.match(r.reason_code, /emission_confidence_missing/);

  const v = verifyHhmmMachine(custom);
  assert.equal(v.valid, false);
  assert.ok(v.blocked_by.some((b) => b.includes("emission_confidence_missing")));
});
