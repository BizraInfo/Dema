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

// ═══════════════════════════════════════════════════════════════════════════
// SLICE 2 — verification_is_external and authority_delta
// ═══════════════════════════════════════════════════════════════════════════

import {
  NODE0_VERIFIER_INDEPENDENCE_SCOPE,
  NODE0_CYCLE_AUTHORITY_DELTA_SCOPE,
  VERIFIER_INDEPENDENCE_VERDICTS,
  AUTHORITY_DELTA_VERDICTS,
  isCleanEligibleVerifierIndependence,
  isCleanEligibleAuthorityDelta,
} from "../packages/core/src/node0-runtime-mission-observation.js";

const VERIF = {
  executor_pid: 10,
  verifier_pid: 11,
  law_source: "rederived_from_persisted_contract_fields",
  executor_self_claimed_success: true,
  independently_rederived_verdict: "REJECT",
  exact_comparison_performed: true,
  authoritative_verdict_source: "independent_verifier",
  positive_control_verdict: "ACCEPT",
};

const AUTH = {
  authority_before_hash: "sha256:a",
  authority_after_hash: "sha256:a",
  carried_authority_delta_claim: 0,
  worker_a_widen_refused: true,
  worker_b_widen_refused: true,
  restart_widen_refused: true,
  self_grant_refused: true,
  stale_grant_refused: true,
};

const build2 = (over = {}) => build({ verification: VERIF, authority: AUTH, ...over });

test("slice2: a genuine observation proves both new rows", () => {
  const o = build2();
  assert.equal(o.verifier_independence_verdict, "VERIFICATION_EXTERNAL_PROVEN");
  assert.equal(o.authority_delta_verdict, "AUTHORITY_DELTA_ZERO_PROVEN");
  assert.ok(isCleanEligibleVerifierIndependence(o));
  assert.ok(isCleanEligibleAuthorityDelta(o));
  assert.equal(NODE0_VERIFIER_INDEPENDENCE_SCOPE, "node0_verifier_independence");
  assert.equal(NODE0_CYCLE_AUTHORITY_DELTA_SCOPE, "node0_cycle_authority_delta");
});

// ── verification_is_external ────────────────────────────────────────────────
test("slice2: one process cannot verify its own work", () => {
  assert.equal(build2({ verification: { ...VERIF, verifier_pid: VERIF.executor_pid } }).verifier_independence_verdict, "SAME_PROCESS_VERIFIED");
});

test("slice2: a verdict sourced from the executor's own claim is self-certification", () => {
  assert.equal(
    build2({ verification: { ...VERIF, authoritative_verdict_source: "executor_self_claim" } }).verifier_independence_verdict,
    "VERIFIER_USED_EXECUTOR_CLAIM",
  );
});

test("slice2: the verifier must obtain the acceptance law independently, not be handed it", () => {
  assert.equal(
    build2({ verification: { ...VERIF, law_source: "passed_by_executor" } }).verifier_independence_verdict,
    "LAW_NOT_INDEPENDENTLY_OBTAINED",
  );
});

test("slice2: without an exact comparison there is no verification", () => {
  assert.equal(build2({ verification: { ...VERIF, exact_comparison_performed: false } }).verifier_independence_verdict, "NO_EXACT_COMPARISON");
});

test("slice2/NC: the self-certification control must actually discriminate", () => {
  // If the executor's claim AGREED with the re-derivation, the episode would not
  // show that self-certification fails — it would show only that they coincided.
  assert.equal(
    build2({ verification: { ...VERIF, executor_self_claimed_success: true, independently_rederived_verdict: "ACCEPT" } })
      .verifier_independence_verdict,
    "CONTROL_DID_NOT_DISCRIMINATE",
  );
  // And a verifier that only ever says REJECT proves nothing either.
  assert.equal(
    build2({ verification: { ...VERIF, positive_control_verdict: "REJECT" } }).verifier_independence_verdict,
    "CONTROL_DID_NOT_DISCRIMINATE",
  );
  assert.equal(build2({ verification: { ...VERIF, positive_control_verdict: null } }).verifier_independence_verdict, "CONTROL_NOT_RUN");
});

// ── authority_delta ─────────────────────────────────────────────────────────
test("slice2: the delta is DERIVED from measured before/after, never from the carried claim", () => {
  // A carried `authority_delta: 0` alongside a genuine widening must lose.
  const o = build2({ authority: { ...AUTH, authority_after_hash: "sha256:widened", carried_authority_delta_claim: 0 } });
  assert.equal(o.authority_delta_verdict, "AUTHORITY_WIDENED");
  assert.equal(o.measured_authority_delta, 1, "the measurement, not the claim");
  assert.equal(isCleanEligibleAuthorityDelta(o), false);
});

test("slice2: a carried claim that contradicts the measurement is itself a refusal", () => {
  assert.equal(
    build2({ authority: { ...AUTH, carried_authority_delta_claim: 1 } }).authority_delta_verdict,
    "CARRIED_CLAIM_CONTRADICTS_MEASUREMENT",
  );
});

for (const [k, verdict] of [
  ["worker_a_widen_refused", "WIDENING_ACCEPTED"],
  ["worker_b_widen_refused", "WIDENING_ACCEPTED"],
  ["restart_widen_refused", "WIDENING_ACCEPTED"],
  ["self_grant_refused", "WIDENING_ACCEPTED"],
  ["stale_grant_refused", "WIDENING_ACCEPTED"],
]) {
  test(`slice2: ${k} false means an attempt succeeded — ${verdict}`, () => {
    assert.equal(build2({ authority: { ...AUTH, [k]: false } }).authority_delta_verdict, verdict);
  });
  test(`slice2: ${k} absent means the attempt was never made — CONTROL_NOT_RUN`, () => {
    const a = { ...AUTH }; delete a[k];
    assert.equal(build2({ authority: a }).authority_delta_verdict, "CONTROL_NOT_RUN");
  });
}

// ── independence of the four rows ───────────────────────────────────────────
test("slice2: all four rows are judged independently and may fail independently", () => {
  const o = build2({ verification: { ...VERIF, verifier_pid: VERIF.executor_pid } });
  assert.equal(o.state_ownership_verdict, "MISSION_STATE_PRIMARY_PROVEN");
  assert.equal(o.contract_immutability_verdict, "CONTRACT_IMMUTABLE_PROVEN");
  assert.equal(o.verifier_independence_verdict, "SAME_PROCESS_VERIFIED");
  assert.equal(o.authority_delta_verdict, "AUTHORITY_DELTA_ZERO_PROVEN");
});

test("slice2: evidence class gates the new rows too", () => {
  for (const cls of ["TEST_INJECTION", "OPERATOR_ASSERTED", "NONE"]) {
    const o = build2({ evidenceClass: cls });
    assert.equal(isCleanEligibleVerifierIndependence(o), false);
    assert.equal(isCleanEligibleAuthorityDelta(o), false);
  }
});

test("slice2: each new vocabulary has exactly one clean-eligible verdict", () => {
  const v = VERIFIER_INDEPENDENCE_VERDICTS.filter((x) => isCleanEligibleVerifierIndependence({ verifier_independence_verdict: x, evidence_class: "OBSERVED" }));
  const a = AUTHORITY_DELTA_VERDICTS.filter((x) => isCleanEligibleAuthorityDelta({ authority_delta_verdict: x, evidence_class: "OBSERVED" }));
  assert.deepEqual(v, ["VERIFICATION_EXTERNAL_PROVEN"]);
  assert.deepEqual(a, ["AUTHORITY_DELTA_ZERO_PROVEN"]);
});
