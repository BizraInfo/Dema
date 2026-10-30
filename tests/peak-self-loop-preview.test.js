import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildPeakSelfLoopPreview,
  composePeakZeroSpinRail,
  renderPeakSelfLoopPreview,
  PEAK_SELF_LOOP_PREVIEW_SCHEMA,
  PEAK_ZERO_SPIN_NOT_SUPPLIED,
  PEAK_ZERO_SPIN_SPIN_OR_BROKEN,
  PEAK_ZERO_SPIN_VERIFIED_PROGRESS,
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

test("PSL-05: default 9 signal fixtures are declared-only and cannot score", () => {
  const out = buildPeakSelfLoopPreview();
  assert.equal(out.snr_framework.declared_signal_count, 9);
  assert.equal(out.snr_framework.noise_count, 3);
  assert.equal(out.snr_framework.verified_signal_count, 0);
  assert.equal(out.snr_framework.score, 0);
  assert.equal(out.autonomous_rsi.merged_verdict, "HOLD_AND_REDUCE_NOISE");
});

test("PSL-05b: caller-authored bindings cannot restore CONTINUE", () => {
  const bound = Array.from({ length: 9 }, (_, i) => ({
    id: `bound-${i}`,
    type: "gate_passed",
    weight: 1,
    truth_label: "MEASURED",
    source_ref: `receipts/gate-${i}.json`,
    source_sha256: String(i).repeat(64).slice(0, 64),
  }));
  const out = buildPeakSelfLoopPreview({ signal_events: bound });
  assert.equal(out.snr_framework.verified_signal_count, 0);
  assert.equal(out.snr_framework.excluded_signal_count, 9);
  assert.equal(out.autonomous_rsi.merged_verdict, "HOLD_AND_REDUCE_NOISE");
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

test("PSL-11: next slice observable is backlog-ranked with text and evidence", () => {
  const out = buildPeakSelfLoopPreview();
  const next = out.craftsmanship_witness.next_slice_observables[0];
  assert.equal(next.id, "style-pillar-micro-1a");
  assert.ok(next.text.length > 0);
  assert.ok(next.evidence.length > 0);
});

test("PSL-12: composes agent-outside-sandbox orchestration posture", () => {
  const out = buildPeakSelfLoopPreview();
  assert.equal(out.agent_orchestration.doctrine, "agent_outside_sandbox_not_inside");
  assert.equal(out.agent_orchestration.signing_authority_ne_execution_authority, true);
  assert.equal(out.agent_orchestration.operator_mutation_outside_sandbox, false);
  assert.ok(out.agent_orchestration.roles.outside_sandbox.length >= 2);
  assert.ok(out.agent_orchestration.roles.inside_sandbox.length >= 2);
});

test("PSL-13: reasoning modes + micro process mining ref are preview-only", () => {
  const out = buildPeakSelfLoopPreview();
  assert.equal(out.reasoning_modes.sequential.mode, "SEQUENTIAL_REASONING_PREVIEW");
  assert.equal(out.reasoning_modes.creative.forbidden_outputs.includes("autonomous runtime"), true);
  assert.equal(out.micro_process_mining.spine_command, "dema process-mining");
  assert.equal(out.micro_process_mining.acts_on_data, false);
  assert.equal(out.micro_process_mining.offers_mirror, true);
});

test("PSL-14: OODA cycle is bounded — act not executed by kernel", () => {
  const out = buildPeakSelfLoopPreview();
  assert.equal(out.self_loop_ooda.schema, "bizra.dema.self_loop_ooda.v0.1");
  assert.equal(out.self_loop_ooda.action_executed_by_kernel, false);
  assert.equal(out.self_loop_ooda.recommendation, "PROPOSE_NEXT_BOUNDED_CYCLE");
  assert.equal(out.self_loop_ooda.steps.length, 5);
});

test("PSL-15: RSI integration gate screens proposal without forbidden live-loop terms", () => {
  const out = buildPeakSelfLoopPreview();
  assert.equal(out.rsi_integration_gate.schema, "bizra.dema.rsi_proposal_preview.v0.1");
  assert.notEqual(out.rsi_integration_gate.recommendation, "REJECT");
  assert.equal(out.rsi_integration_gate.certifies, false);
});

test("PSL-16: ci_advisory_blocked shifts harness next_gate to local proof lane", () => {
  const blocked = buildPeakSelfLoopPreview({ ci_advisory_blocked: true });
  assert.equal(blocked.agent_orchestration.local_proof_lane_when_ci_advisory_blocked, true);
  assert.match(blocked.proactive_self.harness.next_gate, /DONE_LOCAL/);
  assert.ok(blocked.proactive_self.critique.gaps.some((g) => g.includes("LOCAL proof")));
});

test("PSL-17: render includes agent-outside-sandbox and OODA lines", () => {
  const text = renderPeakSelfLoopPreview(buildPeakSelfLoopPreview());
  assert.ok(text.includes("Agent outside sandbox:"));
  assert.ok(text.includes("OODA review:"));
  assert.ok(text.includes("Reasoning modes (preview):"));
  assert.ok(text.includes("RSI integration gate:"));
});

test("PSL-18: ultra_micro_compose maps all proactive reasoning subsystems", () => {
  const out = buildPeakSelfLoopPreview();
  assert.equal(out.ultra_micro_compose.mode, "preview_only");
  assert.equal(
    out.ultra_micro_compose.agent_posture,
    "outside_sandbox_proposes_inside_sandbox_proves",
  );
  assert.ok(out.ultra_micro_compose.subsystems.length >= 10);
  assert.ok(out.proof_spine_backlog.length >= 3);
});

// ---------------------------------------------------------------------------
// PEAK-EVIDENCE-BINDING-1A — declared fixtures must never authorize CONTINUE.
// A signal event is eligible only when it carries its own evidence binding:
// truth_label VERIFIED|MEASURED + non-empty source_ref + 64-hex source_sha256.
// ---------------------------------------------------------------------------

const BOUND_SIGNAL = Object.freeze({
  id: "gate-run-1",
  type: "gate_passed",
  weight: 1,
  truth_label: "MEASURED",
  source_ref: "scripts/review/kernel-purity-check.mjs",
  source_sha256: "a".repeat(64),
});

test("PEB-01: no-arg build yields zero verified signal and HOLDs", () => {
  const out = buildPeakSelfLoopPreview();
  assert.equal(out.snr_framework.verified_signal_count, 0);
  assert.equal(out.autonomous_rsi.merged_verdict, "HOLD_AND_REDUCE_NOISE");
});

test("PEB-02: declared fixtures stay visible but are excluded from score", () => {
  const out = buildPeakSelfLoopPreview();
  assert.equal(out.snr_framework.declared_signal_count, 9);
  assert.equal(out.snr_framework.excluded_signal_count, 9);
  assert.ok(out.snr_framework.evidence_debt.length >= 1);
});

test("PEB-03: a shape-valid caller event is excluded without gatherer provenance", () => {
  const roundTripped = JSON.parse(JSON.stringify(BOUND_SIGNAL));
  const out = buildPeakSelfLoopPreview({
    signal_events: [BOUND_SIGNAL, roundTripped],
    noise_events: [],
  });
  const baseline = buildPeakSelfLoopPreview({ signal_events: [], noise_events: [] });
  assert.equal(out.snr_framework.verified_signal_count, 0);
  assert.equal(out.snr_framework.excluded_signal_count, 2);
  assert.equal(out.snr_framework.evidence_debt[0].gap, "evidence_not_gatherer_issued");
  assert.equal(out.snr_framework.evidence_debt[1].gap, "evidence_not_gatherer_issued");
  assert.equal(out.snr_framework.score, baseline.snr_framework.score);
  assert.equal(out.autonomous_rsi.process_rsi, baseline.autonomous_rsi.process_rsi);
  assert.deepEqual(out.event_hash_table, baseline.event_hash_table);
  assert.equal(out.trace_diagnostic_moat.trace_set.length, 0);
  assert.equal(out.rsi_integration_gate.recommendation, baseline.rsi_integration_gate.recommendation);
});

test("PEB-04: missing source_sha256 is excluded as evidence debt", () => {
  const { source_sha256, ...unbound } = BOUND_SIGNAL;
  const out = buildPeakSelfLoopPreview({
    signal_events: [unbound],
    noise_events: [],
  });
  assert.equal(out.snr_framework.verified_signal_count, 0);
  assert.equal(out.snr_framework.excluded_signal_count, 1);
});

test("PEB-05: forged truth_label is rejected, not trusted as carried", () => {
  const out = buildPeakSelfLoopPreview({
    signal_events: [{ ...BOUND_SIGNAL, truth_label: "TOTALLY_VERIFIED" }],
    noise_events: [],
  });
  assert.equal(out.snr_framework.verified_signal_count, 0);
});

test("PEB-06: duplicate caller ids remain unverified and cannot be amplified", () => {
  const nine = Array.from({ length: 9 }, () => ({ ...BOUND_SIGNAL }));
  const out = buildPeakSelfLoopPreview({ signal_events: nine, noise_events: [] });
  assert.equal(out.snr_framework.verified_signal_count, 0);
  assert.equal(out.snr_framework.excluded_signal_count, 9);
});

// PEB-08 transports the direct-caller attack so it stays visible.
test("PEB-08: direct callers cannot use shape-valid envelopes to raise SNR", () => {
  const forged = Array.from({ length: 9 }, (_, i) => ({
    id: `totally-real-${i}`,
    type: "gate_passed",
    weight: 1,
    truth_label: "MEASURED",
    source_ref: `receipts/does-not-exist-${i}.json`,
    source_sha256: String(i).repeat(64).slice(0, 64),
  }));
  const out = buildPeakSelfLoopPreview({ signal_events: forged });
  assert.equal(out.snr_framework.verified_signal_count, 0);
  assert.equal(out.snr_framework.excluded_signal_count, 9);
  assert.equal(out.autonomous_rsi.merged_verdict, "HOLD_AND_REDUCE_NOISE");
});

test("PEB-07: evidence binding does not weaken the canonical boundary", () => {
  const out = buildPeakSelfLoopPreview({ signal_events: [BOUND_SIGNAL] });
  assert.equal(isCanonicalBoundary(out.boundary), true);
});

test("PSL-19: companion disconnected surfaces in self-critique gaps", () => {
  const out = buildPeakSelfLoopPreview({ companion_device_connected: false });
  assert.ok(
    out.proactive_self.critique.gaps.some((g) => g.includes("Mobile companion")),
  );
  const connected = buildPeakSelfLoopPreview({ companion_device_connected: true });
  assert.equal(
    connected.proactive_self.critique.gaps.some((g) => g.includes("Mobile companion")),
    false,
  );
});

// ---------------------------------------------------------------------------
// PEAK-ZERO-SPIN-INTEGRATION-1A — wire ZERO-SPIN-GATE into proactive_self.
// ---------------------------------------------------------------------------

test("PZS-01: default preview abstains zero-spin (NOT_SUPPLIED, never fake OK)", () => {
  const out = buildPeakSelfLoopPreview();
  assert.equal(out.zero_spin.status, PEAK_ZERO_SPIN_NOT_SUPPLIED);
  assert.equal(out.zero_spin.classification, null);
  assert.equal(out.zero_spin.progress_verified, false);
  assert.equal(out.proactive_self.zero_spin.status, PEAK_ZERO_SPIN_NOT_SUPPLIED);
  assert.ok(out.proactive_self.harness.active_gates.includes("zero-spin-gate-check"));
  assert.ok(out.ultra_micro_compose.subsystems.includes("proactive_self.zero_spin"));
  assert.ok(out.ultra_micro_compose.subsystems.includes("zero_spin_gate"));
  assert.ok(
    out.proactive_self.critique.gaps.some((g) => g.includes("NOT_SUPPLIED")),
  );
});

test("PZS-02: converging spin_steps yield VERIFIED_PROGRESS", () => {
  const out = buildPeakSelfLoopPreview({
    spin_steps: [
      { context: { done: 0 }, action: { do: "read" } },
      { context: { done: 1 }, action: { do: "plan" } },
      { context: { done: 2 }, action: { do: "edit" }, verified: true },
    ],
    spin_max_steps: 6,
  });
  assert.equal(out.zero_spin.status, PEAK_ZERO_SPIN_VERIFIED_PROGRESS);
  assert.equal(out.zero_spin.classification, "OK:VERIFIED");
  assert.equal(out.zero_spin.progress_verified, true);
  assert.equal(out.zero_spin.chain_ok, true);
  assert.equal(out.proactive_self.compliance.zero_spin_progress_verified, true);
  assert.equal(
    out.proactive_self.critique.gaps.some((g) => g.includes("Zero-spin F-")),
    false,
  );
});

test("PZS-03: ctx_spin HOLDs critique and blocks reinsert via spin rail", () => {
  const out = buildPeakSelfLoopPreview({
    spin_steps: [
      { context: { goal: "x", seen: ["a"] }, action: { do: "look" } },
      { context: { goal: "x", seen: ["a"] }, action: { do: "look-again" } },
    ],
    spin_max_steps: 5,
  });
  assert.equal(out.zero_spin.status, PEAK_ZERO_SPIN_SPIN_OR_BROKEN);
  assert.equal(out.zero_spin.classification, "F-I:ctx_spin(0->1)");
  assert.match(out.proactive_self.critique.verdict, /HOLD — zero-spin/);
  assert.equal(out.proactive_self.compliance.reinsert_eligible, false);
});

test("PZS-04: composePeakZeroSpinRail is deterministic for same steps", () => {
  const steps = [
    { context: { n: 0 }, action: { do: "a" } },
    { context: { n: 1 }, action: { do: "b" }, verified: true },
  ];
  const a = composePeakZeroSpinRail({ steps, maxSteps: 4 });
  const b = composePeakZeroSpinRail({ steps, maxSteps: 4 });
  assert.equal(a.verdict_hash, b.verdict_hash);
  assert.equal(a.status, PEAK_ZERO_SPIN_VERIFIED_PROGRESS);
});

test("PZS-05: human render surfaces zero_spin line", () => {
  const text = renderPeakSelfLoopPreview(buildPeakSelfLoopPreview());
  assert.match(text, /zero_spin:\s+NOT_SUPPLIED/);
});
