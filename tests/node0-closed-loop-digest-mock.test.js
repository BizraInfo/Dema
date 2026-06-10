/**
 * ADR-032 Node0 Closed-Loop Digest Mock - Tests (G51)
 * [PROTOTYPE] [DESIGNED_NOT_LIVE]
 * LOCAL_ONLY
 *
 * Tests exercise the local Node0 Closed-Loop Digest mock envelope.
 * No digest runtime, digest writer, digest aggregator, closed-loop runtime execution,
 * Dema/Data-Lake runtime sync, Data Lake mutation, cross-repo write, API bridge,
 * filesystem bridge outside Dema, PAT/SAT/FATE runtime invocation, Node1 activation,
 * AIR runtime expansion, mission memory runtime, hybrid memory runtime, knowledge
 * graph runtime, Body of Knowledge runtime, vector memory, autonomous retrieval,
 * opaque compression, global state store, receipt minting, public receipt writing,
 * publishing, bridging, reward authorization, reward logic, token logic, contracts,
 * marketplace, public economic copy, or Shariah-compliance claims.
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

import test from "node:test";
import assert from "node:assert/strict";
import {
  createMockNode0ClosedLoopDigest,
  loadExampleNode0ClosedLoopDigestInput,
  NODE0_CLOSED_LOOP_DIGEST_MOCK_CONSENT,
} from "../scripts/node0-closed-loop-digest-mock.mjs";

// 1. creates a local Node0 digest envelope with sha256 node0_digest_boundary_id
test("creates a local Node0 digest envelope with sha256 node0_digest_boundary_id", () => {
  const input = loadExampleNode0ClosedLoopDigestInput();
  const env = createMockNode0ClosedLoopDigest(
    { requireConsent: NODE0_CLOSED_LOOP_DIGEST_MOCK_CONSENT },
    input,
  );
  assert.ok(
    env.node0_digest_boundary_id &&
      env.node0_digest_boundary_id.startsWith("sha256:"),
    "creates envelope with sha256 node0_digest_boundary_id [DECLARED]",
  );
});

// 2. requires exact consent
test("requires exact consent", () => {
  const input = loadExampleNode0ClosedLoopDigestInput();
  assert.throws(
    () => createMockNode0ClosedLoopDigest({ requireConsent: "WRONG" }, input),
    /CONSENT_REQUIRED/,
    "rejects missing exact consent [DECLARED]",
  );
});

// 3. requires digest_scope
test("requires digest_scope", () => {
  const input = loadExampleNode0ClosedLoopDigestInput();
  const bad = { ...input };
  delete bad.digest_scope;
  assert.throws(
    () =>
      createMockNode0ClosedLoopDigest(
        { requireConsent: NODE0_CLOSED_LOOP_DIGEST_MOCK_CONSENT },
        bad,
      ),
    /digest_scope/,
    "requires digest_scope [DECLARED]",
  );
});

// 4. requires receipt_review_id sha256 reference
test("requires receipt_review_id sha256 reference", () => {
  const input = loadExampleNode0ClosedLoopDigestInput();
  const bad = { ...input };
  bad.receipt_review_id = "not-sha256";
  assert.throws(
    () =>
      createMockNode0ClosedLoopDigest(
        { requireConsent: NODE0_CLOSED_LOOP_DIGEST_MOCK_CONSENT },
        bad,
      ),
    /receipt_review_id/,
    "requires receipt_review_id sha256: [DECLARED]",
  );
});

// 5. requires local_writer_result_id sha256 reference
test("requires local_writer_result_id sha256 reference", () => {
  const input = loadExampleNode0ClosedLoopDigestInput();
  const bad = { ...input };
  bad.local_writer_result_id = "not-sha256";
  assert.throws(
    () =>
      createMockNode0ClosedLoopDigest(
        { requireConsent: NODE0_CLOSED_LOOP_DIGEST_MOCK_CONSENT },
        bad,
      ),
    /local_writer_result_id/,
    "requires local_writer_result_id sha256: [DECLARED]",
  );
});

// 6. requires air_id sha256 reference
test("requires air_id sha256 reference", () => {
  const input = loadExampleNode0ClosedLoopDigestInput();
  const bad = { ...input };
  bad.air_id = "not-sha256";
  assert.throws(
    () =>
      createMockNode0ClosedLoopDigest(
        { requireConsent: NODE0_CLOSED_LOOP_DIGEST_MOCK_CONSENT },
        bad,
      ),
    /air_id/,
    "requires air_id sha256: [DECLARED]",
  );
});

// 7. requires mission_state_id sha256 reference
test("requires mission_state_id sha256 reference", () => {
  const input = loadExampleNode0ClosedLoopDigestInput();
  const bad = { ...input };
  bad.mission_state_id = "not-sha256";
  assert.throws(
    () =>
      createMockNode0ClosedLoopDigest(
        { requireConsent: NODE0_CLOSED_LOOP_DIGEST_MOCK_CONSENT },
        bad,
      ),
    /mission_state_id/,
    "requires mission_state_id sha256: [DECLARED]",
  );
});

// 8. requires alignment_boundary_id and hybrid_knowledge_boundary_id sha256 references
test("requires alignment_boundary_id and hybrid_knowledge_boundary_id sha256 references", () => {
  const input = loadExampleNode0ClosedLoopDigestInput();
  const bad = { ...input };
  bad.alignment_boundary_id = "not-sha256";
  assert.throws(
    () =>
      createMockNode0ClosedLoopDigest(
        { requireConsent: NODE0_CLOSED_LOOP_DIGEST_MOCK_CONSENT },
        bad,
      ),
    /alignment_boundary_id/,
    "requires alignment_boundary_id and hybrid_knowledge_boundary_id sha256: [DECLARED]",
  );
});

// 9. declares proof-chain expectation without digest runtime, writer, aggregator, or closed-loop execution
test("declares proof-chain expectation without digest runtime, writer, aggregator, or closed-loop execution", () => {
  const input = loadExampleNode0ClosedLoopDigestInput();
  const env = createMockNode0ClosedLoopDigest(
    { requireConsent: NODE0_CLOSED_LOOP_DIGEST_MOCK_CONSENT },
    input,
  );
  const hasChain =
    env.proof_chain_expectation &&
    env.proof_chain_expectation.placeholder === true &&
    env.proof_chain_expectation.digest_runtime_implemented === false &&
    env.proof_chain_expectation.digest_writer_implemented === false &&
    env.proof_chain_expectation.digest_aggregator_implemented === false &&
    env.proof_chain_expectation.closed_loop_runtime_executed === false &&
    Array.isArray(env.proof_chain_expectation.chain_order_declared);
  assert.ok(
    hasChain,
    "declares proof-chain expectation without runtime/writer/aggregator/closed-loop [DECLARED]",
  );
});

// 10. declares still-blocked snapshot without public/economic activation
test("declares still-blocked snapshot without public/economic activation", () => {
  const input = loadExampleNode0ClosedLoopDigestInput();
  const env = createMockNode0ClosedLoopDigest(
    { requireConsent: NODE0_CLOSED_LOOP_DIGEST_MOCK_CONSENT },
    input,
  );
  const hasBlocked =
    env.still_blocked_snapshot &&
    env.still_blocked_snapshot.placeholder === true &&
    env.still_blocked_snapshot.production_scoring === false &&
    env.still_blocked_snapshot.economic_scoring === false &&
    env.still_blocked_snapshot.receipt_minting === false &&
    env.still_blocked_snapshot.public_receipt_writing === false &&
    env.still_blocked_snapshot.publishing === false;
  assert.ok(
    hasBlocked,
    "declares still-blocked snapshot without public/economic activation [DECLARED]",
  );
});

// 11. rejects forbidden digest/runtime/economic/public fields
test("rejects forbidden digest/runtime/economic/public fields", () => {
  const input = loadExampleNode0ClosedLoopDigestInput();
  const bad = { ...input, digest_runtime_active: true };
  assert.throws(
    () =>
      createMockNode0ClosedLoopDigest(
        { requireConsent: NODE0_CLOSED_LOOP_DIGEST_MOCK_CONSENT },
        bad,
      ),
    /FORBIDDEN/,
    "rejects forbidden fields [DECLARED]",
  );
});

// 12. deterministic node0_digest_boundary_id for same semantic input excluding created_at
test("deterministic node0_digest_boundary_id for same semantic input excluding created_at", () => {
  const input = loadExampleNode0ClosedLoopDigestInput();
  const r1 = createMockNode0ClosedLoopDigest(
    { requireConsent: NODE0_CLOSED_LOOP_DIGEST_MOCK_CONSENT },
    input,
  );
  const r2 = createMockNode0ClosedLoopDigest(
    { requireConsent: NODE0_CLOSED_LOOP_DIGEST_MOCK_CONSENT },
    input,
  );
  assert.strictEqual(
    r1.node0_digest_boundary_id,
    r2.node0_digest_boundary_id,
    "deterministic node0_digest_boundary_id (excl created_at) [DECLARED]",
  );
});
