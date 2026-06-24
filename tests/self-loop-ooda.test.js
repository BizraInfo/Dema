import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256, stableStringify } from "../packages/consent/src/consent-common.js";

import {
  buildSelfLoopOodaCycle,
  normalizeSelfLoopStep,
  verifySelfLoopOodaCycle,
  SELF_LOOP_OODA_SCHEMA,
  SELF_LOOP_PHASES,
} from "../packages/core/src/self-loop-ooda.js";

const SHA256_HEX = /^[a-f0-9]{64}$/;

function steps() {
  return [
    { phase: "observe", claim: "PR gates reported success for the bounded slice.", evidence: ["gh-run-list:check-success"] },
    { phase: "orient", claim: "The slice is a pure kernel and should remain local-only.", evidence: ["docs/02-architecture/SELF_AWARENESS_REPORT_v0_1.md"] },
    { phase: "decide", claim: "Proceed only if all required gates are green.", evidence: ["docs/TESTING.md"] },
    { phase: "act", claim: "Prepare the next bounded proposal.", proposed_action: "open review-only PR after gates pass", evidence: ["pull-request-template"] },
    { phase: "review", claim: "Verify that no boundary was expanded.", evidence: ["npm-run-check:success"] },
  ];
}

test("1 · builds a deterministic frozen OODA self-loop cycle", () => {
  const a = buildSelfLoopOodaCycle({ steps: steps(), cycle_id: "cycle-1" });
  const b = buildSelfLoopOodaCycle({ steps: steps(), cycle_id: "cycle-1" });
  assert.equal(a.schema, SELF_LOOP_OODA_SCHEMA);
  assert.equal(a.schema, "bizra.dema.self_loop_ooda.v0.1");
  assert.deepEqual(a.phases, SELF_LOOP_PHASES);
  assert.equal(a.phase_count, 5);
  assert.equal(a.phase_coverage, 1);
  assert.equal(a.phase_coverage_formula, "5/5");
  assert.equal(a.recommendation, "PROPOSE_NEXT_BOUNDED_CYCLE");
  assert.equal(a.cycle_hash, b.cycle_hash);
  assert.match(a.cycle_hash, SHA256_HEX);
  assert.equal(Object.isFrozen(a), true);
  assert.equal(verifySelfLoopOodaCycle(a).valid, true);
});

test("2 · incomplete cycles are honest HOLD, not autonomous execution", () => {
  const c = buildSelfLoopOodaCycle({ steps: steps().filter((s) => s.phase !== "review") });
  assert.equal(c.recommendation, "HOLD");
  assert.deepEqual(c.missing_phases, ["review"]);
  assert.equal(c.phase_coverage, 0.8);
  assert.equal(c.proposed_next_cycle, false);
  assert.equal(c.autonomous_loop_started, false);
});

test("3 · rejects unknown, duplicate, and evidence-free phases", () => {
  assert.equal(normalizeSelfLoopStep({ phase: "ghost", claim: "x", evidence: ["e"] }).reason_code, "phase_unknown");
  assert.equal(normalizeSelfLoopStep({ phase: "observe", claim: "x" }).reason_code, "evidence_required");
  const duplicate = buildSelfLoopOodaCycle({ steps: [steps()[0], steps()[0]] });
  assert.equal(duplicate.valid, false);
  assert.equal(duplicate.reason_code, "duplicate_phase");
});

test("4 · ACT phase cannot claim execution", () => {
  const r = normalizeSelfLoopStep({ phase: "act", claim: "Run it", evidence: ["e"], executed: true });
  assert.equal(r.valid, false);
  assert.equal(r.reason_code, "act_phase_must_not_execute");
});

test("5 · self-loop overclaims are rejected before they become recommendations", () => {
  const r = normalizeSelfLoopStep({
    phase: "decide",
    claim: "Start autonomous loop and execute action",
    evidence: ["operator-note"],
  });
  assert.equal(r.valid, false);
  assert.equal(r.reason_code, "self_loop_overclaim");
});

test("6 · cycle hash changes when an evidence anchor changes", () => {
  const a = buildSelfLoopOodaCycle({ steps: steps() });
  const changed = steps();
  changed[0] = { ...changed[0], evidence: ["different-anchor"] };
  const b = buildSelfLoopOodaCycle({ steps: changed });
  assert.notEqual(a.cycle_hash, b.cycle_hash);
});

test("7 · verifier catches step, cycle, coverage, and boundary tampering", () => {
  const c = buildSelfLoopOodaCycle({ steps: steps() });

  const stepTamper = JSON.parse(JSON.stringify(c));
  stepTamper.steps[0].claim = "tampered";
  assert.ok(verifySelfLoopOodaCycle(stepTamper).blocked_by.some((b) => b.includes("step_hash_mismatch")));

  const coverageTamper = JSON.parse(JSON.stringify(c));
  coverageTamper.phase_coverage = 0.2;
  const { cycle_hash: _drop1, ...coverageBody } = coverageTamper;
  coverageTamper.cycle_hash = sha256(stableStringify(coverageBody));
  assert.ok(verifySelfLoopOodaCycle(coverageTamper).blocked_by.includes("phase_coverage_mismatch"));

  const boundaryTamper = JSON.parse(JSON.stringify(c));
  boundaryTamper.boundary.autonomous_loop_started = true;
  assert.ok(verifySelfLoopOodaCycle(boundaryTamper).blocked_by.some((b) => b.includes("boundary_not_false")));

  const cycleTamper = JSON.parse(JSON.stringify(c));
  cycleTamper.cycle_id = "tampered";
  assert.ok(verifySelfLoopOodaCycle(cycleTamper).blocked_by.includes("cycle_hash_mismatch"));
});

test("8 · verifier re-derives steps_by_phase and missing phases instead of trusting stored indexes", () => {
  const c = buildSelfLoopOodaCycle({ steps: steps() });
  const forged = JSON.parse(JSON.stringify(c));
  forged.steps_by_phase.observe = forged.steps_by_phase.review;
  const { cycle_hash: _drop, ...body } = forged;
  forged.cycle_hash = sha256(stableStringify(body));
  const v = verifySelfLoopOodaCycle(forged);
  assert.equal(v.valid, false);
  assert.ok(v.blocked_by.includes("steps_by_phase_mismatch"));
  assert.ok(!v.blocked_by.includes("cycle_hash_mismatch"), "hash backstop was bypassed; invariant check must catch it");
});

test("9 · source has no fs/network/process/clock/random side-effect surfaces", async () => {
  const src = await readFile(new URL("../packages/core/src/self-loop-ooda.js", import.meta.url), "utf8");
  assert.doesNotMatch(src, /node:(fs|net|http|https|child_process|os|worker_threads)\b/);
  assert.doesNotMatch(src, /\bDate\.now\b|\bnew Date\b|\bMath\.random\b/);
  assert.doesNotMatch(src, /\bfetch\s*\(|\bimport\s*\(/);
});

test("10 · boundary is all false and scope does not claim runtime looping", () => {
  const c = buildSelfLoopOodaCycle({ steps: steps() });
  for (const [k, v] of Object.entries(c.boundary)) assert.equal(v, false, `boundary.${k} must stay false`);
  assert.equal(c.action_executed_by_kernel, false);
  assert.equal(c.autonomous_loop_started, false);
  assert.ok(c.what_this_does_not_prove.some((line) => /not an autonomous loop/i.test(line)));
  assert.ok(c.what_this_does_not_prove.some((line) => /does not execute the ACT phase/i.test(line)));
});

test("11 · every negative result carries a reason_code", () => {
  const negatives = [
    buildSelfLoopOodaCycle({ steps: "bad" }),
    normalizeSelfLoopStep({ phase: "observe", claim: "x" }),
    normalizeSelfLoopStep({ phase: "act", claim: "x", evidence: ["e"], executed: true }),
    verifySelfLoopOodaCycle(null),
  ];
  for (const n of negatives) {
    assert.equal(n.valid, false);
    assert.equal(typeof n.reason_code, "string");
    assert.ok(n.reason_code.length > 0);
  }
});
