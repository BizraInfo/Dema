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

import {
  buildHashTableKnowledgeIndex,
  queryHashTableKnowledgeIndex,
  verifyHashTableKnowledgeIndex,
  normalizeKnowledgeEntry,
  HASH_TABLE_KNOWLEDGE_INDEX_SCHEMA,
  HASH_TABLE_AXES,
} from "../packages/core/src/hash-table-knowledge-index.js";

const SHA256_HEX = /^[a-f0-9]{64}$/;

function hashEntries() {
  return [
    {
      id: "component:dema-face",
      axis: "component",
      key: "dema",
      title: "Dema face",
      summary: "Local companion interface boundary.",
      evidence: ["docs/ARCHITECTURE.md"],
      tags: ["node0", "face"],
    },
    {
      id: "claim:rsi-preview-only",
      axis: "claim",
      key: "rsi-preview-only",
      title: "RSI preview only",
      summary: "RSI proposal kernel does not execute proposals.",
      evidence: ["docs/02-architecture/RSI_PROPOSAL_PREVIEW_v0_1.md"],
      tags: ["rsi", "boundary"],
    },
    {
      id: "risk:overclaim",
      axis: "risk",
      key: "overclaim",
      title: "Overclaim risk",
      summary: "Framework labels can outrun implementation evidence.",
      evidence: ["docs/02-architecture/HHMM_STATE_MACHINE_v0_1.md"],
      tags: ["ihsan", "claim-discipline"],
    },
  ];
}

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
  custom.emissions.push("mystery_signal");
  custom.transitions.declared.mystery_signal = { to: "preview", reason_code: "mystery" };

  const r = transitionHhmmState({ machine: custom, current_state: "declared", observation: "mystery_signal" });
  assert.equal(r.valid, false);
  assert.match(r.reason_code, /emission_confidence_missing/);

  const v = verifyHhmmMachine(custom);
  assert.equal(v.valid, false);
  assert.ok(v.blocked_by.some((b) => b.includes("emission_confidence_missing")));
});

test("17 · hash-table index builds deterministic frozen six-axis buckets", () => {
  const a = buildHashTableKnowledgeIndex({ entries: hashEntries(), namespace: "node0" });
  const b = buildHashTableKnowledgeIndex({ entries: hashEntries(), namespace: "node0" });
  assert.equal(a.schema, HASH_TABLE_KNOWLEDGE_INDEX_SCHEMA);
  assert.deepEqual(a.axes, HASH_TABLE_AXES);
  assert.equal(a.entry_count, 3);
  assert.equal(a.index_hash, b.index_hash);
  assert.match(a.index_hash, SHA256_HEX);
  assert.equal(Object.isFrozen(a), true);
  assert.equal(verifyHashTableKnowledgeIndex(a).valid, true);
});

test("18 · hash-table query returns the matching bucket only", () => {
  const index = buildHashTableKnowledgeIndex({ entries: hashEntries() });
  const hit = queryHashTableKnowledgeIndex({ index, axis: "risk", key: "overclaim" });
  assert.equal(hit.valid, true);
  assert.equal(hit.found, true);
  assert.equal(hit.entries.length, 1);
  assert.equal(hit.entries[0].id, "risk:overclaim");

  const miss = queryHashTableKnowledgeIndex({ index, axis: "risk", key: "missing" });
  assert.equal(miss.valid, true);
  assert.equal(miss.found, false);
  assert.equal(miss.reason_code, "bucket_not_found");
});

test("19 · hash-table rejects unknown axes and missing evidence", () => {
  const badAxis = normalizeKnowledgeEntry({ id: "x", axis: "unknown", key: "x", evidence: ["a"] });
  assert.equal(badAxis.valid, false);
  assert.equal(badAxis.reason_code, "axis_unknown");

  const noEvidence = normalizeKnowledgeEntry({ id: "x", axis: "claim", key: "x" });
  assert.equal(noEvidence.valid, false);
  assert.equal(noEvidence.reason_code, "evidence_required");
});

test("20 · hash-table rejects duplicate entry ids", () => {
  const [entry] = hashEntries();
  const out = buildHashTableKnowledgeIndex({ entries: [entry, { ...entry }] });
  assert.equal(out.valid, false);
  assert.equal(out.reason_code, "duplicate_entry_id");
});

test("21 · hash-table hashes change when entry bodies change", () => {
  const base = buildHashTableKnowledgeIndex({ entries: hashEntries() });
  const changed = buildHashTableKnowledgeIndex({
    entries: hashEntries().map((entry) => entry.id === "risk:overclaim" ? { ...entry, summary: "Changed bounded summary." } : entry),
  });
  assert.notEqual(base.index_hash, changed.index_hash);
});

test("22 · hash-table verifier catches entry, index, and boundary tampering", () => {
  const index = buildHashTableKnowledgeIndex({ entries: hashEntries() });

  const entryTamper = JSON.parse(JSON.stringify(index));
  entryTamper.entries[0].summary = "tampered";
  assert.ok(verifyHashTableKnowledgeIndex(entryTamper).blocked_by.some((b) => b.includes("entry_hash_mismatch")));

  const indexTamper = JSON.parse(JSON.stringify(index));
  indexTamper.namespace = "tampered";
  assert.ok(verifyHashTableKnowledgeIndex(indexTamper).blocked_by.includes("index_hash_mismatch"));

  const boundaryTamper = JSON.parse(JSON.stringify(index));
  boundaryTamper.boundary.network_call_performed = true;
  assert.ok(verifyHashTableKnowledgeIndex(boundaryTamper).blocked_by.some((b) => b.includes("boundary_not_false")));
});

test("23 · hash-table source has no fs/network/process/clock/random surfaces", async () => {
  const src = await readFile(
    new URL("../packages/core/src/hash-table-knowledge-index.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(src, /node:(fs|net|http|https|child_process|os|worker_threads)\b/);
  assert.doesNotMatch(src, /\bDate\.now\b|\bnew Date\b|\bMath\.random\b/);
  assert.doesNotMatch(src, /\bfetch\s*\(|\bimport\s*\(/);
});

test("24 · hash-table boundary remains all false and does not claim semantic truth", () => {
  const index = buildHashTableKnowledgeIndex({ entries: hashEntries() });
  for (const [key, value] of Object.entries(index.boundary)) {
    assert.equal(value, false, `boundary.${key} must remain false`);
  }
  assert.ok(index.what_this_does_not_prove.some((line) => /does not prove semantic truth/i.test(line)));
  assert.ok(index.what_this_does_not_prove.some((line) => /not a database/i.test(line)));
});
