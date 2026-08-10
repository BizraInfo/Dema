// MISSION-CONTRACT-STATE-0A — TASK-026 spec phase 01: mission identity and
// durable state that survive their workers.
//
// NOT ML. NOT runtime. NOT a supervisor. This owns two documents and the rules
// binding them; it conducts nothing. Conduction is phase 02, workers are phase 03.
//
// WHY THIS EXISTS. Mission purpose, acceptance criteria and progress currently
// live in conversation and per-slice artifacts. Nothing owns a durable,
// worker-independent record a replacement worker can trust without reading prose.
//
// THE IMMUTABILITY SHAPE. The contract is content-addressed and deeply frozen, so
// there is no in-place edit path to guard incorrectly. An "amendment" is a NEW
// contract hash requiring the exact operator phrase; the previous hash stays
// resolvable. A worker-channel mutation is refused as `contract_mutation_rejected`
// and never changes the authoritative hash.
//
// CLOCK-FREE. `created_at_iso` is supplied by the caller and treated as opaque
// data. This module reads no clock, so two runs of the same fields hash alike.
//
// Pure: no fs, no network, no process, no clock, no random, no model call.

import { sha256CanonicalJsonV1 } from "../../canon/src/sha256-canonical-json-v1.js";
import { buildPreviewBoundary } from "./preview-boundary.js";

export const MISSION_CONTRACT_SCHEMA = "bizra.dema.mission_contract.v0.1";
export const MISSION_STATE_SCHEMA = "bizra.dema.mission_state.v0.1";
export const MISSION_CONTRACT_TRUTH_LABEL = "MISSION_CONTRACT_STATE_PREVIEW";
export const MISSION_CONTRACT_GO_PHRASE = "GO: create mission contract";

/// Field order is irrelevant to the hash (canonical-json-v1 sorts), but the list
/// is exact: an unknown or missing field is a refusal, not a silent default.
export const CONTRACT_FIELDS = Object.freeze([
  "acceptance_criteria",
  "authority_ceiling",
  "completion_conditions",
  "created_at_iso",
  "escalation_rule",
  "iteration_budget",
  "mission_id",
  "prohibited_outcomes",
  "purpose",
  "scope",
]);

export const STATE_FIELDS = Object.freeze([
  "accepted_evidence",
  "contract_hash",
  "current_stage",
  "failed_attempts",
  "iteration_used",
  "open_blockers",
  "receipt_head",
  "state_seq",
  "worker_history",
]);

export const AMENDMENT_CHANNEL_OPERATOR = "operator_consented";

/// A named, inspectable failure. `code` is the contract; the message is for humans.
export class MissionContractError extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.name = "MissionContractError";
    this.code = code;
    Object.assign(this, extra);
  }
}

function deepFreeze(value) {
  if (Array.isArray(value)) {
    value.forEach(deepFreeze);
    return Object.freeze(value);
  }
  if (value && typeof value === "object") {
    Object.values(value).forEach(deepFreeze);
    return Object.freeze(value);
  }
  return value;
}

function exactKeys(obj, expected) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
  const actual = Object.keys(obj).sort();
  if (actual.length !== expected.length) return false;
  return expected.every((k, i) => actual[i] === k);
}

const isNonBlank = (v) => typeof v === "string" && v.trim().length > 0;
const isStringList = (v) => Array.isArray(v) && v.every(isNonBlank);

export function missionContractStateBoundary() {
  return buildPreviewBoundary();
}

/// Ordering matters: consent is checked BEFORE shape so a malformed unconsented
/// call cannot be told which fields it got wrong.
export function createMissionContract({ fields, consent } = {}) {
  if (consent !== MISSION_CONTRACT_GO_PHRASE) {
    throw new MissionContractError(
      "consent_phrase_mismatch",
      "exact-string consent required to create a mission contract",
    );
  }
  if (!exactKeys(fields, [...CONTRACT_FIELDS].sort())) {
    throw new MissionContractError("contract_shape_invalid", "contract fields must match CONTRACT_FIELDS exactly");
  }
  if (!isNonBlank(fields.mission_id)) {
    throw new MissionContractError("mission_id_missing", "mission_id must be a non-blank string");
  }
  // EC-4 — a mission that cannot be judged cannot be conducted.
  if (!isStringList(fields.acceptance_criteria) || fields.acceptance_criteria.length === 0) {
    throw new MissionContractError("acceptance_criteria_empty", "at least one acceptance criterion is required");
  }
  // EC-5
  if (!Number.isInteger(fields.iteration_budget) || fields.iteration_budget <= 0) {
    throw new MissionContractError("iteration_budget_invalid", "iteration_budget must be a positive integer");
  }
  if (!isStringList(fields.prohibited_outcomes)) {
    throw new MissionContractError("prohibited_outcomes_invalid", "prohibited_outcomes must be non-blank strings");
  }
  if (!isStringList(fields.completion_conditions) || fields.completion_conditions.length === 0) {
    throw new MissionContractError("completion_conditions_invalid", "at least one completion condition is required");
  }
  for (const k of ["purpose", "scope", "authority_ceiling", "escalation_rule", "created_at_iso"]) {
    if (!isNonBlank(fields[k])) {
      throw new MissionContractError(`${k}_missing`, `${k} must be a non-blank string`);
    }
  }

  const contract = deepFreeze({ ...fields, acceptance_criteria: [...fields.acceptance_criteria] });
  return Object.freeze({
    schema: MISSION_CONTRACT_SCHEMA,
    contract,
    contract_hash: sha256CanonicalJsonV1(contract),
  });
}

/// FR-2. The refusal path returns rather than throws: a rejected worker proposal
/// is an ordinary governed outcome the caller receipts, not an exceptional one.
export function proposeContractAmendment({ contract, changes, channel, consent } = {}) {
  const previous_contract_hash = contract ? sha256CanonicalJsonV1(contract) : null;
  if (channel !== AMENDMENT_CHANNEL_OPERATOR) {
    return Object.freeze({
      accepted: false,
      refusal: "contract_mutation_rejected",
      channel: typeof channel === "string" ? channel : null,
      contract_hash: previous_contract_hash,
      previous_contract_hash,
    });
  }
  const next = createMissionContract({ fields: { ...contract, ...changes }, consent });
  return Object.freeze({
    accepted: true,
    refusal: null,
    channel,
    contract: next.contract,
    contract_hash: next.contract_hash,
    previous_contract_hash,
  });
}

export function buildMissionState(input = {}) {
  if (!exactKeys(input, [...STATE_FIELDS].sort())) {
    throw new MissionContractError("state_shape_invalid", "state fields must match STATE_FIELDS exactly");
  }
  if (!isNonBlank(input.contract_hash)) {
    throw new MissionContractError("contract_hash_missing", "state must reference a contract_hash");
  }
  if (!Number.isInteger(input.state_seq) || input.state_seq < 0) {
    throw new MissionContractError("state_seq_invalid", "state_seq must be a non-negative integer");
  }
  return deepFreeze({ ...input });
}

/// FR-4. Advances the sequence, then hashes the resulting snapshot. The hash
/// covers the snapshot INCLUDING its new state_seq, so a replayed sequence
/// number cannot silently reuse an earlier hash.
export function checkpointMissionState(state) {
  if (!state || typeof state !== "object") {
    throw new MissionContractError("state_missing", "checkpoint requires a state document");
  }
  if (!Number.isInteger(state.state_seq) || state.state_seq < 0) {
    throw new MissionContractError("state_seq_invalid", "state_seq must be a non-negative integer");
  }
  const snapshot = deepFreeze({ ...state, state_seq: state.state_seq + 1 });
  return Object.freeze({
    schema: MISSION_STATE_SCHEMA,
    snapshot,
    state_hash: sha256CanonicalJsonV1(snapshot),
    prev: state.receipt_head ?? null,
  });
}

/**
 * FR-4 / EC-1..EC-3. Refuses before yielding state; never "adopts" a near match.
 *
 * `previous` and `concurrent` are supplied by the persistence layer, which is the
 * only party that can see other heads. Absent them this validates identity and
 * integrity only — it cannot invent knowledge of a chain it was not shown.
 */
export function resumeMissionState({ checkpoint, liveContractHash, previous = null, concurrent = null } = {}) {
  if (!checkpoint || typeof checkpoint !== "object" || !checkpoint.snapshot) {
    throw new MissionContractError("checkpoint_missing", "resume requires a checkpoint with a snapshot");
  }
  // EC-1 — identity before integrity: the wrong mission is wrong even if intact.
  if (checkpoint.snapshot.contract_hash !== liveContractHash) {
    throw new MissionContractError("contract_binding_mismatch", "checkpoint is bound to a different contract", {
      checkpoint_contract_hash: checkpoint.snapshot.contract_hash ?? null,
      live_contract_hash: liveContractHash ?? null,
    });
  }
  const observed_hash = sha256CanonicalJsonV1(checkpoint.snapshot);
  if (observed_hash !== checkpoint.state_hash) {
    throw new MissionContractError("state_hash_mismatch", "snapshot does not match its recorded state_hash", {
      expected_hash: checkpoint.state_hash ?? null,
      observed_hash,
    });
  }
  // EC-2 — a gap is repaired by replay from the last verified receipt, never by
  // accepting the later state.
  if (previous) {
    const expected = previous.snapshot.state_seq + 1;
    if (checkpoint.snapshot.state_seq !== expected) {
      throw new MissionContractError("receipt_chain_gap", "state_seq is not contiguous with the previous checkpoint", {
        expected_seq: expected,
        observed_seq: checkpoint.snapshot.state_seq,
      });
    }
  }
  // EC-3 — no last-write-wins. Surface every head at the contested sequence.
  if (Array.isArray(concurrent)) {
    const heads = [
      ...new Set(
        concurrent
          .filter((c) => c?.snapshot?.state_seq === checkpoint.snapshot.state_seq)
          .map((c) => c.state_hash),
      ),
    ];
    if (heads.length > 1) {
      throw new MissionContractError("concurrent_head_conflict", "two checkpoints claim the same state_seq", {
        state_seq: checkpoint.snapshot.state_seq,
        heads,
      });
    }
  }
  return checkpoint.snapshot;
}
