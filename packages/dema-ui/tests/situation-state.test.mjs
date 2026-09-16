import assert from "node:assert/strict";
import test from "node:test";
import {
  createUnknownSituationState,
  freezeSituationState,
  SITUATION_STATE_SCHEMA,
  validateSituationState,
} from "../src/lib/situation/situation-state.ts";

const NOW = "2026-09-14T01:32:00.000Z";

test("unknown fixture is a read model, not authority or runtime truth", () => {
  const state = createUnknownSituationState(NOW);
  assert.equal(state.schema, SITUATION_STATE_SCHEMA);
  assert.equal(state.subject.lens, "NOW");
  assert.equal(state.authority.current.status, "UNKNOWN");
  assert.equal(state.authority.actualAuthorityDelta.status, "UNKNOWN");
  assert.equal(state.evidence.proofCeiling[0], "SITUATION_SCHEMA_ONLY");
  assert.equal(validateSituationState(state).ok, true);
});

test("actor reality keeps existence, availability, activity and evidence separate", () => {
  const state = createUnknownSituationState(NOW);
  const actor = {
    actorId: "pat-1",
    kind: "PAT",
    role: "engineer",
    reality: {
      existence: "DECLARED",
      availability: "AVAILABLE",
      activity: "IDLE",
      evidenceState: "MEASURED",
    },
    observation: state.observation,
    evidenceRefs: ["observation-1"],
  };
  const next = { ...state, actors: [actor] };
  assert.equal(validateSituationState(next).ok, true);
  assert.equal(next.actors[0].reality.existence, "DECLARED");
  assert.equal(next.actors[0].reality.activity, "IDLE");
});

test("verified claims require an observation or receipt reference", () => {
  const state = createUnknownSituationState(NOW);
  const invalid = {
    ...state,
    evidence: {
      ...state.evidence,
      claims: [{
        claimId: "claim-1",
        text: "Node0 is active",
        truth: "VERIFIED",
        scope: "local",
        observationRefs: [],
        receiptRefs: [],
        freshness: state.observation,
      }],
    },
  };
  const result = validateSituationState(invalid);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /verified_claim_without_evidence/);
});

test("recommendation cannot carry measured authority and snapshots are frozen", () => {
  const state = createUnknownSituationState(NOW);
  const invalid = {
    ...state,
    recommendation: {
      ...state.recommendation,
      predictedAuthorityDelta: { status: "MEASURED", value: 1, scope: "test" },
    },
  };
  assert.equal(validateSituationState(invalid).ok, false);
  const frozen = freezeSituationState(state);
  assert.equal(Object.isFrozen(frozen), true);
  assert.equal(Object.isFrozen(frozen.evidence), true);
});

test("actual and predicted authority deltas remain distinct", () => {
  const state = createUnknownSituationState(NOW);
  const next = {
    ...state,
    authority: {
      ...state.authority,
      predictedAuthorityDelta: { status: "PREDICTED", value: 1, scope: "proposal" },
      actualAuthorityDelta: { status: "NONE", value: 0, scope: "receipt" },
    },
  };
  assert.equal(validateSituationState(next).ok, true);
  assert.equal(next.authority.predictedAuthorityDelta.status, "PREDICTED");
  assert.equal(next.authority.actualAuthorityDelta.status, "NONE");
});
