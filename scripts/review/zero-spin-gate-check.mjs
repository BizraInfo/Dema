#!/usr/bin/env node
// ZERO-SPIN-GATE-CHECK-1A — executable review check (read-only).
//
// Re-derives the Zero-Spin Execution Gate's falsifiable controls against the
// pure kernel and fails closed if any control no longer produces its declared
// classification. This is the enforcement half of the governing law "no rule
// without an executable gate and negative control": the kernel DECLARES the
// spin taxonomy, this gate EXECUTES the enumerated scenarios and checks the
// verdicts, and the receipt-chain verify path is replayed to confirm the
// tamper-evident chain holds and fails closed on a broken link.
//
// SOURCING NOTE (slice 1D): the original Python reference (proof_harness.py)
// is GONE and unreadable; these controls encode the WRITTEN INVARIANT SPEC and
// make NO byte-parity claim against the lost prototype.
//
// Read-only: it runs the pure kernel in-process, reads no file beyond import,
// opens no network, activates no runtime. Exit 0 with a deterministic summary
// when every control matches its expected classification; exit 1 fail-closed
// otherwise.

import { pathToFileURL } from "node:url";

import {
  runZeroSpinGate,
  verifyZeroSpinReceiptChain,
  ZERO_SPIN_GATE_SCHEMA,
  ZERO_SPIN_GATE_TRUTH_LABEL,
} from "../../packages/core/src/zero-spin-gate.js";

const JSON_MODE = process.argv.includes("--json");

// Each control is a falsifiable scenario: a run configuration plus the exact
// classification the kernel MUST return. A kernel regression that mislabels a
// spin, or silently reports OK, flips `ok` to false and the gate exits 1.
const CONTROLS = Object.freeze([
  {
    id: "F-IV_ungated_full_budget_waste",
    expected: "F-IV:budget_exhausted",
    run: {
      maxSteps: 5,
      enableCtxGate: false,
      enableActionGate: false,
      steps: Array.from({ length: 5 }, (_, i) => ({ context: { phase: i }, action: { do: `probe-${i}` } })),
    },
  },
  {
    id: "F-I_one_step_lazy_retry",
    expected: "F-I:ctx_spin(0->1)",
    run: {
      maxSteps: 5,
      enableCtxGate: true,
      enableActionGate: true,
      steps: [
        { context: { goal: "x", seen: ["a"] }, action: { do: "look" } },
        { context: { goal: "x", seen: ["a"] }, action: { do: "look-again" } },
      ],
    },
  },
  {
    id: "ablation_both_gates_on_action_stall_first",
    expected: "F-III:action_stall(1->2)",
    run: {
      maxSteps: 6,
      enableCtxGate: true,
      enableActionGate: true,
      steps: [
        { context: { step: 0, ptr: "0x1000" }, action: { verb: "scan", target: "dir-a", ts: "2026-10-19T00:00:00Z" } },
        { context: { step: 1, ptr: "0x2000" }, action: { verb: "edit", target: "file-1", ts: "2026-10-19T00:00:01Z" } },
        { context: { step: 2, ptr: "0x3000" }, action: { verb: "edit", target: "file-1", ts: "2026-10-19T00:00:99Z" } },
      ],
    },
  },
  {
    id: "ablation_action_gate_off_ctx_spin_caught",
    expected: "F-I:ctx_spin(2->3)",
    run: {
      maxSteps: 6,
      enableCtxGate: true,
      enableActionGate: false,
      steps: [
        { context: { step: 0, ptr: "0x1000" }, action: { verb: "scan", target: "dir-a", ts: "t0" } },
        { context: { step: 1, ptr: "0x2000" }, action: { verb: "edit", target: "file-1", ts: "t1" } },
        { context: { step: 2, ptr: "0x3000" }, action: { verb: "edit", target: "file-1", ts: "t2" } },
        { context: { step: 2, ptr: "0x9999" }, action: { verb: "edit", target: "file-2", ts: "t3" } },
      ],
    },
  },
  {
    id: "F-II_ping_pong_cycle",
    expected: "F-II:ctx_cycle(2->4)",
    run: {
      maxSteps: 8,
      enableCtxGate: true,
      enableActionGate: true,
      steps: [
        { context: { place: "A" }, action: { do: "m0" } },
        { context: { place: "B" }, action: { do: "m1" } },
        { context: { place: "A" }, action: { do: "m2" } },
        { context: { place: "B" }, action: { do: "m3" } },
        { context: { place: "A" }, action: { do: "m4" } },
      ],
    },
  },
  {
    id: "F-III_cosmetic_comment_action_spoof",
    expected: "F-III:action_stall(1->2)",
    run: {
      maxSteps: 6,
      enableCtxGate: true,
      enableActionGate: true,
      steps: [
        { context: { n: 0 }, action: { code: "x = 1;", comment: "init" } },
        { context: { n: 1 }, action: { code: "x = 2;", comment: "bump" } },
        { context: { n: 2 }, action: { code: "x = 2;", comment: "// cosmetic only" } },
      ],
    },
  },
  {
    id: "OK_surgical_cumulative_convergence",
    expected: "OK:VERIFIED",
    run: {
      maxSteps: 6,
      enableCtxGate: true,
      enableActionGate: true,
      steps: [
        { context: { done: 0 }, action: { do: "read" } },
        { context: { done: 1 }, action: { do: "plan" } },
        { context: { done: 2 }, action: { do: "edit" }, verified: true },
      ],
    },
  },
]);

export function runZeroSpinGateCheck() {
  const failures = [];
  const controls = [];

  for (const control of CONTROLS) {
    const result = runZeroSpinGate(control.run);
    const match = result.classification === control.expected;
    const chain = verifyZeroSpinReceiptChain(result.receiptChain);
    const boundaryOk =
      result.boundary.runtimeActivated === false &&
      result.boundary.networkCalled === false &&
      result.boundary.authorityDelta === 0;

    if (!match) failures.push(`${control.id}: expected ${control.expected}, got ${result.classification}`);
    if (!chain.ok) failures.push(`${control.id}: receipt chain not verified (${chain.reason})`);
    if (!boundaryOk) failures.push(`${control.id}: boundary not preview-pure`);

    controls.push({
      id: control.id,
      expected: control.expected,
      actual: result.classification,
      ok: match && chain.ok && boundaryOk,
    });
  }

  // Negative control on the verify path itself: a tampered chain MUST be
  // rejected, or the receipt chaining guarantees nothing.
  const sample = runZeroSpinGate({
    maxSteps: 4,
    steps: [
      { context: { done: 0 }, action: { do: "read" } },
      { context: { done: 1 }, action: { do: "edit" }, verified: true },
    ],
  });
  const tampered = sample.receiptChain.map((r, i) =>
    i === 1 ? { ...r, prev_step_hash: "sha256:" + "0".repeat(64) } : r,
  );
  const tamperRejected = verifyZeroSpinReceiptChain(tampered);
  if (tamperRejected.ok !== false || tamperRejected.reason !== "RECEIPT_CHAIN_BROKEN") {
    failures.push("tamper_detection: a broken receipt chain was NOT rejected");
  }

  return {
    schema: "bizra.dema.review.zero_spin_gate_check.v0.1",
    kernel_schema: ZERO_SPIN_GATE_SCHEMA,
    truth_label: ZERO_SPIN_GATE_TRUTH_LABEL,
    ok: failures.length === 0,
    control_count: controls.length,
    controls,
    tamper_detection_ok: tamperRejected.ok === false,
    failures,
    boundary: {
      read_only_audit: true,
      runtime_execution: false,
      network_used: false,
      mutation_performed: false,
      authority_delta: 0,
    },
  };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const result = runZeroSpinGateCheck();

  if (JSON_MODE) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("DEMA - zero-spin execution gate controls");
    console.log(`  kernel_schema: ${result.kernel_schema}`);
    console.log(`  controls: ${result.control_count}`);
    for (const c of result.controls) {
      console.log(`    ${c.id}: ${c.ok ? "PASS" : "FAIL"} (${c.actual})`);
    }
    console.log(`  tamper_detection: ${result.tamper_detection_ok ? "PASS" : "FAIL"}`);
    if (result.failures.length > 0) {
      console.log("  FAILURES:");
      for (const f of result.failures) console.log(`    ${f}`);
    }
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
  }

  if (!result.ok) process.exit(1);
}
