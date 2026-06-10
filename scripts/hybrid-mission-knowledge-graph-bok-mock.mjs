/**
 * ADR-031 Hybrid Mission Knowledge Graph + Body of Knowledge Mock (G47)
 * [PROTOTYPE]
 * [DESIGNED_NOT_LIVE]
 * LOCAL_ONLY
 *
 * Local hybrid mission knowledge graph + BoK mock envelope only.
 * Produces reference/expectation objects for mission tree, knowledge graph,
 * and Body of Knowledge patterns.
 * No hybrid memory runtime, knowledge graph runtime, BoK runtime, vector memory,
 * autonomous retrieval, opaque compression, global state store, Data Lake mutation,
 * Dema/Data-Lake runtime sync, cross-repo writes, API bridge, PAT/SAT/FATE/URP
 * runtime invocation, Node1 activation, AIR runtime expansion, mission memory
 * runtime, receipt minting, public receipt writing, publishing, bridging,
 * reward authorization, reward logic, token logic, contracts, marketplace,
 * public economic copy, or Shariah-compliance claims.
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

import { createHash } from "node:crypto";

export const HYBRID_MISSION_KNOWLEDGE_GRAPH_BOK_MOCK_CONSENT =
  "GO: HYBRID MISSION KNOWLEDGE GRAPH BOK MOCK";

const FORBIDDEN_TERMS = new Set([
  "mint",
  "publish",
  "bridge",
  "reward_authorized",
  "token",
  "contract",
  "marketplace",
  "Node1",
  "URP",
  "Shariah",
  "guaranteed",
  "payout",
  "claimable",
  "earn",
  "authorized",
  "transferable",
  "public_url",
  "public",
  "vector_memory",
  "autonomous_retrieval",
  "opaque_compression",
  "global_state_store",
  "automatic_context_rewriting",
  "datalake_mutation",
  "cross_repo_write",
  "runtime_sync",
  "pat_runtime",
  "sat_runtime",
  "fate_runtime",
]);

const FORBIDDEN_OUTPUT_KEYS = [
  "vector_memory_runtime_active",
  "autonomous_retrieval_active",
  "opaque_compression_active",
  "global_state_store_active",
  "context_rewrite_performed",
  "datalake_synced",
  "cross_repo_write_performed",
  "runtime_bridge_active",
  "node1_sync",
  "urp_publication",
  "token_minted",
  "reward_authorized",
  "contract_call",
  "marketplace_signal",
  "public_receipt_url",
  "shariah_compliant",
];

export function createMockHybridMissionKnowledgeGraphBok(
  { requireConsent },
  input = loadExampleHybridMissionKnowledgeGraphBokInput(),
) {
  if (requireConsent !== HYBRID_MISSION_KNOWLEDGE_GRAPH_BOK_MOCK_CONSENT) {
    throw new Error(
      'CONSENT_REQUIRED: exact "GO: HYBRID MISSION KNOWLEDGE GRAPH BOK MOCK" required',
    );
  }

  if (!input || typeof input !== "object") {
    throw new Error("VALIDATION_FAILED: input must be object");
  }

  // Required inputs
  if (!input.mission_id) {
    throw new Error("VALIDATION_FAILED: mission_id required");
  }
  if (
    !input.mission_state_id ||
    !input.mission_state_id.startsWith("sha256:")
  ) {
    throw new Error(
      "VALIDATION_FAILED: mission_state_id must start with sha256:",
    );
  }
  if (
    !input.alignment_boundary_id ||
    !input.alignment_boundary_id.startsWith("sha256:")
  ) {
    throw new Error(
      "VALIDATION_FAILED: alignment_boundary_id must start with sha256:",
    );
  }
  if (!Array.isArray(input.proof_gaps) || input.proof_gaps.length === 0) {
    throw new Error("VALIDATION_FAILED: proof_gaps required and non-empty");
  }

  // Allowed input fields (from ADR-031)
  const allowedInput = [
    "mission_id",
    "mission_state_id",
    "air_id",
    "alignment_boundary_id",
    "dema_ref",
    "datalake_ref",
    "mission_tree_ref",
    "knowledge_node_ref",
    "knowledge_edge_ref",
    "bok_pattern_ref",
    "environment_refs",
    "expected_hashes",
    "proof_gaps",
    "consent_status",
    "review_status",
    "prototype_posture",
  ];
  for (const k of Object.keys(input)) {
    if (!allowedInput.includes(k)) {
      throw new Error(`FORBIDDEN_INPUT: field "${k}" not allowed`);
    }
  }

  // Reject promotion language
  const checkInput = { ...input };
  const serialized = JSON.stringify(checkInput).toLowerCase();
  for (const term of FORBIDDEN_TERMS) {
    if (serialized.includes(term)) {
      throw new Error(`FORBIDDEN_PROMOTION: detected "${term}"`);
    }
  }

  const now = new Date().toISOString();

  const body = {
    schema: "bizra.hybrid.knowledge.v0.1.local",
    hybrid_knowledge_boundary_id: null,
    mission_ref: input.mission_id,
    mission_state_ref: input.mission_state_id,
    alignment_ref: input.alignment_boundary_id,
    mission_tree_expectation: {
      placeholder: true,
      mission_tree_runtime_implemented: false,
      task_decomposition_expected: true,
    },
    knowledge_graph_expectation: {
      placeholder: true,
      graph_runtime_implemented: false,
      node_expectation_declared: true,
      edge_expectation_declared: true,
      autonomous_retrieval_enabled: false,
    },
    bok_expectation: {
      placeholder: true,
      bok_runtime_implemented: false,
      reusable_pattern_expected: true,
      automatic_pattern_promotion: false,
    },
    environment_recheck_expectation: {
      placeholder: true,
      required_before_knowledge_update: true,
      source_of_truth: "environment_over_memory",
      runtime_implemented: false,
    },
    stale_belief_policy: {
      placeholder: true,
      invalidation_required: true,
      silent_overwrite_forbidden: true,
      opaque_compression_forbidden: true,
      autonomous_retrieval_forbidden: true,
    },
    proof_gaps: input.proof_gaps,
    created_at: now,
    prototype_posture: "[PROTOTYPE] [DESIGNED_NOT_LIVE] LOCAL_ONLY",
  };

  // Deterministic id excludes created_at
  const identityBody = Object.fromEntries(
    Object.entries(body).filter(([key]) => key !== "created_at"),
  );
  const canonical = JSON.stringify(
    identityBody,
    Object.keys(identityBody).sort(),
  );
  const hybrid_knowledge_boundary_id =
    "sha256:" +
    createHash("sha256")
      .update(canonical + HYBRID_MISSION_KNOWLEDGE_GRAPH_BOK_MOCK_CONSENT)
      .digest("hex");

  body.hybrid_knowledge_boundary_id = hybrid_knowledge_boundary_id;

  // Final safety: no forbidden output keys
  for (const fk of FORBIDDEN_OUTPUT_KEYS) {
    if (fk in body) {
      throw new Error(`FORBIDDEN_OUTPUT: ${fk} must never be present`);
    }
  }

  return body;
}

export function loadExampleHybridMissionKnowledgeGraphBokInput() {
  return {
    mission_id: "mission-ex-001",
    mission_state_id: "sha256:example-mission-state-from-g39",
    air_id: "sha256:example-air-ref-from-g35",
    alignment_boundary_id: "sha256:example-alignment-from-g43",
    dema_ref: "sha256:example-dema-ref",
    datalake_ref: "datalake-body-ref:pat7-sat5-fate-urp-layers",
    mission_tree_ref: "mission-tree-ref-ex-001",
    knowledge_node_ref: "knowledge-node-ref-ex-001",
    knowledge_edge_ref: "knowledge-edge-ref-ex-001",
    bok_pattern_ref: "bok-pattern-ref-ex-001",
    environment_refs: ["local-models", "dema-home-integrity"],
    expected_hashes: ["sha256:env-snapshot"],
    proof_gaps: [
      "GAP_HYBRID_KNOWLEDGE_NOT_YET_IMPLEMENTED",
      "GAP_REFERENCE_EXPECTATION_ONLY",
    ],
    consent_status: "required",
    review_status: "boundary_local_only",
    prototype_posture: "[PROTOTYPE] [DESIGNED_NOT_LIVE] LOCAL_ONLY",
  };
}

// Self-test
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(
    "--- BIZRA G47: HYBRID MISSION KNOWLEDGE GRAPH BOK MOCK SELF-TEST ---",
  );
  try {
    const base = loadExampleHybridMissionKnowledgeGraphBokInput();

    // 1. creates with sha256 hybrid_knowledge_boundary_id
    const r1 = createMockHybridMissionKnowledgeGraphBok(
      { requireConsent: HYBRID_MISSION_KNOWLEDGE_GRAPH_BOK_MOCK_CONSENT },
      base,
    );
    console.log(
      "1. creates local envelope: hybrid_knowledge_boundary_id=",
      (r1.hybrid_knowledge_boundary_id || "").substring(0, 30) + "...",
    );

    // 2. requires exact consent
    try {
      createMockHybridMissionKnowledgeGraphBok(
        { requireConsent: "WRONG" },
        base,
      );
      throw new Error("should have thrown");
    } catch (e) {
      if (!e.message.includes("CONSENT_REQUIRED")) throw e;
      console.log("2. rejects missing exact consent");
    }

    // 3. requires mission_id
    try {
      const bad = { ...base };
      delete bad.mission_id;
      createMockHybridMissionKnowledgeGraphBok(
        { requireConsent: HYBRID_MISSION_KNOWLEDGE_GRAPH_BOK_MOCK_CONSENT },
        bad,
      );
      throw new Error("should have thrown");
    } catch (e) {
      if (!e.message.includes("mission_id")) throw e;
      console.log("3. requires mission_id");
    }

    // 4. includes mission_state_ref and alignment_ref
    console.log(
      "4. includes mission_state_ref and alignment_ref sha256:",
      r1.mission_state_ref.startsWith("sha256:") &&
        r1.alignment_ref.startsWith("sha256:"),
    );

    // 5. declares mission tree expectation without runtime
    const hasTree =
      r1.mission_tree_expectation &&
      r1.mission_tree_expectation.placeholder === true &&
      r1.mission_tree_expectation.mission_tree_runtime_implemented === false;
    console.log(
      "5. declares mission tree expectation without runtime:",
      hasTree,
    );

    // 6. declares knowledge graph expectation without graph runtime or autonomous retrieval
    const hasGraph =
      r1.knowledge_graph_expectation &&
      r1.knowledge_graph_expectation.placeholder === true &&
      r1.knowledge_graph_expectation.graph_runtime_implemented === false &&
      r1.knowledge_graph_expectation.autonomous_retrieval_enabled === false;
    console.log(
      "6. declares knowledge graph expectation without runtime/autonomous retrieval:",
      hasGraph,
    );

    // 7. declares BoK expectation without runtime or automatic promotion
    const hasBok =
      r1.bok_expectation &&
      r1.bok_expectation.placeholder === true &&
      r1.bok_expectation.bok_runtime_implemented === false &&
      r1.bok_expectation.automatic_pattern_promotion === false;
    console.log(
      "7. declares BoK expectation without runtime/automatic promotion:",
      hasBok,
    );

    // 8. declares environment re-check expectation
    const hasEnv =
      r1.environment_recheck_expectation &&
      r1.environment_recheck_expectation.placeholder === true &&
      r1.environment_recheck_expectation.required_before_knowledge_update ===
        true &&
      r1.environment_recheck_expectation.runtime_implemented === false;
    console.log(
      "8. declares environment re-check expectation before knowledge update:",
      hasEnv,
    );

    // 9. declares stale-belief policy without opaque compression
    const hasStale =
      r1.stale_belief_policy &&
      r1.stale_belief_policy.placeholder === true &&
      r1.stale_belief_policy.invalidation_required === true &&
      r1.stale_belief_policy.opaque_compression_forbidden === true;
    console.log(
      "9. declares stale-belief policy without opaque compression:",
      hasStale,
    );

    // 10. includes proof_gaps and prototype_posture
    const hasGaps = Array.isArray(r1.proof_gaps) && r1.proof_gaps.length > 0;
    const hasPosture =
      r1.prototype_posture && r1.prototype_posture.includes("PROTOTYPE");
    console.log(
      "10. includes proof_gaps and prototype_posture:",
      hasGaps && hasPosture,
    );

    // 11. no forbidden in output
    const hasNoForbidden = !FORBIDDEN_OUTPUT_KEYS.some((k) => k in r1);
    console.log("11. never returns forbidden fields:", hasNoForbidden);

    // 12. deterministic excluding created_at
    const r12a = createMockHybridMissionKnowledgeGraphBok(
      { requireConsent: HYBRID_MISSION_KNOWLEDGE_GRAPH_BOK_MOCK_CONSENT },
      base,
    );
    const r12b = createMockHybridMissionKnowledgeGraphBok(
      { requireConsent: HYBRID_MISSION_KNOWLEDGE_GRAPH_BOK_MOCK_CONSENT },
      base,
    );
    console.log(
      "12. deterministic hybrid_knowledge_boundary_id (excl created_at):",
      r12a.hybrid_knowledge_boundary_id === r12b.hybrid_knowledge_boundary_id,
    );

    console.log(
      "G47 self-test PASS (local mock, consented, required fields, placeholders, deterministic, no forbidden).",
    );
    process.exit(0);
  } catch (e) {
    console.error("G47 SELF-TEST FAIL:", e.message);
    process.exit(1);
  }
}
