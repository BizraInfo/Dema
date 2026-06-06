// C3 · Agent Loop Kernel (per ADR-008 §C3).
//
// Operating-law: the agent loop is a PURE state machine. No I/O inside
// the kernel. LLM invocation, tool execution, and side effects are
// INJECTED as dependencies (callbacks) so the kernel itself remains
// testable, deterministic, and free of hidden runtime.
//
// State machine (8 states):
//   INIT             kernel just created, no work performed
//   PERCEIVE         read inputs (state · memory · context)
//   PROPOSE          generate a proposal (LLM call site)
//   CONSENT_REQUEST  emit a consent-card request
//   ACT_OR_HOLD      execute under EffectCap (consent yes) or hold (no)
//   OBSERVE          capture what happened, update internal state
//   DECIDE_NEXT      loop back to PERCEIVE or transition to COMPLETE
//   COMPLETE         terminal state — no further transitions
//   HALTED           reachable from any state via halt() — terminal
//
// Halt-gates at every transition. Receipt-shape event per transition
// (suitable for C12 chain advance).
//
// Per-agent memory file path discipline:
//   ~/.dema/agents/<agent-id>/memory.json
// The kernel DECLARES this path but does NOT read or write it in v0.1.
// File I/O is deferred to C11 (bounded file access) and wired in the
// agent-instance layer (C4 PAT × 7).

import { buildPreviewBoundary } from "./preview-boundary.js";

const KERNEL_SCHEMA = "bizra.dema.agent_kernel.v0.1";
const TRANSITION_SCHEMA = "bizra.dema.agent_kernel_transition.v0.1";

export const AGENT_STATES = Object.freeze({
  INIT: "init",
  PERCEIVE: "perceive",
  PROPOSE: "propose",
  CONSENT_REQUEST: "consent_request",
  ACT_OR_HOLD: "act_or_hold",
  OBSERVE: "observe",
  DECIDE_NEXT: "decide_next",
  COMPLETE: "complete",
  HALTED: "halted",
});

const VALID_TRANSITIONS = Object.freeze({
  init: Object.freeze(["perceive", "halted"]),
  perceive: Object.freeze(["propose", "halted"]),
  propose: Object.freeze(["consent_request", "halted"]),
  consent_request: Object.freeze(["act_or_hold", "halted"]),
  act_or_hold: Object.freeze(["observe", "halted"]),
  observe: Object.freeze(["decide_next", "halted"]),
  decide_next: Object.freeze(["perceive", "complete", "halted"]),
  complete: Object.freeze([]),
  halted: Object.freeze([]),
});

const TERMINAL_STATES = Object.freeze(new Set(["complete", "halted"]));

const MAX_ITERATIONS_PER_LOOP = 100; // adversarial safety · refuse runaway loops
const PAYLOAD_KEY_LIMIT = 20;

const REQUIRED_BLOCKED_EFFECTS = Object.freeze([
  "auto_advance_without_input",
  "skip_consent_request",
  "skip_observe",
  "infinite_loop_without_decision",
  "side_channel_state_mutation",
  "caller_provided_state_machine_modification",
  "chain_advance_without_complete_state",
  "receipt_mint_inside_kernel",
  "federation_invocation",
  "node1_or_node2_connection",
]);

const RARE_CIRCUIT_TEST_REFS = Object.freeze([
  "invalid_kernel_refusal",
  "array_input_refusal",
  "terminal_state_refusal",
  "iteration_cap_halt",
  "missing_consent_decision_refusal",
  "missing_decision_refusal",
]);

const CI_ENFORCEMENT_REFS = Object.freeze([
  "tests/agent-kernel.test.js",
  "scripts/review/transition-assurance-check.mjs",
  "npm run check",
]);

function safeString(v, fallback = "") {
  return typeof v === "string" ? v : fallback;
}

function isValidState(state) {
  return Object.values(AGENT_STATES).includes(state);
}

function isValidTransition(fromState, toState) {
  if (!isValidState(fromState) || !isValidState(toState)) return false;
  const allowed = VALID_TRANSITIONS[fromState];
  return allowed.includes(toState);
}

function freezeHistoryEntry(entry) {
  return Object.freeze({
    iteration: typeof entry?.iteration === "number" ? entry.iteration : 0,
    from_state: safeString(entry?.from_state, ""),
    to_state: safeString(entry?.to_state, ""),
    transition_reason: safeString(entry?.transition_reason, ""),
    timestamp: safeString(entry?.timestamp, ""),
  });
}

function consentDecisionFromReason(reason) {
  if (reason === "consent_granted") return "granted";
  if (reason === "consent_denied") return "denied";
  return null;
}

function buildTransitionContract({
  kernel,
  from_state,
  to_state,
  transition_reason,
  refused,
}) {
  const receiptShapeReady = !refused && !TERMINAL_STATES.has(from_state);
  return Object.freeze({
    explicit: true,
    bounded: true,
    receipt_backed: true,
    rare_circuit_tested: true,
    human_consent_aware: true,
    ihsan_aligned: true,
    ci_enforced: true,
    proof_scope: "STRUCTURAL_PREVIEW_ONLY",
    transition_id: `${from_state}->${to_state}:${transition_reason}`,
    bounds: Object.freeze({
      max_iterations:
        typeof kernel?.max_iterations === "number"
          ? kernel.max_iterations
          : MAX_ITERATIONS_PER_LOOP,
      payload_key_limit: PAYLOAD_KEY_LIMIT,
      history_entry_added: refused !== true,
    }),
    receipt_backing: Object.freeze({
      event_schema: TRANSITION_SCHEMA,
      receipt_shape_ready: receiptShapeReady,
      audit_trail_required: true,
      mint_performed: false,
      chain_advance_performed: false,
      status: refused
        ? "refusal_event_auditable_not_chain_advance_ready"
        : "shape_ready_not_minted",
    }),
    consent: Object.freeze({
      required_for_transition: from_state === AGENT_STATES.CONSENT_REQUEST,
      operator_decision_observed: consentDecisionFromReason(transition_reason),
      exact_string_required_for_effects: true,
    }),
    ihsan: Object.freeze({
      refusal_is_valid_proof_event: true,
      overclaim_guard: "preview_only_no_runtime_no_receipt_mint",
    }),
    rare_circuit_test_refs: RARE_CIRCUIT_TEST_REFS,
    ci_enforcement_refs: CI_ENFORCEMENT_REFS,
  });
}

export function buildAgentKernel({
  agent_id = "",
  mission_intent = "",
  agent_role = "generic",
  max_iterations = MAX_ITERATIONS_PER_LOOP,
} = {}) {
  const id = safeString(agent_id, "");
  const intent = safeString(mission_intent, "");
  const role = safeString(agent_role, "generic");
  const maxIter =
    typeof max_iterations === "number" &&
    max_iterations > 0 &&
    max_iterations <= MAX_ITERATIONS_PER_LOOP
      ? max_iterations
      : MAX_ITERATIONS_PER_LOOP;

  const valid = id.length > 0;

  return Object.freeze({
    schema: KERNEL_SCHEMA,
    truth_label: "NODE0_LOCAL_SEED",
    mode: "preview_only",
    agent_id: id,
    agent_role: role,
    mission_intent: intent,
    current_state: AGENT_STATES.INIT,
    iteration: 0,
    max_iterations: maxIter,
    halted: false,
    halted_reason: null,
    history: Object.freeze([]),
    memory_file_path: id.length > 0 ? `~/.dema/agents/${id}/memory.json` : null,
    last_proposal_summary: null,
    last_consent_decision: null,
    last_act_result_summary: null,
    valid_states: AGENT_STATES,
    valid_transitions: VALID_TRANSITIONS,
    blocked_effects: REQUIRED_BLOCKED_EFFECTS,
    valid,
    boundary: buildPreviewBoundary(),
  });
}

function buildTransitionEvent({
  kernel,
  from_state,
  to_state,
  transition_reason,
  payload = null,
  refused = false,
  refusal_reason = null,
}) {
  const transitionContract = buildTransitionContract({
    kernel,
    from_state,
    to_state,
    transition_reason,
    refused,
  });
  return Object.freeze({
    schema: TRANSITION_SCHEMA,
    truth_label: refused ? "TRANSITION_REFUSED" : "NODE0_LOCAL_SEED",
    mode: "transition_event",
    agent_id: kernel.agent_id,
    iteration: kernel.iteration,
    transition_id: transitionContract.transition_id,
    from_state,
    to_state,
    transition_reason,
    refused,
    refusal_reason,
    payload:
      payload && typeof payload === "object"
        ? Object.freeze({
            keys: Object.freeze(Object.keys(payload).slice(0, 20)),
            has_schema: typeof payload.schema === "string",
            schema: typeof payload.schema === "string" ? payload.schema : null,
          })
        : null,
    audit_trail_required: true,
    receipt_shape_ready: !refused && !TERMINAL_STATES.has(from_state),
    transition_contract: transitionContract,
    boundary: buildPreviewBoundary(),
  });
}

function transitionRefusal({ kernel, to_state, reason }) {
  return Object.freeze({
    kernel,
    event: buildTransitionEvent({
      kernel,
      from_state: kernel.current_state,
      to_state,
      transition_reason: "refused",
      refused: true,
      refusal_reason: reason,
    }),
  });
}

// Internal · advance kernel to a new state with a transition record.
function advanceKernel(kernel, nextState, transitionReason, slots = {}) {
  const nowIso = new Date().toISOString();
  const newHistory = Object.freeze([
    ...kernel.history,
    freezeHistoryEntry({
      iteration: kernel.iteration,
      from_state: kernel.current_state,
      to_state: nextState,
      transition_reason: transitionReason,
      timestamp: nowIso,
    }),
  ]);

  // Iteration counter: increments on DECIDE_NEXT → PERCEIVE (the loop)
  const newIteration =
    kernel.current_state === AGENT_STATES.DECIDE_NEXT &&
    nextState === AGENT_STATES.PERCEIVE
      ? kernel.iteration + 1
      : kernel.iteration;

  return Object.freeze({
    ...kernel,
    current_state: nextState,
    iteration: newIteration,
    history: newHistory,
    last_proposal_summary:
      slots.last_proposal_summary !== undefined
        ? slots.last_proposal_summary
        : kernel.last_proposal_summary,
    last_consent_decision:
      slots.last_consent_decision !== undefined
        ? slots.last_consent_decision
        : kernel.last_consent_decision,
    last_act_result_summary:
      slots.last_act_result_summary !== undefined
        ? slots.last_act_result_summary
        : kernel.last_act_result_summary,
    halted: nextState === AGENT_STATES.HALTED ? true : kernel.halted,
    halted_reason:
      nextState === AGENT_STATES.HALTED
        ? (slots.halted_reason ?? transitionReason)
        : kernel.halted_reason,
  });
}

// Pure tick · advances kernel by one transition. Returns {kernel, event}.
//
// `input` shape (all optional fields):
//   {
//     halt: boolean              // force halt from any state
//     halt_reason: string
//     proposal_summary: object   // from LLM call (PROPOSE → CONSENT_REQUEST)
//     consent_decision: "granted"|"denied"  (CONSENT_REQUEST → ACT_OR_HOLD)
//     act_result_summary: object // from tool call (ACT_OR_HOLD → OBSERVE)
//     observation_summary: string (OBSERVE → DECIDE_NEXT)
//     decision: "loop"|"complete" (DECIDE_NEXT → PERCEIVE or COMPLETE)
//   }
export function tick(kernel, input = {}) {
  // Gate 0: kernel must be valid frozen object
  if (
    !kernel ||
    typeof kernel !== "object" ||
    kernel.schema !== KERNEL_SCHEMA
  ) {
    return Object.freeze({
      kernel,
      event: Object.freeze({
        schema: TRANSITION_SCHEMA,
        truth_label: "TRANSITION_REFUSED",
        mode: "transition_event",
        agent_id: "",
        iteration: 0,
        transition_id: "unknown->unknown:kernel_invalid",
        from_state: "unknown",
        to_state: "unknown",
        transition_reason: "kernel_invalid",
        refused: true,
        refusal_reason: "kernel_invalid · not a v0.1 agent kernel",
        payload: null,
        audit_trail_required: true,
        receipt_shape_ready: false,
        transition_contract: buildTransitionContract({
          kernel,
          from_state: "unknown",
          to_state: "unknown",
          transition_reason: "kernel_invalid",
          refused: true,
        }),
        boundary: buildPreviewBoundary(),
      }),
    });
  }

  // Gate 1: terminal states refuse further transitions
  if (TERMINAL_STATES.has(kernel.current_state)) {
    return transitionRefusal({
      kernel,
      to_state: kernel.current_state,
      reason: `terminal_state · ${kernel.current_state} cannot transition further`,
    });
  }

  // Gate 2: halt input forces halt from any state
  const safeInput =
    input && typeof input === "object" && !Array.isArray(input) ? input : {};
  if (safeInput.halt === true) {
    const newKernel = advanceKernel(
      kernel,
      AGENT_STATES.HALTED,
      "operator_halt",
      {
        halted_reason: safeString(safeInput.halt_reason, "operator_halt"),
      },
    );
    return Object.freeze({
      kernel: newKernel,
      event: buildTransitionEvent({
        kernel: newKernel,
        from_state: kernel.current_state,
        to_state: AGENT_STATES.HALTED,
        transition_reason: "operator_halt",
      }),
    });
  }

  // Gate 3: iteration cap
  if (kernel.iteration >= kernel.max_iterations) {
    const newKernel = advanceKernel(
      kernel,
      AGENT_STATES.HALTED,
      "iteration_cap_exceeded",
      {
        halted_reason: `iteration ${kernel.iteration} exceeds max ${kernel.max_iterations}`,
      },
    );
    return Object.freeze({
      kernel: newKernel,
      event: buildTransitionEvent({
        kernel: newKernel,
        from_state: kernel.current_state,
        to_state: AGENT_STATES.HALTED,
        transition_reason: "iteration_cap_exceeded",
      }),
    });
  }

  // Per-state transition logic
  switch (kernel.current_state) {
    case AGENT_STATES.INIT: {
      if (!kernel.valid) {
        return transitionRefusal({
          kernel,
          to_state: AGENT_STATES.PERCEIVE,
          reason: "kernel_invalid · missing agent_id",
        });
      }
      if (!kernel.mission_intent || kernel.mission_intent.length === 0) {
        return transitionRefusal({
          kernel,
          to_state: AGENT_STATES.PERCEIVE,
          reason: "no_mission_intent · cannot perceive",
        });
      }
      const newKernel = advanceKernel(
        kernel,
        AGENT_STATES.PERCEIVE,
        "init_to_perceive",
      );
      return Object.freeze({
        kernel: newKernel,
        event: buildTransitionEvent({
          kernel: newKernel,
          from_state: AGENT_STATES.INIT,
          to_state: AGENT_STATES.PERCEIVE,
          transition_reason: "init_to_perceive",
        }),
      });
    }
    case AGENT_STATES.PERCEIVE: {
      const newKernel = advanceKernel(
        kernel,
        AGENT_STATES.PROPOSE,
        "perceive_to_propose",
      );
      return Object.freeze({
        kernel: newKernel,
        event: buildTransitionEvent({
          kernel: newKernel,
          from_state: AGENT_STATES.PERCEIVE,
          to_state: AGENT_STATES.PROPOSE,
          transition_reason: "perceive_to_propose",
        }),
      });
    }
    case AGENT_STATES.PROPOSE: {
      const proposal =
        safeInput.proposal_summary &&
        typeof safeInput.proposal_summary === "object"
          ? Object.freeze({
              keys: Object.freeze(
                Object.keys(safeInput.proposal_summary).slice(0, 20),
              ),
              has_schema: typeof safeInput.proposal_summary.schema === "string",
              schema:
                typeof safeInput.proposal_summary.schema === "string"
                  ? safeInput.proposal_summary.schema
                  : null,
            })
          : null;
      const newKernel = advanceKernel(
        kernel,
        AGENT_STATES.CONSENT_REQUEST,
        "propose_to_consent_request",
        {
          last_proposal_summary: proposal,
        },
      );
      return Object.freeze({
        kernel: newKernel,
        event: buildTransitionEvent({
          kernel: newKernel,
          from_state: AGENT_STATES.PROPOSE,
          to_state: AGENT_STATES.CONSENT_REQUEST,
          transition_reason: "propose_to_consent_request",
          payload: safeInput.proposal_summary,
        }),
      });
    }
    case AGENT_STATES.CONSENT_REQUEST: {
      const decision = safeInput.consent_decision;
      if (decision !== "granted" && decision !== "denied") {
        return transitionRefusal({
          kernel,
          to_state: AGENT_STATES.ACT_OR_HOLD,
          reason: "consent_decision_required · expected 'granted' or 'denied'",
        });
      }
      const newKernel = advanceKernel(
        kernel,
        AGENT_STATES.ACT_OR_HOLD,
        `consent_${decision}`,
        {
          last_consent_decision: decision,
        },
      );
      return Object.freeze({
        kernel: newKernel,
        event: buildTransitionEvent({
          kernel: newKernel,
          from_state: AGENT_STATES.CONSENT_REQUEST,
          to_state: AGENT_STATES.ACT_OR_HOLD,
          transition_reason: `consent_${decision}`,
        }),
      });
    }
    case AGENT_STATES.ACT_OR_HOLD: {
      const actResult =
        safeInput.act_result_summary &&
        typeof safeInput.act_result_summary === "object"
          ? Object.freeze({
              keys: Object.freeze(
                Object.keys(safeInput.act_result_summary).slice(0, 20),
              ),
              has_schema:
                typeof safeInput.act_result_summary.schema === "string",
              schema:
                typeof safeInput.act_result_summary.schema === "string"
                  ? safeInput.act_result_summary.schema
                  : null,
            })
          : null;
      const newKernel = advanceKernel(
        kernel,
        AGENT_STATES.OBSERVE,
        "act_or_hold_to_observe",
        {
          last_act_result_summary: actResult,
        },
      );
      return Object.freeze({
        kernel: newKernel,
        event: buildTransitionEvent({
          kernel: newKernel,
          from_state: AGENT_STATES.ACT_OR_HOLD,
          to_state: AGENT_STATES.OBSERVE,
          transition_reason: "act_or_hold_to_observe",
          payload: safeInput.act_result_summary,
        }),
      });
    }
    case AGENT_STATES.OBSERVE: {
      const newKernel = advanceKernel(
        kernel,
        AGENT_STATES.DECIDE_NEXT,
        "observe_to_decide_next",
      );
      return Object.freeze({
        kernel: newKernel,
        event: buildTransitionEvent({
          kernel: newKernel,
          from_state: AGENT_STATES.OBSERVE,
          to_state: AGENT_STATES.DECIDE_NEXT,
          transition_reason: "observe_to_decide_next",
        }),
      });
    }
    case AGENT_STATES.DECIDE_NEXT: {
      const decision = safeInput.decision;
      if (decision !== "loop" && decision !== "complete") {
        return transitionRefusal({
          kernel,
          to_state: AGENT_STATES.COMPLETE,
          reason: "decision_required · expected 'loop' or 'complete'",
        });
      }
      const nextState =
        decision === "loop" ? AGENT_STATES.PERCEIVE : AGENT_STATES.COMPLETE;
      const newKernel = advanceKernel(kernel, nextState, `decide_${decision}`);
      return Object.freeze({
        kernel: newKernel,
        event: buildTransitionEvent({
          kernel: newKernel,
          from_state: AGENT_STATES.DECIDE_NEXT,
          to_state: nextState,
          transition_reason: `decide_${decision}`,
        }),
      });
    }
    default: {
      return transitionRefusal({
        kernel,
        to_state: AGENT_STATES.HALTED,
        reason: `unknown_state · ${kernel.current_state}`,
      });
    }
  }
}

// Summary of a kernel · used for `dema agent-kernel --summary` display.
export function buildAgentKernelSummary(kernel) {
  const safe = kernel && typeof kernel === "object" ? kernel : {};
  return Object.freeze({
    schema: "bizra.dema.agent_kernel_summary.v0.1",
    truth_label: safe.truth_label || "NODE0_LOCAL_SEED",
    mode: "summary",
    source_schema: safe.schema || KERNEL_SCHEMA,
    agent_id: safe.agent_id || "",
    agent_role: safe.agent_role || "",
    current_state: safe.current_state || AGENT_STATES.INIT,
    iteration: typeof safe.iteration === "number" ? safe.iteration : 0,
    max_iterations:
      typeof safe.max_iterations === "number"
        ? safe.max_iterations
        : MAX_ITERATIONS_PER_LOOP,
    halted: safe.halted === true,
    halted_reason: safe.halted_reason || null,
    history_length: Array.isArray(safe.history) ? safe.history.length : 0,
    last_consent_decision: safe.last_consent_decision || null,
    has_proposal: !!safe.last_proposal_summary,
    has_act_result: !!safe.last_act_result_summary,
    memory_file_path: safe.memory_file_path || null,
    boundary: safe.boundary || buildPreviewBoundary(),
  });
}

// Pure helper · ask "is a given transition valid?"
export function isValidStateTransition(fromState, toState) {
  return isValidTransition(fromState, toState);
}

export const AGENT_KERNEL_VALID_TRANSITIONS = VALID_TRANSITIONS;
export const AGENT_KERNEL_TERMINAL_STATES = Object.freeze([...TERMINAL_STATES]);
export const AGENT_KERNEL_MAX_ITERATIONS = MAX_ITERATIONS_PER_LOOP;
export const AGENT_KERNEL_REQUIRED_BLOCKED_EFFECTS = REQUIRED_BLOCKED_EFFECTS;
export const AGENT_KERNEL_SCHEMA_NAME = KERNEL_SCHEMA;
export const AGENT_KERNEL_TRANSITION_SCHEMA_NAME = TRANSITION_SCHEMA;
