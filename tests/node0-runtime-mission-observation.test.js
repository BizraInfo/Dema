// NODE0-RUNTIME-MISSION-OBSERVATION-1A — red-first kernel tests.
//
// The CLASSIFICATION contract for two closure rows:
//   mission_is_primary_state  <- node0_runtime_state_ownership
//   contract_is_immutable     <- node0_contract_artifact_immutability
//
// This file proves the classification only. It does not prove any process ever
// died — that costs a real kill and lives in the producer's test.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  NODE0_RUNTIME_MISSION_SCHEMA,
  NODE0_RUNTIME_STATE_OWNERSHIP_SCOPE,
  NODE0_CONTRACT_IMMUTABILITY_SCOPE,
  RUNTIME_MISSION_EVIDENCE_CLASSES,
  STATE_OWNERSHIP_VERDICTS,
  CONTRACT_IMMUTABILITY_VERDICTS,
  buildRuntimeMissionObservation,
  verifyRuntimeMissionHash,
  isCleanEligibleStateOwnership,
  isCleanEligibleContractImmutability,
} from "../packages/core/src/node0-runtime-mission-observation.js";

const hash = (v) => `sha256:${createHash("sha256").update(JSON.stringify(v)).digest("hex")}`;

const PRED = {
  pid: 111,
  exited: true,
  killed_with: "SIGKILL",
  mission_id: "M-1",
  contract_hash: "sha256:c",
  checkpoint_state_hash: "sha256:s1",
  state_seq: 1,
};
const SUCC = {
  pid: 222,
  reconstructed_from: "dema_home_only",
  mission_id: "M-1",
  contract_hash: "sha256:c",
  resumed_state_hash: "sha256:s1",
  state_seq: 2,
  human_steps_between: 0,
};
const WORKER_LOCAL_CONTROL = { attempted: true, recovered: false };
const IMMUT = {
  amendment_channel: "worker",
  amendment_refusal: "contract_mutation_rejected",
  contract_hash_before: "sha256:c",
  contract_hash_after: "sha256:c",
  refusal_receipted: true,
  operator_control_attempted: true,
  operator_control_new_hash: "sha256:c2",
};

const build = (over = {}) =>
  buildRuntimeMissionObservation({
    predecessor: PRED,
    successor: SUCC,
    workerLocalControl: WORKER_LOCAL_CONTROL,
    immutability: IMMUT,
    evidenceClass: "OBSERVED",
    executedCodeHash: "sha256:kernel",
    hash,
    ...over,
  });

// ── the good case ────────────────────────────────────────────────────────────
test("a genuine observation proves BOTH rows and is clean-eligible for both", () => {
  const o = build();
  assert.equal(o.schema, NODE0_RUNTIME_MISSION_SCHEMA);
  assert.equal(o.state_ownership_verdict, "MISSION_STATE_PRIMARY_PROVEN");
  assert.equal(o.contract_immutability_verdict, "CONTRACT_IMMUTABLE_PROVEN");
  assert.ok(isCleanEligibleStateOwnership(o));
  assert.ok(isCleanEligibleContractImmutability(o));
  assert.equal(o.authority_delta, 0);
});

test("scopes are exported so an adapter imports them rather than retyping", () => {
  assert.equal(NODE0_RUNTIME_STATE_OWNERSHIP_SCOPE, "node0_runtime_state_ownership");
  assert.equal(NODE0_CONTRACT_IMMUTABILITY_SCOPE, "node0_contract_artifact_immutability");
});

// ── evidence class is the first gate ─────────────────────────────────────────
for (const cls of ["TEST_INJECTION", "OPERATOR_ASSERTED", "NONE"]) {
  test(`evidence class ${cls} can never reach a PROVEN verdict`, () => {
    const o = build({ evidenceClass: cls });
    assert.notEqual(o.state_ownership_verdict, "MISSION_STATE_PRIMARY_PROVEN");
    assert.notEqual(o.contract_immutability_verdict, "CONTRACT_IMMUTABLE_PROVEN");
    assert.equal(isCleanEligibleStateOwnership(o), false);
    assert.equal(isCleanEligibleContractImmutability(o), false);
  });
}

test("the evidence-class vocabulary is closed", () => {
  assert.deepEqual([...RUNTIME_MISSION_EVIDENCE_CLASSES].sort(), ["NONE", "OBSERVED", "OPERATOR_ASSERTED", "TEST_INJECTION"]);
});

// ── mission_is_primary_state · each near-miss gets its OWN refusal ───────────
test("a predecessor that did not exit is concurrency, not succession", () => {
  assert.equal(build({ predecessor: { ...PRED, exited: false } }).state_ownership_verdict, "PREDECESSOR_STILL_LIVE");
});

test("a clean exit is not a survived death — the kill signal is load-bearing", () => {
  assert.equal(build({ predecessor: { ...PRED, killed_with: "SIGTERM" } }).state_ownership_verdict, "NOT_KILLED");
});

test("the successor must be a DIFFERENT process", () => {
  assert.equal(build({ successor: { ...SUCC, pid: PRED.pid } }).state_ownership_verdict, "SAME_PROCESS");
});

test("state carried in argv rather than read from DEMA_HOME does not prove ownership", () => {
  assert.equal(
    build({ successor: { ...SUCC, reconstructed_from: "argv" } }).state_ownership_verdict,
    "STATE_NOT_RECONSTRUCTED_FROM_HOME",
  );
});

test("a different mission_id or contract_hash is a different mission, not a resume", () => {
  assert.equal(build({ successor: { ...SUCC, mission_id: "M-2" } }).state_ownership_verdict, "MISSION_IDENTITY_CHANGED");
  assert.equal(build({ successor: { ...SUCC, contract_hash: "sha256:other" } }).state_ownership_verdict, "MISSION_IDENTITY_CHANGED");
});

test("beginning again is the flattering near-miss and is refused", () => {
  assert.equal(build({ successor: { ...SUCC, state_seq: 1, resumed_state_hash: "sha256:fresh" } }).state_ownership_verdict, "RESUMED_FROM_FRESH_STATE");
});

test("any human step between death and resume disqualifies the observation", () => {
  assert.equal(build({ successor: { ...SUCC, human_steps_between: 1 } }).state_ownership_verdict, "HUMAN_INTERVENED");
});

// ── the negative control must itself have been run ───────────────────────────
test("without a FAILING worker-local control the row cannot be proven", () => {
  // If a worker-local-only mission is ALSO recoverable, the harness proves nothing:
  // recovery would not be evidence that state lives outside the worker.
  assert.equal(build({ workerLocalControl: { attempted: true, recovered: true } }).state_ownership_verdict, "CONTROL_DID_NOT_DISCRIMINATE");
  assert.equal(build({ workerLocalControl: { attempted: false, recovered: false } }).state_ownership_verdict, "CONTROL_NOT_RUN");
});

// ── contract_is_immutable ────────────────────────────────────────────────────
test("an accepted worker-channel amendment is a violation, not a refusal", () => {
  assert.equal(build({ immutability: { ...IMMUT, amendment_refusal: null } }).contract_immutability_verdict, "AMENDMENT_NOT_REFUSED");
});

test("a changed on-disk contract hash refutes immutability outright", () => {
  assert.equal(
    build({ immutability: { ...IMMUT, contract_hash_after: "sha256:widened" } }).contract_immutability_verdict,
    "CONTRACT_HASH_CHANGED",
  );
});

test("an unreceipted refusal is not a governed refusal", () => {
  assert.equal(build({ immutability: { ...IMMUT, refusal_receipted: false } }).contract_immutability_verdict, "REFUSAL_NOT_RECEIPTED");
});

test("without the operator positive control, 'refuses everything' passes as immutability", () => {
  // A contract that refuses EVERY amendment is not immutable, it is broken. The
  // control proves the refusal discriminates by channel.
  assert.equal(build({ immutability: { ...IMMUT, operator_control_attempted: false } }).contract_immutability_verdict, "CONTROL_NOT_RUN");
  assert.equal(
    build({ immutability: { ...IMMUT, operator_control_new_hash: IMMUT.contract_hash_before } }).contract_immutability_verdict,
    "CONTROL_DID_NOT_DISCRIMINATE",
  );
});

// ── hash discipline ──────────────────────────────────────────────────────────
test("the observation hash covers the facts and EXCLUDES observed_at", () => {
  const a = build({ observedAt: "2026-01-01T00:00:00.000Z" });
  const b = build({ observedAt: "2027-06-06T00:00:00.000Z" });
  assert.equal(a.observation_hash, b.observation_hash, "two identical observations must bind to the same witness");
  assert.ok(verifyRuntimeMissionHash(a, hash));
});

test("a hand-edited verdict fails re-derivation", () => {
  const o = build();
  assert.equal(verifyRuntimeMissionHash({ ...o, state_ownership_verdict: "MISSION_STATE_PRIMARY_PROVEN" }, hash), true);
  assert.equal(verifyRuntimeMissionHash({ ...o, successor_state_seq: 99 }, hash), false);
});

test("an absent injected hash is refused rather than defaulted", () => {
  assert.throws(() => buildRuntimeMissionObservation({ predecessor: PRED, successor: SUCC }), TypeError);
});

test("verdict vocabularies are closed and each contains exactly one clean-eligible value", () => {
  assert.ok(STATE_OWNERSHIP_VERDICTS.includes("MISSION_STATE_PRIMARY_PROVEN"));
  assert.ok(CONTRACT_IMMUTABILITY_VERDICTS.includes("CONTRACT_IMMUTABLE_PROVEN"));
  const cleanState = STATE_OWNERSHIP_VERDICTS.filter((v) => isCleanEligibleStateOwnership({ state_ownership_verdict: v, evidence_class: "OBSERVED" }));
  const cleanImmut = CONTRACT_IMMUTABILITY_VERDICTS.filter((v) => isCleanEligibleContractImmutability({ contract_immutability_verdict: v, evidence_class: "OBSERVED" }));
  assert.deepEqual(cleanState, ["MISSION_STATE_PRIMARY_PROVEN"]);
  assert.deepEqual(cleanImmut, ["CONTRACT_IMMUTABLE_PROVEN"]);
});

test("the kernel grants no authority on any path", () => {
  for (const o of [build(), build({ evidenceClass: "TEST_INJECTION" }), build({ predecessor: { ...PRED, exited: false } })]) {
    assert.equal(o.authority_delta, 0);
  }
});
