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

import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
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

const emit = (facts) => writeFileSync(factsPath, JSON.stringify(facts));
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

  emit({
    role,
    pid: process.pid,
    mission_id: c.contract.mission_id,
    contract_hash: c.contract_hash,
    checkpoint_state_hash,
    state_seq: s.state_seq,
    persisted: role === "predecessor",
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

  emit({
    role,
    pid: process.pid,
    recovered: true,
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
} else {
  emit({ role, error: "unknown_role" });
  process.exit(2);
}
