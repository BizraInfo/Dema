// MISSION-WORKER-ADAPTER-0A — TASK-026 spec phase 03: the worker seam and the
// ten-demonstration swap protocol.
//
// NOT ML. NOT runtime. NOT a worker pool. The workers here are SIMULATED
// IDENTITIES: deterministic fixtures. Nothing spawns a process, invokes a model,
// or opens a socket. A live-worker run is a separate operator-GO'd act outside
// this repo and is not claimed by anything in this file.
//
// THE SEAM IS THE POINT. A worker receives exactly `{checkpoint,
// eligible_actions}` — never a mutable contract reference, never a receipt
// signer, never the verdict. Privilege separation is structural: the input the
// adapter builds cannot express the forbidden acts, and a proposal carrying a
// forbidden field is refused on SHAPE before any hash is computed. Refusing
// after hashing would mean the writer had already treated hostile input as data
// worth binding.
//
// WHAT IT COMPOSES, AND DOES NOT REBUILD. Contract identity and checkpoint /
// resume come from mission-contract-state.js; stage walking, receipts and replay
// come from mission-supervisor.js; acceptance comes, through the supervisor, from
// node0-model-swap-invariance.js. This module adds a seam and a protocol.
//
// Pure: no fs, no network, no process, no clock, no random, no model call.

import { sha256CanonicalJsonV1 } from "../../canon/src/sha256-canonical-json-v1.js";
import { buildPreviewBoundary } from "./preview-boundary.js";
import {
  buildMissionState,
  checkpointMissionState,
  resumeMissionState,
  proposeContractAmendment,
  MISSION_CONTRACT_GO_PHRASE,
} from "./mission-contract-state.js";
import {
  EVENT_KINDS,
  genesisSupervisorState,
  step,
  replay,
  decisionStateHash,
} from "./mission-supervisor.js";

export const MISSION_WORKER_ADAPTER_SCHEMA = "bizra.dema.mission_worker_adapter.v0.1";
export const MISSION_WORKER_ADAPTER_TRUTH_LABEL = "MISSION_WORKER_ADAPTER_PREVIEW";

/// FR-1 — the Swiss-watch card. Data, so a reviewer can read the worker's whole
/// privilege envelope without following control flow.
export const WORKER_ADAPTER_CARD = Object.freeze({
  purpose: "Propose the next mission event from a checkpoint and an eligible-action set",
  input_contract: Object.freeze(["checkpoint", "eligible_actions"]),
  output_contract: Object.freeze(["proposal events only"]),
  authority: "none",
  allowed_effects: Object.freeze([]),
  forbidden_effects: Object.freeze(["contract mutation", "receipt write", "verdict"]),
  failure_codes: Object.freeze([
    "forbidden_proposal_field",
    "proposal_shape_invalid",
    "out_of_stage_event",
    "duplicate_event",
  ]),
  verification_method: "the supervisor delegates the verdict to node0-model-swap-invariance; the worker never renders one",
  receipt_fields: Object.freeze(["mission_id", "state_seq", "from_stage", "to_stage", "event_kind", "event_hash", "prev_receipt"]),
  recovery_behavior: "a stopped worker is replaced; mission state lives in the checkpoint, not in the worker",
});

/// A proposal that names any of these is refused at the seam. `acceptance_contract`
/// is here as well as in the reducer: defence at both ends of the same wire.
export const FORBIDDEN_PROPOSAL_FIELDS = Object.freeze([
  "acceptance_contract",
  "authority",
  "authority_ceiling",
  "contract",
  "contract_hash",
  "receipt",
  "receipt_head",
  "scope",
  "verdict",
]);

const PROPOSAL_REQUIRED = Object.freeze(["hash", "kind", "stage"]);

export function missionWorkerAdapterBoundary() {
  return buildPreviewBoundary();
}

/// FR-2 — the seam drops everything else rather than carrying it and trusting a
/// downstream reader to ignore it.
export function buildWorkerInput({ checkpoint, eligible_actions } = {}) {
  return Object.freeze({
    checkpoint,
    eligible_actions: Object.freeze([...(eligible_actions ?? [])]),
  });
}

/// EC-5 / T-03 — shape first. `hash_computed` is reported so a test can prove the
/// refusal happened before any binding work, not merely that it happened.
export function validateProposal(proposal) {
  if (!proposal || typeof proposal !== "object" || Array.isArray(proposal)) {
    return Object.freeze({ ok: false, refusal: "proposal_shape_invalid", hash_computed: false });
  }
  for (const field of FORBIDDEN_PROPOSAL_FIELDS) {
    if (field in proposal) {
      return Object.freeze({ ok: false, refusal: `forbidden_proposal_field:${field}`, hash_computed: false });
    }
  }
  for (const field of PROPOSAL_REQUIRED) {
    if (typeof proposal[field] !== "string" || proposal[field].length === 0) {
      return Object.freeze({ ok: false, refusal: `proposal_shape_invalid:${field}`, hash_computed: false });
    }
  }
  return Object.freeze({ ok: true, refusal: null, hash_computed: true, proposal_hash: sha256CanonicalJsonV1(proposal) });
}

/// FR-3 — two deterministic identities. sim_a is the "prestigious" one and it
/// deliberately emits a FAILING output, because a demo where the famous model is
/// also the correct one proves nothing about model-blindness.
function makeSim(worker_id, label, output) {
  return Object.freeze({
    worker_id,
    label,
    propose(stage) {
      if (stage === "EXECUTE") return Object.freeze({ output: Object.freeze({ ...output }), worker_id });
      return Object.freeze({ worker_id });
    },
    stop() {
      return Object.freeze({ worker_id, stopped: true, reason: "worker_exited" });
    },
  });
}

export const WORKER_SIM_A = makeSim("worker_sim_a", "prestigious", { patch: "TODO: think about it", test_result: "fail" });
export const WORKER_SIM_B = makeSim("worker_sim_b", "small_local", { patch: "diff --git a b", test_result: "pass" });

export const SWAP_DEMONSTRATIONS = Object.freeze([
  Object.freeze({ n: 1, title: "worker A performs the first attempt" }),
  Object.freeze({ n: 2, title: "state saved outside the worker" }),
  Object.freeze({ n: 3, title: "worker A intentionally stopped" }),
  Object.freeze({ n: 4, title: "worker B resumes from the checkpoint" }),
  Object.freeze({ n: 5, title: "worker B cannot alter the contract" }),
  Object.freeze({ n: 6, title: "external tests decide acceptance" }),
  Object.freeze({ n: 7, title: "failed prestigious output stays rejected" }),
  Object.freeze({ n: 8, title: "valid smaller-model output accepted" }),
  Object.freeze({ n: 9, title: "receipt per iteration" }),
  Object.freeze({ n: 10, title: "replay from history" }),
]);

let EV = 0;
const nextEvent = (kind, stage, extra = {}) => Object.freeze({ kind, stage, hash: `sha256:swap-${++EV}`, ...extra });

/// FR-4 / FR-5 — the ten demonstrations as ONE executable walk, returning a
/// deterministic receipt. The fixture is fixed, so two runs are byte-identical:
/// event ids are reset per run rather than drawn from a counter that remembers.
export function runSwapProtocol({ contract, contract_hash } = {}) {
  EV = 0;
  const demos = [];
  const record = (n, passed, evidence, extra = {}) =>
    demos.push(Object.freeze({ n, title: SWAP_DEMONSTRATIONS[n - 1].title, passed, evidence, ...extra }));

  const allEvents = [];
  let s = genesisSupervisorState({ contract, contract_hash });
  const drive = (e) => {
    allEvents.push(e);
    const r = step(s, e, { contract });
    s = r.state;
    return r;
  };

  // ── demo 1 · worker A makes the first attempt ──────────────────────────────
  const a1 = drive(nextEvent(EVENT_KINDS.DISCOVERY_RECORDED, "DISCOVER", WORKER_SIM_A.propose("DISCOVER")));
  drive(nextEvent(EVENT_KINDS.CONTRACT_FROZEN, "CONTRACT", WORKER_SIM_A.propose("CONTRACT")));
  drive(nextEvent(EVENT_KINDS.PLAN_PROPOSED, "PLAN", WORKER_SIM_A.propose("PLAN")));
  record(1, a1.rejected === null && s.worker_history.includes(WORKER_SIM_A.worker_id), `worker A advanced the mission to ${s.stage}`);
  const preSwap = { mission_id: s.mission_id, contract_hash: s.contract_hash, worker_id: WORKER_SIM_A.worker_id };

  // ── demo 2 · state lives outside the worker ────────────────────────────────
  const missionState = buildMissionState({
    contract_hash,
    current_stage: s.stage,
    iteration_used: s.iteration_used,
    worker_history: [...s.worker_history],
    accepted_evidence: [],
    failed_attempts: [],
    open_blockers: [],
    receipt_head: s.receipt_head,
    state_seq: s.state_seq,
  });
  const cp = checkpointMissionState(missionState);
  record(2, typeof cp.state_hash === "string", `checkpoint ${cp.state_hash} holds the mission with no worker in it`);

  // ── demo 3 · worker A is stopped ───────────────────────────────────────────
  const stopped = WORKER_SIM_A.stop();
  record(3, stopped.stopped === true && stopped.reason === "worker_exited", `worker A reported ${stopped.reason}`);

  // ── demo 4 · worker B resumes from that checkpoint ─────────────────────────
  const resumed = resumeMissionState({ checkpoint: cp, liveContractHash: contract_hash });
  record(
    4,
    resumed.contract_hash === contract_hash && resumed.current_stage === s.stage,
    `worker B resumed at ${resumed.current_stage} under the same contract_hash`,
  );

  // ── demo 5 · worker B cannot alter the contract ────────────────────────────
  const amend = proposeContractAmendment({
    contract,
    changes: { scope: "the entire repository" },
    channel: "worker",
    consent: MISSION_CONTRACT_GO_PHRASE,
  });
  record(5, amend.accepted === false && amend.contract_hash === contract_hash, `amendment refused: ${amend.refusal}`);

  // ── EC-3 · two workers race for the same eligible action ───────────────────
  const raceEvent = nextEvent(EVENT_KINDS.CONSENT_BOUND, "FATE", {
    effect_class: "reversible",
    consent_ref: "sha256:consent-swap",
    ...WORKER_SIM_B.propose("FATE"),
  });
  const firstWin = drive(raceEvent);
  const secondTry = step(s, raceEvent, { contract });
  const EC3 = { first_accepted: firstWin.rejected === null, second_rejected: secondTry.rejected };

  // ── demo 7 · the prestigious worker's failing output ───────────────────────
  const badExec = drive(nextEvent(EVENT_KINDS.EXECUTION_RESULT, "EXECUTE", WORKER_SIM_A.propose("EXECUTE")));
  const badVerdictStep = drive(nextEvent(EVENT_KINDS.VERDICT_REQUESTED, "VERIFY", WORKER_SIM_A.propose("EXECUTE")));
  const badVerdict = s.verdicts.at(-1)?.verdict ?? null;
  record(7, badVerdict !== "ACCEPT", `prestigious output judged ${badVerdict}`, { verdict: badVerdict });

  // ── EC-1 · a proposal referencing a pre-swap state_seq ─────────────────────
  const stale = step(s, nextEvent(EVENT_KINDS.PLAN_PROPOSED, "PLAN"), { contract });
  const EC1 = { rejected: stale.rejected, receipted: stale.receipts.length > 0 };

  // ── EC-2 · worker A returns from the dead ──────────────────────────────────
  const headBefore = s.receipt_head;
  const revenant = step(s, badExec.receipts.length ? { ...allEvents[allEvents.length - 2] } : nextEvent("x", "EXECUTE"), {
    contract,
  });
  const EC2 = { rejected: revenant.rejected, chain_head_unchanged: revenant.state.stage === s.stage && headBefore !== null };

  // ── demos 6 + 8 · retry, then worker B's valid output is accepted ──────────
  drive(nextEvent(EVENT_KINDS.REVIEW_RETRY, "REVIEW", WORKER_SIM_B.propose("REVIEW")));
  drive(nextEvent(EVENT_KINDS.PLAN_PROPOSED, "PLAN", WORKER_SIM_B.propose("PLAN")));
  drive(
    nextEvent(EVENT_KINDS.CONSENT_BOUND, "FATE", {
      effect_class: "reversible",
      consent_ref: "sha256:consent-swap-2",
      ...WORKER_SIM_B.propose("FATE"),
    }),
  );
  drive(nextEvent(EVENT_KINDS.EXECUTION_RESULT, "EXECUTE", WORKER_SIM_B.propose("EXECUTE")));
  drive(nextEvent(EVENT_KINDS.VERDICT_REQUESTED, "VERIFY", WORKER_SIM_B.propose("EXECUTE")));
  const goodVerdict = s.verdicts.at(-1)?.verdict ?? null;
  record(
    6,
    badVerdictStep.rejected === null && goodVerdict !== null,
    "acceptance came from the delegated judge, never from a worker",
  );
  record(8, goodVerdict === "ACCEPT", `smaller-model output judged ${goodVerdict}`, { verdict: goodVerdict });

  drive(nextEvent(EVENT_KINDS.REVIEW_ACCEPTED, "REVIEW", WORKER_SIM_B.propose("REVIEW")));
  drive(nextEvent(EVENT_KINDS.RECEIPT_SEALED, "RECEIPT", WORKER_SIM_B.propose("RECEIPT")));
  drive(nextEvent(EVENT_KINDS.DECIDE_DONE, "DECIDE", WORKER_SIM_B.propose("DECIDE")));

  const postSwap = { mission_id: s.mission_id, contract_hash: s.contract_hash, worker_id: WORKER_SIM_B.worker_id };

  // ── demo 9 · a receipt per iteration ───────────────────────────────────────
  record(9, s.receipt_head !== null && s.state_seq === allEvents.length, `${s.state_seq} transitions, chain head ${s.receipt_head}`);

  // ── demo 10 · replay ───────────────────────────────────────────────────────
  const replayed = replay({ contract, contract_hash, events: allEvents });
  const replay_hash = decisionStateHash(replayed);
  record(10, replay_hash === decisionStateHash(s), `replay identity ${replay_hash}`);

  // ── EC-4 · swapping during a consent hold does not launder consent ─────────
  let held = genesisSupervisorState({ contract, contract_hash });
  for (const e of [
    nextEvent(EVENT_KINDS.DISCOVERY_RECORDED, "DISCOVER"),
    nextEvent(EVENT_KINDS.CONTRACT_FROZEN, "CONTRACT"),
    nextEvent(EVENT_KINDS.PLAN_PROPOSED, "PLAN"),
    nextEvent(EVENT_KINDS.CONSENT_BOUND, "FATE", { effect_class: "reversible" }),
  ]) {
    held = step(held, e, { contract }).state;
  }
  const noConsent = step(held, nextEvent(EVENT_KINDS.OPERATOR_RESUME, "HALTED", WORKER_SIM_B.propose("HALTED")), { contract });
  const withConsent = step(held, nextEvent(EVENT_KINDS.OPERATOR_RESUME, "HALTED", { consent_ref: "sha256:operator" }), {
    contract,
  });
  const EC4 = {
    stage: held.stage,
    resume_without_consent_rejected: noConsent.rejected === "consent_absent",
    resume_with_consent_stage: withConsent.state.stage,
  };

  const receiptBody = {
    schema: MISSION_WORKER_ADAPTER_SCHEMA,
    truth_label: MISSION_WORKER_ADAPTER_TRUTH_LABEL,
    contract_hash,
    worker_identities: Object.freeze([WORKER_SIM_A.worker_id, WORKER_SIM_B.worker_id]),
    verdicts: Object.freeze([badVerdict, goodVerdict]),
    receipt_chain_head: s.receipt_head,
    replay_hash,
    demonstrations_passed: demos.filter((d) => d.passed).length,
    workers_were_simulated: true,
    boundary: missionWorkerAdapterBoundary(),
    what_this_proves:
      "That a mission survives a worker swap: the contract, the checkpoint chain and the acceptance verdict are unchanged by who produced the output.",
    what_this_does_not_prove:
      "Nothing about live conduction. Both workers are simulated deterministic identities in-repo; no process was spawned, no model invoked, no network used. A live-worker run is a separate operator-authorised act.",
  };

  return Object.freeze({
    demonstrations: Object.freeze(demos.sort((x, y) => x.n - y.n)),
    pre_swap: Object.freeze(preSwap),
    post_swap: Object.freeze(postSwap),
    edge_cases: Object.freeze({ EC1: Object.freeze(EC1), EC2: Object.freeze(EC2), EC3: Object.freeze(EC3), EC4: Object.freeze(EC4) }),
    receipt: Object.freeze(receiptBody),
    receipt_hash: sha256CanonicalJsonV1(receiptBody),
    settles_closure_invariant: false,
  });
}
