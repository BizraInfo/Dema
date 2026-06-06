import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildAgentKernel,
  buildAgentKernelSummary,
  tick,
  isValidStateTransition,
  AGENT_STATES,
  AGENT_KERNEL_VALID_TRANSITIONS,
  AGENT_KERNEL_TERMINAL_STATES,
  AGENT_KERNEL_MAX_ITERATIONS,
  AGENT_KERNEL_REQUIRED_BLOCKED_EFFECTS,
  AGENT_KERNEL_SCHEMA_NAME,
  AGENT_KERNEL_TRANSITION_SCHEMA_NAME,
} from "../packages/core/src/agent-kernel.js";
import {
  isCanonicalBoundary,
  PREVIEW_BOUNDARY_CANONICAL_KEYS,
} from "../packages/core/src/preview-boundary.js";

function validKernel(overrides = {}) {
  return buildAgentKernel({
    agent_id: "pat-1-mission-scribe",
    mission_intent: "draft the next safe action",
    agent_role: "pat",
    ...overrides,
  });
}

// =========================================================================
// KERNEL STRUCTURE TESTS (5)
// =========================================================================

test("Kernel emits canonical schema + truth label + preview_only mode", () => {
  const k = validKernel();
  assert.equal(k.schema, AGENT_KERNEL_SCHEMA_NAME);
  assert.equal(k.schema, "bizra.dema.agent_kernel.v0.1");
  assert.equal(k.truth_label, "NODE0_LOCAL_SEED");
  assert.equal(k.mode, "preview_only");
});

test("Kernel initial state is INIT · valid=true · history empty", () => {
  const k = validKernel();
  assert.equal(k.current_state, AGENT_STATES.INIT);
  assert.equal(k.valid, true);
  assert.equal(k.iteration, 0);
  assert.equal(k.halted, false);
  assert.deepEqual([...k.history], []);
});

test("Kernel boundary is canonical 16-key all-false frozen object", () => {
  const k = validKernel();
  assert.ok(isCanonicalBoundary(k.boundary));
  for (const key of PREVIEW_BOUNDARY_CANONICAL_KEYS) {
    assert.equal(k.boundary[key], false);
  }
});

test("Kernel is deep-frozen at top level + sub-views", () => {
  const k = validKernel();
  assert.ok(Object.isFrozen(k));
  assert.ok(Object.isFrozen(k.history));
  assert.ok(Object.isFrozen(k.boundary));
  assert.ok(Object.isFrozen(k.blocked_effects));
  assert.ok(Object.isFrozen(k.valid_states));
  assert.ok(Object.isFrozen(k.valid_transitions));
});

test("Kernel declares memory_file_path per-agent · scoped to ~/.dema/agents/<id>", () => {
  const k = validKernel();
  assert.equal(
    k.memory_file_path,
    "~/.dema/agents/pat-1-mission-scribe/memory.json",
  );
});

// =========================================================================
// STATE MACHINE TRANSITION TESTS (8 · the full happy path)
// =========================================================================

test("INIT → PERCEIVE with intent", () => {
  const k = validKernel();
  const { kernel, event } = tick(k);
  assert.equal(kernel.current_state, AGENT_STATES.PERCEIVE);
  assert.equal(event.from_state, AGENT_STATES.INIT);
  assert.equal(event.to_state, AGENT_STATES.PERCEIVE);
  assert.equal(event.refused, false);
});

test("PERCEIVE → PROPOSE", () => {
  let { kernel } = tick(validKernel());
  ({ kernel } = tick(kernel));
  assert.equal(kernel.current_state, AGENT_STATES.PROPOSE);
});

test("PROPOSE → CONSENT_REQUEST with proposal_summary captured", () => {
  let { kernel } = tick(validKernel());
  ({ kernel } = tick(kernel));
  const proposal = { schema: "test.proposal.v0.1", action: "draft" };
  ({ kernel } = tick(kernel, { proposal_summary: proposal }));
  assert.equal(kernel.current_state, AGENT_STATES.CONSENT_REQUEST);
  assert.equal(kernel.last_proposal_summary.has_schema, true);
  assert.equal(kernel.last_proposal_summary.schema, "test.proposal.v0.1");
});

test("CONSENT_REQUEST → ACT_OR_HOLD with consent granted", () => {
  let { kernel } = tick(validKernel());
  ({ kernel } = tick(kernel));
  ({ kernel } = tick(kernel, { proposal_summary: { action: "x" } }));
  ({ kernel } = tick(kernel, { consent_decision: "granted" }));
  assert.equal(kernel.current_state, AGENT_STATES.ACT_OR_HOLD);
  assert.equal(kernel.last_consent_decision, "granted");
});

test("CONSENT_REQUEST → ACT_OR_HOLD with consent denied (held)", () => {
  let { kernel } = tick(validKernel());
  ({ kernel } = tick(kernel));
  ({ kernel } = tick(kernel, { proposal_summary: { action: "x" } }));
  ({ kernel } = tick(kernel, { consent_decision: "denied" }));
  assert.equal(kernel.current_state, AGENT_STATES.ACT_OR_HOLD);
  assert.equal(kernel.last_consent_decision, "denied");
});

test("ACT_OR_HOLD → OBSERVE with act_result captured", () => {
  let { kernel } = tick(validKernel());
  ({ kernel } = tick(kernel));
  ({ kernel } = tick(kernel, { proposal_summary: { x: 1 } }));
  ({ kernel } = tick(kernel, { consent_decision: "granted" }));
  ({ kernel } = tick(kernel, {
    act_result_summary: { schema: "test.result.v0.1", output: "ok" },
  }));
  assert.equal(kernel.current_state, AGENT_STATES.OBSERVE);
  assert.equal(kernel.last_act_result_summary.has_schema, true);
});

test("OBSERVE → DECIDE_NEXT", () => {
  let { kernel } = tick(validKernel());
  ({ kernel } = tick(kernel));
  ({ kernel } = tick(kernel, { proposal_summary: { x: 1 } }));
  ({ kernel } = tick(kernel, { consent_decision: "granted" }));
  ({ kernel } = tick(kernel, { act_result_summary: { ok: true } }));
  ({ kernel } = tick(kernel));
  assert.equal(kernel.current_state, AGENT_STATES.DECIDE_NEXT);
});

test("DECIDE_NEXT → COMPLETE (terminal)", () => {
  let { kernel } = tick(validKernel());
  ({ kernel } = tick(kernel));
  ({ kernel } = tick(kernel, { proposal_summary: { x: 1 } }));
  ({ kernel } = tick(kernel, { consent_decision: "granted" }));
  ({ kernel } = tick(kernel, { act_result_summary: { ok: true } }));
  ({ kernel } = tick(kernel));
  ({ kernel } = tick(kernel, { decision: "complete" }));
  assert.equal(kernel.current_state, AGENT_STATES.COMPLETE);
});

// =========================================================================
// LOOP TESTS (3)
// =========================================================================

test("DECIDE_NEXT → PERCEIVE (loop) increments iteration", () => {
  let { kernel } = tick(validKernel());
  ({ kernel } = tick(kernel));
  ({ kernel } = tick(kernel, { proposal_summary: { x: 1 } }));
  ({ kernel } = tick(kernel, { consent_decision: "granted" }));
  ({ kernel } = tick(kernel, { act_result_summary: { ok: true } }));
  ({ kernel } = tick(kernel));
  assert.equal(kernel.iteration, 0);
  ({ kernel } = tick(kernel, { decision: "loop" }));
  assert.equal(kernel.current_state, AGENT_STATES.PERCEIVE);
  assert.equal(kernel.iteration, 1);
});

test("Iteration cap halts the kernel after max_iterations exceeded", () => {
  // Build with tiny max_iterations
  const k = buildAgentKernel({
    agent_id: "test",
    mission_intent: "loop test",
    max_iterations: 2,
  });
  // Reach iteration 2 (the cap) and then attempt another tick
  let kernel = k;
  // Force iteration count up by constructing scenario (we cannot mutate frozen)
  // Loop the full cycle twice to get iteration=2
  for (let i = 0; i < 2; i++) {
    ({ kernel } = tick(kernel)); // INIT/PERCEIVE → ...
    ({ kernel } = tick(kernel)); // PERCEIVE → PROPOSE
    ({ kernel } = tick(kernel, { proposal_summary: {} })); // PROPOSE → CONSENT_REQUEST
    ({ kernel } = tick(kernel, { consent_decision: "granted" })); // CONSENT_REQUEST → ACT_OR_HOLD
    ({ kernel } = tick(kernel, { act_result_summary: {} })); // ACT_OR_HOLD → OBSERVE
    ({ kernel } = tick(kernel)); // OBSERVE → DECIDE_NEXT
    if (i === 0) {
      ({ kernel } = tick(kernel, { decision: "loop" })); // → PERCEIVE (iter=1)
    }
  }
  // After 2 loops, iteration=1 (after first loop) · we want iteration ≥ max_iterations
  // Force loop one more time to push iteration to 2 (the cap)
  ({ kernel } = tick(kernel, { decision: "loop" })); // iter goes to 2 = max
  // Now any further tick should halt
  const result = tick(kernel);
  assert.equal(result.kernel.current_state, AGENT_STATES.HALTED);
  assert.match(result.event.transition_reason, /iteration_cap_exceeded/);
});

test("Multiple ticks are deterministic given same input · pure function", () => {
  const k = validKernel();
  const a = tick(k);
  const b = tick(k);
  assert.equal(a.kernel.current_state, b.kernel.current_state);
  assert.equal(a.kernel.iteration, b.kernel.iteration);
  assert.equal(a.event.from_state, b.event.from_state);
  assert.equal(a.event.to_state, b.event.to_state);
});

// =========================================================================
// HALT GATE TESTS (4)
// =========================================================================

test("halt=true input transitions any state to HALTED", () => {
  let { kernel } = tick(validKernel()); // → PERCEIVE
  ({ kernel } = tick(kernel, {
    halt: true,
    halt_reason: "operator requested",
  }));
  assert.equal(kernel.current_state, AGENT_STATES.HALTED);
  assert.equal(kernel.halted, true);
  assert.match(kernel.halted_reason, /operator requested/);
});

test("HALTED is terminal · further ticks refused", () => {
  let { kernel } = tick(validKernel());
  ({ kernel } = tick(kernel, { halt: true }));
  const result = tick(kernel, { proposal_summary: {} });
  assert.equal(result.event.refused, true);
  assert.match(result.event.refusal_reason, /terminal_state/);
});

test("COMPLETE is terminal · further ticks refused", () => {
  let { kernel } = tick(validKernel());
  ({ kernel } = tick(kernel));
  ({ kernel } = tick(kernel, { proposal_summary: {} }));
  ({ kernel } = tick(kernel, { consent_decision: "granted" }));
  ({ kernel } = tick(kernel, { act_result_summary: {} }));
  ({ kernel } = tick(kernel));
  ({ kernel } = tick(kernel, { decision: "complete" }));
  const result = tick(kernel);
  assert.equal(result.event.refused, true);
  assert.match(result.event.refusal_reason, /terminal_state/);
});

test("Halt event truth_label is appropriate · halt is not a refusal", () => {
  let { kernel } = tick(validKernel());
  const result = tick(kernel, { halt: true, halt_reason: "test halt" });
  assert.equal(result.event.refused, false);
  assert.equal(result.event.truth_label, "NODE0_LOCAL_SEED");
});

// =========================================================================
// REFUSAL TESTS (4)
// =========================================================================

test("INIT refuses transition if mission_intent empty", () => {
  const k = buildAgentKernel({ agent_id: "x", mission_intent: "" });
  const result = tick(k);
  assert.equal(result.event.refused, true);
  assert.match(result.event.refusal_reason, /no_mission_intent/);
});

test("INIT refuses transition if agent_id empty (kernel.valid=false)", () => {
  const k = buildAgentKernel({ agent_id: "", mission_intent: "test" });
  const result = tick(k);
  assert.equal(result.event.refused, true);
  assert.match(result.event.refusal_reason, /kernel_invalid/);
});

test("CONSENT_REQUEST refuses without consent_decision in input", () => {
  let { kernel } = tick(validKernel());
  ({ kernel } = tick(kernel));
  ({ kernel } = tick(kernel, { proposal_summary: {} }));
  const result = tick(kernel); // missing consent_decision
  assert.equal(result.event.refused, true);
  assert.match(result.event.refusal_reason, /consent_decision_required/);
});

test("DECIDE_NEXT refuses without decision in input", () => {
  let { kernel } = tick(validKernel());
  ({ kernel } = tick(kernel));
  ({ kernel } = tick(kernel, { proposal_summary: {} }));
  ({ kernel } = tick(kernel, { consent_decision: "granted" }));
  ({ kernel } = tick(kernel, { act_result_summary: {} }));
  ({ kernel } = tick(kernel));
  const result = tick(kernel); // missing decision
  assert.equal(result.event.refused, true);
  assert.match(result.event.refusal_reason, /decision_required/);
});

// =========================================================================
// ADVERSARIAL TESTS (5)
// =========================================================================

test("Adversarial · non-kernel input refused gracefully", () => {
  const result = tick({ schema: "wrong.schema", current_state: "init" });
  assert.equal(result.event.refused, true);
  assert.match(result.event.refusal_reason, /kernel_invalid/);
});

test("Adversarial · invalid kernel refusal still emits canonical transition event fields", () => {
  const result = tick({ schema: "wrong.schema", current_state: "init" });
  const { event } = result;

  assert.equal(event.schema, AGENT_KERNEL_TRANSITION_SCHEMA_NAME);
  assert.equal(event.truth_label, "TRANSITION_REFUSED");
  assert.equal(event.mode, "transition_event");
  assert.equal(event.agent_id, "");
  assert.equal(event.iteration, 0);
  assert.equal(event.from_state, "unknown");
  assert.equal(event.to_state, "unknown");
  assert.equal(event.transition_reason, "kernel_invalid");
  assert.equal(event.audit_trail_required, true);
  assert.equal(event.receipt_shape_ready, false);
  assert.equal(
    event.transition_contract.receipt_backing.status,
    "refusal_event_auditable_not_chain_advance_ready",
  );
  assert.equal(
    event.transition_contract.receipt_backing.receipt_shape_ready,
    false,
  );
  assert.ok(isCanonicalBoundary(event.boundary));
});

test("Adversarial · null/undefined input arg refused gracefully", () => {
  const k = validKernel();
  const a = tick(k, null);
  const b = tick(k, undefined);
  // Both should still transition (null/undefined → treated as empty)
  assert.equal(a.kernel.current_state, AGENT_STATES.PERCEIVE);
  assert.equal(b.kernel.current_state, AGENT_STATES.PERCEIVE);
});

test("Adversarial · array input arg refused (must be object)", () => {
  let { kernel } = tick(validKernel());
  ({ kernel } = tick(kernel));
  ({ kernel } = tick(kernel, { proposal_summary: {} }));
  const result = tick(kernel, ["array", "not", "object"]); // array input
  // consent_decision is undefined when input is array · refused
  assert.equal(result.event.refused, true);
});

test("Adversarial · halt_reason non-string coerced to empty", () => {
  let { kernel } = tick(validKernel());
  ({ kernel } = tick(kernel, { halt: true, halt_reason: { malicious: true } }));
  assert.equal(kernel.current_state, AGENT_STATES.HALTED);
  // halt_reason should be "operator_halt" default since the object isn't a string
  assert.equal(kernel.halted_reason, "operator_halt");
});

test("Adversarial · cannot mutate frozen kernel · attempts silently fail", () => {
  const k = validKernel();
  try {
    k.current_state = "halted";
  } catch {
    /* strict-mode throw is OK */
  }
  // Mutation either silently fails or throws; value must not change
  assert.equal(k.current_state, AGENT_STATES.INIT);
});

// =========================================================================
// EVENT SCHEMA TESTS (3)
// =========================================================================

test("Transition event has canonical schema + receipt_shape_ready flag", () => {
  let { event } = tick(validKernel());
  assert.equal(event.schema, AGENT_KERNEL_TRANSITION_SCHEMA_NAME);
  assert.equal(event.schema, "bizra.dema.agent_kernel_transition.v0.1");
  assert.equal(event.audit_trail_required, true);
  assert.equal(event.receipt_shape_ready, true);
});

test("Transition event boundary is canonical 16-key", () => {
  const { event } = tick(validKernel());
  assert.ok(isCanonicalBoundary(event.boundary));
});

test("Transition event is deep-frozen · cannot be tampered post-build", () => {
  const { event } = tick(validKernel());
  assert.ok(Object.isFrozen(event));
});

test("Transition event carries explicit assurance contract for the objective", () => {
  const { event } = tick(validKernel());

  assert.equal(event.transition_id, "init->perceive:init_to_perceive");
  assert.equal(event.transition_contract.explicit, true);
  assert.equal(event.transition_contract.bounded, true);
  assert.equal(event.transition_contract.receipt_backed, true);
  assert.equal(event.transition_contract.rare_circuit_tested, true);
  assert.equal(event.transition_contract.human_consent_aware, true);
  assert.equal(event.transition_contract.ihsan_aligned, true);
  assert.equal(event.transition_contract.ci_enforced, true);
  assert.equal(
    event.transition_contract.receipt_backing.event_schema,
    AGENT_KERNEL_TRANSITION_SCHEMA_NAME,
  );
  assert.equal(
    event.transition_contract.receipt_backing.receipt_shape_ready,
    event.receipt_shape_ready,
  );
  assert.equal(event.transition_contract.receipt_backing.mint_performed, false);
  assert.equal(
    event.transition_contract.receipt_backing.chain_advance_performed,
    false,
  );
  assert.equal(
    event.transition_contract.bounds.max_iterations,
    AGENT_KERNEL_MAX_ITERATIONS,
  );
  assert.equal(event.transition_contract.bounds.payload_key_limit, 20);
  assert.ok(Object.isFrozen(event.transition_contract));
  assert.ok(Object.isFrozen(event.transition_contract.receipt_backing));
});

test("Consent transition event records the observed human decision without broadening authority", () => {
  let { kernel } = tick(validKernel());
  ({ kernel } = tick(kernel));
  ({ kernel } = tick(kernel, { proposal_summary: { action: "draft" } }));
  const { event } = tick(kernel, { consent_decision: "granted" });

  assert.equal(event.from_state, AGENT_STATES.CONSENT_REQUEST);
  assert.equal(event.transition_contract.consent.required_for_transition, true);
  assert.equal(
    event.transition_contract.consent.operator_decision_observed,
    "granted",
  );
  assert.equal(
    event.transition_contract.consent.exact_string_required_for_effects,
    true,
  );
  assert.equal(event.transition_contract.receipt_backing.mint_performed, false);
});

test("Refused transition still carries assurance contract and no chain advance", () => {
  let { kernel } = tick(validKernel());
  ({ kernel } = tick(kernel));
  ({ kernel } = tick(kernel, { proposal_summary: { action: "draft" } }));
  const { event } = tick(kernel);

  assert.equal(event.refused, true);
  assert.equal(event.transition_contract.explicit, true);
  assert.equal(event.transition_contract.receipt_backed, true);
  assert.equal(
    event.transition_contract.receipt_backing.status,
    "refusal_event_auditable_not_chain_advance_ready",
  );
  assert.equal(
    event.transition_contract.receipt_backing.chain_advance_performed,
    false,
  );
  assert.equal(event.transition_contract.consent.required_for_transition, true);
});

// =========================================================================
// VALID TRANSITION HELPER + SUMMARY (3)
// =========================================================================

test("isValidStateTransition rejects skip-state transitions", () => {
  assert.equal(isValidStateTransition("init", "perceive"), true);
  assert.equal(isValidStateTransition("init", "act_or_hold"), false);
  assert.equal(isValidStateTransition("perceive", "consent_request"), false);
  assert.equal(isValidStateTransition("perceive", "halted"), true);
  assert.equal(isValidStateTransition("complete", "perceive"), false);
});

test("Summary preserves load-bearing fields + canonical boundary", () => {
  const k = validKernel();
  const s = buildAgentKernelSummary(k);
  assert.equal(s.schema, "bizra.dema.agent_kernel_summary.v0.1");
  assert.equal(s.truth_label, "NODE0_LOCAL_SEED");
  assert.equal(s.mode, "summary");
  assert.equal(s.agent_id, "pat-1-mission-scribe");
  assert.equal(s.current_state, AGENT_STATES.INIT);
  assert.equal(s.halted, false);
  assert.ok(isCanonicalBoundary(s.boundary));
});

test("Exports + constants present and frozen", () => {
  assert.ok(Object.isFrozen(AGENT_STATES));
  assert.ok(Object.isFrozen(AGENT_KERNEL_VALID_TRANSITIONS));
  assert.ok(Array.isArray(AGENT_KERNEL_TERMINAL_STATES));
  assert.ok(AGENT_KERNEL_TERMINAL_STATES.includes("halted"));
  assert.ok(AGENT_KERNEL_TERMINAL_STATES.includes("complete"));
  assert.equal(typeof AGENT_KERNEL_MAX_ITERATIONS, "number");
  assert.ok(Object.isFrozen(AGENT_KERNEL_REQUIRED_BLOCKED_EFFECTS));
  assert.ok(
    AGENT_KERNEL_REQUIRED_BLOCKED_EFFECTS.includes(
      "infinite_loop_without_decision",
    ),
  );
  assert.ok(
    AGENT_KERNEL_REQUIRED_BLOCKED_EFFECTS.includes(
      "receipt_mint_inside_kernel",
    ),
  );
});
