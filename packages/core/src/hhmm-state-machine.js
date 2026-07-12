// HHMM-STATE-MACHINE-KERNEL-1A
//
// A real, deterministic, IMPORTED state-machine kernel that models the Node0/Dema
// lifecycle as transitions over observable evidence. "HHMM-inspired" only in shape
// (states + emissions + an inferred state with a confidence) — it is NOT neural,
// NOT machine learning, NOT learned probabilistic inference. The "hidden" aspect is
// represented honestly as `inferred_state_confidence`, a value read from a fixed
// deterministic rule table, not estimated from data.
//
// This is a pure kernel: it has no daemon, no autonomous loop, no self-modification,
// no file write, no model call, no network, no signing/key/mint, no federation, and
// performs no execution. It reads evidence and returns frozen verdicts.

import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import { buildAllFalseBoundaryFromKeys } from "./boundary-schema.js";

export const HHMM_STATE_MACHINE_SCHEMA = "bizra.dema.hhmm_state_machine.v0.1";

const CANONICAL_STATES = Object.freeze([
  "declared",
  "preview",
  "tested_preview",
  "gate_blocked",
  "merge_ready",
  "merged",
  "designed_not_live",
  "rejected",
]);

const CANONICAL_EMISSIONS = Object.freeze([
  "code_anchor_present",
  "tests_passed",
  "check_passed",
  "guidance_passed",
  "ci_green",
  "pr_merged",
  "claim_overreach",
  "gate_failed",
  "designed_only",
]);

// Active (non-terminal) states the global transitions apply from.
const ACTIVE_STATES = Object.freeze([
  "declared",
  "preview",
  "tested_preview",
  "merge_ready",
  "gate_blocked",
]);

// Deterministic rule confidence per emission (NOT a learned probability).
const CONFIDENCE_BY_EMISSION = Object.freeze({
  code_anchor_present: 0.7,
  tests_passed: 0.85,
  check_passed: 0.85,
  guidance_passed: 0.85,
  ci_green: 0.95,
  pr_merged: 1.0,
  claim_overreach: 0.95,
  gate_failed: 0.9,
  designed_only: 0.9,
});

// Global transitions available from any ACTIVE state.
const GLOBAL_FROM_ACTIVE = Object.freeze({
  gate_failed: { to: "gate_blocked", reason_code: "gate_failed" },
  claim_overreach: { to: "rejected", reason_code: "claim_overreach" },
  designed_only: { to: "designed_not_live", reason_code: "designed_only" },
});

// Per-state specific transitions (the lifecycle spine).
const PER_STATE = Object.freeze({
  declared: { code_anchor_present: { to: "preview", reason_code: "code_anchor_present" } },
  preview: { tests_passed: { to: "tested_preview", reason_code: "tests_passed" } },
  tested_preview: {
    ci_green: { to: "merge_ready", reason_code: "ci_green" },
    check_passed: { to: "tested_preview", reason_code: "check_passed" },
    guidance_passed: { to: "tested_preview", reason_code: "guidance_passed" },
  },
  merge_ready: { pr_merged: { to: "merged", reason_code: "pr_merged" } },
  gate_blocked: { ci_green: { to: "merge_ready", reason_code: "gate_recovered" } },
});

export const HHMM_BOUNDARY_KEYS = Object.freeze([
  "runtime_execution_performed",
  "autonomous_loop_started",
  "self_modification_performed",
  "file_write_performed",
  "model_invocation_performed",
  "network_call_performed",
  "signing_performed",
  "key_generation_performed",
  "mint_performed",
  "poi_activation_performed",
  "federation_started",
  "mcp_runtime_started",
  "a2a_runtime_started",
]);

const CANONICAL_BOUNDARY = buildAllFalseBoundaryFromKeys(HHMM_BOUNDARY_KEYS);

const WHAT_THIS_PROVES = Object.freeze([
  "Node0/Dema lifecycle state can be deterministically inferred from observable evidence via an explicit transition table.",
  "Invalid transitions, unknown states, and unsupported emissions all fail closed with a reason_code.",
  "A trace over observations is content-addressed (trace_hash) and reproducible.",
]);

const WHAT_THIS_DOES_NOT_PROVE = Object.freeze([
  "This is NOT neural, machine learning, or learned probabilistic inference — confidence is read from a fixed rule table.",
  "The kernel runs no daemon, no autonomous loop, and executes nothing.",
  "It does not mutate files, branches, PRs, keys, tokens, or any network/federation state.",
]);

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function canonicalTransitions() {
  const table = {};
  for (const state of CANONICAL_STATES) {
    table[state] = {
      ...(ACTIVE_STATES.includes(state) ? GLOBAL_FROM_ACTIVE : {}),
      ...(PER_STATE[state] || {}),
    };
  }
  return table;
}

export function buildHhmmStateMachine({
  states,
  transitions,
  emissions,
  initial_state,
} = {}) {
  return deepFreeze({
    schema: HHMM_STATE_MACHINE_SCHEMA,
    inference_method: "deterministic_rule_table",
    learned_probabilistic_inference: false,
    states: states ? [...states] : [...CANONICAL_STATES],
    emissions: emissions ? [...emissions] : [...CANONICAL_EMISSIONS],
    transitions: transitions ? transitions : canonicalTransitions(),
    initial_state: initial_state ?? "declared",
    confidence_by_emission: { ...CONFIDENCE_BY_EMISSION },
    what_this_proves: WHAT_THIS_PROVES,
    what_this_does_not_prove: WHAT_THIS_DOES_NOT_PROVE,
    boundary: { ...CANONICAL_BOUNDARY },
  });
}

function isKnownEmission(machine, observation) {
  return typeof observation === "string" && machine.emissions.includes(observation);
}

export function classifyHhmmObservation({ machine, observation } = {}) {
  if (!machine || typeof machine !== "object") {
    return Object.freeze({ valid: false, observation: null, reason_code: "machine_missing", confidence: null });
  }
  if (typeof observation !== "string" || observation.trim().length === 0) {
    return Object.freeze({ valid: false, observation: null, reason_code: "malformed_observation", confidence: null });
  }
  if (!isKnownEmission(machine, observation)) {
    return Object.freeze({ valid: false, observation, reason_code: `unsupported_emission:${observation}`, confidence: null });
  }
  const confidence = machine.confidence_by_emission?.[observation] ?? null;
  return Object.freeze({ valid: true, observation, reason_code: "recognized_emission", confidence });
}

export function transitionHhmmState({ machine, current_state, observation } = {}) {
  if (!machine || typeof machine !== "object") {
    return Object.freeze({ valid: false, from: null, to: null, observation: null, reason_code: "machine_missing", confidence: null });
  }
  if (!machine.states.includes(current_state)) {
    return Object.freeze({ valid: false, from: current_state ?? null, to: null, observation: observation ?? null, reason_code: `unknown_state:${current_state}`, confidence: null });
  }
  const classified = classifyHhmmObservation({ machine, observation });
  if (!classified.valid) {
    return Object.freeze({ valid: false, from: current_state, to: current_state, observation: classified.observation, reason_code: classified.reason_code, confidence: null });
  }
  const rule = machine.transitions?.[current_state]?.[observation];
  if (!rule || typeof rule.to !== "string") {
    return Object.freeze({ valid: false, from: current_state, to: current_state, observation, reason_code: `invalid_transition:${current_state}:${observation}`, confidence: null });
  }
  // Contract: a valid transition ALWAYS carries a numeric rule confidence. A machine
  // whose confidence_by_emission omits a transition-reachable emission is malformed —
  // fail closed rather than emit a valid transition with null confidence.
  if (typeof classified.confidence !== "number" || !Number.isFinite(classified.confidence)) {
    return Object.freeze({ valid: false, from: current_state, to: current_state, observation, reason_code: `emission_confidence_missing:${observation}`, confidence: null });
  }
  return Object.freeze({
    valid: true,
    from: current_state,
    to: rule.to,
    observation,
    reason_code: rule.reason_code ?? `transition:${current_state}->${rule.to}`,
    confidence: classified.confidence,
  });
}

export function runHhmmTrace({ machine, observations } = {}) {
  if (!machine || typeof machine !== "object") {
    return Object.freeze({ valid: false, reason_code: "machine_missing", initial_state: null, final_state: null, path: Object.freeze([]), step_count: 0, trace_hash: null, inferred_state_confidence: null });
  }
  if (!Array.isArray(observations)) {
    return Object.freeze({ valid: false, reason_code: "observations_not_array", initial_state: machine.initial_state, final_state: machine.initial_state, path: Object.freeze([]), step_count: 0, trace_hash: null, inferred_state_confidence: null });
  }

  const path = [];
  let current = machine.initial_state;
  let allValid = true;
  let lastConfidence = null;

  for (const observation of observations) {
    const step = transitionHhmmState({ machine, current_state: current, observation });
    path.push(step);
    if (step.valid) {
      current = step.to;
      lastConfidence = step.confidence;
    } else {
      allValid = false;
      // fail closed: an invalid observation does NOT advance the state
    }
  }

  const hashableBody = {
    schema: machine.schema,
    states: machine.states,
    transitions: machine.transitions,
    initial_state: machine.initial_state,
    observations,
    // Bind confidence: the hash must vouch for the confidence it carries, not
    // only the structural path. Without `confidence`, two machines differing
    // only in confidence_by_emission share a trace_hash while surfacing a
    // different inferred_state_confidence (integrity gap closed here).
    path: path.map((s) => ({ from: s.from, to: s.to, observation: s.observation, reason_code: s.reason_code, valid: s.valid, confidence: s.confidence ?? null })),
  };

  return deepFreeze({
    valid: allValid,
    reason_code: allValid ? "trace_complete" : "trace_contains_invalid_step",
    initial_state: machine.initial_state,
    final_state: current,
    path,
    step_count: path.length,
    inferred_state_confidence: lastConfidence,
    trace_hash: sha256(stableStringify(hashableBody)),
  });
}

export function verifyHhmmMachine(machine) {
  const blocked_by = [];
  if (!machine || typeof machine !== "object") {
    return Object.freeze({ valid: false, blocked_by: Object.freeze(["machine_missing"]) });
  }
  if (machine.schema !== HHMM_STATE_MACHINE_SCHEMA) blocked_by.push("schema_invalid");

  const states = Array.isArray(machine.states) ? machine.states : [];
  const emissions = Array.isArray(machine.emissions) ? machine.emissions : [];
  if (states.length === 0) blocked_by.push("states_empty");
  if (!states.includes(machine.initial_state)) blocked_by.push(`initial_state_unknown:${machine.initial_state}`);

  const transitions = machine.transitions && typeof machine.transitions === "object" ? machine.transitions : {};
  for (const [fromState, byObs] of Object.entries(transitions)) {
    if (!states.includes(fromState)) blocked_by.push(`transition_source_unknown:${fromState}`);
    for (const [obs, rule] of Object.entries(byObs || {})) {
      if (!emissions.includes(obs)) blocked_by.push(`transition_emission_unknown:${fromState}:${obs}`);
      if (!rule || !states.includes(rule.to)) blocked_by.push(`transition_target_unknown:${fromState}:${obs}->${rule?.to}`);
    }
  }

  // every emission must carry a numeric rule confidence (no null-confidence transitions)
  const conf = machine.confidence_by_emission && typeof machine.confidence_by_emission === "object" ? machine.confidence_by_emission : {};
  for (const e of emissions) {
    if (typeof conf[e] !== "number" || !Number.isFinite(conf[e])) blocked_by.push(`emission_confidence_missing:${e}`);
  }

  if (!machine.boundary || typeof machine.boundary !== "object") {
    blocked_by.push("boundary_missing");
  } else {
    for (const [k, v] of Object.entries(machine.boundary)) {
      if (v !== false) blocked_by.push(`boundary_not_false:${k}`);
    }
  }
  if (machine.learned_probabilistic_inference !== false) blocked_by.push("ml_inference_overclaim");

  return Object.freeze({ valid: blocked_by.length === 0, blocked_by: Object.freeze([...blocked_by]) });
}
