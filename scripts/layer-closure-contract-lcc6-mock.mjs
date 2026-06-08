/**
 * ADR-033 Layer Closure Contract LCC-6 Mock (G55)
 * [PROTOTYPE]
 * [DESIGNED_NOT_LIVE]
 * LOCAL_ONLY
 *
 * Local Layer Closure Contract LCC-6 mock envelope only.
 * Produces a reference/expectation object for the six-part maintainability contract:
 * boundary_ref -> schema_ref -> test_scaffold_ref -> delivery_check_marker
 * -> claim_map_status -> remote_witness_condition.
 * No LCC runtime, LCC registry writer, LCC aggregator, automatic layer closure engine,
 * delivery-check rewrite engine, claim-map writer, remote witness collector,
 * digest runtime, digest writer, digest aggregator, closed-loop runtime execution,
 * Dema/Data-Lake runtime sync, Data Lake mutation, cross-repo writes, API bridge,
 * filesystem bridge outside Dema, PAT runtime invocation, SAT runtime invocation,
 * FATE runtime invocation, URP sync, Node1 activation, AIR runtime expansion,
 * mission memory runtime, hybrid memory runtime, knowledge graph runtime,
 * Body of Knowledge runtime, vector memory runtime, autonomous retrieval engine,
 * opaque compression engine, global state store, receipt minting, public receipt
 * writing, publishing, bridging, reward authorization, reward logic, token logic,
 * contracts, marketplace, public economic copy, or Shariah-compliance claims.
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

import { createHash } from 'node:crypto';

export const LAYER_CLOSURE_CONTRACT_LCC6_MOCK_CONSENT = 'GO: LAYER CLOSURE CONTRACT LCC-6 MOCK';

const FORBIDDEN_TERMS = new Set([
  'mint', 'publish', 'bridge', 'reward_authorized', 'token', 'contract',
  'marketplace', 'Node1', 'URP', 'Shariah', 'guaranteed', 'payout',
  'claimable', 'earn', 'authorized', 'transferable', 'public_url', 'public',
  'vector_memory', 'autonomous_retrieval', 'opaque_compression',
  'global_state_store', 'automatic_context_rewriting', 'datalake_mutation',
  'cross_repo_write', 'runtime_sync', 'pat_runtime', 'sat_runtime',
  'fate_runtime', 'lcc_runtime_active', 'registry_written', 'aggregation_performed',
  'automatic_closure_performed', 'delivery_check_rewritten', 'claim_map_written',
  'remote_witness_collected'
]);

const FORBIDDEN_OUTPUT_KEYS = [
  'lcc_runtime_active',
  'registry_written',
  'aggregation_performed',
  'automatic_closure_performed',
  'delivery_check_rewritten',
  'claim_map_written',
  'remote_witness_collected',
  'datalake_synced',
  'cross_repo_write_performed',
  'runtime_bridge_active',
  'node1_sync',
  'urp_publication',
  'token_minted',
  'reward_authorized',
  'contract_call',
  'marketplace_signal',
  'public_receipt_url',
  'shariah_compliant'
];

export function createMockLayerClosureContractLcc6({ requireConsent }, input = loadExampleLayerClosureContractLcc6Input()) {
  if (requireConsent !== LAYER_CLOSURE_CONTRACT_LCC6_MOCK_CONSENT) {
    throw new Error('CONSENT_REQUIRED: exact "GO: LAYER CLOSURE CONTRACT LCC-6 MOCK" required');
  }

  if (!input || typeof input !== 'object') {
    throw new Error('VALIDATION_FAILED: input must be object');
  }

  // Required per ADR-033 + GO spec
  if (!input.layer_id) {
    throw new Error('VALIDATION_FAILED: layer_id required');
  }
  if (!input.layer_name) {
    throw new Error('VALIDATION_FAILED: layer_name required');
  }
  if (!input.boundary_ref) {
    throw new Error('VALIDATION_FAILED: boundary_ref required');
  }
  if (!input.schema_ref) {
    throw new Error('VALIDATION_FAILED: schema_ref required');
  }
  if (!input.test_scaffold_ref) {
    throw new Error('VALIDATION_FAILED: test_scaffold_ref required');
  }
  if (!input.delivery_check_marker) {
    throw new Error('VALIDATION_FAILED: delivery_check_marker required');
  }
  if (!input.claim_map_status) {
    throw new Error('VALIDATION_FAILED: claim_map_status required');
  }
  if (!input.remote_witness_condition || input.remote_witness_condition !== 'four_exact_head_rails_completed_success') {
    throw new Error('VALIDATION_FAILED: remote_witness_condition must equal four_exact_head_rails_completed_success');
  }
  if (!Array.isArray(input.proof_gaps) || input.proof_gaps.length === 0) {
    throw new Error('VALIDATION_FAILED: proof_gaps must be a non-empty array');
  }
  if (!Array.isArray(input.still_blocked_invariants) || input.still_blocked_invariants.length === 0) {
    throw new Error('VALIDATION_FAILED: still_blocked_invariants must be a non-empty array');
  }

  // Allowed input fields (from ADR-033 + GO)
  const allowedInput = [
    'layer_id', 'layer_name', 'boundary_ref', 'schema_ref',
    'test_scaffold_ref', 'delivery_check_marker', 'claim_map_status',
    'remote_witness_condition', 'proof_gaps', 'still_blocked_invariants',
    'consent_status', 'review_status', 'prototype_posture'
  ];
  for (const k of Object.keys(input)) {
    if (!allowedInput.includes(k)) {
      throw new Error(`FORBIDDEN_INPUT: field "${k}" not allowed`);
    }
  }

  // Reject promotion language (skip still_blocked/proof_gaps carriers)
  const checkInput = { ...input };
  if (checkInput.still_blocked_invariants) delete checkInput.still_blocked_invariants;
  if (checkInput.proof_gaps) delete checkInput.proof_gaps;
  const serialized = JSON.stringify(checkInput).toLowerCase();
  for (const term of FORBIDDEN_TERMS) {
    if (serialized.includes(term)) {
      throw new Error(`FORBIDDEN_PROMOTION: detected "${term}"`);
    }
  }

  const now = new Date().toISOString();

  const body = {
    schema: 'bizra.lcc6.layer_closure_contract.v0.1.local',
    lcc6_boundary_id: null,
    layer_id: input.layer_id,
    layer_name: input.layer_name,
    lcc6_contract: {
      placeholder: true,
      status: 'REFERENCE_EXPECTATION_ONLY',
      boundary_ref: input.boundary_ref,
      schema_ref: input.schema_ref,
      test_scaffold_ref: input.test_scaffold_ref,
      delivery_check_marker: input.delivery_check_marker,
      claim_map_status: input.claim_map_status,
      remote_witness_condition: input.remote_witness_condition,
      boundary_ref_declared: true,
      schema_ref_declared: true,
      test_scaffold_ref_declared: true,
      delivery_check_marker_declared: true,
      claim_map_status_declared: true,
      remote_witness_condition_declared: true,
      lcc_runtime_implemented: false,
      lcc_registry_writer_implemented: false,
      lcc_aggregator_implemented: false,
      automatic_layer_closure_engine_implemented: false,
      delivery_check_rewrite_engine_implemented: false,
      claim_map_writer_implemented: false,
      remote_witness_collector_implemented: false
    },
    closure_status: 'MOCK_DEFINED',
    proof_gaps: input.proof_gaps,
    still_blocked_snapshot: {
      placeholder: true,
      source: 'carried_still_blocked_invariants',
      production_scoring: false,
      economic_scoring: false,
      reward_eligibility_implementation: false,
      reward_logic: false,
      receipt_minting: false,
      public_receipt_writing: false,
      publishing: false,
      bridging: false,
      contracts: false,
      token_logic: false,
      marketplace: false,
      public_economic_copy: false,
      node1: false,
      public_urp_bridge: false,
      shariah_compliance_claim: false
    },
    still_blocked_invariants: input.still_blocked_invariants,
    created_at: now,
    prototype_posture: input.prototype_posture || '[PROTOTYPE] [DESIGNED_NOT_LIVE] LOCAL_ONLY'
  };

  // Deterministic id excludes created_at
  const identityBody = Object.fromEntries(
    Object.entries(body).filter(([key]) => key !== 'created_at')
  );
  const canonical = JSON.stringify(identityBody, Object.keys(identityBody).sort());
  const lcc6_boundary_id = 'sha256:' + createHash('sha256').update(canonical + LAYER_CLOSURE_CONTRACT_LCC6_MOCK_CONSENT).digest('hex');

  body.lcc6_boundary_id = lcc6_boundary_id;

  // Final safety: no forbidden output keys
  for (const fk of FORBIDDEN_OUTPUT_KEYS) {
    if (fk in body) {
      throw new Error(`FORBIDDEN_OUTPUT: ${fk} must never be present`);
    }
  }

  return body;
}

export function loadExampleLayerClosureContractLcc6Input() {
  return {
    layer_id: 'layer-adr-032-node0-closed-loop-digest',
    layer_name: 'ADR-032 Node0 Closed-Loop Digest',
    boundary_ref: 'docs/06-adr/ADR-032-node0-closed-loop-digest-boundary.md',
    schema_ref: 'bizra.node0.closed_loop_digest.v0.1.local',
    test_scaffold_ref: 'tests/node0-closed-loop-digest-boundary.test.js',
    delivery_check_marker: 'ADR-032 node0 closed-loop digest mock integrated: PASS',
    claim_map_status: 'BOUNDARY_NON_CLAIM_ONLY',
    remote_witness_condition: 'four_exact_head_rails_completed_success',
    proof_gaps: [
      'GAP_LCC6_MOCK_NOT_YET_INTEGRATED_INTO_REGISTRY',
      'GAP_REFERENCE_EXPECTATION_ONLY'
    ],
    still_blocked_invariants: [
      'NO_PRODUCTION_SCORING',
      'NO_ECONOMIC_SCORING',
      'NO_RECEIPT_MINTING',
      'NO_PUBLIC_RECEIPT_WRITING',
      'NO_PUBLISHING',
      'NO_BRIDGING',
      'NO_NODE1',
      'NO_SHARIAH_COMPLIANCE_CLAIM'
    ],
    consent_status: 'required',
    review_status: 'boundary_local_only',
    prototype_posture: '[PROTOTYPE] [DESIGNED_NOT_LIVE] LOCAL_ONLY'
  };
}

// Self-test (executes when run directly)
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('--- BIZRA G55: LAYER CLOSURE CONTRACT LCC-6 MOCK SELF-TEST ---');
  try {
    const base = loadExampleLayerClosureContractLcc6Input();

    // 1. creates a local LCC-6 envelope with sha256 lcc6_boundary_id
    const r1 = createMockLayerClosureContractLcc6({ requireConsent: LAYER_CLOSURE_CONTRACT_LCC6_MOCK_CONSENT }, base);
    console.log('1. creates local envelope: lcc6_boundary_id=', (r1.lcc6_boundary_id || '').substring(0, 30) + '...');

    // 2. requires exact consent
    try { createMockLayerClosureContractLcc6({ requireConsent: 'WRONG' }, base); throw new Error('should have thrown'); } catch (e) { if (!e.message.includes('CONSENT_REQUIRED')) throw e; console.log('2. rejects missing exact consent'); }

    // 3. requires layer_id
    try { const bad = { ...base }; delete bad.layer_id; createMockLayerClosureContractLcc6({ requireConsent: LAYER_CLOSURE_CONTRACT_LCC6_MOCK_CONSENT }, bad); throw new Error('should have thrown'); } catch (e) { if (!e.message.includes('layer_id')) throw e; console.log('3. requires layer_id'); }

    // 4. requires layer_name
    try { const bad = { ...base }; delete bad.layer_name; createMockLayerClosureContractLcc6({ requireConsent: LAYER_CLOSURE_CONTRACT_LCC6_MOCK_CONSENT }, bad); throw new Error('should have thrown'); } catch (e) { if (!e.message.includes('layer_name')) throw e; console.log('4. requires layer_name'); }

    // 5. requires boundary_ref
    try { const bad = { ...base }; delete bad.boundary_ref; createMockLayerClosureContractLcc6({ requireConsent: LAYER_CLOSURE_CONTRACT_LCC6_MOCK_CONSENT }, bad); throw new Error('should have thrown'); } catch (e) { if (!e.message.includes('boundary_ref')) throw e; console.log('5. requires boundary_ref'); }

    // 6. requires schema_ref
    try { const bad = { ...base }; delete bad.schema_ref; createMockLayerClosureContractLcc6({ requireConsent: LAYER_CLOSURE_CONTRACT_LCC6_MOCK_CONSENT }, bad); throw new Error('should have thrown'); } catch (e) { if (!e.message.includes('schema_ref')) throw e; console.log('6. requires schema_ref'); }

    // 7. requires test_scaffold_ref and delivery_check_marker
    try { const bad = { ...base }; delete bad.test_scaffold_ref; createMockLayerClosureContractLcc6({ requireConsent: LAYER_CLOSURE_CONTRACT_LCC6_MOCK_CONSENT }, bad); throw new Error('should have thrown'); } catch (e) { if (!e.message.includes('test_scaffold_ref')) throw e; console.log('7. requires test_scaffold_ref and delivery_check_marker'); }

    // 8. requires remote_witness_condition to equal four_exact_head_rails_completed_success
    try { const bad = { ...base }; bad.remote_witness_condition = 'wrong'; createMockLayerClosureContractLcc6({ requireConsent: LAYER_CLOSURE_CONTRACT_LCC6_MOCK_CONSENT }, bad); throw new Error('should have thrown'); } catch (e) { if (!e.message.includes('remote_witness_condition')) throw e; console.log('8. requires remote_witness_condition to equal four_exact_head_rails_completed_success'); }

    // 9. declares six LCC-6 references without LCC runtime, registry writer, aggregator, automatic closure, delivery rewrite, claim writer, or witness collector
    const hasContract = r1.lcc6_contract &&
      r1.lcc6_contract.placeholder === true &&
      r1.lcc6_contract.status === 'REFERENCE_EXPECTATION_ONLY' &&
      r1.lcc6_contract.lcc_runtime_implemented === false &&
      r1.lcc6_contract.lcc_registry_writer_implemented === false &&
      r1.lcc6_contract.lcc_aggregator_implemented === false &&
      r1.lcc6_contract.automatic_layer_closure_engine_implemented === false &&
      r1.lcc6_contract.delivery_check_rewrite_engine_implemented === false &&
      r1.lcc6_contract.claim_map_writer_implemented === false &&
      r1.lcc6_contract.remote_witness_collector_implemented === false;
    console.log('9. declares six LCC-6 references without runtime/registry/aggregator/closure/rewrite/claim/witness:', hasContract);

    // 10. declares still-blocked snapshot without public/economic activation
    const hasBlocked = r1.still_blocked_snapshot &&
      r1.still_blocked_snapshot.placeholder === true &&
      r1.still_blocked_snapshot.production_scoring === false &&
      r1.still_blocked_snapshot.economic_scoring === false &&
      r1.still_blocked_snapshot.receipt_minting === false &&
      r1.still_blocked_snapshot.public_receipt_writing === false &&
      r1.still_blocked_snapshot.publishing === false;
    console.log('10. declares still-blocked snapshot without public/economic activation:', hasBlocked);

    // 11. rejects forbidden LCC/runtime/economic/public fields
    const badForbidden = { ...base, lcc_runtime_active: true };
    try { createMockLayerClosureContractLcc6({ requireConsent: LAYER_CLOSURE_CONTRACT_LCC6_MOCK_CONSENT }, badForbidden); throw new Error('should have thrown'); } catch (e) { if (!e.message.includes('FORBIDDEN')) throw e; console.log('11. rejects forbidden LCC/runtime/economic/public fields'); }

    // 12. deterministic lcc6_boundary_id for same semantic input excluding created_at
    const r12a = createMockLayerClosureContractLcc6({ requireConsent: LAYER_CLOSURE_CONTRACT_LCC6_MOCK_CONSENT }, base);
    const r12b = createMockLayerClosureContractLcc6({ requireConsent: LAYER_CLOSURE_CONTRACT_LCC6_MOCK_CONSENT }, base);
    console.log('12. deterministic lcc6_boundary_id (excl created_at):', r12a.lcc6_boundary_id === r12b.lcc6_boundary_id);

    console.log('G55 self-test PASS (local mock, consented, required fields, LCC-6 contract + still-blocked placeholders, deterministic, no forbidden).');
    process.exit(0);
  } catch (e) {
    console.error('G55 SELF-TEST FAIL:', e.message);
    process.exit(1);
  }
}
