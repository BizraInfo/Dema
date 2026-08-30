// NODE0-RECOVERY-OBSERVATION-1A — the disposable worker.
//
// Started ONLY by the proof-only recovery supervisor (role a) or by it again as
// the replacement (role b). Never reachable from the Dema face.
//
// BOUNDARY: no network, no model, no daemon, no listener. Reads and writes only
// under the DEMA_HOME it is handed.

import { mkdirSync, writeFileSync, readFileSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";

import { sha256CanonicalJsonV1 } from "../../packages/canon/src/sha256-canonical-json-v1.js";
import { MISSION_CONTRACT_GO_PHRASE, createMissionContract } from "../../packages/core/src/mission-contract-state.js";
import { EVENT_KINDS, genesisSupervisorState, step } from "../../packages/core/src/mission-supervisor.js";
import { acquireClosureOwnership } from "../../packages/receipts/src/mission-closure-ownership.js";
import { NODE0_RECOVERY_TRANSACTION_ID } from "../../packages/core/src/node0-recovery-observation.js";

const [role, DEMA_HOME] = process.argv.slice(2);
export const RECOVERY_DIR = join("node0", "recovery");
const p = (n) => join(DEMA_HOME, RECOVERY_DIR, n);
const write = (n, o) => {
  const target = p(n);
  const tmp = `${target}.tmp.${process.pid}`;
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(tmp, JSON.stringify(o, null, 2));
  renameSync(tmp, target);
};

const TX = NODE0_RECOVERY_TRANSACTION_ID;
const TX_HASH = `sha256:${"5".repeat(64)}`;

export const CONTRACT_FIELDS = Object.freeze({
  mission_id: "MISSION-RECOVERY-PROOF-001",
  purpose: "Prove the loop resumes after an unexpected worker death, with no human hands",
  scope: "scoped temp DEMA_HOME only",
  acceptance_contract: { required_output_keys: ["patch"], forbidden_substrings: ["TODO"] },
  acceptance_criteria: ["successor advances the mission"],
  prohibited_outcomes: ["push", "network"],
  authority_ceiling: "local_reversible",
  iteration_budget: 4,
  completion_conditions: ["next legal transition reached"],
  escalation_rule: "halt_and_report",
  created_at_iso: "2026-08-10T00:00:00.000Z",
});

const authorityHash = (f) => sha256CanonicalJsonV1({ authority_ceiling: f.authority_ceiling, scope: f.scope });
const c = createMissionContract({ fields: CONTRACT_FIELDS, consent: MISSION_CONTRACT_GO_PHRASE });
const owned = await acquireClosureOwnership({ demaHome: DEMA_HOME, transactionId: TX, transactionHash: TX_HASH });

if (role === "a") {
  let s = genesisSupervisorState({ contract: c.contract, contract_hash: c.contract_hash });
  let n = 0;
  for (const e of [
    { kind: EVENT_KINDS.DISCOVERY_RECORDED, stage: "DISCOVER" },
    { kind: EVENT_KINDS.CONTRACT_FROZEN, stage: "CONTRACT" },
    { kind: EVENT_KINDS.PLAN_PROPOSED, stage: "PLAN" },
  ]) s = step(s, { ...e, hash: `sha256:a-${++n}` }, { contract: c.contract }).state;

  const checkpoint_hash = sha256CanonicalJsonV1(s);
  write("state.json", {
    schema: "bizra.dema.node0_recovery_state.v0.1",
    contract_fields: CONTRACT_FIELDS,
    contract_hash: c.contract_hash,
    supervisor_state: s,
    checkpoint_hash,
    authority_before_hash: authorityHash(CONTRACT_FIELDS),
  });
  write("worker-a.json", {
    pid: process.pid,
    mission_id: c.contract.mission_id,
    contract_hash: c.contract_hash,
    checkpoint_hash,
    state_seq: s.state_seq,
    fencing_token: owned.claim?.claim_hash ?? null,
  });
  // No signal handler: the supervisor's kill, when it comes, is a real death.
  setInterval(() => {}, 1 << 30);
} else if (role === "b") {
  const held = JSON.parse(readFileSync(p("state.json"), "utf8"));
  // Re-derive rather than trust the stored hash.
  const rc = createMissionContract({ fields: held.contract_fields, consent: MISSION_CONTRACT_GO_PHRASE });
  const advanced = step(
    held.supervisor_state,
    { kind: EVENT_KINDS.CONSENT_BOUND, stage: "FATE", hash: "sha256:b-1", effect_class: "reversible", consent_ref: "sha256:consent-recovery" },
    { contract: rc.contract },
  ).state;
  write("state.json", { ...held, supervisor_state: advanced, authority_after_hash: authorityHash(held.contract_fields) });
  write("worker-b.json", {
    pid: process.pid,
    mission_id: rc.contract.mission_id,
    contract_hash: rc.contract_hash,
    rederived_matches_stored: rc.contract_hash === held.contract_hash,
    resumed_checkpoint_hash: held.checkpoint_hash,
    advanced_to_stage: advanced.stage,
    state_seq: advanced.state_seq,
    claim_kind: owned.claim?.claim_kind ?? null,
  });
  process.exit(0);
} else {
  process.exit(2);
}
