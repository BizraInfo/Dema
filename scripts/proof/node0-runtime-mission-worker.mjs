// NODE0-RUNTIME-MISSION-OBSERVATION-1A — the disposable worker.
//
// Invoked only by node0-runtime-mission-proof.mjs. Never reachable from the CLI.
//
// BOUNDARY: no network, no model, no daemon, no listener. It reads and writes
// under the DEMA_HOME it is handed and nothing else.
//
// THE ARGV RULE IS THE WHOLE EXPERIMENT. A successor is given ONLY its role, the
// home path and a facts path. No mission id, no contract, no stage, no sequence.
// If it can continue the mission, it can only have got that from the home.

import { mkdirSync, writeFileSync, readFileSync, existsSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";

import { sha256CanonicalJsonV1 } from "../../packages/canon/src/sha256-canonical-json-v1.js";
import {
  MISSION_CONTRACT_GO_PHRASE,
  createMissionContract,
  proposeContractAmendment,
} from "../../packages/core/src/mission-contract-state.js";
import {
  EVENT_KINDS,
  genesisSupervisorState,
  step,
} from "../../packages/core/src/mission-supervisor.js";
import { evaluateAgainstContract } from "../../packages/core/src/node0-model-swap-invariance.js";

const [role, DEMA_HOME, factsPath] = process.argv.slice(2);
export const STATE_RELPATH = join("node0", "runtime-mission", "state.json");
const statePath = join(DEMA_HOME, STATE_RELPATH);

// Fixed so two processes deriving it independently agree byte for byte.
const CONTRACT_FIELDS = Object.freeze({
  mission_id: "MISSION-RUNTIME-PROOF-001",
  purpose: "Prove mission state outlives the worker holding it",
  scope: "scoped temp DEMA_HOME only",
  acceptance_contract: { required_output_keys: ["patch"], forbidden_substrings: ["TODO"] },
  acceptance_criteria: ["state survives a kill"],
  prohibited_outcomes: ["push", "network"],
  authority_ceiling: "local_reversible",
  iteration_budget: 4,
  completion_conditions: ["successor continues the chain"],
  escalation_rule: "halt_and_report",
  created_at_iso: "2026-08-10T00:00:00.000Z",
});

// The executor deliberately produces a FAILING output and claims success on it.
// If it produced a passing one, the verifier agreeing would show only that they
// coincided — not that self-certification is powerless.
const BAD_OUTPUT = Object.freeze({ patch: "TODO: not really done" });
const GOOD_OUTPUT = Object.freeze({ patch: "diff --git a b" });
const EXEC_RELPATH = join("node0", "runtime-mission", "execution.json");

// ATOMIC. The proof driver polls with existsSync and then JSON.parse, so a
// partially written file reads as torn JSON and throws. Measured under load:
// one of two parallel fresh-extraction qualifications failed RMA-08 with
// "Unexpected end of JSON input" while the same file passed 5/5 in isolation.
// rename(2) inside one directory is atomic, so a reader sees the old file or the
// complete new one, never a prefix of it.
const emit = (facts) => {
  const tmp = `${factsPath}.partial`;
  writeFileSync(tmp, JSON.stringify(facts));
  renameSync(tmp, factsPath);
};

/// The authority envelope as it exists ON DISK. Measured, never carried.
const authorityHash = (fields) =>
  sha256CanonicalJsonV1({ authority_ceiling: fields.authority_ceiling, scope: fields.scope });

/// Every widening vector returns true only when the attempt was REFUSED.
function widenAttempts(contract) {
  const worker = proposeContractAmendment({
    contract,
    changes: { authority_ceiling: "unbounded", scope: "the entire filesystem" },
    channel: "worker",
    consent: MISSION_CONTRACT_GO_PHRASE,
  });
  const selfGrant = proposeContractAmendment({
    contract,
    changes: { authority_ceiling: "unbounded" },
    channel: "self",
    consent: MISSION_CONTRACT_GO_PHRASE,
  });
  // A stale/incorrect consent phrase on the operator channel must not pass.
  let staleRefused = false;
  try {
    proposeContractAmendment({
      contract,
      changes: { authority_ceiling: "unbounded" },
      channel: "operator_consented",
      consent: "GO: an expired phrase from a previous season",
    });
  } catch (e) {
    staleRefused = e?.code === "consent_phrase_mismatch";
  }
  return {
    worker_refused: worker.accepted === false,
    self_grant_refused: selfGrant.accepted === false,
    stale_grant_refused: staleRefused,
  };
}
const persist = (obj) => {
  mkdirSync(dirname(statePath), { recursive: true });
  writeFileSync(statePath, JSON.stringify(obj, null, 2));
};

function walkToExecute(contract, contract_hash) {
  let s = genesisSupervisorState({ contract, contract_hash });
  let n = 0;
  for (const e of [
    { kind: EVENT_KINDS.DISCOVERY_RECORDED, stage: "DISCOVER" },
    { kind: EVENT_KINDS.CONTRACT_FROZEN, stage: "CONTRACT" },
    { kind: EVENT_KINDS.PLAN_PROPOSED, stage: "PLAN" },
  ]) {
    s = step(s, { ...e, hash: `sha256:pre-${++n}` }, { contract }).state;
  }
  return s;
}

if (role === "predecessor" || role === "worker_local_control") {
  const c = createMissionContract({ fields: CONTRACT_FIELDS, consent: MISSION_CONTRACT_GO_PHRASE });
  const s = walkToExecute(c.contract, c.contract_hash);
  const checkpoint_state_hash = sha256CanonicalJsonV1(s);

  // THE CONTROL. worker_local_control deliberately keeps the mission in memory and
  // writes NOTHING durable, so a successor has nothing to reconstruct from. If the
  // successor recovered anyway, the experiment would not discriminate.
  if (role === "predecessor") {
    persist({
      schema: "bizra.dema.node0_runtime_mission_state.v0.1",
      contract_fields: CONTRACT_FIELDS,
      contract_hash: c.contract_hash,
      supervisor_state: s,
      checkpoint_state_hash,
    });
  }

  const w = widenAttempts(c.contract);
  if (role === "predecessor") {
    // The executor's own claim, recorded so a later process can refuse to use it.
    writeFileSync(
      join(DEMA_HOME, EXEC_RELPATH),
      JSON.stringify({ executor_pid: process.pid, output: BAD_OUTPUT, self_claimed_success: true, self_claimed_verdict: "ACCEPT" }),
    );
  }

  emit({
    role,
    pid: process.pid,
    mission_id: c.contract.mission_id,
    contract_hash: c.contract_hash,
    checkpoint_state_hash,
    state_seq: s.state_seq,
    persisted: role === "predecessor",
    authority_before_hash: authorityHash(CONTRACT_FIELDS),
    worker_a_widen_refused: w.worker_refused,
  });

  // Stay alive with no signal handler so the parent's SIGKILL is a real death.
  setInterval(() => {}, 1 << 30);
} else if (role === "successor" || role === "control_successor") {
  if (!existsSync(statePath)) {
    // The control's expected outcome: nothing durable was left behind.
    emit({ role, pid: process.pid, recovered: false, reason: "no_durable_state_in_home" });
    process.exit(0);
  }
  const held = JSON.parse(readFileSync(statePath, "utf8"));

  // Rebuild the contract from the persisted FIELDS and re-derive its hash rather
  // than trusting the one on disk. A successor that trusted the carried hash
  // could resume a contract nobody could reproduce.
  const c = createMissionContract({ fields: held.contract_fields, consent: MISSION_CONTRACT_GO_PHRASE });
  const rederived_matches = c.contract_hash === held.contract_hash;

  const resumed = held.supervisor_state;
  const advanced = step(
    resumed,
    { kind: EVENT_KINDS.CONSENT_BOUND, stage: "FATE", hash: "sha256:suc-1", effect_class: "reversible", consent_ref: "sha256:consent-proof" },
    { contract: c.contract },
  ).state;

  // contract_is_immutable, measured in a real process against the real artefact.
  const before = sha256CanonicalJsonV1(JSON.parse(readFileSync(statePath, "utf8")).contract_fields);
  const workerAmend = proposeContractAmendment({
    contract: c.contract,
    changes: { scope: "the entire filesystem", authority_ceiling: "unbounded" },
    channel: "worker",
    consent: MISSION_CONTRACT_GO_PHRASE,
  });
  // POSITIVE CONTROL: the operator channel must produce a genuinely NEW hash, or
  // "refuses everything" would read as immutability.
  const operatorAmend = proposeContractAmendment({
    contract: c.contract,
    changes: { iteration_budget: 9 },
    channel: "operator_consented",
    consent: MISSION_CONTRACT_GO_PHRASE,
  });
  const after = sha256CanonicalJsonV1(JSON.parse(readFileSync(statePath, "utf8")).contract_fields);

  persist({ ...held, supervisor_state: advanced, refusal_receipt: { refusal: workerAmend.refusal, channel: "worker" } });
  const receipted = JSON.parse(readFileSync(statePath, "utf8")).refusal_receipt?.refusal === "contract_mutation_rejected";

  const w2 = widenAttempts(c.contract);
  const authority_after_hash = authorityHash(JSON.parse(readFileSync(statePath, "utf8")).contract_fields);

  emit({
    role,
    pid: process.pid,
    recovered: true,
    authority_after_hash,
    worker_b_widen_refused: w2.worker_refused,
    restart_widen_refused: w2.worker_refused,
    self_grant_refused: w2.self_grant_refused,
    stale_grant_refused: w2.stale_grant_refused,
    reconstructed_from: "dema_home_only",
    rederived_contract_hash_matches: rederived_matches,
    mission_id: c.contract.mission_id,
    contract_hash: c.contract_hash,
    resumed_state_hash: held.checkpoint_state_hash,
    state_seq: advanced.state_seq,
    amendment_refusal: workerAmend.refusal,
    amendment_hash_unchanged: workerAmend.contract_hash === held.contract_hash,
    contract_hash_before: before,
    contract_hash_after: after,
    refusal_receipted: receipted,
    operator_control_attempted: true,
    operator_control_new_hash: operatorAmend.contract_hash,
  });
  process.exit(0);
} else if (role === "verifier") {
  // A DIFFERENT process from the executor. It is handed the home path and
  // nothing else: it obtains the acceptance law by re-deriving the contract from
  // the persisted fields, so it is never handed the law by the party under
  // judgement, and it never reads the executor's claimed verdict as an answer.
  const held = JSON.parse(readFileSync(statePath, "utf8"));
  const exec = JSON.parse(readFileSync(join(DEMA_HOME, EXEC_RELPATH), "utf8"));
  const c = createMissionContract({ fields: held.contract_fields, consent: MISSION_CONTRACT_GO_PHRASE });

  const rederived = evaluateAgainstContract(exec.output, c.contract.acceptance_contract);
  // POSITIVE CONTROL: the same verifier must be able to say ACCEPT, or "always
  // rejects" would masquerade as independent judgement.
  const control = evaluateAgainstContract(GOOD_OUTPUT, c.contract.acceptance_contract);

  emit({
    role,
    executor_pid: exec.executor_pid,
    verifier_pid: process.pid,
    law_source: "rederived_from_persisted_contract_fields",
    executor_self_claimed_success: exec.self_claimed_success === true,
    executor_self_claimed_verdict: exec.self_claimed_verdict,
    independently_rederived_verdict: rederived.verdict,
    positive_control_verdict: control.verdict,
    authoritative_verdict_source: "independent_verifier",
    exact_comparison_performed: true,
    claims_disagree: exec.self_claimed_verdict !== rederived.verdict,
  });
  process.exit(0);
} else {
  emit({ role, error: "unknown_role" });
  process.exit(2);
}
