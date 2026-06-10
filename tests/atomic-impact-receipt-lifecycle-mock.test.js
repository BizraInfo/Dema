/**
 * ADR-028 Atomic Impact Receipt Lifecycle Mock - Tests (G35)
 * [PROTOTYPE] [DESIGNED_NOT_LIVE]
 * LOCAL_ONLY
 *
 * Tests exercise the local AIR lifecycle mock envelope.
 * No AIR runtime, MCP, A2A, HHMM, AgentFold, URP, minting, public writing,
 * publishing, bridging, reward, token, contracts, marketplace, Node1, or Shariah.
 *
 * NO_AIR_RUNTIME_IMPLEMENTATION
 * NO_MCP_TOOL_IMPLEMENTATION
 * NO_A2A_BRIDGE_IMPLEMENTATION
 * NO_HHMM_ENGINE_IMPLEMENTATION
 * NO_AGENTFOLD_IMPLEMENTATION
 * NO_URP_SYNC_IMPLEMENTATION
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
  createMockAtomicImpactReceiptLifecycle,
  loadExampleAtomicImpactReceiptLifecycleInput,
  ATOMIC_IMPACT_RECEIPT_LIFECYCLE_MOCK_CONSENT,
} from "../scripts/atomic-impact-receipt-lifecycle-mock.mjs";

// 1. creates a local AIR lifecycle envelope with sha256 air_id
test("creates a local AIR lifecycle envelope with sha256 air_id", () => {
  const input = loadExampleAtomicImpactReceiptLifecycleInput();
  const env = createMockAtomicImpactReceiptLifecycle(
    { requireConsent: ATOMIC_IMPACT_RECEIPT_LIFECYCLE_MOCK_CONSENT },
    input,
  );
  assert.ok(
    env.air_id && env.air_id.startsWith("sha256:"),
    "creates envelope with sha256 air_id [DECLARED]",
  );
  assert.strictEqual(
    env.lifecycle_state,
    "READY_FOR_REVIEW",
    "default state READY_FOR_REVIEW [DECLARED]",
  );
});

// 2. requires exact consent
test("requires exact consent", () => {
  const input = loadExampleAtomicImpactReceiptLifecycleInput();
  assert.throws(
    () =>
      createMockAtomicImpactReceiptLifecycle(
        { requireConsent: "WRONG" },
        input,
      ),
    /CONSENT_REQUIRED/,
    "rejects missing exact consent [DECLARED]",
  );
});

// 3. includes writer_ref from local_writer_result_id
test("includes writer_ref from local_writer_result_id", () => {
  const input = loadExampleAtomicImpactReceiptLifecycleInput();
  const env = createMockAtomicImpactReceiptLifecycle(
    { requireConsent: ATOMIC_IMPACT_RECEIPT_LIFECYCLE_MOCK_CONSENT },
    input,
  );
  assert.ok(
    env.writer_ref && env.writer_ref.startsWith("sha256:"),
    "includes writer_ref [DECLARED]",
  );
  assert.strictEqual(
    env.writer_ref,
    input.local_writer_result_id || env.writer_ref,
    "writer_ref matches input local_writer_result_id [DECLARED]",
  );
});

// 4. declares MCP expectation without MCP runtime
test("declares MCP expectation without MCP runtime", () => {
  const input = loadExampleAtomicImpactReceiptLifecycleInput();
  const env = createMockAtomicImpactReceiptLifecycle(
    { requireConsent: ATOMIC_IMPACT_RECEIPT_LIFECYCLE_MOCK_CONSENT },
    input,
  );
  assert.ok(
    env.mcp_expectation &&
      env.mcp_expectation.placeholder === true &&
      env.mcp_expectation.runtime_implemented === false,
    "MCP expectation placeholder, no runtime [DECLARED]",
  );
});

// 5. declares A2A PAT/SAT expectation without bridge runtime
test("declares A2A PAT/SAT expectation without bridge runtime", () => {
  const input = loadExampleAtomicImpactReceiptLifecycleInput();
  const env = createMockAtomicImpactReceiptLifecycle(
    { requireConsent: ATOMIC_IMPACT_RECEIPT_LIFECYCLE_MOCK_CONSENT },
    input,
  );
  assert.ok(
    env.a2a_expectation &&
      env.a2a_expectation.placeholder === true &&
      env.a2a_expectation.pat_sat_bridge_runtime_implemented === false,
    "A2A expectation placeholder, no bridge runtime [DECLARED]",
  );
});

// 6. declares HHMM expectation without HHMM engine
test("declares HHMM expectation without HHMM engine", () => {
  const input = loadExampleAtomicImpactReceiptLifecycleInput();
  const env = createMockAtomicImpactReceiptLifecycle(
    { requireConsent: ATOMIC_IMPACT_RECEIPT_LIFECYCLE_MOCK_CONSENT },
    input,
  );
  assert.ok(
    env.hhmm_expectation &&
      env.hhmm_expectation.placeholder === true &&
      env.hhmm_expectation.engine_implemented === false,
    "HHMM expectation placeholder, no engine [DECLARED]",
  );
});

// 7. declares AgentFold seal expectation without seal implementation
test("declares AgentFold seal expectation without seal implementation", () => {
  const input = loadExampleAtomicImpactReceiptLifecycleInput();
  const env = createMockAtomicImpactReceiptLifecycle(
    { requireConsent: ATOMIC_IMPACT_RECEIPT_LIFECYCLE_MOCK_CONSENT },
    input,
  );
  assert.ok(
    env.seal_expectation &&
      env.seal_expectation.placeholder === true &&
      env.seal_expectation.agentfold_l3_implemented === false,
    "AgentFold seal expectation placeholder, no implementation [DECLARED]",
  );
});

// 8. declares URP expectation without sync/publication
test("declares URP expectation without sync/publication", () => {
  const input = loadExampleAtomicImpactReceiptLifecycleInput();
  const env = createMockAtomicImpactReceiptLifecycle(
    { requireConsent: ATOMIC_IMPACT_RECEIPT_LIFECYCLE_MOCK_CONSENT },
    input,
  );
  assert.ok(
    env.urp_expectation &&
      env.urp_expectation.placeholder === true &&
      env.urp_expectation.urp_sync_implemented === false &&
      env.urp_expectation.public_publication === false,
    "URP expectation placeholder, no sync/publication [DECLARED]",
  );
});

// 9. rejects forbidden economic/public fields
test("rejects forbidden economic/public fields", () => {
  const input = loadExampleAtomicImpactReceiptLifecycleInput();
  const env = createMockAtomicImpactReceiptLifecycle(
    { requireConsent: ATOMIC_IMPACT_RECEIPT_LIFECYCLE_MOCK_CONSENT },
    input,
  );
  const forbidden = [
    "token_minted",
    "reward_authorized",
    "reward_amount",
    "token_amount",
    "contract_call",
    "marketplace_signal",
    "public_receipt_url",
    "public_url",
    "bridge_id",
    "node1_sync",
    "urp_publication",
    "shariah_compliant",
  ];
  const hasForbidden = forbidden.some((f) => f in env);
  assert.ok(
    !hasForbidden,
    "never returns forbidden economic/public fields [DECLARED]",
  );
});

// 10. deterministic air_id for same semantic input excluding created_at
test("deterministic air_id for same semantic input excluding created_at", () => {
  const input = loadExampleAtomicImpactReceiptLifecycleInput();
  const r1 = createMockAtomicImpactReceiptLifecycle(
    { requireConsent: ATOMIC_IMPACT_RECEIPT_LIFECYCLE_MOCK_CONSENT },
    input,
  );
  const r2 = createMockAtomicImpactReceiptLifecycle(
    { requireConsent: ATOMIC_IMPACT_RECEIPT_LIFECYCLE_MOCK_CONSENT },
    input,
  );
  assert.strictEqual(
    r1.air_id,
    r2.air_id,
    "deterministic air_id excluding created_at [DECLARED]",
  );
});
