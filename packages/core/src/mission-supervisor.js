// MISSION-SUPERVISOR-0A — TASK-026 spec phase 02: the conductor.
//
// NOT ML. NOT runtime. NOT a daemon. This is a PURE REDUCER. It proposes; it
// never performs. `EXECUTE` here means "an execution result event was injected",
// never that anything ran — `runtime_execution_performed` is false by
// construction, not by policy.
//
// WHY THIS EXISTS. The measured kernels are judges without a court schedule.
// Nothing walked a mission through stages, enforced a budget, or decided what is
// eligible next.
//
// THE ONE THING IT REFUSES TO OWN. Acceptance semantics. The verdict is computed
// by `evaluateAgainstContract` from the model-swap-invariance kernel, called with
// exactly two bindings — the output and the contract's frozen acceptance law. The
// verdict path cannot read `worker_id` because it is never passed one, and an
// event that tries to carry its own acceptance law is refused rather than
// silently preferred: the rule that decides success is bound to `contract_hash`
// before execution, so no worker may supply or replace it after freeze.
//
// Live conduction stays outside the Dema face or behind the governed Node0
// adapter (phase 00 §3). Nothing here spawns, opens a socket, or calls a model.
//
// Pure: no fs, no network, no process, no clock, no random, no model call.

import { sha256CanonicalJsonV1 } from "../../canon/src/sha256-canonical-json-v1.js";
import { buildPreviewBoundary } from "./preview-boundary.js";
import { evaluateAgainstContract } from "./node0-model-swap-invariance.js";

export const MISSION_SUPERVISOR_SCHEMA = "bizra.dema.mission_supervisor.v0.1";
export const MISSION_SUPERVISOR_TRUTH_LABEL = "MISSION_SUPERVISOR_PREVIEW";

export const STAGES = Object.freeze([
  "DISCOVER",
  "CONTRACT",
  "PLAN",
  "FATE",
  "EXECUTE",
  "VERIFY",
  "REVIEW",
  "RECEIPT",
  "DECIDE",
]);
export const TERMINAL_STAGES = Object.freeze(["DONE", "HALTED", "BUDGET_EXHAUSTED"]);

export const EVENT_KINDS = Object.freeze({
  DISCOVERY_RECORDED: "discovery_recorded",
  CONTRACT_FROZEN: "contract_frozen",
  PLAN_PROPOSED: "plan_proposed",
  CONSENT_BOUND: "consent_bound",
  EXECUTION_RESULT: "execution_result",
  VERDICT_REQUESTED: "verdict_requested",
  REVIEW_ACCEPTED: "review_accepted",
  REVIEW_RETRY: "review_retry",
  REVIEW_HALT: "review_halt",
  RECEIPT_SEALED: "receipt_sealed",
  DECIDE_DONE: "decide_done",
  DECIDE_RETRY: "decide_retry",
  DECIDE_HALT: "decide_halt",
  OPERATOR_RESUME: "operator_resume",
});

/// The legal-transition table is DATA, not code branches: a reader can audit
/// what the machine can do without following control flow, and adding an edge is
/// a one-line reviewable change. Anything absent here is illegal by default.
export const TRANSITIONS = Object.freeze({
  DISCOVER: Object.freeze({ [EVENT_KINDS.DISCOVERY_RECORDED]: "CONTRACT" }),
  CONTRACT: Object.freeze({ [EVENT_KINDS.CONTRACT_FROZEN]: "PLAN" }),
  PLAN: Object.freeze({ [EVENT_KINDS.PLAN_PROPOSED]: "FATE" }),
  FATE: Object.freeze({ [EVENT_KINDS.CONSENT_BOUND]: "EXECUTE" }),
  EXECUTE: Object.freeze({ [EVENT_KINDS.EXECUTION_RESULT]: "VERIFY" }),
  VERIFY: Object.freeze({ [EVENT_KINDS.VERDICT_REQUESTED]: "REVIEW" }),
  REVIEW: Object.freeze({
    [EVENT_KINDS.REVIEW_ACCEPTED]: "RECEIPT",
    [EVENT_KINDS.REVIEW_RETRY]: "PLAN",
    [EVENT_KINDS.REVIEW_HALT]: "HALTED",
  }),
  RECEIPT: Object.freeze({ [EVENT_KINDS.RECEIPT_SEALED]: "DECIDE" }),
  DECIDE: Object.freeze({
    [EVENT_KINDS.DECIDE_DONE]: "DONE",
    [EVENT_KINDS.DECIDE_RETRY]: "PLAN",
    [EVENT_KINDS.DECIDE_HALT]: "HALTED",
  }),
  HALTED: Object.freeze({ [EVENT_KINDS.OPERATOR_RESUME]: "__HELD__" }),
});

/// A retry is the only way back to PLAN, and it is the only edge that spends
/// budget. There is no unbounded retry in the table above, so exhaustion is
/// reachable by construction rather than enforced by a counter somewhere else.
const LOOP_EDGES = Object.freeze([["REVIEW", "PLAN"], ["DECIDE", "PLAN"]]);
const EFFECT_CLASSES = Object.freeze(["reversible", "irreversible", "value_bearing"]);

/// Fields whose value changes what the machine will DECIDE next. Provenance
/// (`worker_history`, `verdicts` detail, `seen`) is deliberately excluded: a
/// mission conducted by a different worker is the same mission.
const DECISION_FIELDS = Object.freeze([
  "authority_ceiling",
  "authority_delta",
  "contract_hash",
  "hold_reason",
  "held_stage",
  "iteration_used",
  "mission_id",
  "receipt_head",
  "scope",
  "stage",
  "state_seq",
]);

export class MissionSupervisorError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "MissionSupervisorError";
    this.code = code;
  }
}

export function missionSupervisorBoundary() {
  return buildPreviewBoundary();
}

const isTerminal = (stage) => TERMINAL_STAGES.includes(stage);
const isLoopEdge = (from, to) => LOOP_EDGES.some(([f, t]) => f === from && t === to);

export function genesisSupervisorState({ contract, contract_hash } = {}) {
  if (!contract || typeof contract !== "object") {
    throw new MissionSupervisorError("contract_missing", "genesis requires a mission contract");
  }
  return Object.freeze({
    schema: MISSION_SUPERVISOR_SCHEMA,
    mission_id: contract.mission_id,
    contract_hash,
    stage: "DISCOVER",
    held_stage: null,
    hold_reason: null,
    iteration_used: 0,
    // Mirrored from the frozen contract so a widening attempt is VISIBLE in state
    // rather than only absent from it.
    authority_ceiling: contract.authority_ceiling,
    scope: contract.scope,
    authority_delta: 0,
    worker_history: Object.freeze([]),
    verdicts: Object.freeze([]),
    seen: Object.freeze([]),
    duplicates_receipted: Object.freeze([]),
    receipt_head: null,
    state_seq: 0,
  });
}

/// The derived identity of everything that decides. §H: mutate any of it and
/// this changes; change provenance alone and it does not.
export function decisionStateHash(state) {
  const body = {};
  for (const k of DECISION_FIELDS) body[k] = state?.[k] ?? null;
  return sha256CanonicalJsonV1(body);
}

function makeReceipt({ state, from_stage, to_stage, event, note = null }) {
  const body = {
    mission_id: state.mission_id,
    state_seq: state.state_seq + 1,
    from_stage,
    to_stage,
    event_kind: event?.kind ?? null,
    event_hash: event?.hash ?? null,
    note,
    prev_receipt: state.receipt_head,
    boundary: missionSupervisorBoundary(),
  };
  return Object.freeze({ ...body, receipt_hash: sha256CanonicalJsonV1(body) });
}

function outcome(state, receipts, rejected = null) {
  return Object.freeze({
    state,
    receipts: Object.freeze(receipts),
    eligible_actions: Object.freeze(Object.keys(TRANSITIONS[state.stage] ?? {})),
    rejected,
  });
}

/// Records a refusal WITHOUT advancing any decision-bearing field. A late or
/// illegal worker event leaves a trace and changes nothing else — that is the
/// whole point of EC-1.
function refuse(state, event, reason) {
  const receipt = makeReceipt({ state, from_stage: state.stage, to_stage: state.stage, event, note: reason });
  const next = Object.freeze({
    ...state,
    seen: Object.freeze([...state.seen, event?.hash].filter(Boolean)),
    receipt_head: receipt.receipt_hash,
    state_seq: state.state_seq + 1,
  });
  return outcome(next, [receipt], reason);
}

export function step(state, event, { contract } = {}) {
  if (!state || typeof state !== "object") {
    throw new MissionSupervisorError("state_missing", "step requires a supervisor state");
  }
  // EC-5 — a terminal state accepts nothing, loudly.
  if (isTerminal(state.stage) && state.stage !== "HALTED") {
    throw new MissionSupervisorError("terminal_state_event", `stage ${state.stage} is terminal and accepts no events`);
  }
  const kind = event?.kind;
  const hash = event?.hash;

  // EC-2 — idempotent, and receipted exactly once however many times it repeats.
  if (hash && state.seen.includes(hash)) {
    if (state.duplicates_receipted.includes(hash)) {
      return outcome(state, [], "duplicate_event");
    }
    const receipt = makeReceipt({ state, from_stage: state.stage, to_stage: state.stage, event, note: "duplicate_event" });
    const next = Object.freeze({
      ...state,
      duplicates_receipted: Object.freeze([...state.duplicates_receipted, hash]),
      receipt_head: receipt.receipt_hash,
      state_seq: state.state_seq + 1,
    });
    return outcome(next, [receipt], "duplicate_event");
  }

  // EC-1 — an event addressed to a stage we are not in cannot corrupt us.
  if (event?.stage !== state.stage) return refuse(state, event, "out_of_stage_event");

  const table = TRANSITIONS[state.stage] ?? {};
  let next = table[kind];
  if (!next) return refuse(state, event, "illegal_transition");

  // EC-4 — resume is the ONE input HALTED accepts, and only with consent.
  if (next === "__HELD__") {
    if (typeof event.consent_ref !== "string" || event.consent_ref.length === 0) {
      return refuse(state, event, "consent_absent");
    }
    next = state.held_stage;
  }

  // FR-3 — FATE holds; it never skips ahead. Effect class and a bound consent
  // reference are BOTH required before any effect-bearing stage is eligible.
  if (state.stage === "FATE") {
    const classOk = EFFECT_CLASSES.includes(event.effect_class);
    const consentOk = typeof event.consent_ref === "string" && event.consent_ref.length > 0;
    if (!classOk || !consentOk) {
      const receipt = makeReceipt({ state, from_stage: "FATE", to_stage: "HALTED", event, note: "consent_hold" });
      return outcome(
        Object.freeze({
          ...state,
          stage: "HALTED",
          held_stage: "FATE",
          hold_reason: "consent_hold",
          seen: Object.freeze([...state.seen, hash].filter(Boolean)),
          receipt_head: receipt.receipt_hash,
          state_seq: state.state_seq + 1,
        }),
        [receipt],
      );
    }
  }

  // NC-A2 — the acceptance law is bound to contract_hash. An event offering its
  // own is refused, not preferred and not merged.
  if ("acceptance_contract" in (event ?? {})) {
    return refuse(state, event, "out_of_band_acceptance_law");
  }

  // FR-4 — delegate. Exactly two bindings reach the judge, and `worker_id` is
  // not one of them: the verdict cannot depend on who produced the output
  // because this call site has no way to tell it.
  let verdicts = state.verdicts;
  if (state.stage === "VERIFY") {
    const decision = evaluateAgainstContract(event.output, contract?.acceptance_contract);
    verdicts = Object.freeze([...state.verdicts, Object.freeze({ verdict: decision.verdict })]);
  }

  // FR-5 — the loop edge is the only place budget is spent, and exhaustion is a
  // terminal receipted state rather than a silent stop.
  let iteration_used = state.iteration_used;
  if (isLoopEdge(state.stage, next)) {
    iteration_used += 1;
    if (iteration_used >= (contract?.iteration_budget ?? 0)) next = "BUDGET_EXHAUSTED";
  }

  const worker_history =
    typeof event.worker_id === "string" && event.worker_id.length > 0
      ? Object.freeze([...state.worker_history, event.worker_id])
      : state.worker_history;

  const receipt = makeReceipt({ state, from_stage: state.stage, to_stage: next, event });
  return outcome(
    Object.freeze({
      ...state,
      stage: next,
      held_stage: next === "HALTED" ? state.stage : state.held_stage,
      hold_reason: next === "HALTED" ? (state.hold_reason ?? "review_halt") : state.hold_reason,
      iteration_used,
      verdicts,
      worker_history,
      seen: Object.freeze([...state.seen, hash].filter(Boolean)),
      receipt_head: receipt.receipt_hash,
      state_seq: state.state_seq + 1,
    }),
    [receipt],
  );
}

/// FR-7 — deterministic and byte-identical to the live walk, because it IS the
/// live walk: one reducer, replayed. A second implementation here would be a
/// second source of truth about what the machine does.
export function replay({ contract, contract_hash, events } = {}) {
  let state = genesisSupervisorState({ contract, contract_hash });
  for (const e of events ?? []) state = step(state, e, { contract }).state;
  return state;
}
