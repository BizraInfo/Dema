import test from "node:test";
import assert from "node:assert/strict";

import {
  runZeroSpinGate,
  scrubTelemetryNoise,
  verifyZeroSpinReceiptChain,
  ZERO_SPIN_GATE_SCHEMA,
  ZERO_SPIN_GATE_TRUTH_LABEL,
} from "../packages/core/src/zero-spin-gate.js";

// -----------------------------------------------------------------------------
// Spec interpretation note (orchestrator_briefing: proof_harness.py is GONE and
// unreadable; these controls encode the WRITTEN INVARIANT SPEC, not a port).
//
// A "step" is one unit of work an agent took toward a goal. Each step carries
// a `context` (the state it observed) and an `action` (what it did). The gate
// walks origin(0) -> step(n) and classifies the FIRST falsifiable spin:
//   F-I   ctx_spin(origin->step)      1-step canonical context digest collision
//                                     (step's context digest == the immediately
//                                     previous step's context digest).
//   F-II  ctx_cycle(origin->step)     non-adjacent k-cycle: the step's context
//                                     digest equals a NON-adjacent earlier
//                                     visited context digest (oscillation).
//   F-III action_stall(origin->step)  context mutates but the NORMALIZED action
//                                     digest repeats the previous step's.
//   F-IV  budget_exhausted            no verified convergence within maxSteps.
//   OK:VERIFIED                       converged with 0 spins inside budget.
// Detection order per step is F-I, then F-II, then F-III (context collisions are
// a stronger/earlier guard than an action stall). Gate flags are orthogonal:
// enableCtxGate guards F-I and F-II; enableActionGate guards F-III.
// -----------------------------------------------------------------------------

// A run that converges: `verified:true` on the final step signals OK:VERIFIED.
function stepRecord({ context, action, verified = false }) {
  return { context, action, verified };
}

test("schema and truth label are the frozen PREVIEW_ONLY constants", () => {
  assert.equal(ZERO_SPIN_GATE_SCHEMA, "bizra.dema.zero_spin_gate.v0.1");
  assert.equal(ZERO_SPIN_GATE_TRUTH_LABEL, "ZERO_SPIN_GATE_PREVIEW_ONLY");
});

test("telemetry noise scrubbing is deterministic for the five tokens", () => {
  // Each noise class is replaced by its stable placeholder so two structurally
  // identical actions that differ ONLY in telemetry hash to the same digest.
  const noisy = {
    ts: "2026-10-19T12:00:00.123Z",
    ptr: "0x7ffabc123def",
    pod: "pod-8d4f2a-worker-17",
    uuid: "550e8400-e29b-41d4-a716-446655440000",
    telem: "telem=cpu:0.84,mem:0.41,lat:12ms",
  };
  const scrubbedOnce = scrubTelemetryNoise(noisy);
  const scrubbedTwice = scrubTelemetryNoise(noisy);
  assert.deepEqual(scrubbedOnce, scrubbedTwice, "scrub must be deterministic");

  const flat = JSON.stringify(scrubbedOnce);
  assert.match(flat, /<TS>/);
  assert.match(flat, /<PTR>/);
  assert.match(flat, /<POD>/);
  assert.match(flat, /<UUID>/);
  assert.match(flat, /<TELEM>/);
  // No raw noise survives.
  assert.doesNotMatch(flat, /2026-10-19T12:00:00/);
  assert.doesNotMatch(flat, /0x7ffabc123def/);
  assert.doesNotMatch(flat, /550e8400-e29b-41d4-a716-446655440000/);
});

test("boundary is the frozen preview boundary on every run", () => {
  const result = runZeroSpinGate({
    maxSteps: 4,
    steps: [stepRecord({ context: { k: 1 }, action: { do: "a", verified: true }, verified: true })],
  });
  assert.equal(result.boundary.runtimeActivated, false);
  assert.equal(result.boundary.networkCalled, false);
  assert.equal(result.boundary.authorityDelta, 0);
});

// --- Falsifiable control: F-IV ungated full-budget waste -----------------
test("F-IV: ungated full-budget waste exhausts budget with no convergence", () => {
  // Both gates OFF, no step ever verifies: the run must burn maxSteps and
  // classify budget_exhausted rather than silently reporting OK.
  const steps = Array.from({ length: 5 }, (_, i) =>
    stepRecord({ context: { phase: i }, action: { do: `probe-${i}` } }),
  );
  const result = runZeroSpinGate({
    maxSteps: 5,
    enableCtxGate: false,
    enableActionGate: false,
    steps,
  });
  assert.equal(result.classification, "F-IV:budget_exhausted");
  assert.equal(result.verified, false);
  assert.equal(result.spinsDetected, 0);
});

// --- Falsifiable control: F-I 1-step lazy retry --------------------------
test("F-I: 1-step lazy retry is caught as ctx_spin(0->1)", () => {
  // Step 1 observes the IDENTICAL context as step 0 (a lazy retry): adjacent
  // canonical context digest collision -> F-I at the first opportunity.
  const result = runZeroSpinGate({
    maxSteps: 5,
    enableCtxGate: true,
    enableActionGate: true,
    steps: [
      stepRecord({ context: { goal: "x", seen: ["a"] }, action: { do: "look" } }),
      stepRecord({ context: { goal: "x", seen: ["a"] }, action: { do: "look-again" } }),
    ],
  });
  assert.equal(result.classification, "F-I:ctx_spin(0->1)");
  assert.equal(result.verified, false);
});

// --- Falsifiable control: orthogonal ablation ----------------------------
test("orthogonal ablation (both gates ON): preempted at Step 2 by F-III:action_stall(1->2)", () => {
  // Telemetry noise differs each step so the RAW context looks fresh, but once
  // scrubbed the action at step 2 is structurally identical to step 1's while
  // the context legitimately mutates -> action_stall fires first at (1->2).
  const steps = [
    stepRecord({
      context: { step: 0, ptr: "0x1000" },
      action: { verb: "scan", target: "dir-a", ts: "2026-10-19T00:00:00Z" },
    }),
    stepRecord({
      context: { step: 1, ptr: "0x2000" },
      action: { verb: "edit", target: "file-1", ts: "2026-10-19T00:00:01Z" },
    }),
    stepRecord({
      // context mutates (step advances, new pointer) ...
      context: { step: 2, ptr: "0x3000" },
      // ... but the action is the SAME edit modulo telemetry (ts) noise.
      action: { verb: "edit", target: "file-1", ts: "2026-10-19T00:00:99Z" },
    }),
  ];
  const result = runZeroSpinGate({
    maxSteps: 6,
    enableCtxGate: true,
    enableActionGate: true,
    steps,
  });
  assert.equal(result.classification, "F-III:action_stall(1->2)");
});

test("orthogonal ablation (Action Gate OFF / Context Gate ON): caught at Step 3 by F-I:ctx_spin(2->3)", () => {
  // With the action gate OFF the action_stall at (1->2) is NOT caught; the run
  // proceeds until step 3 re-observes step 2's context (adjacent collision),
  // which the still-ON context gate catches as F-I:ctx_spin(2->3).
  const steps = [
    stepRecord({ context: { step: 0, ptr: "0x1000" }, action: { verb: "scan", target: "dir-a", ts: "t0" } }),
    stepRecord({ context: { step: 1, ptr: "0x2000" }, action: { verb: "edit", target: "file-1", ts: "t1" } }),
    stepRecord({ context: { step: 2, ptr: "0x3000" }, action: { verb: "edit", target: "file-1", ts: "t2" } }),
    // step 3 re-observes step 2's (scrubbed) context exactly:
    stepRecord({ context: { step: 2, ptr: "0x9999" }, action: { verb: "edit", target: "file-2", ts: "t3" } }),
  ];
  const result = runZeroSpinGate({
    maxSteps: 6,
    enableCtxGate: true,
    enableActionGate: false,
    steps,
  });
  assert.equal(result.classification, "F-I:ctx_spin(2->3)");
});

// --- Falsifiable control: F-II ping-pong cycle ---------------------------
test("F-II: ping-pong cycle is caught as ctx_cycle(2->4)", () => {
  // Contexts oscillate A,B,A,B,A. Spec interpretation (documented in the kernel
  // header: the lost proof_harness.py is unreadable, so this is the literal
  // reading of "non-adjacent k-cycle oscillation"): a single revisit A,B,A is
  // NOT yet a cycle; the cycle is confirmed only when the anchor digest A recurs
  // a THIRD time at a stable period k (indices 0,2,4 -> period 2), i.e. at step
  // 4, binding one period back to step 2 -> ctx_cycle(2->4). Actions differ each
  // step so no action_stall preempts it.
  const ctxA = { place: "A" };
  const ctxB = { place: "B" };
  const steps = [
    stepRecord({ context: ctxA, action: { do: "m0" } }),
    stepRecord({ context: ctxB, action: { do: "m1" } }),
    stepRecord({ context: ctxA, action: { do: "m2" } }),
    stepRecord({ context: ctxB, action: { do: "m3" } }),
    stepRecord({ context: ctxA, action: { do: "m4" } }),
  ];
  const result = runZeroSpinGate({
    maxSteps: 8,
    enableCtxGate: true,
    enableActionGate: true,
    steps,
  });
  assert.equal(result.classification, "F-II:ctx_cycle(2->4)");
});

// --- Falsifiable control: cosmetic/comment action spoof ------------------
test("F-III: cosmetic/comment action spoof is caught as action_stall(1->2)", () => {
  // The step-2 action differs from step-1 ONLY by a cosmetic comment field;
  // normalization strips it, so the normalized action digest repeats while the
  // context mutates -> action_stall(1->2).
  const steps = [
    stepRecord({ context: { n: 0 }, action: { code: "x = 1;", comment: "init" } }),
    stepRecord({ context: { n: 1 }, action: { code: "x = 2;", comment: "bump" } }),
    stepRecord({ context: { n: 2 }, action: { code: "x = 2;", comment: "// cosmetic only" } }),
  ];
  const result = runZeroSpinGate({
    maxSteps: 6,
    enableCtxGate: true,
    enableActionGate: true,
    steps,
  });
  assert.equal(result.classification, "F-III:action_stall(1->2)");
});

// --- Positive control: surgical cumulative convergence -------------------
test("OK:VERIFIED: surgical cumulative convergence with 0 spins", () => {
  // Every step mutates both context and action and the final step verifies:
  // no F-I/F-II/F-III, converges inside budget.
  const steps = [
    stepRecord({ context: { done: 0 }, action: { do: "read" } }),
    stepRecord({ context: { done: 1 }, action: { do: "plan" } }),
    stepRecord({ context: { done: 2 }, action: { do: "edit" }, verified: true }),
  ];
  const result = runZeroSpinGate({
    maxSteps: 6,
    enableCtxGate: true,
    enableActionGate: true,
    steps,
  });
  assert.equal(result.classification, "OK:VERIFIED");
  assert.equal(result.verified, true);
  assert.equal(result.spinsDetected, 0);
});

// --- Linear prev_step_hash receipt chaining ------------------------------
test("receipt chain is linear: each step's prev_step_hash binds the one before", () => {
  const steps = [
    stepRecord({ context: { done: 0 }, action: { do: "read" } }),
    stepRecord({ context: { done: 1 }, action: { do: "plan" } }),
    stepRecord({ context: { done: 2 }, action: { do: "edit" }, verified: true }),
  ];
  const result = runZeroSpinGate({ maxSteps: 6, steps });

  assert.equal(result.receiptChain.length, steps.length);
  assert.equal(result.receiptChain[0].prev_step_hash, null, "genesis step has no predecessor");
  for (let i = 1; i < result.receiptChain.length; i++) {
    assert.equal(
      result.receiptChain[i].prev_step_hash,
      result.receiptChain[i - 1].step_hash,
      `step ${i} must chain to step ${i - 1}`,
    );
    assert.match(result.receiptChain[i].step_hash, /^sha256:[0-9a-f]{64}$/);
  }

  const verified = verifyZeroSpinReceiptChain(result.receiptChain);
  assert.equal(verified.ok, true);
  assert.equal(verified.reason, "RECEIPT_CHAIN_VERIFIED");
});

test("receipt chain verification fails closed on a tampered link", () => {
  const steps = [
    stepRecord({ context: { done: 0 }, action: { do: "read" } }),
    stepRecord({ context: { done: 1 }, action: { do: "edit" }, verified: true }),
  ];
  const result = runZeroSpinGate({ maxSteps: 4, steps });
  const tampered = result.receiptChain.map((r, i) =>
    i === 1 ? { ...r, prev_step_hash: "sha256:" + "0".repeat(64) } : r,
  );
  const verified = verifyZeroSpinReceiptChain(tampered);
  assert.equal(verified.ok, false);
  assert.equal(verified.reason, "RECEIPT_CHAIN_BROKEN");
});

test("run is deterministic: identical input yields identical verdict + chain", () => {
  const steps = [
    stepRecord({ context: { done: 0 }, action: { do: "read" } }),
    stepRecord({ context: { done: 1 }, action: { do: "edit" }, verified: true }),
  ];
  const first = runZeroSpinGate({ maxSteps: 4, steps });
  const second = runZeroSpinGate({ maxSteps: 4, steps });
  assert.equal(first.verdict_hash, second.verdict_hash);
  assert.match(first.verdict_hash, /^sha256:[0-9a-f]{64}$/);
});
