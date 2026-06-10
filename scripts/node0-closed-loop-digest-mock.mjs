/**
 * ADR-032 Node0 Closed-Loop Digest Mock (G51)
 * [PROTOTYPE]
 * [DESIGNED_NOT_LIVE]
 * LOCAL_ONLY
 *
 * Local Node0 Closed-Loop Digest mock envelope only.
 * Produces a reference/expectation object summarizing the local proof spine:
 * receipt review -> local writer -> AIR -> mission state -> Dema/Data-Lake alignment
 * -> Hybrid Mission Knowledge Graph + BoK.
 * No digest runtime, digest writer, digest aggregator, closed-loop runtime execution,
 * Dema/Data-Lake runtime sync, Data Lake mutation, cross-repo writes, API bridge,
 * filesystem bridge outside Dema, PAT runtime invocation, SAT runtime invocation,
 * FATE runtime invocation, URP sync, Node1 activation, AIR runtime expansion,
 * mission memory runtime, hybrid memory runtime, knowledge graph runtime,
 * Body of Knowledge runtime, vector memory runtime, autonomous retrieval engine,
 * opaque compression engine, global state store, receipt minting, public receipt
 * writing, publishing, bridging, reward authorization, reward logic, token logic,
 * contracts, marketplace, public economic copy, or Shariah-compliance claims.
 *
 * NO_DIGEST_RUNTIME
 * NO_DIGEST_WRITER
 * NO_DIGEST_AGGREGATOR
 * NO_CLOSED_LOOP_RUNTIME_EXECUTION
 * NO_DEMA_DATALAKE_RUNTIME_SYNC
 * NO_DATALAKE_MUTATION
 * NO_CROSS_REPO_WRITE
 * NO_API_BRIDGE
 * NO_FILESYSTEM_BRIDGE_OUTSIDE_DEMA
 * NO_PAT_RUNTIME_INVOCATION
 * NO_SAT_RUNTIME_INVOCATION
 * NO_FATE_RUNTIME_INVOCATION
 * NO_URP_SYNC
 * NO_NODE1_ACTIVATION
 * NO_AIR_RUNTIME_EXPANSION
 * NO_MISSION_MEMORY_RUNTIME
 * NO_HYBRID_MEMORY_RUNTIME
 * NO_KNOWLEDGE_GRAPH_RUNTIME
 * NO_BOK_RUNTIME
 * NO_VECTOR_MEMORY_RUNTIME
 * NO_AUTONOMOUS_RETRIEVAL_ENGINE
 * NO_OPAQUE_COMPRESSION_ENGINE
 * NO_GLOBAL_STATE_STORE
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

export const NODE0_CLOSED_LOOP_DIGEST_MOCK_CONSENT =
  "GO: NODE0 CLOSED-LOOP DIGEST MOCK";

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
  "digest_written",
  "digest_published",
  "digest_runtime_active",
  "digest_aggregated",
  "node1_sync",
  "urp_publication",
]);

const FORBIDDEN_OUTPUT_KEYS = [
  "digest_written",
  "digest_published",
  "digest_runtime_active",
  "digest_aggregated",
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

export function createMockNode0ClosedLoopDigest(
  { requireConsent },
  input = loadExampleNode0ClosedLoopDigestInput(),
) {
  if (requireConsent !== NODE0_CLOSED_LOOP_DIGEST_MOCK_CONSENT) {
    throw new Error(
      'CONSENT_REQUIRED: exact "GO: NODE0 CLOSED-LOOP DIGEST MOCK" required',
    );
  }

  if (!input || typeof input !== "object") {
    throw new Error("VALIDATION_FAILED: input must be object");
  }

  // Required per ADR-032 + GO spec
  if (!input.digest_scope) {
    throw new Error("VALIDATION_FAILED: digest_scope required");
  }
  if (
    !input.receipt_review_id ||
    !input.receipt_review_id.startsWith("sha256:")
  ) {
    throw new Error(
      "VALIDATION_FAILED: receipt_review_id must start with sha256:",
    );
  }
  if (
    !input.local_writer_result_id ||
    !input.local_writer_result_id.startsWith("sha256:")
  ) {
    throw new Error(
      "VALIDATION_FAILED: local_writer_result_id must start with sha256:",
    );
  }
  if (!input.air_id || !input.air_id.startsWith("sha256:")) {
    throw new Error("VALIDATION_FAILED: air_id must start with sha256:");
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
  if (
    !input.hybrid_knowledge_boundary_id ||
    !input.hybrid_knowledge_boundary_id.startsWith("sha256:")
  ) {
    throw new Error(
      "VALIDATION_FAILED: hybrid_knowledge_boundary_id must start with sha256:",
    );
  }
  if (!Array.isArray(input.proof_gaps) || input.proof_gaps.length === 0) {
    throw new Error("VALIDATION_FAILED: proof_gaps must be a non-empty array");
  }
  if (
    !Array.isArray(input.still_blocked_invariants) ||
    input.still_blocked_invariants.length === 0
  ) {
    throw new Error(
      "VALIDATION_FAILED: still_blocked_invariants must be a non-empty array",
    );
  }

  // Allowed input fields (from ADR-032 + GO)
  const allowedInput = [
    "digest_scope",
    "receipt_review_id",
    "local_writer_result_id",
    "air_id",
    "state_transition_id",
    "mission_state_id",
    "alignment_boundary_id",
    "hybrid_knowledge_boundary_id",
    "dema_ref",
    "datalake_ref",
    "mission_ref",
    "proof_gaps",
    "still_blocked_invariants",
    "consent_status",
    "review_status",
    "prototype_posture",
  ];
  for (const k of Object.keys(input)) {
    if (!allowedInput.includes(k)) {
      throw new Error(`FORBIDDEN_INPUT: field "${k}" not allowed`);
    }
  }

  // Reject promotion language (skip still_blocked/proof_gaps carriers which legitimately declare negatives)
  const checkInput = { ...input };
  if (checkInput.still_blocked_invariants)
    delete checkInput.still_blocked_invariants;
  if (checkInput.proof_gaps) delete checkInput.proof_gaps;
  const serialized = JSON.stringify(checkInput).toLowerCase();
  for (const term of FORBIDDEN_TERMS) {
    if (serialized.includes(term)) {
      throw new Error(`FORBIDDEN_PROMOTION: detected "${term}"`);
    }
  }

  const now = new Date().toISOString();

  const body = {
    schema: "bizra.node0.closed_loop_digest.v0.1.local",
    node0_digest_boundary_id: null,
    digest_scope:
      input.digest_scope || "NODE0_CLOSED_LOOP_REFERENCE_EXPECTATION",
    receipt_ref: input.receipt_review_id,
    writer_ref: input.local_writer_result_id,
    air_ref: input.air_id,
    mission_state_ref: input.mission_state_id,
    alignment_ref: input.alignment_boundary_id,
    hybrid_knowledge_ref: input.hybrid_knowledge_boundary_id,
    proof_chain_expectation: {
      placeholder: true,
      status: "REFERENCE_EXPECTATION_ONLY",
      digest_runtime_implemented: false,
      digest_writer_implemented: false,
      digest_aggregator_implemented: false,
      closed_loop_runtime_executed: false,
      chain_order_declared: [
        "receipt_review_id",
        "local_writer_result_id",
        "air_id",
        "mission_state_id",
        "alignment_boundary_id",
        "hybrid_knowledge_boundary_id",
      ],
    },
    still_blocked_snapshot: {
      placeholder: true,
      source: "carried_still_blocked_invariants",
      production_scoring: false,
      economic_scoring: false,
      receipt_minting: false,
      public_receipt_writing: false,
      publishing: false,
      bridging: false,
      token_logic: false,
      contracts: false,
      marketplace: false,
      node1: false,
      public_urp_bridge: false,
      shariah_compliance_claim: false,
    },
    proof_gaps: input.proof_gaps,
    still_blocked_invariants: input.still_blocked_invariants,
    created_at: now,
    prototype_posture:
      input.prototype_posture || "[PROTOTYPE] [DESIGNED_NOT_LIVE] LOCAL_ONLY",
  };

  // Deterministic id excludes created_at (and audit fields)
  const identityBody = Object.fromEntries(
    Object.entries(body).filter(([key]) => key !== "created_at"),
  );
  const canonical = JSON.stringify(
    identityBody,
    Object.keys(identityBody).sort(),
  );
  const node0_digest_boundary_id =
    "sha256:" +
    createHash("sha256")
      .update(canonical + NODE0_CLOSED_LOOP_DIGEST_MOCK_CONSENT)
      .digest("hex");

  body.node0_digest_boundary_id = node0_digest_boundary_id;

  // Final safety: no forbidden output keys
  for (const fk of FORBIDDEN_OUTPUT_KEYS) {
    if (fk in body) {
      throw new Error(`FORBIDDEN_OUTPUT: ${fk} must never be present`);
    }
  }

  return body;
}

export function loadExampleNode0ClosedLoopDigestInput() {
  return {
    digest_scope: "NODE0_CLOSED_LOOP_REFERENCE_EXPECTATION",
    receipt_review_id: "sha256:receipt-review-ex-g50",
    local_writer_result_id: "sha256:local-writer-result-ex-g31",
    air_id: "sha256:air-lifecycle-ex-g35",
    state_transition_id: "sha256:state-transition-ex-g39",
    mission_state_id: "sha256:mission-state-ex-g39",
    alignment_boundary_id: "sha256:alignment-boundary-ex-g43",
    hybrid_knowledge_boundary_id: "sha256:hybrid-knowledge-ex-g47",
    dema_ref: "sha256:dema-face-ref",
    datalake_ref: "datalake-body-ref:pat7-sat5-fate-urp-layers",
    mission_ref: "mission-ex-001",
    proof_gaps: [
      "GAP_NODE0_CLOSED_LOOP_DIGEST_NOT_IMPLEMENTED",
      "GAP_REFERENCE_EXPECTATION_ONLY",
      "GAP_NO_DIGEST_RUNTIME",
      "GAP_NO_PUBLIC_ACTIVATION",
    ],
    still_blocked_invariants: [
      "NO_PRODUCTION_SCORING",
      "NO_ECONOMIC_SCORING",
      "NO_RECEIPT_MINTING",
      "NO_PUBLIC_RECEIPT_WRITING",
      "NO_PUBLISHING",
      "NO_BRIDGING",
      "NO_NODE1",
      "NO_SHARIAH_COMPLIANCE_CLAIM",
    ],
    consent_status: "required",
    review_status: "boundary_local_only",
    prototype_posture: "[PROTOTYPE] [DESIGNED_NOT_LIVE] LOCAL_ONLY",
  };
}

// Self-test (executes when run directly: node scripts/node0-closed-loop-digest-mock.mjs)
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("--- BIZRA G51: NODE0 CLOSED-LOOP DIGEST MOCK SELF-TEST ---");
  try {
    const base = loadExampleNode0ClosedLoopDigestInput();

    // 1. creates a local Node0 digest envelope with sha256 node0_digest_boundary_id
    const r1 = createMockNode0ClosedLoopDigest(
      { requireConsent: NODE0_CLOSED_LOOP_DIGEST_MOCK_CONSENT },
      base,
    );
    console.log(
      "1. creates local envelope: node0_digest_boundary_id=",
      (r1.node0_digest_boundary_id || "").substring(0, 30) + "...",
    );

    // 2. requires exact consent
    try {
      createMockNode0ClosedLoopDigest({ requireConsent: "WRONG" }, base);
      throw new Error("should have thrown");
    } catch (e) {
      if (!e.message.includes("CONSENT_REQUIRED")) throw e;
      console.log("2. rejects missing exact consent");
    }

    // 3. requires digest_scope
    try {
      const bad = { ...base };
      delete bad.digest_scope;
      createMockNode0ClosedLoopDigest(
        { requireConsent: NODE0_CLOSED_LOOP_DIGEST_MOCK_CONSENT },
        bad,
      );
      throw new Error("should have thrown");
    } catch (e) {
      if (!e.message.includes("digest_scope")) throw e;
      console.log("3. requires digest_scope");
    }

    // 4. requires receipt_review_id sha256 reference
    try {
      const bad = { ...base };
      bad.receipt_review_id = "not-sha256";
      createMockNode0ClosedLoopDigest(
        { requireConsent: NODE0_CLOSED_LOOP_DIGEST_MOCK_CONSENT },
        bad,
      );
      throw new Error("should have thrown");
    } catch (e) {
      if (!e.message.includes("receipt_review_id")) throw e;
      console.log("4. requires receipt_review_id sha256 reference");
    }

    // 5. requires local_writer_result_id sha256 reference
    try {
      const bad = { ...base };
      bad.local_writer_result_id = "not-sha256";
      createMockNode0ClosedLoopDigest(
        { requireConsent: NODE0_CLOSED_LOOP_DIGEST_MOCK_CONSENT },
        bad,
      );
      throw new Error("should have thrown");
    } catch (e) {
      if (!e.message.includes("local_writer_result_id")) throw e;
      console.log("5. requires local_writer_result_id sha256 reference");
    }

    // 6. requires air_id sha256 reference
    try {
      const bad = { ...base };
      bad.air_id = "not-sha256";
      createMockNode0ClosedLoopDigest(
        { requireConsent: NODE0_CLOSED_LOOP_DIGEST_MOCK_CONSENT },
        bad,
      );
      throw new Error("should have thrown");
    } catch (e) {
      if (!e.message.includes("air_id")) throw e;
      console.log("6. requires air_id sha256 reference");
    }

    // 7. requires mission_state_id sha256 reference
    try {
      const bad = { ...base };
      bad.mission_state_id = "not-sha256";
      createMockNode0ClosedLoopDigest(
        { requireConsent: NODE0_CLOSED_LOOP_DIGEST_MOCK_CONSENT },
        bad,
      );
      throw new Error("should have thrown");
    } catch (e) {
      if (!e.message.includes("mission_state_id")) throw e;
      console.log("7. requires mission_state_id sha256 reference");
    }

    // 8. requires alignment_boundary_id and hybrid_knowledge_boundary_id sha256 references
    try {
      const bad = { ...base };
      bad.alignment_boundary_id = "not-sha256";
      createMockNode0ClosedLoopDigest(
        { requireConsent: NODE0_CLOSED_LOOP_DIGEST_MOCK_CONSENT },
        bad,
      );
      throw new Error("should have thrown");
    } catch (e) {
      if (!e.message.includes("alignment_boundary_id")) throw e;
      console.log("8. requires alignment + hybrid sha256 references");
    }

    // 9. declares proof-chain expectation without digest runtime, writer, aggregator, or closed-loop execution
    const hasChain =
      r1.proof_chain_expectation &&
      r1.proof_chain_expectation.placeholder === true &&
      r1.proof_chain_expectation.digest_runtime_implemented === false &&
      r1.proof_chain_expectation.digest_writer_implemented === false &&
      r1.proof_chain_expectation.digest_aggregator_implemented === false &&
      r1.proof_chain_expectation.closed_loop_runtime_executed === false &&
      Array.isArray(r1.proof_chain_expectation.chain_order_declared);
    console.log(
      "9. declares proof-chain expectation without runtime/writer/aggregator/closed-loop:",
      hasChain,
    );

    // 10. declares still-blocked snapshot without public/economic activation
    const hasBlocked =
      r1.still_blocked_snapshot &&
      r1.still_blocked_snapshot.placeholder === true &&
      r1.still_blocked_snapshot.production_scoring === false &&
      r1.still_blocked_snapshot.economic_scoring === false &&
      r1.still_blocked_snapshot.receipt_minting === false &&
      r1.still_blocked_snapshot.public_receipt_writing === false &&
      r1.still_blocked_snapshot.publishing === false;
    console.log(
      "10. declares still-blocked snapshot without public/economic activation:",
      hasBlocked,
    );

    // 11. rejects forbidden digest/runtime/economic/public fields
    const badForbidden = { ...base, digest_runtime_active: true };
    try {
      createMockNode0ClosedLoopDigest(
        { requireConsent: NODE0_CLOSED_LOOP_DIGEST_MOCK_CONSENT },
        badForbidden,
      );
      throw new Error("should have thrown");
    } catch (e) {
      if (!e.message.includes("FORBIDDEN")) throw e;
      console.log(
        "11. rejects forbidden digest/runtime/economic/public fields",
      );
    }

    // 12. deterministic node0_digest_boundary_id for same semantic input excluding created_at
    const r12a = createMockNode0ClosedLoopDigest(
      { requireConsent: NODE0_CLOSED_LOOP_DIGEST_MOCK_CONSENT },
      base,
    );
    const r12b = createMockNode0ClosedLoopDigest(
      { requireConsent: NODE0_CLOSED_LOOP_DIGEST_MOCK_CONSENT },
      base,
    );
    console.log(
      "12. deterministic node0_digest_boundary_id (excl created_at):",
      r12a.node0_digest_boundary_id === r12b.node0_digest_boundary_id,
    );

    console.log(
      "G51 self-test PASS (local mock, consented, required refs, placeholders, deterministic, no forbidden).",
    );
    process.exit(0);
  } catch (e) {
    console.error("G51 SELF-TEST FAIL:", e.message);
    process.exit(1);
  }
}
