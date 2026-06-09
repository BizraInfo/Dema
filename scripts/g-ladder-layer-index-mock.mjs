/**
 * ADR-034 G-Ladder Layer Index Mock
 * [PROTOTYPE]
 * [DESIGNED_NOT_LIVE]
 * LOCAL_ONLY
 *
 * Local proof-layer index mock envelope only.
 * Produces a machine-readable reference rollup for PDF section 1:
 * G-Ladder Layer Index, claim-map, proof-gap register, and release-readiness
 * rollup. No G-Ladder runtime, index writer, registry, LCC aggregator,
 * automatic layer closure, delivery-check rewrite engine, claim-map writer,
 * remote witness collector, CI polling, GitHub API polling runtime, public
 * publishing, economic activation, Node1 activation, URP bridge, token logic,
 * contracts, marketplace, or Shariah-compliance claim is introduced.
 */

import { createHash } from 'node:crypto';

export const G_LADDER_LAYER_INDEX_MOCK_CONSENT = 'GO: G-LADDER LAYER INDEX MOCK';

const ALLOWED_INPUT_FIELDS = new Set([
  'index_scope',
  'layers',
  'checklist_section',
  'consent_status',
  'review_status',
  'prototype_posture'
]);

const FORBIDDEN_PROMOTION_TERMS = new Set([
  'token',
  'reward',
  'payout',
  'marketplace',
  'contract',
  'shariah',
  'public url',
  'public receipt',
  'public token',
  'public reward',
  'public launch',
  'node1',
  'urp bridge',
  'ci polling',
  'github api polling',
  'registry writer',
  'claim map writer',
  'remote witness collector',
  'automatic closure',
  'production ready',
  'production release',
  'guaranteed'
]);

const FORBIDDEN_OUTPUT_KEYS = [
  'index_written',
  'registry_written',
  'aggregation_performed',
  'automatic_closure_performed',
  'delivery_check_rewritten',
  'claim_map_written',
  'remote_witness_collected',
  'ci_polling_performed',
  'github_api_polling_performed',
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

const REQUIRED_LCC6_FIELDS = [
  'boundary_ref',
  'schema_ref',
  'test_scaffold_ref',
  'delivery_check_marker',
  'claim_map_status',
  'remote_witness_condition'
];

const WITNESS_RAILS = [
  'gitleaks',
  'codeql',
  'bizra_review_gate',
  'check'
];

const GLOBAL_STILL_BLOCKED_SNAPSHOT = Object.freeze({
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
});

export function createMockGLadderLayerIndex(
  { requireConsent },
  input = loadExampleGLadderLayerIndexInput()
) {
  if (requireConsent !== G_LADDER_LAYER_INDEX_MOCK_CONSENT) {
    throw new Error('CONSENT_REQUIRED: exact "GO: G-LADDER LAYER INDEX MOCK" required');
  }

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('VALIDATION_FAILED: input must be object');
  }

  for (const key of Object.keys(input)) {
    if (!ALLOWED_INPUT_FIELDS.has(key)) {
      throw new Error(`FORBIDDEN_INPUT: field "${key}" not allowed`);
    }
  }

  const checkInput = {
    index_scope: input.index_scope,
    checklist_section: input.checklist_section,
    consent_status: input.consent_status,
    review_status: input.review_status,
    prototype_posture: input.prototype_posture
  };
  const serialized = JSON.stringify(checkInput).toLowerCase();
  for (const term of FORBIDDEN_PROMOTION_TERMS) {
    if (serialized.includes(term)) {
      throw new Error(`FORBIDDEN_PROMOTION: detected "${term}"`);
    }
  }

  if (!Array.isArray(input.layers) || input.layers.length === 0) {
    throw new Error('VALIDATION_FAILED: layers must be a non-empty array');
  }

  const layers = Object.freeze(input.layers.map(normalizeLayer));
  const allLayersComplete = layers.every(layer =>
    layer.boundary_ref &&
    layer.test_scaffold_ref &&
    layer.mock_ref &&
    layer.delivery_check_marker &&
    layer.closure_status === 'LCC6_CLOSED'
  );

  const proofGaps = layers.flatMap(layer =>
    layer.proof_gaps.map(gap => Object.freeze({
      layer_id: layer.layer_id,
      gap
    }))
  );

  const body = {
    schema: 'bizra.g_ladder.layer_index.v0.1.local',
    g_ladder_layer_index_id: null,
    checklist_section: input.checklist_section || 'proof_layer_closure',
    layer_index: Object.freeze({
      status: 'CONSOLIDATED_LOCAL_MOCK',
      boundary_to_scaffold_to_mock_to_delivery_check_complete: allLayersComplete,
      lcc6_required_fields: Object.freeze([...REQUIRED_LCC6_FIELDS]),
      layers
    }),
    machine_readable_layer_index: Object.freeze({
      exists: true,
      format: 'application/json',
      local_only: true,
      writer_implemented: false,
      runtime_implemented: false
    }),
    claim_map: Object.freeze({
      exists: true,
      status: 'CONSOLIDATED_LOCAL_MOCK',
      writer_implemented: false,
      entries: Object.freeze(layers.map(layer => Object.freeze({
        layer_id: layer.layer_id,
        claim_map_status: layer.claim_map_status,
        public_claim_allowed: false,
        production_claim_allowed: false,
        economic_claim_allowed: false,
        shariah_claim_allowed: false,
        review_status: 'local_review_only'
      })))
    }),
    proof_gap_register: Object.freeze({
      exists: true,
      status: 'OPEN_GAPS_CARRIED',
      writer_implemented: false,
      gaps: Object.freeze(proofGaps)
    }),
    release_readiness_rollup: Object.freeze({
      exists: true,
      local_proof_stream_ready: true,
      production_release_ready: false,
      public_claim_allowed: false,
      reason: 'PROTOTYPE_ONLY_STILL_BLOCKED_INVARIANTS_OPEN',
      remote_witness_condition: 'four_exact_head_rails_completed_success'
    }),
    still_blocked_snapshot: GLOBAL_STILL_BLOCKED_SNAPSHOT,
    created_at: new Date(0).toISOString(),
    prototype_posture: input.prototype_posture || '[PROTOTYPE] [DESIGNED_NOT_LIVE] LOCAL_ONLY'
  };

  for (const key of FORBIDDEN_OUTPUT_KEYS) {
    if (Object.hasOwn(body, key)) {
      throw new Error(`FORBIDDEN_OUTPUT: ${key} must never be present`);
    }
  }

  const identityBody = { ...body, g_ladder_layer_index_id: 'pending' };
  const canonical = JSON.stringify(identityBody);
  const g_ladder_layer_index_id = `sha256:${createHash('sha256')
    .update(canonical + G_LADDER_LAYER_INDEX_MOCK_CONSENT)
    .digest('hex')}`;

  return Object.freeze({
    ...body,
    g_ladder_layer_index_id
  });
}

function normalizeLayer(layer) {
  if (!layer || typeof layer !== 'object' || Array.isArray(layer)) {
    throw new Error('VALIDATION_FAILED: layer must be object');
  }

  for (const field of REQUIRED_LCC6_FIELDS) {
    if (!layer[field]) {
      throw new Error(`VALIDATION_FAILED: ${field} required for layer`);
    }
  }

  if (!layer.layer_id || !layer.layer_name || !layer.g_ring_id || !layer.head_sha) {
    throw new Error('VALIDATION_FAILED: layer_id, layer_name, g_ring_id, and head_sha required');
  }

  if (layer.remote_witness_condition !== 'four_exact_head_rails_completed_success') {
    throw new Error('VALIDATION_FAILED: remote_witness_condition must equal four_exact_head_rails_completed_success');
  }

  if (!layer.run_ids || typeof layer.run_ids !== 'object') {
    throw new Error('VALIDATION_FAILED: run_ids required');
  }

  for (const rail of WITNESS_RAILS) {
    if (!Number.isInteger(layer.run_ids[rail]) || layer.run_ids[rail] <= 0) {
      throw new Error(`VALIDATION_FAILED: run_ids.${rail} must be positive integer`);
    }
  }

  if (!Array.isArray(layer.proof_gaps) || layer.proof_gaps.length === 0) {
    throw new Error('VALIDATION_FAILED: proof_gaps must be non-empty array');
  }

  if (!Array.isArray(layer.still_blocked_invariants) || layer.still_blocked_invariants.length === 0) {
    throw new Error('VALIDATION_FAILED: still_blocked_invariants must be non-empty array');
  }

  return Object.freeze({
    g_ring_id: layer.g_ring_id,
    layer_id: layer.layer_id,
    layer_name: layer.layer_name,
    boundary_ref: layer.boundary_ref,
    schema_ref: layer.schema_ref,
    test_scaffold_ref: layer.test_scaffold_ref,
    mock_ref: layer.mock_ref,
    delivery_check_marker: layer.delivery_check_marker,
    claim_map_status: layer.claim_map_status,
    remote_witness_condition: layer.remote_witness_condition,
    head_sha: layer.head_sha,
    run_ids: Object.freeze({ ...layer.run_ids }),
    closure_status: layer.closure_status || 'LCC6_CLOSED',
    proof_gaps: Object.freeze([...layer.proof_gaps]),
    still_blocked_invariants: Object.freeze([...layer.still_blocked_invariants])
  });
}

export function loadExampleGLadderLayerIndexInput() {
  return {
    index_scope: 'local proof-layer closure rollup',
    checklist_section: 'proof_layer_closure',
    consent_status: 'required',
    review_status: 'local_review_only',
    prototype_posture: '[PROTOTYPE] [DESIGNED_NOT_LIVE] LOCAL_ONLY',
    layers: [
      layer({
        g_ring_id: 'G32R',
        layer_id: 'adr-028-atomic-impact-receipt-lifecycle',
        layer_name: 'ADR-028 Atomic Impact Receipt Lifecycle',
        boundary_ref: 'docs/06-adr/ADR-028-atomic-impact-receipt-lifecycle-boundary.md',
        schema_ref: 'bizra.impact.atomic_receipt_lifecycle.v0.1.local',
        test_scaffold_ref: 'tests/atomic-impact-receipt-lifecycle-boundary.test.js',
        mock_ref: 'tests/atomic-impact-receipt-lifecycle-mock.test.js',
        delivery_check_marker: 'ADR-028 atomic impact receipt lifecycle mock integrated: PASS',
        head_sha: '4499afe896befbf32223adf30468785d1e992aba',
        run_ids: {
          gitleaks: 27142447061,
          codeql: 27142447297,
          bizra_review_gate: 27142447416,
          check: 27142447058
        },
        proof_gaps: [
          'GAP_NO_AIR_RUNTIME_IMPLEMENTATION',
          'GAP_NO_URP_SYNC',
          'GAP_REFERENCE_EXPECTATION_ONLY'
        ]
      }),
      layer({
        g_ring_id: 'G36R',
        layer_id: 'adr-029-mission-centric-state-ecosystem',
        layer_name: 'ADR-029 Mission-Centric State Ecosystem',
        boundary_ref: 'docs/06-adr/ADR-029-mission-centric-state-ecosystem-boundary.md',
        schema_ref: 'bizra.mission_state.ecosystem.v0.1.local',
        test_scaffold_ref: 'tests/mission-centric-state-ecosystem-boundary.test.js',
        mock_ref: 'tests/mission-centric-state-ecosystem-mock.test.js',
        delivery_check_marker: 'ADR-029 mission-centric state ecosystem mock integrated: PASS',
        head_sha: '6018735c0d3f9cc4bd24b07c80ad19fccec1dbb6',
        run_ids: {
          gitleaks: 27146704919,
          codeql: 27146704944,
          bizra_review_gate: 27146704955,
          check: 27146705046
        },
        proof_gaps: [
          'GAP_NO_MISSION_MEMORY_RUNTIME',
          'GAP_NO_GLOBAL_STATE_STORE',
          'GAP_REFERENCE_EXPECTATION_ONLY'
        ]
      }),
      layer({
        g_ring_id: 'G40R',
        layer_id: 'adr-030-dema-datalake-alignment',
        layer_name: 'ADR-030 Dema/Data-Lake Alignment',
        boundary_ref: 'docs/06-adr/ADR-030-dema-data-lake-alignment-boundary.md',
        schema_ref: 'bizra.dema.datalake.alignment.v0.1.local',
        test_scaffold_ref: 'tests/dema-datalake-alignment-boundary.test.js',
        mock_ref: 'tests/dema-datalake-alignment-mock.test.js',
        delivery_check_marker: 'ADR-030 Dema Data-Lake alignment mock integrated: PASS',
        head_sha: '9d0d5a4b122b05c78a9b75c1e1f4281638f8a7f7',
        run_ids: {
          gitleaks: 27149374316,
          codeql: 27149374335,
          bizra_review_gate: 27149374840,
          check: 27149373607
        },
        proof_gaps: [
          'GAP_NO_DEMA_DATALAKE_RUNTIME_SYNC',
          'GAP_NO_CROSS_REPO_WRITE',
          'GAP_REFERENCE_EXPECTATION_ONLY'
        ]
      }),
      layer({
        g_ring_id: 'G44R',
        layer_id: 'adr-031-hybrid-mission-knowledge-bok',
        layer_name: 'ADR-031 Hybrid Mission Knowledge Graph + BoK',
        boundary_ref: 'docs/06-adr/ADR-031-hybrid-mission-knowledge-graph-bok-boundary.md',
        schema_ref: 'bizra.hybrid.mission.knowledge.bok.v0.1.local',
        test_scaffold_ref: 'tests/hybrid-mission-knowledge-graph-bok-boundary.test.js',
        mock_ref: 'tests/hybrid-mission-knowledge-graph-bok-mock.test.js',
        delivery_check_marker: 'ADR-031 hybrid mission knowledge graph BoK mock integrated: PASS',
        head_sha: 'f75ed2eda1d0a9db446b0d2d2e94291b9c74fd13',
        run_ids: {
          gitleaks: 27153687054,
          codeql: 27153686892,
          bizra_review_gate: 27153686845,
          check: 27153686868
        },
        proof_gaps: [
          'GAP_NO_HYBRID_MEMORY_RUNTIME',
          'GAP_NO_KNOWLEDGE_GRAPH_RUNTIME',
          'GAP_NO_BOK_RUNTIME'
        ]
      }),
      layer({
        g_ring_id: 'G48R',
        layer_id: 'adr-032-node0-closed-loop-digest',
        layer_name: 'ADR-032 Node0 Closed-Loop Digest',
        boundary_ref: 'docs/06-adr/ADR-032-node0-closed-loop-digest-boundary.md',
        schema_ref: 'bizra.node0.closed_loop_digest.v0.1.local',
        test_scaffold_ref: 'tests/node0-closed-loop-digest-boundary.test.js',
        mock_ref: 'tests/node0-closed-loop-digest-mock.test.js',
        delivery_check_marker: 'ADR-032 node0 closed-loop digest mock integrated: PASS',
        head_sha: 'efd6a8c04ca134ace96ff3c4abfa7955e002ff07',
        run_ids: {
          gitleaks: 27155336175,
          codeql: 27155336300,
          bizra_review_gate: 27155336296,
          check: 27155336180
        },
        proof_gaps: [
          'GAP_NO_DIGEST_RUNTIME',
          'GAP_NO_DIGEST_WRITER',
          'GAP_REFERENCE_EXPECTATION_ONLY'
        ]
      }),
      layer({
        g_ring_id: 'G52R',
        layer_id: 'adr-033-layer-closure-contract-lcc6',
        layer_name: 'ADR-033 Layer Closure Contract LCC-6',
        boundary_ref: 'docs/06-adr/ADR-033-layer-closure-contract-lcc6-boundary.md',
        schema_ref: 'bizra.lcc6.layer_closure_contract.v0.1.local',
        test_scaffold_ref: 'tests/layer-closure-contract-lcc6-boundary.test.js',
        mock_ref: 'tests/layer-closure-contract-lcc6-mock.test.js',
        delivery_check_marker: 'ADR-033 Layer Closure Contract LCC-6 mock integrated: PASS',
        head_sha: 'b1678a01a5bbfafe73f90b9e5b68831c0ca3a262',
        run_ids: {
          gitleaks: 27160030443,
          codeql: 27160030518,
          bizra_review_gate: 27160030678,
          check: 27160030461
        },
        proof_gaps: [
          'GAP_NO_LCC_REGISTRY_WRITER',
          'GAP_NO_LCC_AGGREGATOR',
          'GAP_NO_AUTOMATIC_LAYER_CLOSURE_ENGINE'
        ]
      }),
    ]
  };
}

function layer(overrides) {
  return {
    claim_map_status: 'BOUNDARY_NON_CLAIM_ONLY',
    remote_witness_condition: 'four_exact_head_rails_completed_success',
    closure_status: 'LCC6_CLOSED',
    still_blocked_invariants: [
      'NO_PRODUCTION_SCORING',
      'NO_ECONOMIC_SCORING',
      'NO_REWARD_ELIGIBILITY_IMPLEMENTATION',
      'NO_REWARD_LOGIC',
      'NO_RECEIPT_MINTING',
      'NO_PUBLIC_RECEIPT_WRITING',
      'NO_PUBLISHING',
      'NO_BRIDGING',
      'NO_CONTRACTS',
      'NO_TOKEN_LOGIC',
      'NO_MARKETPLACE',
      'NO_PUBLIC_ECONOMIC_COPY',
      'NO_NODE1',
      'NO_PUBLIC_URP_BRIDGE',
      'NO_SHARIAH_COMPLIANCE_CLAIM'
    ],
    ...overrides
  };
}
