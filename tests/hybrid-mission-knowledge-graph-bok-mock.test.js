/**
 * ADR-031 Hybrid Mission Knowledge Graph + Body of Knowledge Mock - Tests (G47)
 * [PROTOTYPE] [DESIGNED_NOT_LIVE]
 * LOCAL_ONLY
 *
 * Tests exercise the local hybrid mission knowledge graph + BoK mock envelope.
 * No hybrid memory, knowledge graph, BoK, vector memory, autonomous retrieval,
 * opaque compression, global state, Data Lake mutation, Dema/Data-Lake sync,
 * cross-repo write, API bridge, PAT/SAT/FATE/URP runtime, Node1, AIR expansion,
 * mission memory, receipt minting, public writing, publishing, bridging,
 * reward/token/contract/marketplace, or Shariah claims.
 *
 * NO_HYBRID_MEMORY_RUNTIME
 * NO_KNOWLEDGE_GRAPH_RUNTIME
 * NO_BOK_RUNTIME
 * NO_VECTOR_MEMORY_RUNTIME
 * NO_AUTONOMOUS_RETRIEVAL_ENGINE
 * NO_OPAQUE_COMPRESSION_ENGINE
 * NO_GLOBAL_STATE_STORE
 * NO_DATALAKE_MUTATION
 * NO_DEMA_DATALAKE_RUNTIME_SYNC
 * NO_CROSS_REPO_WRITE
 * NO_API_BRIDGE
 * NO_PAT_RUNTIME_INVOCATION
 * NO_SAT_RUNTIME_INVOCATION
 * NO_FATE_RUNTIME_INVOCATION
 * NO_URP_SYNC
 * NO_NODE1_ACTIVATION
 * NO_AIR_RUNTIME_EXPANSION
 * NO_MISSION_MEMORY_RUNTIME
 * NO_RECEIPT_MINTING
 * NO_PUBLIC_RECEIPT_WRITING
 * NO_PUBLISHING
 * NO_BRIDGING
 * NO_REWARD_AUTHORIZATION
 * NO_REWARD_LOGIC
 * NO_TOKEN_LOGIC
 * NO_CONTRACTS
 * NO_MARKETPLACE
 * NO_PUBLIC_ECONOMIC_COPY
 * NO_SHARIAH_COMPLIANCE_CLAIM
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  createMockHybridMissionKnowledgeGraphBok,
  loadExampleHybridMissionKnowledgeGraphBokInput,
  HYBRID_MISSION_KNOWLEDGE_GRAPH_BOK_MOCK_CONSENT,
} from "../scripts/hybrid-mission-knowledge-graph-bok-mock.mjs";

// 1. creates a local hybrid knowledge envelope with sha256 hybrid_knowledge_boundary_id
test("creates a local hybrid knowledge envelope with sha256 hybrid_knowledge_boundary_id", () => {
  const input = loadExampleHybridMissionKnowledgeGraphBokInput();
  const env = createMockHybridMissionKnowledgeGraphBok(
    { requireConsent: HYBRID_MISSION_KNOWLEDGE_GRAPH_BOK_MOCK_CONSENT },
    input,
  );
  assert.ok(
    env.hybrid_knowledge_boundary_id &&
      env.hybrid_knowledge_boundary_id.startsWith("sha256:"),
    "creates envelope with sha256 hybrid_knowledge_boundary_id [DECLARED]",
  );
});

// 2. requires exact consent
test("requires exact consent", () => {
  const input = loadExampleHybridMissionKnowledgeGraphBokInput();
  assert.throws(
    () =>
      createMockHybridMissionKnowledgeGraphBok(
        { requireConsent: "WRONG" },
        input,
      ),
    /CONSENT_REQUIRED/,
    "rejects missing exact consent [DECLARED]",
  );
});

// 3. requires mission_id
test("requires mission_id", () => {
  const input = loadExampleHybridMissionKnowledgeGraphBokInput();
  const bad = { ...input };
  delete bad.mission_id;
  assert.throws(
    () =>
      createMockHybridMissionKnowledgeGraphBok(
        { requireConsent: HYBRID_MISSION_KNOWLEDGE_GRAPH_BOK_MOCK_CONSENT },
        bad,
      ),
    /mission_id/,
    "requires mission_id [DECLARED]",
  );
});

// 4. requires mission_state_id sha256 reference
test("requires mission_state_id sha256 reference", () => {
  const input = loadExampleHybridMissionKnowledgeGraphBokInput();
  const bad = { ...input };
  bad.mission_state_id = "not-sha256";
  assert.throws(
    () =>
      createMockHybridMissionKnowledgeGraphBok(
        { requireConsent: HYBRID_MISSION_KNOWLEDGE_GRAPH_BOK_MOCK_CONSENT },
        bad,
      ),
    /mission_state_id/,
    "requires mission_state_id sha256: [DECLARED]",
  );
});

// 5. requires alignment_boundary_id sha256 reference
test("requires alignment_boundary_id sha256 reference", () => {
  const input = loadExampleHybridMissionKnowledgeGraphBokInput();
  const bad = { ...input };
  bad.alignment_boundary_id = "not-sha256";
  assert.throws(
    () =>
      createMockHybridMissionKnowledgeGraphBok(
        { requireConsent: HYBRID_MISSION_KNOWLEDGE_GRAPH_BOK_MOCK_CONSENT },
        bad,
      ),
    /alignment_boundary_id/,
    "requires alignment_boundary_id sha256: [DECLARED]",
  );
});

// 6. declares mission tree expectation without mission tree runtime
test("declares mission tree expectation without mission tree runtime", () => {
  const input = loadExampleHybridMissionKnowledgeGraphBokInput();
  const env = createMockHybridMissionKnowledgeGraphBok(
    { requireConsent: HYBRID_MISSION_KNOWLEDGE_GRAPH_BOK_MOCK_CONSENT },
    input,
  );
  const hasTree =
    env.mission_tree_expectation &&
    env.mission_tree_expectation.placeholder === true &&
    env.mission_tree_expectation.mission_tree_runtime_implemented === false;
  assert.ok(
    hasTree,
    "declares mission tree expectation without runtime [DECLARED]",
  );
});

// 7. declares knowledge graph expectation without graph runtime or autonomous retrieval
test("declares knowledge graph expectation without graph runtime or autonomous retrieval", () => {
  const input = loadExampleHybridMissionKnowledgeGraphBokInput();
  const env = createMockHybridMissionKnowledgeGraphBok(
    { requireConsent: HYBRID_MISSION_KNOWLEDGE_GRAPH_BOK_MOCK_CONSENT },
    input,
  );
  const hasGraph =
    env.knowledge_graph_expectation &&
    env.knowledge_graph_expectation.placeholder === true &&
    env.knowledge_graph_expectation.graph_runtime_implemented === false &&
    env.knowledge_graph_expectation.autonomous_retrieval_enabled === false;
  assert.ok(
    hasGraph,
    "declares knowledge graph expectation without runtime or autonomous retrieval [DECLARED]",
  );
});

// 8. declares BoK expectation without BoK runtime or automatic promotion
test("declares BoK expectation without BoK runtime or automatic promotion", () => {
  const input = loadExampleHybridMissionKnowledgeGraphBokInput();
  const env = createMockHybridMissionKnowledgeGraphBok(
    { requireConsent: HYBRID_MISSION_KNOWLEDGE_GRAPH_BOK_MOCK_CONSENT },
    input,
  );
  const hasBok =
    env.bok_expectation &&
    env.bok_expectation.placeholder === true &&
    env.bok_expectation.bok_runtime_implemented === false &&
    env.bok_expectation.automatic_pattern_promotion === false;
  assert.ok(
    hasBok,
    "declares BoK expectation without runtime or automatic promotion [DECLARED]",
  );
});

// 9. declares environment re-check expectation before knowledge update
test("declares environment re-check expectation before knowledge update", () => {
  const input = loadExampleHybridMissionKnowledgeGraphBokInput();
  const env = createMockHybridMissionKnowledgeGraphBok(
    { requireConsent: HYBRID_MISSION_KNOWLEDGE_GRAPH_BOK_MOCK_CONSENT },
    input,
  );
  const hasEnv =
    env.environment_recheck_expectation &&
    env.environment_recheck_expectation.placeholder === true &&
    env.environment_recheck_expectation.required_before_knowledge_update ===
      true &&
    env.environment_recheck_expectation.runtime_implemented === false;
  assert.ok(
    hasEnv,
    "declares environment re-check expectation before knowledge update [DECLARED]",
  );
});

// 10. declares stale-belief invalidation policy without opaque compression
test("declares stale-belief invalidation policy without opaque compression", () => {
  const input = loadExampleHybridMissionKnowledgeGraphBokInput();
  const env = createMockHybridMissionKnowledgeGraphBok(
    { requireConsent: HYBRID_MISSION_KNOWLEDGE_GRAPH_BOK_MOCK_CONSENT },
    input,
  );
  const hasStale =
    env.stale_belief_policy &&
    env.stale_belief_policy.placeholder === true &&
    env.stale_belief_policy.invalidation_required === true &&
    env.stale_belief_policy.opaque_compression_forbidden === true;
  assert.ok(
    hasStale,
    "declares stale-belief invalidation policy without opaque compression [DECLARED]",
  );
});

// 11. rejects forbidden runtime/economic/public fields
test("rejects forbidden runtime/economic/public fields", () => {
  const input = loadExampleHybridMissionKnowledgeGraphBokInput();
  const bad = { ...input, vector_memory_runtime_active: true };
  assert.throws(
    () =>
      createMockHybridMissionKnowledgeGraphBok(
        { requireConsent: HYBRID_MISSION_KNOWLEDGE_GRAPH_BOK_MOCK_CONSENT },
        bad,
      ),
    /FORBIDDEN/,
    "rejects forbidden fields [DECLARED]",
  );
});

// 12. deterministic hybrid_knowledge_boundary_id for same semantic input excluding created_at
test("deterministic hybrid_knowledge_boundary_id for same semantic input excluding created_at", () => {
  const input = loadExampleHybridMissionKnowledgeGraphBokInput();
  const r1 = createMockHybridMissionKnowledgeGraphBok(
    { requireConsent: HYBRID_MISSION_KNOWLEDGE_GRAPH_BOK_MOCK_CONSENT },
    input,
  );
  const r2 = createMockHybridMissionKnowledgeGraphBok(
    { requireConsent: HYBRID_MISSION_KNOWLEDGE_GRAPH_BOK_MOCK_CONSENT },
    input,
  );
  assert.strictEqual(
    r1.hybrid_knowledge_boundary_id,
    r2.hybrid_knowledge_boundary_id,
    "deterministic hybrid_knowledge_boundary_id (excl created_at) [DECLARED]",
  );
});
