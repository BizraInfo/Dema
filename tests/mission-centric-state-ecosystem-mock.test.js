/**
 * ADR-029 Mission-Centric State Ecosystem Mock - Tests (G39)
 * [PROTOTYPE] [DESIGNED_NOT_LIVE]
 * LOCAL_ONLY
 *
 * Tests exercise the local mission-centric state ecosystem mock envelope.
 * No mission/vector memory, no automatic rewriting, no opaque compression,
 * no autonomous retrieval, no global store, no AIR/MCP/A2A/HHMM/AgentFold/Data Lake/URP runtime,
 * no minting, no public writing, no publishing, no bridging, no reward/token/contracts/marketplace,
 * no Node1, no public URP, no Shariah.
 *
 * NO_MISSION_MEMORY_RUNTIME
 * NO_VECTOR_MEMORY_RUNTIME
 * NO_AUTOMATIC_CONTEXT_REWRITING_ENGINE
 * NO_OPAQUE_COMPRESSION
 * NO_AUTONOMOUS_RETRIEVAL
 * NO_GLOBAL_STATE_STORE
 * NO_AIR_RUNTIME_EXPANSION
 * NO_MCP_RUNTIME
 * NO_A2A_RUNTIME
 * NO_HHMM_ENGINE
 * NO_AGENTFOLD_IMPLEMENTATION
 * NO_DATALAKE_SYNC
 * NO_URP_SYNC
 * NO_RECEIPT_MINTING
 * NO_PUBLIC_RECEIPT_WRITING
 * NO_PUBLISHING
 * NO_BRIDGING
 * NO_REWARD_AUTHORIZATION
 * NO_REWARD_LOGIC
 * NO_TOKEN_LOGIC
 * NO_CONTRACTS
 * NO_MARKETPLACE
 * NO_NODE1
 * NO_PUBLIC_URP_BRIDGE
 * NO_SHARIAH_COMPLIANCE_CLAIM
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  createMockMissionCentricStateEcosystem,
  loadExampleMissionCentricStateInput,
  MISSION_CENTRIC_STATE_ECOSYSTEM_MOCK_CONSENT,
} from "../scripts/mission-centric-state-ecosystem-mock.mjs";

// 1. creates a local mission-centric state envelope with sha256 mission_state_id
test("creates a local mission-centric state envelope with sha256 mission_state_id", () => {
  const input = loadExampleMissionCentricStateInput();
  const env = createMockMissionCentricStateEcosystem(
    { requireConsent: MISSION_CENTRIC_STATE_ECOSYSTEM_MOCK_CONSENT },
    input,
  );
  assert.ok(
    env.mission_state_id && env.mission_state_id.startsWith("sha256:"),
    "creates envelope with sha256 mission_state_id [DECLARED]",
  );
  assert.strictEqual(
    env.current_state,
    "MISSION_STATE_DECLARED",
    "default current_state [DECLARED]",
  );
  assert.strictEqual(
    env.previous_state,
    "READY_FOR_REVIEW",
    "default previous_state [DECLARED]",
  );
});

// 2. requires exact consent
test("requires exact consent", () => {
  const input = loadExampleMissionCentricStateInput();
  assert.throws(
    () =>
      createMockMissionCentricStateEcosystem(
        { requireConsent: "WRONG" },
        input,
      ),
    /CONSENT_REQUIRED/,
    "rejects missing exact consent [DECLARED]",
  );
});

// 3. requires mission_id
test("requires mission_id", () => {
  const input = loadExampleMissionCentricStateInput();
  const bad = { ...input };
  delete bad.mission_id;
  assert.throws(
    () =>
      createMockMissionCentricStateEcosystem(
        { requireConsent: MISSION_CENTRIC_STATE_ECOSYSTEM_MOCK_CONSENT },
        bad,
      ),
    /mission_id/,
    "requires mission_id [DECLARED]",
  );
});

// 4. includes AIR reference and state transition reference
test("includes AIR reference and state transition reference", () => {
  const input = loadExampleMissionCentricStateInput();
  const env = createMockMissionCentricStateEcosystem(
    { requireConsent: MISSION_CENTRIC_STATE_ECOSYSTEM_MOCK_CONSENT },
    input,
  );
  assert.ok(
    env.air_ref && env.air_ref.startsWith("sha256:"),
    "includes air_ref [DECLARED]",
  );
  assert.ok(
    env.state_transition_ref && env.state_transition_ref.startsWith("sha256:"),
    "includes state_transition_ref [DECLARED]",
  );
});

// 5. declares environment re-check expectation without runtime
test("declares environment re-check expectation without runtime", () => {
  const input = loadExampleMissionCentricStateInput();
  const env = createMockMissionCentricStateEcosystem(
    { requireConsent: MISSION_CENTRIC_STATE_ECOSYSTEM_MOCK_CONSENT },
    input,
  );
  assert.ok(
    env.environment_recheck_result &&
      env.environment_recheck_result.placeholder === true &&
      env.environment_recheck_result.runtime_implemented === false,
    "environment re-check placeholder without runtime [DECLARED]",
  );
});

// 6. declares stale-belief invalidation policy without opaque compression
test("declares stale-belief invalidation policy without opaque compression", () => {
  const input = loadExampleMissionCentricStateInput();
  const env = createMockMissionCentricStateEcosystem(
    { requireConsent: MISSION_CENTRIC_STATE_ECOSYSTEM_MOCK_CONSENT },
    input,
  );
  assert.ok(
    env.stale_belief_policy &&
      env.stale_belief_policy.placeholder === true &&
      env.stale_belief_policy.invalidation_required === true &&
      env.stale_belief_policy.opaque_compression_forbidden === true,
    "stale-belief policy without opaque compression [DECLARED]",
  );
});

// 7. declares HHMM state without HHMM engine
test("declares HHMM state without HHMM engine", () => {
  const input = loadExampleMissionCentricStateInput();
  const env = createMockMissionCentricStateEcosystem(
    { requireConsent: MISSION_CENTRIC_STATE_ECOSYSTEM_MOCK_CONSENT },
    input,
  );
  assert.ok(
    env.hhmm_state &&
      env.hhmm_state.placeholder === true &&
      env.hhmm_state.engine_implemented === false,
    "HHMM state without engine [DECLARED]",
  );
});

// 8. includes writer_ref from local_writer_result_id
test("includes writer_ref from local_writer_result_id", () => {
  const input = loadExampleMissionCentricStateInput();
  const env = createMockMissionCentricStateEcosystem(
    { requireConsent: MISSION_CENTRIC_STATE_ECOSYSTEM_MOCK_CONSENT },
    input,
  );
  assert.ok(
    env.writer_ref && env.writer_ref.startsWith("sha256:"),
    "includes writer_ref [DECLARED]",
  );
  assert.strictEqual(
    env.writer_ref,
    input.local_writer_result_id,
    "writer_ref matches input [DECLARED]",
  );
});

// 9. declares AgentFold expectation without implementation
test("declares AgentFold expectation without implementation", () => {
  const input = loadExampleMissionCentricStateInput();
  const env = createMockMissionCentricStateEcosystem(
    { requireConsent: MISSION_CENTRIC_STATE_ECOSYSTEM_MOCK_CONSENT },
    input,
  );
  assert.ok(
    env.agentfold_expectation &&
      env.agentfold_expectation.placeholder === true &&
      env.agentfold_expectation.agentfold_l3_implemented === false,
    "AgentFold expectation without implementation [DECLARED]",
  );
});

// 10. declares Data Lake alignment expectation without sync
test("declares Data Lake alignment expectation without sync", () => {
  const input = loadExampleMissionCentricStateInput();
  const env = createMockMissionCentricStateEcosystem(
    { requireConsent: MISSION_CENTRIC_STATE_ECOSYSTEM_MOCK_CONSENT },
    input,
  );
  assert.ok(
    env.datalake_alignment_expectation &&
      env.datalake_alignment_expectation.placeholder === true &&
      env.datalake_alignment_expectation.datalake_sync_implemented === false,
    "Data Lake alignment without sync [DECLARED]",
  );
});

// 11. declares URP expectation without sync/publication
test("declares URP expectation without sync/publication", () => {
  const input = loadExampleMissionCentricStateInput();
  const env = createMockMissionCentricStateEcosystem(
    { requireConsent: MISSION_CENTRIC_STATE_ECOSYSTEM_MOCK_CONSENT },
    input,
  );
  assert.ok(
    env.urp_expectation &&
      env.urp_expectation.placeholder === true &&
      env.urp_expectation.urp_sync_implemented === false &&
      env.urp_expectation.public_publication === false,
    "URP expectation without sync/publication [DECLARED]",
  );
});

// 12. rejects forbidden memory/economic/public/runtime fields
test("rejects forbidden memory/economic/public/runtime fields", () => {
  const input = loadExampleMissionCentricStateInput();
  const bad = { ...input, vector_memory_runtime: "bad" };
  assert.throws(
    () =>
      createMockMissionCentricStateEcosystem(
        { requireConsent: MISSION_CENTRIC_STATE_ECOSYSTEM_MOCK_CONSENT },
        bad,
      ),
    /FORBIDDEN/,
    "rejects forbidden fields [DECLARED]",
  );
});

// 13. deterministic mission_state_id for same semantic input excluding created_at
test("deterministic mission_state_id for same semantic input excluding created_at", () => {
  const input = loadExampleMissionCentricStateInput();
  const r1 = createMockMissionCentricStateEcosystem(
    { requireConsent: MISSION_CENTRIC_STATE_ECOSYSTEM_MOCK_CONSENT },
    input,
  );
  const r2 = createMockMissionCentricStateEcosystem(
    { requireConsent: MISSION_CENTRIC_STATE_ECOSYSTEM_MOCK_CONSENT },
    input,
  );
  assert.strictEqual(
    r1.mission_state_id,
    r2.mission_state_id,
    "deterministic mission_state_id excluding created_at [DECLARED]",
  );
});
