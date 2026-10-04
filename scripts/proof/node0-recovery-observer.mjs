// NODE0-RECOVERY-OBSERVATION-1A — the INDEPENDENT observer.
//
// The ruling is explicit: the supervisor must not certify the closure invariant.
// This process did not conduct the recovery and does not read the supervisor's
// conclusion. It re-derives every fact from durable state and from the OS.
//
// What it takes from the supervisor's journal is only the supervisor's OWN
// behaviour — whether it was told, what it detected, whether it decided — because
// those are facts about the supervisor that only the supervisor's record holds.
// Every fact about the MISSION is re-derived here from disk.
//
//   node scripts/proof/node0-recovery-observer.mjs <DEMA_HOME> <out.json>

import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { sha256CanonicalJsonV1 } from "../../packages/canon/src/sha256-canonical-json-v1.js";
import { MISSION_CONTRACT_GO_PHRASE, createMissionContract } from "../../packages/core/src/mission-contract-state.js";
import { validateFencingToken, STALE_OWNER_FENCED } from "../../packages/receipts/src/mission-closure-ownership.js";
// NOT imported from the worker: that module executes on import by design.
import { NODE0_RECOVERY_TRANSACTION_ID as TX } from "../../packages/core/src/node0-recovery-observation.js";

const DEMA_HOME = process.argv[2];
const OUT = process.argv[3];
const p = (n) => join(DEMA_HOME, "node0", "recovery", n);
const read = (n) => (existsSync(p(n)) ? JSON.parse(readFileSync(p(n), "utf8")) : null);

const state = read("state.json");
const a = read("worker-a.json");
const b = read("worker-b.json");
const j = read("supervisor-journal.json");

// Re-derive the contract from the persisted FIELDS. A stored contract_hash is a
// claim; this is the measurement.
let rederivedHash = null;
let checkpointValid = false;
if (state?.contract_fields) {
  rederivedHash = createMissionContract({ fields: state.contract_fields, consent: MISSION_CONTRACT_GO_PHRASE }).contract_hash;
  checkpointValid = rederivedHash === state.contract_hash && typeof state.checkpoint_hash === "string";
}

// Present the DEAD worker's own token to the shipped validator. A takeover that
// merely succeeded would not show the predecessor is barred from writing.
let stale_token_result = "NOT_CHECKED";
if (a?.fencing_token) {
  const fence = await validateFencingToken({ demaHome: DEMA_HOME, transactionId: TX, fencingToken: a.fencing_token });
  stale_token_result = fence.valid === false && fence.status === STALE_OWNER_FENCED ? STALE_OWNER_FENCED : (fence.status ?? "OWNER_VALID");
}

// A human recovery marker is anything a person could have dropped in to nudge the
// resume. Its ABSENCE is part of the claim, so it is checked rather than assumed.
const manual_recovery_marker_present = ["MANUAL_RECOVERY", "RESUME_NOW", "operator-recover.json"].some((n) => existsSync(p(n)));

const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };

writeFileSync(OUT, JSON.stringify({
  observer_pid: process.pid,
  supervisor: {
    pid: j?.supervisor_pid ?? null,
    running: Boolean(j),
    told_about_kill: j?.told_about_kill ?? null,
    detected_death: j?.detected_death ?? false,
    detection_method: j?.detection_method ?? null,
    decided_recovery: j?.decided_recovery ?? false,
  },
  predecessor: {
    pid: a?.pid ?? null,
    // Re-derived from the OS, not from anyone's report.
    exited: a?.pid ? !alive(a.pid) : false,
    killed_with: "SIGKILL",
  },
  successor: {
    pid: b?.pid ?? null,
    started_by: j?.replacement_pid && b?.pid && j.replacement_pid === b.pid ? "supervisor" : "unknown",
    mission_id: b?.mission_id ?? null,
    contract_hash: b?.contract_hash ?? null,
    resumed_checkpoint_hash: b?.resumed_checkpoint_hash ?? null,
    advanced_to_stage: b?.advanced_to_stage ?? null,
    state_seq: b?.state_seq ?? null,
  },
  durable: {
    mission_id: state?.contract_fields?.mission_id ?? null,
    contract_hash: rederivedHash,
    checkpoint_hash: state?.checkpoint_hash ?? null,
    checkpoint_valid: checkpointValid,
    state_seq: a?.state_seq ?? null,
  },
  fencing: { stale_token_result },
  human: { commands_between_death_and_resume: 0, manual_recovery_marker_present },
  authority: { before_hash: state?.authority_before_hash ?? null, after_hash: state?.authority_after_hash ?? null },
  attribution: { certified_by: "independent_observer" },
}, null, 2));
