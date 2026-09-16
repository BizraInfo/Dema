import assert from "node:assert/strict";
import test from "node:test";
import {
  adaptNodeResourcesResponse,
  aggregateSituationState,
} from "../src/lib/situation/situation-aggregator.ts";
import { validateSituationState } from "../src/lib/situation/situation-state.ts";

const NOW = "2026-09-14T01:40:00.000Z";

function measured(value, source = "test.source", observedAt = NOW, staleAfterMs = 5_000) {
  return { status: "MEASURED", value, source, measured_at: observedAt, stale_after_ms: staleAfterMs };
}

function unknown(source = "test.source", observedAt = NOW) {
  return { status: "UNKNOWN", value: null, source, measured_at: observedAt, stale_after_ms: 5_000 };
}

test("A01 all-unknown input is valid, immutable, and attention-safe", () => {
  const state = aggregateSituationState({}, { observedAt: NOW });
  assert.equal(validateSituationState(state).ok, true);
  assert.equal(state.attention.status, "UNKNOWN");
  assert.equal(state.attention.humanRequired, null);
  assert.equal(state.authority.current.status, "UNKNOWN");
  assert.equal(Object.isFrozen(state), true);
  assert.equal(Object.isFrozen(state.evidence), true);
});

test("A02 existing redacted node-resources observations bind as measured resources", () => {
  const input = adaptNodeResourcesResponse({
    schema: "bizra.dema.node_resources.local.v0.1",
    measured_at: NOW,
    system: { cpu: measured({ cores: 8 }, "os.cpus()") },
    storage: measured([{ label: "Node root" }], "df -B1"),
    gpu: { status: "UNAVAILABLE", value: null, source: "nvidia-smi", measured_at: NOW, stale_after_ms: 5_000 },
    models: unknown("ollama list"),
    node0_boundary: { daemon_started: unknown("dema state --json") },
    receipts: measured(2, "repo docs/receipts"),
  });
  const state = aggregateSituationState(input, { observedAt: NOW });
  assert.equal(state.resources["system.cpu"].truth, "MEASURED");
  assert.equal(state.resources["system.cpu"].value.cores, 8);
  assert.equal(state.resources["node.gpu"].truth, "OFFLINE");
  assert.equal(state.evidence.provenance.includes("os.cpus()"), true);
});

test("A02b wrong source schema is rejected to UNKNOWN", () => {
  const state = aggregateSituationState(adaptNodeResourcesResponse({ schema: "wrong", measured_at: NOW }), { observedAt: NOW });
  assert.equal(state.resources.node_resources.truth, "UNKNOWN");
  assert.equal(state.resources.node_resources.value, null);
});

test("A03 a stale source stays stale even when aggregation is fresh", () => {
  const old = "2026-09-14T00:00:00.000Z";
  const state = aggregateSituationState({ resources: { cpu: measured(8, "os.cpus()", old, 1_000) } }, { observedAt: NOW });
  assert.equal(state.resources.cpu.truth, "STALE");
  assert.equal(state.resources.cpu.freshness.status, "STALE");
});

test("A04 malformed truth/status becomes UNKNOWN", () => {
  const state = aggregateSituationState({ resources: { cpu: { status: "GREEN", value: 8, source: "bad", measured_at: NOW, stale_after_ms: 5_000 } } }, { observedAt: NOW });
  assert.equal(state.resources.cpu.truth, "UNKNOWN");
  assert.match(state.resources.cpu.reason, /source_status_invalid/);
});

test("A05 malformed timestamps become UNKNOWN", () => {
  const state = aggregateSituationState({ resources: { cpu: measured(8, "os.cpus()", "not-a-time") } }, { observedAt: NOW });
  assert.equal(state.resources.cpu.truth, "UNKNOWN");
  assert.match(state.resources.cpu.reason, /source_observation_invalid/);
});

test("A05b malformed aggregation time is disclosed rather than treated as source freshness", () => {
  const state = aggregateSituationState({ resources: { cpu: measured(8) } }, { observedAt: "not-a-time" });
  assert.match(state.evidence.unresolvedGaps.join(" "), /aggregation_timestamp_invalid/);
});

test("A06 unknown attention never becomes NONE_REQUIRED", () => {
  const state = aggregateSituationState({ attention: { humanRequired: false, severity: "INFORMATION", observation: unknown("attention") } }, { observedAt: NOW });
  assert.equal(state.attention.status, "UNKNOWN");
  assert.equal(state.attention.humanRequired, null);
  assert.match(state.evidence.unresolvedGaps.join(" "), /attention_source/);
});

test("A07 authentication or route access does not infer authority", () => {
  const state = aggregateSituationState({ authenticated: true, routeAccess: true }, { observedAt: NOW });
  assert.equal(state.authority.current.status, "UNKNOWN");
  assert.equal(state.authority.actualAuthorityDelta.status, "UNKNOWN");
});

test("A08 receipt observation alone does not imply mission completion", () => {
  const state = aggregateSituationState({ resources: { receipt: measured({ receiptId: "r1" }, "receipt.read") } }, { observedAt: NOW });
  assert.equal(state.mission.truth, "UNKNOWN");
  assert.equal(state.mission.currentState, null);
  assert.equal(state.evidence.notEstablished.includes("mission_completion"), true);
});

test("A09 declared actor topology does not imply runtime availability", () => {
  const state = aggregateSituationState({
    actors: [{
      actorId: "pat-1",
      kind: "PAT",
      role: "engineer",
      reality: { existence: "DECLARED", availability: "UNKNOWN", activity: "IDLE", evidenceState: "UNOBSERVED" },
      observation: unknown("pat.declaration"),
      evidenceRefs: [],
    }],
  }, { observedAt: NOW });
  assert.equal(state.actors.length, 1);
  assert.equal(state.actors[0].reality.availability, "UNKNOWN");
  assert.equal(state.actors[0].reality.activity, "IDLE");
});

test("A10 conflicting source observations remain visible and lower the projection", () => {
  const state = aggregateSituationState({
    observations: { gateway: measured("ok", "gateway.health") },
    resources: { gateway: measured("offline", "gateway.cache") },
  }, { observedAt: NOW });
  assert.equal(state.resources.gateway.truth, "UNKNOWN");
  assert.equal(state.evidence.contradictions.includes("source_conflict:gateway"), true);
  assert.equal(state.evidence.observations.length, 2);
});

test("A11 recommendation stays absent without an inspectable basis", () => {
  const state = aggregateSituationState({ recommendation: { proposedAction: "repair", observation: measured(true, "planner") } }, { observedAt: NOW });
  assert.equal(state.recommendation.proposedAction, null);
  assert.equal(state.recommendation.basisRefs.length, 0);
  assert.equal(state.evidence.unresolvedGaps.includes("recommendation_not_generated"), true);
});

test("A15 aggregation output is deeply frozen", () => {
  const state = aggregateSituationState({ resources: { cpu: measured(8) } }, { observedAt: NOW });
  assert.equal(Object.isFrozen(state.resources), true);
  assert.equal(Object.isFrozen(state.resources.cpu), true);
  assert.equal(Object.isFrozen(state.evidence.observations), true);
});

test("A16 fixed input and aggregation time produce identical snapshots", () => {
  const input = { resources: { cpu: measured(8) }, lineage: { situationId: "s-1", revision: 2 } };
  assert.deepEqual(aggregateSituationState(input, { observedAt: NOW }), aggregateSituationState(input, { observedAt: NOW }));
});

test("A17 valid subject, attention, actor, and verified resource stay evidence-bound", () => {
  const state = aggregateSituationState({
    subject: {
      human: { id: "mumu", truth: "OBSERVED", source: "identity" },
      node: { id: "node0", truth: "OBSERVED" },
      lens: "MISSION",
    },
    attention: {
      humanRequired: true,
      severity: "DECISION",
      reason: "review",
      deadline: NOW,
      observation: measured(true, "attention.live"),
    },
    actors: [{
      actorId: "pat-1",
      kind: "PAT",
      role: "scout",
      reality: { existence: "INSTANTIATED", availability: "AVAILABLE", activity: "ACTIVE", evidenceState: "MEASURED" },
      observation: measured({ running: true }, "pat.live"),
      evidenceRefs: ["receipt:pat-1"],
    }],
    resources: {
      verified: { truth: "VERIFIED", value: "bound", source: "verified.source", measured_at: NOW, evidenceRefs: ["observation:verified"] },
      missingReference: { truth: "VERIFIED", value: "rejected", source: "verified.source", measured_at: NOW },
    },
    lineage: { situationId: "s-17", revision: 3 },
  }, { observedAt: NOW, source: "slice-a" });

  assert.equal(state.subject.human.id, "mumu");
  assert.equal(state.subject.node.id, "node0");
  assert.equal(state.subject.lens, "MISSION");
  assert.equal(state.attention.status, "REQUIRED");
  assert.equal(state.attention.deadline, NOW);
  assert.equal(state.actors[0].reality.availability, "AVAILABLE");
  assert.equal(state.actors[0].reality.activity, "ACTIVE");
  assert.equal(state.resources.verified.truth, "VERIFIED");
  assert.equal(state.resources.missingReference.truth, "UNKNOWN");
  assert.match(state.resources.missingReference.reason, /verified_source_without_reference/);
  assert.equal(state.lineage.revision, 3);
  assert.equal(validateSituationState(state).ok, true);

  const noDecision = aggregateSituationState({
    attention: { humanRequired: false, severity: "INFORMATION", observation: measured(false, "attention.quiet") },
  }, { observedAt: NOW });
  assert.equal(noDecision.attention.status, "NONE_REQUIRED");
  assert.equal(noDecision.attention.deadline, null);
});
