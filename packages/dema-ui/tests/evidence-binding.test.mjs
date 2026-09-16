import assert from "node:assert/strict";
import test from "node:test";
import { aggregateSituationState } from "../src/lib/situation/situation-aggregator.ts";
import { projectNow } from "../src/lib/situation/now-projection.ts";
import {
  EVIDENCE_BINDING_SCHEMA,
  buildEvidenceBindings,
  normalizeEvidenceBinding,
  validateEvidenceBindings,
} from "../src/lib/situation/evidence-binding.ts";

const NOW = "2026-09-14T03:05:00.000Z";

function measured(value, source = "test.source", observedAt = NOW, staleAfterMs = 5_000) {
  return { status: "MEASURED", value, source, measured_at: observedAt, stale_after_ms: staleAfterMs };
}

function evidenceWith(state, binding) {
  return { ...state.evidence, bindings: [binding] };
}

test("E01 field resolves to a deterministic evidence binding", () => {
  const state = aggregateSituationState({ resources: { cpu: measured(8, "os.cpus()") } }, { observedAt: NOW });
  const binding = state.evidence.bindings.find((candidate) => candidate.fieldRef === "/resources/cpu");
  assert.ok(binding);
  assert.equal(binding.schema, EVIDENCE_BINDING_SCHEMA);
  assert.deepEqual(binding.observationRefs, ["observation:cpu:os.cpus()"]);
  assert.equal(binding.truth, "MEASURED");
  assert.equal(validateEvidenceBindings(state.evidence).ok, true);
});

test("E02 VERIFIED without evidence rejects", () => {
  const state = aggregateSituationState({}, { observedAt: NOW });
  const invalid = {
    schema: EVIDENCE_BINDING_SCHEMA,
    fieldRef: "/mission/currentState",
    claimRefs: [], observationRefs: [], receiptRefs: [], provenanceRefs: [],
    truth: "VERIFIED", freshness: state.observation,
    proofCeiling: ["VERIFIED"], notEstablished: [],
  };
  const result = validateEvidenceBindings(evidenceWith(state, invalid));
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /verified_binding_without_evidence/);
});

test("E03 UNKNOWN gains no synthetic proof", () => {
  const state = aggregateSituationState({}, { observedAt: NOW });
  const binding = state.evidence.bindings.find((candidate) => candidate.fieldRef === "/mission/currentState");
  assert.ok(binding);
  assert.equal(binding.truth, "UNKNOWN");
  assert.deepEqual(binding.claimRefs, []);
  assert.deepEqual(binding.observationRefs, []);
  assert.deepEqual(binding.receiptRefs, []);
  assert.deepEqual(binding.proofCeiling, ["NO_SUPPORTING_EVIDENCE"]);
});

test("E04 missing claim reference rejects", () => {
  const state = aggregateSituationState({ resources: { cpu: measured(8) } }, { observedAt: NOW });
  const valid = state.evidence.bindings.find((candidate) => candidate.fieldRef === "/resources/cpu");
  const result = validateEvidenceBindings(evidenceWith(state, { ...valid, claimRefs: ["claim:missing"] }));
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /binding_claim_missing/);
});

test("E05 missing observation reference rejects", () => {
  const state = aggregateSituationState({}, { observedAt: NOW });
  const valid = state.evidence.bindings.find((candidate) => candidate.fieldRef === "/mission/currentState");
  const result = validateEvidenceBindings(evidenceWith(state, { ...valid, observationRefs: ["observation:missing"], truth: "MEASURED", freshness: { ...state.observation, status: "CURRENT" } }));
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /binding_observation_missing/);
});

test("E06 missing receipt reference rejects", () => {
  const state = aggregateSituationState({}, { observedAt: NOW });
  const valid = state.evidence.bindings.find((candidate) => candidate.fieldRef === "/mission/currentState");
  const result = validateEvidenceBindings(evidenceWith(state, { ...valid, receiptRefs: ["receipt:missing"], truth: "MEASURED", freshness: { ...state.observation, status: "CURRENT" } }));
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /binding_receipt_missing/);
});

test("E07 stale evidence cannot freshen a current binding", () => {
  const stale = aggregateSituationState({ resources: { cpu: measured(8, "os.cpus()", "2026-09-14T00:00:00.000Z", 1_000) } }, { observedAt: NOW });
  const binding = stale.evidence.bindings.find((candidate) => candidate.fieldRef === "/resources/cpu");
  assert.equal(binding.truth, "STALE");
  assert.equal(binding.freshness.status, "STALE");
  const dishonest = { ...binding, truth: "MEASURED", freshness: { ...binding.freshness, status: "CURRENT" } };
  const result = validateEvidenceBindings(evidenceWith(stale, dishonest));
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /current_binding_stale_only/);
});

test("E08 contradiction remains attached to the resource binding", () => {
  const state = aggregateSituationState({
    observations: { gateway: measured("ok", "gateway.health") },
    resources: { gateway: measured("offline", "gateway.cache") },
  }, { observedAt: NOW });
  const binding = state.evidence.bindings.find((candidate) => candidate.fieldRef === "/resources/gateway");
  assert.equal(state.evidence.contradictions.includes("source_conflict:gateway"), true);
  assert.equal(binding.notEstablished.includes("source_conflict:gateway"), true);
});

test("E09 resource proof cannot establish authority", () => {
  const state = aggregateSituationState({ resources: { gpu: measured({ util: 20 }, "nvidia-smi") } }, { observedAt: NOW });
  const binding = state.evidence.bindings.find((candidate) => candidate.fieldRef === "/resources/gpu");
  assert.deepEqual(binding.proofCeiling, ["RESOURCE_OBSERVATION_ONLY"]);
  assert.equal(binding.notEstablished.includes("authority"), true);
  assert.equal(state.authority.current.status, "UNKNOWN");
});

test("E10 receipt presence cannot establish mission completion", () => {
  const state = aggregateSituationState({ resources: { receipt: measured({ receiptId: "r1" }, "receipt.read") } }, { observedAt: NOW });
  const binding = state.evidence.bindings.find((candidate) => candidate.fieldRef === "/mission/currentState");
  assert.equal(binding.truth, "UNKNOWN");
  assert.equal(binding.observationRefs.length, 0);
  assert.equal(binding.notEstablished.includes("mission_completion"), true);
});

test("E11 PAT declaration cannot establish activity", () => {
  const state = aggregateSituationState({ actors: [{
    actorId: "pat-2", kind: "PAT", role: "engineer",
    reality: { existence: "DECLARED", availability: "UNKNOWN", activity: "ACTIVE", evidenceState: "UNOBSERVED" },
    observation: { status: "UNKNOWN", value: null, source: "pat.declaration", measured_at: NOW, stale_after_ms: 5000 }, evidenceRefs: [],
  }] }, { observedAt: NOW });
  const binding = state.evidence.bindings.find((candidate) => candidate.fieldRef === "/actors/pat-2/reality/activity");
  assert.equal(binding.truth, "UNKNOWN");
  assert.deepEqual(binding.observationRefs, []);
  assert.equal(binding.notEstablished.includes("actor_activity_not_bound"), true);
});

test("E12 notEstablished survives binding", () => {
  const state = aggregateSituationState({ resources: { cpu: measured(8) } }, { observedAt: NOW });
  const binding = state.evidence.bindings.find((candidate) => candidate.fieldRef === "/resources/cpu");
  for (const gap of state.evidence.notEstablished) assert.equal(binding.notEstablished.includes(gap), true);
});

test("E13 local proof ceiling survives binding", () => {
  const state = aggregateSituationState({ resources: { cpu: measured(8) } }, { observedAt: NOW });
  const binding = state.evidence.bindings.find((candidate) => candidate.fieldRef === "/resources/cpu");
  assert.deepEqual(binding.proofCeiling, ["RESOURCE_OBSERVATION_ONLY"]);
});

test("E14 unordered references normalize identically", () => {
  const state = aggregateSituationState({}, { observedAt: NOW });
  const base = state.evidence.bindings.find((candidate) => candidate.fieldRef === "/mission/currentState");
  const left = normalizeEvidenceBinding({ ...base, claimRefs: ["b", "a", "a"], observationRefs: ["z", "y"], provenanceRefs: ["source-b", "source-a"], proofCeiling: ["z", "a"], notEstablished: ["z", "a"] });
  const right = normalizeEvidenceBinding({ ...base, claimRefs: ["a", "b"], observationRefs: ["y", "z"], provenanceRefs: ["source-a", "source-b"], proofCeiling: ["a", "z"], notEstablished: ["a", "z"] });
  assert.deepEqual(left, right);
});

test("E15 existing NOW projection remains truth-preserving", () => {
  const state = aggregateSituationState({ resources: { cpu: measured(8) } }, { observedAt: NOW });
  const projection = projectNow(state);
  assert.equal(projection.resources.truth, "MEASURED");
  assert.equal(projection.mission.truth, "UNKNOWN");
  assert.equal(projection.authority.truth, "UNKNOWN");
  assert.equal(state.evidence.bindings.length > 0, true);
});

test("E16 binding does not expand Situation source coverage", () => {
  const state = aggregateSituationState({ resources: { cpu: measured(8) } }, { observedAt: NOW });
  const mission = state.evidence.bindings.find((candidate) => candidate.fieldRef === "/mission/currentState");
  const authority = state.evidence.bindings.find((candidate) => candidate.fieldRef === "/authority/current/status");
  assert.deepEqual(mission.claimRefs, []);
  assert.deepEqual(mission.observationRefs, []);
  assert.deepEqual(authority.claimRefs, []);
  assert.deepEqual(authority.observationRefs, []);
  assert.equal(state.evidence.provenance.includes("test.source"), true);
});

test("E17 binding construction is pure and does not persist or invoke effects", () => {
  const state = aggregateSituationState({ resources: { cpu: measured(8) } }, { observedAt: NOW });
  const before = JSON.stringify(state);
  const first = buildEvidenceBindings(state);
  const second = buildEvidenceBindings(state);
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(state), before);
  assert.equal(Object.isFrozen(first), true);
});

test("E18 unsupported semantic input is downgraded to UNKNOWN", () => {
  const state = aggregateSituationState({
    attention: {
      humanRequired: false,
      severity: "INFORMATION",
      observation: measured("none", "attention.source"),
    },
  }, { observedAt: NOW });
  const binding = state.evidence.bindings.find((candidate) => candidate.fieldRef === "/attention/status");
  assert.equal(state.attention.status, "NONE_REQUIRED");
  assert.equal(binding.truth, "UNKNOWN");
  assert.deepEqual(binding.observationRefs, []);
});
