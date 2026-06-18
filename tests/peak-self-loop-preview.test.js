import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildPeakSelfLoopPreview,
  renderPeakSelfLoopPreview,
  PEAK_SELF_LOOP_PREVIEW_SCHEMA,
} from "../packages/core/src/peak-self-loop-preview.js";
import {
  isCanonicalBoundary,
  PREVIEW_BOUNDARY_CANONICAL_KEYS,
} from "../packages/core/src/preview-boundary.js";

test("PSL-01: emits canonical schema bizra.dema.peak_self_loop_preview.v0.1", () => {
  const out = buildPeakSelfLoopPreview();
  assert.equal(out.schema, PEAK_SELF_LOOP_PREVIEW_SCHEMA);
});

test("PSL-02: truth_label NODE0_LOCAL_SEED · mode preview_only · receipt_shape_ready", () => {
  const out = buildPeakSelfLoopPreview();
  assert.equal(out.truth_label, "NODE0_LOCAL_SEED");
  assert.equal(out.mode, "preview_only");
  assert.equal(out.receipt_shape_ready, true);
});

test("PSL-03: boundary is canonical 16-key all-false", () => {
  const out = buildPeakSelfLoopPreview();
  assert.equal(isCanonicalBoundary(out.boundary), true);
  assert.equal(
    Object.keys(out.boundary).length,
    PREVIEW_BOUNDARY_CANONICAL_KEYS.length,
  );
});

test("PSL-04: composes SNR, convergence, HHMM, craftsmanship, proactive_self", () => {
  const out = buildPeakSelfLoopPreview();
  assert.equal(typeof out.snr_framework.score, "number");
  assert.equal(out.snr_framework.signal_definition, "actionable architectural insight");
  assert.ok(out.proof_of_truth_convergence.summary.total >= 1);
  assert.equal(out.hhmm.phases.length, 5);
  assert.equal(out.hhmm.mode, "preview_diffusion_not_runtime_engine");
  assert.ok(Object.keys(out.event_hash_table).length >= 2);
  assert.equal(out.craftsmanship_witness.schema, "bizra.dema.craftsmanship_witness.v0.1");
  assert.ok(out.proactive_self.harness.active_gates.length >= 4);
  assert.equal(out.autonomous_rsi.not_autonomous_runtime, true);
});

test("PSL-05: default SNR favors signal (4 signal vs 1 noise)", () => {
  const out = buildPeakSelfLoopPreview();
  assert.equal(out.snr_framework.signal_count, 4);
  assert.equal(out.snr_framework.noise_count, 1);
  assert.ok(out.snr_framework.score >= 0.7);
  assert.equal(out.autonomous_rsi.merged_verdict, "CONTINUE_MICRO_SLICE");
});

test("PSL-06: process RSI uses score field (not undefined rsi alias)", () => {
  const out = buildPeakSelfLoopPreview();
  assert.equal(typeof out.autonomous_rsi.process_rsi, "number");
  assert.ok(out.autonomous_rsi.process_rsi >= 0);
});

test("PSL-07: shoulders protocol refs are frozen DECLARED mappings", () => {
  const out = buildPeakSelfLoopPreview();
  assert.ok(out.shoulders_protocol.refs.length >= 4);
  for (const ref of out.shoulders_protocol.refs) {
    assert.ok(typeof ref.giant === "string");
    assert.ok(typeof ref.dema_surface === "string");
    assert.ok(typeof ref.truth_label === "string");
  }
});

test("PSL-08: output is deep-frozen at top level", () => {
  const out = buildPeakSelfLoopPreview();
  assert.equal(Object.isFrozen(out), true);
  assert.equal(Object.isFrozen(out.proactive_self), true);
  assert.equal(Object.isFrozen(out.hhmm.diffusion), true);
});

test("PSL-09: renderPeakSelfLoopPreview includes SNR and proactive self lines", () => {
  const text = renderPeakSelfLoopPreview(buildPeakSelfLoopPreview());
  assert.ok(text.includes("PEAK SELF-LOOP"));
  assert.ok(text.includes("Proactive self-loop:"));
  assert.ok(text.includes("SNR:"));
});

test("PSL-10: high noise input triggers HOLD merged verdict", () => {
  const out = buildPeakSelfLoopPreview({
    signal_events: [{ id: "s1", type: "gate_passed", weight: 1 }],
    noise_events: [
      { id: "n1", type: "runtime_ambiguity", weight: 1 },
      { id: "n2", type: "scope_contamination", weight: 1 },
      { id: "n3", type: "unresolved_blocker", weight: 1 },
    ],
  });
  assert.equal(out.autonomous_rsi.merged_verdict, "HOLD_AND_REDUCE_NOISE");
});

test("PSL-11: next slice observable is post-integration with text and evidence", () => {
  const out = buildPeakSelfLoopPreview();
  const next = out.craftsmanship_witness.next_slice_observables[0];
  assert.equal(next.id, "pat-council-route-runtime-dispatch");
  assert.notEqual(next.id, "claim-corpus-gate-baseline-ratchet");
  assert.ok(next.text.length > 0);
  assert.ok(next.evidence.length > 0);
});
