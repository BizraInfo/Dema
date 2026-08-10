// NODE0-RECOVERY-OBSERVATION-1A — red-first kernel tests.
//
// The classification contract for `recovery_after_worker_exit`
// <- node0_runtime_kill_resume.
//
// The whole question this row asks is "without human hands". So the refusals are
// organised around every way a recovery can LOOK autonomous without being it:
// the harness started the replacement, the supervisor was told about the kill,
// the supervisor never observed the death, or a human recovery marker was sitting
// in the home the whole time.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  NODE0_RECOVERY_OBSERVATION_SCHEMA,
  NODE0_RUNTIME_KILL_RESUME_SCOPE,
  RECOVERY_VERDICTS,
  RECOVERY_EVIDENCE_CLASSES,
  buildRecoveryObservation,
  verifyRecoveryHash,
  isCleanEligibleRecovery,
} from "../packages/core/src/node0-recovery-observation.js";

const hash = (v) => `sha256:${createHash("sha256").update(JSON.stringify(v)).digest("hex")}`;

const F = {
  supervisor: {
    pid: 50,
    running: true,
    told_about_kill: false,
    detected_death: true,
    detection_method: "liveness_probe",
    decided_recovery: true,
    started_replacement: true,
  },
  predecessor: { pid: 51, exited: true, killed_with: "SIGKILL" },
  successor: {
    pid: 52,
    started_by: "supervisor",
    mission_id: "M-1",
    contract_hash: "sha256:c",
    resumed_checkpoint_hash: "sha256:cp",
    advanced_to_stage: "EXECUTE",
    state_seq: 2,
  },
  durable: { mission_id: "M-1", contract_hash: "sha256:c", checkpoint_hash: "sha256:cp", checkpoint_valid: true, state_seq: 1 },
  fencing: { stale_token_result: "STALE_OWNER_FENCED" },
  human: { commands_between_death_and_resume: 0, manual_recovery_marker_present: false },
  authority: { before_hash: "sha256:a", after_hash: "sha256:a" },
  attribution: { certified_by: "independent_observer" },
  controls: { no_supervisor_recovered: false, harness_started_b_accepted: false, alive_a_triggered_b: false },
};

const b = (over = {}) =>
  buildRecoveryObservation({ facts: { ...F, ...over }, evidenceClass: "OBSERVED", executedCodeHash: "sha256:k", hash });
const sub = (key, patch) => b({ [key]: { ...F[key], ...patch } });

test("a genuine autonomous recovery proves the row", () => {
  const o = b();
  assert.equal(o.schema, NODE0_RECOVERY_OBSERVATION_SCHEMA);
  assert.equal(o.recovery_verdict, "RECOVERY_AFTER_EXIT_PROVEN");
  assert.ok(isCleanEligibleRecovery(o));
  assert.equal(NODE0_RUNTIME_KILL_RESUME_SCOPE, "node0_runtime_kill_resume");
  assert.equal(o.authority_delta, 0);
});

for (const cls of ["TEST_INJECTION", "OPERATOR_ASSERTED", "NONE"]) {
  test(`evidence class ${cls} can never reach PROVEN`, () => {
    const o = buildRecoveryObservation({ facts: F, evidenceClass: cls, executedCodeHash: "sha256:k", hash });
    assert.notEqual(o.recovery_verdict, "RECOVERY_AFTER_EXIT_PROVEN");
    assert.equal(isCleanEligibleRecovery(o), false);
  });
}

// ── NC-1 · no supervisor running → death does not recover ────────────────────
test("NC-1: with no supervisor there is nothing to recover autonomously", () => {
  assert.equal(sub("supervisor", { running: false }).recovery_verdict, "NO_SUPERVISOR");
});

test("NC-1 control: the no-supervisor case must actually have FAILED to recover", () => {
  // If a home with no supervisor recovered anyway, recovery is not attributable
  // to the supervisor at all and the whole episode is decorative.
  assert.equal(b({ controls: { ...F.controls, no_supervisor_recovered: true } }).recovery_verdict, "CONTROL_DID_NOT_DISCRIMINATE");
});

// ── NC-2 · the harness starting B must never satisfy the row ─────────────────
test("NC-2: a harness-started replacement is a scripted replacement, not a recovery", () => {
  assert.equal(sub("successor", { started_by: "harness" }).recovery_verdict, "HARNESS_STARTED_REPLACEMENT");
});

test("NC-2 control: a harness-started run must have been REJECTED by the same kernel", () => {
  assert.equal(b({ controls: { ...F.controls, harness_started_b_accepted: true } }).recovery_verdict, "CONTROL_DID_NOT_DISCRIMINATE");
});

// ── the supervisor must have found out by itself ─────────────────────────────
test("a supervisor that was TOLD about the kill did not detect anything", () => {
  assert.equal(sub("supervisor", { told_about_kill: true }).recovery_verdict, "SUPERVISOR_WAS_TOLD");
});

test("a supervisor that never observed the death cannot have decided on it", () => {
  assert.equal(sub("supervisor", { detected_death: false }).recovery_verdict, "DEATH_NOT_DETECTED");
});

test("a supervisor that observed but did not decide has not recovered anything", () => {
  assert.equal(sub("supervisor", { decided_recovery: false }).recovery_verdict, "RECOVERY_NOT_DECIDED");
});

// ── NC-3 · a live A must not trigger a replacement ───────────────────────────
test("NC-3: the supervisor must not start B while A is alive", () => {
  assert.equal(sub("predecessor", { exited: false }).recovery_verdict, "PREDECESSOR_STILL_LIVE");
  assert.equal(b({ controls: { ...F.controls, alive_a_triggered_b: true } }).recovery_verdict, "CONTROL_DID_NOT_DISCRIMINATE");
});

test("a clean exit is not an unexpected death", () => {
  assert.equal(sub("predecessor", { killed_with: "SIGTERM" }).recovery_verdict, "NOT_KILLED");
});

// ── NC-4 / NC-5 · the recovered mission must be the SAME mission ─────────────
test("NC-4: an invalid checkpoint refuses recovery", () => {
  assert.equal(sub("durable", { checkpoint_valid: false }).recovery_verdict, "CHECKPOINT_INVALID");
});

test("NC-5: a wrong contract_hash refuses recovery", () => {
  assert.equal(sub("successor", { contract_hash: "sha256:other" }).recovery_verdict, "CONTRACT_HASH_MISMATCH");
});

test("a different mission_id is a different mission", () => {
  assert.equal(sub("successor", { mission_id: "M-2" }).recovery_verdict, "MISSION_IDENTITY_CHANGED");
});

test("resuming something other than the committed checkpoint is not the same lineage", () => {
  assert.equal(sub("successor", { resumed_checkpoint_hash: "sha256:fresh" }).recovery_verdict, "CHECKPOINT_LINEAGE_BROKEN");
});

test("a successor that did not advance has resumed nothing", () => {
  assert.equal(sub("successor", { advanced_to_stage: null }).recovery_verdict, "NO_LEGAL_TRANSITION");
  assert.equal(sub("successor", { state_seq: 1 }).recovery_verdict, "NO_LEGAL_TRANSITION");
});

// ── NC-6 / NC-7 · authority and the corpse ───────────────────────────────────
test("NC-6: a successor that widened authority refutes the row", () => {
  assert.equal(b({ authority: { before_hash: "sha256:a", after_hash: "sha256:wider" } }).recovery_verdict, "AUTHORITY_WIDENED");
});

test("NC-7: an unfenced stale predecessor means the corpse can still write", () => {
  assert.equal(b({ fencing: { stale_token_result: "OWNER_VALID" } }).recovery_verdict, "STALE_NOT_FENCED");
});

// ── NC-8 · a human recovery marker disqualifies the whole episode ────────────
test("NC-8: a manual recovery marker present in the home disqualifies the invariant", () => {
  assert.equal(sub("human", { manual_recovery_marker_present: true }).recovery_verdict, "HUMAN_RECOVERY_MARKER");
});

test("any human command between death and resume disqualifies it", () => {
  assert.equal(sub("human", { commands_between_death_and_resume: 1 }).recovery_verdict, "HUMAN_INTERVENED");
});

// ── the supervisor may not certify its own recovery ──────────────────────────
test("a supervisor-certified episode is self-certification and is refused", () => {
  assert.equal(b({ attribution: { certified_by: "supervisor" } }).recovery_verdict, "SELF_CERTIFIED");
});

// ── hash + vocabulary discipline ─────────────────────────────────────────────
test("the hash excludes observed_at and covers the verdict", () => {
  const x = buildRecoveryObservation({ facts: F, evidenceClass: "OBSERVED", executedCodeHash: "sha256:k", observedAt: "2026-01-01", hash });
  const y = buildRecoveryObservation({ facts: F, evidenceClass: "OBSERVED", executedCodeHash: "sha256:k", observedAt: "2030-01-01", hash });
  assert.equal(x.observation_hash, y.observation_hash);
  assert.ok(verifyRecoveryHash(x, hash));
  assert.equal(verifyRecoveryHash({ ...x, recovery_verdict: "RECOVERY_AFTER_EXIT_PROVEN", successor_started_by: "harness" }, hash), false);
});

test("an absent injected hash is refused rather than defaulted", () => {
  assert.throws(() => buildRecoveryObservation({ facts: F }), TypeError);
});

test("exactly one verdict is clean-eligible, and the class vocabulary is closed", () => {
  const clean = RECOVERY_VERDICTS.filter((v) => isCleanEligibleRecovery({ recovery_verdict: v, evidence_class: "OBSERVED" }));
  assert.deepEqual(clean, ["RECOVERY_AFTER_EXIT_PROVEN"]);
  assert.deepEqual([...RECOVERY_EVIDENCE_CLASSES].sort(), ["NONE", "OBSERVED", "OPERATOR_ASSERTED", "TEST_INJECTION"]);
});
