// MISSION-CONTRACT-STATE-0A — red-first tests for TASK-026 spec phase 01.
//
// Anchors T-01..T-06 from
// /data/bizra/research/MISSION_RUNTIME_0A_SPEC_v0_1/phase_01_mission_contract_and_state.md
//
// This phase proves mission IDENTITY and STATE survive workers. It does NOT prove
// any mission runs — conduction is phase 02, workers are phase 03.

import test from "node:test";
import assert from "node:assert/strict";

import {
  MISSION_CONTRACT_SCHEMA,
  MISSION_STATE_SCHEMA,
  MISSION_CONTRACT_GO_PHRASE,
  createMissionContract,
  proposeContractAmendment,
  buildMissionState,
  checkpointMissionState,
  resumeMissionState,
  missionContractStateBoundary,
} from "../packages/core/src/mission-contract-state.js";
import { isCanonicalBoundary } from "../packages/core/src/preview-boundary.js";

const GO = MISSION_CONTRACT_GO_PHRASE;

const FIELDS = Object.freeze({
  mission_id: "MISSION-REPAIR-001",
  purpose: "Repair one bounded local defect",
  scope: "packages/core/src only",
  acceptance_criteria: Object.freeze(["focused test green", "full gates green"]),
  prohibited_outcomes: Object.freeze(["push", "merge", "network"]),
  authority_ceiling: "local_reversible",
  iteration_budget: 4,
  completion_conditions: Object.freeze(["all acceptance criteria met"]),
  escalation_rule: "halt_and_report",
  created_at_iso: "2026-08-10T00:00:00.000Z",
});

const contractOf = (over = {}) => createMissionContract({ fields: { ...FIELDS, ...over }, consent: GO });

// ── T-01 · creation validation throws NAMED errors ────────────────────────────
test("T-01: empty acceptance_criteria is invalid at creation (EC-4)", () => {
  assert.throws(
    () => contractOf({ acceptance_criteria: [] }),
    (e) => e.code === "acceptance_criteria_empty",
  );
});

test("T-01: iteration_budget <= 0 or non-integer is invalid at creation (EC-5)", () => {
  assert.throws(() => contractOf({ iteration_budget: 0 }), (e) => e.code === "iteration_budget_invalid");
  assert.throws(() => contractOf({ iteration_budget: 2.5 }), (e) => e.code === "iteration_budget_invalid");
});

test("T-01: creation without the exact consent phrase is refused", () => {
  assert.throws(
    () => createMissionContract({ fields: FIELDS, consent: "go: mission contract" }),
    (e) => e.code === "consent_phrase_mismatch",
  );
});

// ── T-02 · canonical determinism ──────────────────────────────────────────────
test("T-02: identical fields hash identically across runs", () => {
  assert.equal(contractOf().contract_hash, contractOf().contract_hash);
});

test("T-02: key order cannot change the contract hash", () => {
  const reordered = {};
  for (const k of Object.keys(FIELDS).reverse()) reordered[k] = FIELDS[k];
  assert.equal(
    createMissionContract({ fields: reordered, consent: GO }).contract_hash,
    contractOf().contract_hash,
  );
});

test("T-02: a changed field changes the hash", () => {
  assert.notEqual(contractOf({ iteration_budget: 5 }).contract_hash, contractOf().contract_hash);
});

// ── T-03 · immutability (FR-2) ────────────────────────────────────────────────
test("T-03: a worker-channel amendment is rejected fail-closed", () => {
  const base = contractOf();
  const r = proposeContractAmendment({
    contract: base.contract,
    changes: { authority_ceiling: "unbounded" },
    channel: "worker",
    consent: GO,
  });
  assert.equal(r.accepted, false);
  assert.equal(r.refusal, "contract_mutation_rejected");
  assert.equal(r.contract_hash, base.contract_hash, "the authoritative hash must be unchanged");
});

test("T-03: an operator-consented amendment yields a NEW hash and preserves the old", () => {
  const base = contractOf();
  const r = proposeContractAmendment({
    contract: base.contract,
    changes: { iteration_budget: 8 },
    channel: "operator_consented",
    consent: GO,
  });
  assert.equal(r.accepted, true);
  assert.notEqual(r.contract_hash, base.contract_hash);
  assert.equal(r.previous_contract_hash, base.contract_hash, "old contract stays resolvable");
  assert.equal(base.contract.iteration_budget, 4, "no in-place edit");
});

test("T-03: there is no in-place edit path — the returned contract is deeply frozen", () => {
  const base = contractOf();
  assert.throws(() => {
    base.contract.authority_ceiling = "unbounded";
  }, TypeError);
  assert.throws(() => {
    base.contract.acceptance_criteria.push("smuggled");
  }, TypeError);
});

// ── T-04 · checkpoint / resume round trip (FR-4) ──────────────────────────────
const stateOf = (c) =>
  buildMissionState({
    contract_hash: c.contract_hash,
    current_stage: "PLAN",
    iteration_used: 1,
    worker_history: ["worker-a"],
    accepted_evidence: [],
    failed_attempts: [],
    open_blockers: [],
    receipt_head: null,
    state_seq: 0,
  });

test("T-04: checkpoint -> resume round trip yields deep-equal state", () => {
  const c = contractOf();
  const cp = checkpointMissionState(stateOf(c));
  const resumed = resumeMissionState({ checkpoint: cp, liveContractHash: c.contract_hash });
  assert.deepEqual(resumed, cp.snapshot);
  assert.equal(cp.snapshot.state_seq, 1, "checkpoint advances state_seq");
});

test("T-04: a tampered snapshot byte makes resume refuse, naming BOTH hashes", () => {
  const c = contractOf();
  const cp = checkpointMissionState(stateOf(c));
  const tampered = { ...cp, snapshot: { ...cp.snapshot, current_stage: "EXECUTE" } };
  assert.throws(
    () => resumeMissionState({ checkpoint: tampered, liveContractHash: c.contract_hash }),
    (e) =>
      e.code === "state_hash_mismatch" &&
      typeof e.expected_hash === "string" &&
      typeof e.observed_hash === "string" &&
      e.expected_hash !== e.observed_hash,
  );
});

// ── T-05 · EC-1 / EC-2 / EC-3 each get a dedicated failing fixture ────────────
test("T-05/EC-1: resume against a different live contract refuses, never adopts", () => {
  const a = contractOf();
  const b = contractOf({ purpose: "A different mission entirely" });
  const cp = checkpointMissionState(stateOf(a));
  assert.throws(
    () => resumeMissionState({ checkpoint: cp, liveContractHash: b.contract_hash }),
    (e) => e.code === "contract_binding_mismatch",
  );
});

test("T-05/EC-2: a receipt-chain gap (seq n -> n+2) refuses", () => {
  const c = contractOf();
  const first = checkpointMissionState(stateOf(c));
  const skipped = checkpointMissionState({ ...first.snapshot, state_seq: first.snapshot.state_seq + 1 });
  assert.throws(
    () => resumeMissionState({ checkpoint: skipped, liveContractHash: c.contract_hash, previous: first }),
    (e) => e.code === "receipt_chain_gap",
  );
});

test("T-05/EC-3: two checkpoints at the same state_seq fail closed and surface BOTH hashes", () => {
  const c = contractOf();
  const one = checkpointMissionState(stateOf(c));
  const two = checkpointMissionState({ ...stateOf(c), worker_history: ["worker-b"] });
  assert.equal(one.snapshot.state_seq, two.snapshot.state_seq);
  assert.throws(
    () => resumeMissionState({ checkpoint: one, liveContractHash: c.contract_hash, concurrent: [one, two] }),
    (e) =>
      e.code === "concurrent_head_conflict" &&
      Array.isArray(e.heads) &&
      e.heads.length === 2 &&
      e.heads[0] !== e.heads[1],
  );
});

// ── T-06 · boundary ───────────────────────────────────────────────────────────
test("T-06: boundary is canonical and all-false", () => {
  const b = missionContractStateBoundary();
  assert.ok(isCanonicalBoundary(b));
  for (const [k, v] of Object.entries(b)) assert.equal(v, false, `${k} must be false`);
});

test("T-06: schemas are declared and stable", () => {
  assert.equal(MISSION_CONTRACT_SCHEMA, "bizra.dema.mission_contract.v0.1");
  assert.equal(MISSION_STATE_SCHEMA, "bizra.dema.mission_state.v0.1");
});

// ── Negative control · the state hash must actually cover the state ───────────
test("NC: every state field is load-bearing in state_hash", () => {
  const c = contractOf();
  const base = checkpointMissionState(stateOf(c));
  for (const key of ["current_stage", "iteration_used", "state_seq"]) {
    const mutated = { ...base.snapshot, [key]: key === "current_stage" ? "VERIFY" : 99 };
    const rehashed = checkpointMissionState({ ...mutated, state_seq: mutated.state_seq - 1 });
    assert.notEqual(rehashed.state_hash, base.state_hash, `${key} must change state_hash`);
  }
});
