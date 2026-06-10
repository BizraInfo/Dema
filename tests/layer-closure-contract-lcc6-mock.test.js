/**
 * ADR-033 Layer Closure Contract LCC-6 Mock - Tests (G55)
 * [PROTOTYPE] [DESIGNED_NOT_LIVE]
 * LOCAL_ONLY
 *
 * Tests exercise the local Layer Closure Contract LCC-6 mock envelope.
 * No LCC runtime, LCC registry writer, LCC aggregator, automatic layer closure engine,
 * delivery-check rewrite engine, claim-map writer, remote witness collector,
 * digest runtime, digest writer, digest aggregator, closed-loop runtime execution,
 * Dema/Data-Lake runtime sync, Data Lake mutation, cross-repo write, API bridge,
 * filesystem bridge outside Dema, PAT/SAT/FATE runtime invocation, Node1 activation,
 * AIR runtime expansion, mission memory runtime, hybrid memory runtime, knowledge
 * graph runtime, Body of Knowledge runtime, vector memory, autonomous retrieval,
 * opaque compression, global state store, receipt minting, public receipt writing,
 * publishing, bridging, reward authorization, reward logic, token logic, contracts,
 * marketplace, public economic copy, or Shariah-compliance claims.
 *
 * NO_LCC_RUNTIME
 * NO_LCC_REGISTRY_WRITER
 * NO_LCC_AGGREGATOR
 * NO_AUTOMATIC_LAYER_CLOSURE_ENGINE
 * NO_DELIVERY_CHECK_REWRITE_ENGINE
 * NO_CLAIM_MAP_WRITER
 * NO_REMOTE_WITNESS_COLLECTOR
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
  createMockLayerClosureContractLcc6,
  loadExampleLayerClosureContractLcc6Input,
  LAYER_CLOSURE_CONTRACT_LCC6_MOCK_CONSENT,
} from "../scripts/layer-closure-contract-lcc6-mock.mjs";

// 1. creates a local LCC-6 envelope with sha256 lcc6_boundary_id
test("creates a local LCC-6 envelope with sha256 lcc6_boundary_id", () => {
  const input = loadExampleLayerClosureContractLcc6Input();
  const env = createMockLayerClosureContractLcc6(
    { requireConsent: LAYER_CLOSURE_CONTRACT_LCC6_MOCK_CONSENT },
    input,
  );
  assert.ok(
    env.lcc6_boundary_id && env.lcc6_boundary_id.startsWith("sha256:"),
    "creates envelope with sha256 lcc6_boundary_id [DECLARED]",
  );
});

// 2. requires exact consent
test("requires exact consent", () => {
  const input = loadExampleLayerClosureContractLcc6Input();
  assert.throws(
    () =>
      createMockLayerClosureContractLcc6({ requireConsent: "WRONG" }, input),
    /CONSENT_REQUIRED/,
    "rejects missing exact consent [DECLARED]",
  );
});

// 3. requires layer_id
test("requires layer_id", () => {
  const input = loadExampleLayerClosureContractLcc6Input();
  const bad = { ...input };
  delete bad.layer_id;
  assert.throws(
    () =>
      createMockLayerClosureContractLcc6(
        { requireConsent: LAYER_CLOSURE_CONTRACT_LCC6_MOCK_CONSENT },
        bad,
      ),
    /layer_id/,
    "requires layer_id [DECLARED]",
  );
});

// 4. requires layer_name
test("requires layer_name", () => {
  const input = loadExampleLayerClosureContractLcc6Input();
  const bad = { ...input };
  delete bad.layer_name;
  assert.throws(
    () =>
      createMockLayerClosureContractLcc6(
        { requireConsent: LAYER_CLOSURE_CONTRACT_LCC6_MOCK_CONSENT },
        bad,
      ),
    /layer_name/,
    "requires layer_name [DECLARED]",
  );
});

// 5. requires boundary_ref
test("requires boundary_ref", () => {
  const input = loadExampleLayerClosureContractLcc6Input();
  const bad = { ...input };
  delete bad.boundary_ref;
  assert.throws(
    () =>
      createMockLayerClosureContractLcc6(
        { requireConsent: LAYER_CLOSURE_CONTRACT_LCC6_MOCK_CONSENT },
        bad,
      ),
    /boundary_ref/,
    "requires boundary_ref [DECLARED]",
  );
});

// 6. requires schema_ref
test("requires schema_ref", () => {
  const input = loadExampleLayerClosureContractLcc6Input();
  const bad = { ...input };
  delete bad.schema_ref;
  assert.throws(
    () =>
      createMockLayerClosureContractLcc6(
        { requireConsent: LAYER_CLOSURE_CONTRACT_LCC6_MOCK_CONSENT },
        bad,
      ),
    /schema_ref/,
    "requires schema_ref [DECLARED]",
  );
});

// 7. requires test_scaffold_ref and delivery_check_marker
test("requires test_scaffold_ref and delivery_check_marker", () => {
  const input = loadExampleLayerClosureContractLcc6Input();
  const bad = { ...input };
  delete bad.test_scaffold_ref;
  assert.throws(
    () =>
      createMockLayerClosureContractLcc6(
        { requireConsent: LAYER_CLOSURE_CONTRACT_LCC6_MOCK_CONSENT },
        bad,
      ),
    /test_scaffold_ref/,
    "requires test_scaffold_ref and delivery_check_marker [DECLARED]",
  );
});

// 8. requires remote_witness_condition to equal four_exact_head_rails_completed_success
test("requires remote_witness_condition to equal four_exact_head_rails_completed_success", () => {
  const input = loadExampleLayerClosureContractLcc6Input();
  const bad = { ...input };
  bad.remote_witness_condition = "wrong_value";
  assert.throws(
    () =>
      createMockLayerClosureContractLcc6(
        { requireConsent: LAYER_CLOSURE_CONTRACT_LCC6_MOCK_CONSENT },
        bad,
      ),
    /remote_witness_condition/,
    "requires remote_witness_condition to equal four_exact_head_rails_completed_success [DECLARED]",
  );
});

// 9. declares six LCC-6 references without LCC runtime, registry writer, aggregator, automatic closure, delivery rewrite, claim writer, or witness collector
test("declares six LCC-6 references without LCC runtime, registry writer, aggregator, automatic closure, delivery rewrite, claim writer, or witness collector", () => {
  const input = loadExampleLayerClosureContractLcc6Input();
  const env = createMockLayerClosureContractLcc6(
    { requireConsent: LAYER_CLOSURE_CONTRACT_LCC6_MOCK_CONSENT },
    input,
  );
  const hasContract =
    env.lcc6_contract &&
    env.lcc6_contract.placeholder === true &&
    env.lcc6_contract.status === "REFERENCE_EXPECTATION_ONLY" &&
    env.lcc6_contract.lcc_runtime_implemented === false &&
    env.lcc6_contract.lcc_registry_writer_implemented === false &&
    env.lcc6_contract.lcc_aggregator_implemented === false &&
    env.lcc6_contract.automatic_layer_closure_engine_implemented === false &&
    env.lcc6_contract.delivery_check_rewrite_engine_implemented === false &&
    env.lcc6_contract.claim_map_writer_implemented === false &&
    env.lcc6_contract.remote_witness_collector_implemented === false;
  assert.ok(
    hasContract,
    "declares six LCC-6 references without runtime/registry/aggregator/closure/rewrite/claim/witness [DECLARED]",
  );
});

// 10. declares still-blocked snapshot without public/economic activation
test("declares still-blocked snapshot without public/economic activation", () => {
  const input = loadExampleLayerClosureContractLcc6Input();
  const env = createMockLayerClosureContractLcc6(
    { requireConsent: LAYER_CLOSURE_CONTRACT_LCC6_MOCK_CONSENT },
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

// 11. rejects forbidden LCC/runtime/economic/public fields
test("rejects forbidden LCC/runtime/economic/public fields", () => {
  const input = loadExampleLayerClosureContractLcc6Input();
  const bad = { ...input, lcc_runtime_active: true };
  assert.throws(
    () =>
      createMockLayerClosureContractLcc6(
        { requireConsent: LAYER_CLOSURE_CONTRACT_LCC6_MOCK_CONSENT },
        bad,
      ),
    /FORBIDDEN/,
    "rejects forbidden fields [DECLARED]",
  );
});

// 12. deterministic lcc6_boundary_id for same semantic input excluding created_at
test("deterministic lcc6_boundary_id for same semantic input excluding created_at", () => {
  const input = loadExampleLayerClosureContractLcc6Input();
  const r1 = createMockLayerClosureContractLcc6(
    { requireConsent: LAYER_CLOSURE_CONTRACT_LCC6_MOCK_CONSENT },
    input,
  );
  const r2 = createMockLayerClosureContractLcc6(
    { requireConsent: LAYER_CLOSURE_CONTRACT_LCC6_MOCK_CONSENT },
    input,
  );
  assert.strictEqual(
    r1.lcc6_boundary_id,
    r2.lcc6_boundary_id,
    "deterministic lcc6_boundary_id (excl created_at) [DECLARED]",
  );
});
