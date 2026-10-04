import test from "node:test";
import assert from "node:assert/strict";

import { makeNode0RealmEvent } from "../packages/core/src/node0-realm-state-kernel.js";
import {
  DEMA_MISSION_WORKER_HANDOFF_SCHEMA,
  DEMA_MISSION_WORKER_HANDOFF_TRUTH_LABEL,
  DEMA_MISSION_WORKER_HANDOFF_GO_PHRASE,
  DEMA_MISSION_WORKER_HANDOFF_CANONICAL_FIXTURE,
  DEMA_MISSION_WORKER_HANDOFF_AUTHORITY_ATTACK_FIXTURE,
  DEMA_MISSION_WORKER_HANDOFF_DRIFT_ATTACK_FIXTURE,
  demaMissionWorkerHandoffBoundary,
  planDemaMissionWorkerHandoff,
  buildDemaMissionWorkerHandoffPayload,
  verifyDemaMissionWorkerHandoff,
  runDemaMissionWorkerHandoff,
} from "../packages/core/src/dema-mission-worker-handoff.js";
import { runDemaMissionWorkerHandoffCheck } from "../scripts/review/dema-mission-worker-handoff-check.mjs";

function cloneFixture() {
  return structuredClone(DEMA_MISSION_WORKER_HANDOFF_CANONICAL_FIXTURE);
}

function forgeLastEvent(envelope, mutatePayload) {
  const event_history = [...envelope.event_history];
  const original = event_history.at(-1);
  const event = makeNode0RealmEvent({
    seq: original.seq,
    kind: original.kind,
    payload: mutatePayload(structuredClone(original.payload)),
    prev_event: original.prev_event,
  });
  event_history[event_history.length - 1] = event;
  return {
    ...envelope,
    event_history,
    handoff_event_id: event.event_id,
    replay: { ...envelope.replay, head: { ...envelope.replay.head, event_id: event.event_id } },
  };
}

test("plan rejects a missing exact consent phrase", () => {
  const plan = planDemaMissionWorkerHandoff({ consent: "wrong", input: cloneFixture() });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("consent_phrase_mismatch"));
});

test("plan accepts the canonical worker replacement", () => {
  const plan = planDemaMissionWorkerHandoff({ consent: DEMA_MISSION_WORKER_HANDOFF_GO_PHRASE, input: cloneFixture() });
  assert.equal(plan.eligible, true);
  assert.deepEqual(plan.blocked_by, []);
});

test("plan rejects a smuggled top-level authority field", () => {
  const plan = planDemaMissionWorkerHandoff({
    consent: DEMA_MISSION_WORKER_HANDOFF_GO_PHRASE,
    input: { ...cloneFixture(), can_merge: true },
  });
  assert.ok(plan.blocked_by.includes("input_shape_invalid"));
});

test("plan rejects nonzero authority delta", () => {
  const plan = planDemaMissionWorkerHandoff({
    consent: DEMA_MISSION_WORKER_HANDOFF_GO_PHRASE,
    input: structuredClone(DEMA_MISSION_WORKER_HANDOFF_AUTHORITY_ATTACK_FIXTURE),
  });
  assert.ok(plan.blocked_by.includes("authority_delta_nonzero"));
});

test("plan rejects consent-scope drift", () => {
  const plan = planDemaMissionWorkerHandoff({
    consent: DEMA_MISSION_WORKER_HANDOFF_GO_PHRASE,
    input: structuredClone(DEMA_MISSION_WORKER_HANDOFF_DRIFT_ATTACK_FIXTURE),
  });
  assert.ok(plan.blocked_by.includes("consent_scope_hash_drift"));
});

for (const [field, code] of [
  ["mission_contract_hash", "mission_contract_hash_drift"],
  ["acceptance_criteria_hash", "acceptance_criteria_hash_drift"],
  ["source_checkpoint_hash", "source_checkpoint_hash_drift"],
]) {
  test(`plan rejects ${field} drift`, () => {
    const input = cloneFixture();
    input.acceptance.after[field] = `sha256:${"a".repeat(64)}`;
    const plan = planDemaMissionWorkerHandoff({ consent: DEMA_MISSION_WORKER_HANDOFF_GO_PHRASE, input });
    assert.ok(plan.blocked_by.includes(code));
  });
}

test("plan rejects a handoff to the same worker", () => {
  const input = cloneFixture();
  input.to_worker.worker_ref = input.from_worker.worker_ref;
  const plan = planDemaMissionWorkerHandoff({ consent: DEMA_MISSION_WORKER_HANDOFF_GO_PHRASE, input });
  assert.ok(plan.blocked_by.includes("worker_not_changed"));
});

test("plan rejects duplicate evidence references", () => {
  const input = cloneFixture();
  input.evidence_refs = ["same", "same"];
  const plan = planDemaMissionWorkerHandoff({ consent: DEMA_MISSION_WORKER_HANDOFF_GO_PHRASE, input });
  assert.ok(plan.blocked_by.includes("evidence_refs_invalid"));
});

test("plan rejects a mission absent from prior realm state", () => {
  const input = cloneFixture();
  input.mission_id = "UNKNOWN-MISSION";
  const plan = planDemaMissionWorkerHandoff({ consent: DEMA_MISSION_WORKER_HANDOFF_GO_PHRASE, input });
  assert.ok(plan.blocked_by.includes("mission_not_declared"));
});

test("plan propagates a corrupt prior event chain", () => {
  const input = cloneFixture();
  input.events[0].event_id = `sha256:${"0".repeat(64)}`;
  const plan = planDemaMissionWorkerHandoff({ consent: DEMA_MISSION_WORKER_HANDOFF_GO_PHRASE, input });
  assert.ok(plan.blocked_by.includes("prior_replay:event_id_mismatch"));
});

test("proposed event canonicalization rejects a lone surrogate", () => {
  const input = cloneFixture();
  input.to_worker.worker_ref = "bad\ud800";
  const plan = planDemaMissionWorkerHandoff({
    consent: DEMA_MISSION_WORKER_HANDOFF_GO_PHRASE,
    input,
  });
  assert.ok(plan.blocked_by.includes("proposed_event_not_canonicalizable:string_lone_surrogate"));
});

test("plan rejects an accessor-backed top-level field", () => {
  const input = cloneFixture();
  Object.defineProperty(input, "mission_id", { enumerable: true, get: () => "MISSION-CONTINUITY-MODEL-SWAP-0A" });
  const plan = planDemaMissionWorkerHandoff({ consent: DEMA_MISSION_WORKER_HANDOFF_GO_PHRASE, input });
  assert.ok(plan.blocked_by.includes("input_shape_invalid"));
});

test("build compiles the handoff into one deterministic MISSION_CHECKPOINT", () => {
  const a = cloneFixture();
  const b = cloneFixture();
  b.evidence_refs.reverse();
  b.prohibited_effects.reverse();
  const p1 = buildDemaMissionWorkerHandoffPayload(a);
  const p2 = buildDemaMissionWorkerHandoffPayload(b);
  assert.equal(p1.handoff_event_id, p2.handoff_event_id);
  assert.equal(p1.event_history.at(-1).kind, "MISSION_CHECKPOINT");
  assert.equal(p1.event_history.at(-1).payload.checkpoint_type, "WORKER_HANDOFF");
});

test("clean payload proves continuity and remains deeply frozen", () => {
  const payload = buildDemaMissionWorkerHandoffPayload(cloneFixture());
  assert.equal(payload.schema, DEMA_MISSION_WORKER_HANDOFF_SCHEMA);
  assert.equal(payload.truth_label, DEMA_MISSION_WORKER_HANDOFF_TRUTH_LABEL);
  assert.equal(payload.continuity_status, "MISSION_CONTINUES");
  assert.ok(Object.values(payload.event_history.at(-1).payload.continuity_proof).every(Boolean));
  assert.equal(payload.authority_delta, 0);
  assert.ok(Object.values(payload.boundary).every((value) => value === false));
  assert.ok(Object.isFrozen(payload));
  assert.ok(Object.isFrozen(payload.event_history));
});

test("verify accepts the clean replayable handoff", () => {
  const payload = buildDemaMissionWorkerHandoffPayload(cloneFixture());
  assert.deepEqual(verifyDemaMissionWorkerHandoff(payload), { ok: true, blocked_by: [] });
});

test("verify rejects a forged and rehashed authority increase", () => {
  const payload = buildDemaMissionWorkerHandoffPayload(cloneFixture());
  const forged = forgeLastEvent(payload, (body) => ({ ...body, authority_delta: 1 }));
  const verdict = verifyDemaMissionWorkerHandoff(forged);
  assert.equal(verdict.ok, false);
  assert.ok(verdict.blocked_by.includes("handoff_authority_delta_nonzero"));
});

test("verify rejects a forged and rehashed false continuity claim", () => {
  const payload = buildDemaMissionWorkerHandoffPayload(cloneFixture());
  const forged = forgeLastEvent(payload, (body) => ({
    ...body,
    continuity_proof: { ...body.continuity_proof, consent_scope_preserved: false },
  }));
  const verdict = verifyDemaMissionWorkerHandoff(forged);
  assert.equal(verdict.ok, false);
  assert.ok(verdict.blocked_by.includes("continuity_proof_invalid"));
});

test("verify rejects a boundary missing one declared key", () => {
  const payload = buildDemaMissionWorkerHandoffPayload(cloneFixture());
  const { network_used: _drop, ...boundary } = payload.boundary;
  const verdict = verifyDemaMissionWorkerHandoff({ ...payload, boundary });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.blocked_by.includes("boundary_not_all_false"));
});

test("verify rejects a smuggled top-level authority field", () => {
  const payload = buildDemaMissionWorkerHandoffPayload(cloneFixture());
  const verdict = verifyDemaMissionWorkerHandoff({ ...payload, can_merge: true });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.blocked_by.includes("payload_shape_invalid"));
});

test("verify rejects a smuggled field on the handoff event", () => {
  const payload = buildDemaMissionWorkerHandoffPayload(cloneFixture());
  const event_history = [...payload.event_history];
  event_history[event_history.length - 1] = { ...event_history.at(-1), can_merge: true };
  const verdict = verifyDemaMissionWorkerHandoff({ ...payload, event_history });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.blocked_by.includes("handoff_event_shape_invalid"));
});

test("verify rejects a smuggled field inside the handoff payload", () => {
  const payload = buildDemaMissionWorkerHandoffPayload(cloneFixture());
  const forged = forgeLastEvent(payload, (body) => ({ ...body, can_merge: true }));
  const verdict = verifyDemaMissionWorkerHandoff(forged);
  assert.equal(verdict.ok, false);
  assert.ok(verdict.blocked_by.includes("handoff_payload_invalid"));
});

test("verify rejects a rehashed but non-normalized evidence order", () => {
  const payload = buildDemaMissionWorkerHandoffPayload(cloneFixture());
  const forged = forgeLastEvent(payload, (body) => ({ ...body, evidence_refs: [...body.evidence_refs].reverse() }));
  const verdict = verifyDemaMissionWorkerHandoff(forged);
  assert.equal(verdict.ok, false);
  assert.ok(verdict.blocked_by.includes("evidence_refs_not_sorted"));
});

test("build does not freeze caller-owned prior events", () => {
  const input = cloneFixture();
  assert.equal(Object.isFrozen(input.events[0]), false);
  buildDemaMissionWorkerHandoffPayload(input);
  assert.equal(Object.isFrozen(input.events[0]), false);
});

test("run returns a replayed zero-authority continuity checkpoint", () => {
  const result = runDemaMissionWorkerHandoff({
    consent: DEMA_MISSION_WORKER_HANDOFF_GO_PHRASE,
    input: cloneFixture(),
  });
  assert.equal(result.ok, true);
  assert.match(result.handoff_event_id, /^sha256:[0-9a-f]{64}$/);
  assert.equal(result.replay.ok, true);
  assert.equal(result.replay.events_applied, 2);
  assert.equal(result.authority_delta, 0);
});

test("review gate passes clean and rejects authority/drift attacks", () => {
  const result = runDemaMissionWorkerHandoffCheck();
  assert.equal(result.ok, true, JSON.stringify(result.blocked_by));
  assert.equal(result.continuity_status, "MISSION_CONTINUES");
  assert.equal(result.authority_delta, 0);
});

test("boundary has the exact canonical all-false key set", () => {
  assert.deepEqual(Object.keys(demaMissionWorkerHandoffBoundary()).sort(), [
    "acceptance_criteria_mutated",
    "authority_increased",
    "consent_scope_mutated",
    "file_write_performed",
    "live_execution_performed",
    "mission_contract_mutated",
    "model_invocation_performed",
    "network_used",
    "source_checkpoint_mutated",
  ]);
});
