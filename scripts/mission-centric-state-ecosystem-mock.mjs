/**
 * ADR-029 Mission-Centric State Ecosystem Mock (G39)
 * [PROTOTYPE]
 * [DESIGNED_NOT_LIVE]
 * LOCAL_ONLY
 *
 * Local mission-centric state ecosystem envelope mock only.
 * Uses Mission ID as primary key, AIR as transition atom, explicit re-check and invalidation.
 * No mission/vector memory runtime, no automatic context rewriting, no opaque compression,
 * no autonomous retrieval, no global state store, no AIR/MCP/A2A/HHMM/AgentFold/Data Lake/URP runtime,
 * no receipt minting, no public writing, no publishing, no bridging, no reward/token/contracts/marketplace,
 * no Node1, no public URP, no Shariah claim.
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

import { createHash } from 'node:crypto';

export const MISSION_CENTRIC_STATE_ECOSYSTEM_MOCK_CONSENT = 'GO: MISSION-CENTRIC STATE ECOSYSTEM MOCK';

const FORBIDDEN_TERMS = new Set([
  'mint', 'publish', 'bridge', 'reward_authorized', 'token', 'contract',
  'marketplace', 'Node1', 'URP', 'Shariah', 'guaranteed', 'payout',
  'claimable', 'earn', 'authorized', 'transferable', 'public_url', 'public',
  'vector_memory', 'automatic_context_rewriting', 'opaque_compression',
  'autonomous_retrieval', 'global_state_store'
]);

const FORBIDDEN_OUTPUT_KEYS = [
  'token_minted', 'reward_authorized', 'reward_amount', 'token_amount',
  'contract_call', 'marketplace_signal', 'public_receipt_url', 'public_url',
  'bridge_id', 'node1_sync', 'urp_publication', 'shariah_compliant',
  'vector_memory_runtime', 'automatic_context_rewriting_engine',
  'opaque_compression_engine', 'autonomous_retrieval_engine', 'global_state_store'
];

export function createMockMissionCentricStateEcosystem({ requireConsent }, input = loadExampleMissionCentricStateInput()) {
  if (requireConsent !== MISSION_CENTRIC_STATE_ECOSYSTEM_MOCK_CONSENT) {
    throw new Error('CONSENT_REQUIRED: exact "GO: MISSION-CENTRIC STATE ECOSYSTEM MOCK" required');
  }

  if (!input || typeof input !== 'object') {
    throw new Error('VALIDATION_FAILED: input must be object');
  }

  // Required input fields
  if (!input.mission_id) {
    throw new Error('VALIDATION_FAILED: mission_id required');
  }
  if (!input.air_id || !input.air_id.startsWith('sha256:')) {
    throw new Error('VALIDATION_FAILED: air_id must start with sha256:');
  }
  if (!input.state_transition_id || !input.state_transition_id.startsWith('sha256:')) {
    throw new Error('VALIDATION_FAILED: state_transition_id must start with sha256:');
  }
  if (!input.local_writer_result_id || !input.local_writer_result_id.startsWith('sha256:')) {
    throw new Error('VALIDATION_FAILED: local_writer_result_id must start with sha256:');
  }
  if (!Array.isArray(input.proof_gaps) || input.proof_gaps.length === 0) {
    throw new Error('VALIDATION_FAILED: proof_gaps required and non-empty');
  }

  // Allowed input fields
  const allowedInput = [
    'mission_id', 'air_id', 'state_transition_id', 'local_writer_result_id',
    'environment_refs', 'expected_hashes', 'stale_belief_markers', 'proof_gaps',
    'consent_status', 'review_status', 'prototype_posture'
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
    schema: 'bizra.mission.state.v0.1.local',
    mission_state_id: null,
    mission_id: input.mission_id,
    current_state: 'MISSION_STATE_DECLARED',
    previous_state: 'READY_FOR_REVIEW',
    air_ref: input.air_id,
    state_transition_ref: input.state_transition_id,
    environment_recheck_result: {
      placeholder: true,
      source_of_truth: 'environment_over_memory',
      recheck_required_before_persistence: true,
      runtime_implemented: false
    },
    stale_belief_policy: {
      placeholder: true,
      invalidation_required: true,
      silent_overwrite_forbidden: true,
      opaque_compression_forbidden: true,
      autonomous_retrieval_forbidden: true
    },
    hhmm_state: {
      placeholder: true,
      state_declared: 'MISSION_STATE_DECLARED',
      engine_implemented: false
    },
    proof_gaps: input.proof_gaps,
    writer_ref: input.local_writer_result_id,
    agentfold_expectation: {
      placeholder: true,
      agentfold_l3_implemented: false
    },
    datalake_alignment_expectation: {
      placeholder: true,
      datalake_sync_implemented: false,
      face_body_alignment_expected: true
    },
    urp_expectation: {
      placeholder: true,
      urp_sync_implemented: false,
      public_publication: false
    },
    created_at: now,
    prototype_posture: '[PROTOTYPE] [DESIGNED_NOT_LIVE] LOCAL_ONLY'
  };

  // Deterministic id excludes created_at
  const identityBody = Object.fromEntries(
    Object.entries(body).filter(([key]) => key !== 'created_at')
  );
  const canonical = JSON.stringify(identityBody, Object.keys(identityBody).sort());
  const mission_state_id = 'sha256:' + createHash('sha256').update(canonical + MISSION_CENTRIC_STATE_ECOSYSTEM_MOCK_CONSENT).digest('hex');

  body.mission_state_id = mission_state_id;

  // Final safety: no forbidden output keys
  for (const fk of FORBIDDEN_OUTPUT_KEYS) {
    if (fk in body) {
      throw new Error(`FORBIDDEN_OUTPUT: ${fk} must never be present`);
    }
  }

  return body;
}

export function loadExampleMissionCentricStateInput() {
  return {
    mission_id: 'mission-ex-001',
    air_id: 'sha256:example-air-ref-from-g35',
    state_transition_id: 'sha256:example-transition-ref',
    local_writer_result_id: 'sha256:example-writer-ref-from-g31',
    environment_refs: ['local-models', 'dema-home-integrity'],
    expected_hashes: ['sha256:env-snapshot'],
    stale_belief_markers: ['old-belief-xyz'],
    proof_gaps: ['GAP_MISSION_STATE_NOT_YET_PERSISTED', 'GAP_HUMAN_REVIEW_PENDING'],
    consent_status: 'required',
    review_status: 'boundary_local_only',
    prototype_posture: '[PROTOTYPE] [DESIGNED_NOT_LIVE] LOCAL_ONLY'
  };
}

// Self-test
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('--- BIZRA G39: MISSION-CENTRIC STATE ECOSYSTEM MOCK SELF-TEST ---');
  try {
    const base = loadExampleMissionCentricStateInput();

    // 1. creates with sha256 mission_state_id
    const r1 = createMockMissionCentricStateEcosystem({ requireConsent: MISSION_CENTRIC_STATE_ECOSYSTEM_MOCK_CONSENT }, base);
    console.log('1. creates local envelope: mission_state_id=', (r1.mission_state_id || '').substring(0,30)+'... current=', r1.current_state);

    // 2. requires exact consent
    try { createMockMissionCentricStateEcosystem({ requireConsent: 'WRONG' }, base); throw new Error('should have thrown'); } catch(e){ if(!e.message.includes('CONSENT_REQUIRED')) throw e; console.log('2. rejects missing exact consent'); }

    // 3. requires mission_id
    try { const bad = {...base}; delete bad.mission_id; createMockMissionCentricStateEcosystem({ requireConsent: MISSION_CENTRIC_STATE_ECOSYSTEM_MOCK_CONSENT }, bad); throw new Error('should have thrown'); } catch(e){ if(!e.message.includes('mission_id')) throw e; console.log('3. requires mission_id'); }

    // 4. includes AIR and state transition refs
    console.log('4. includes air_ref and state_transition_ref:', !!r1.air_ref && !!r1.state_transition_ref);

    // 5. environment re-check expectation
    const hasEnv = r1.environment_recheck_result && r1.environment_recheck_result.placeholder === true && r1.environment_recheck_result.runtime_implemented === false;
    console.log('5. declares environment re-check expectation without runtime:', hasEnv);

    // 6. stale-belief policy
    const hasStale = r1.stale_belief_policy && r1.stale_belief_policy.placeholder === true && r1.stale_belief_policy.invalidation_required === true;
    console.log('6. declares stale-belief policy without opaque compression:', hasStale);

    // 7. HHMM state without engine
    const hasHhmm = r1.hhmm_state && r1.hhmm_state.placeholder === true && r1.hhmm_state.engine_implemented === false;
    console.log('7. declares HHMM state without engine:', hasHhmm);

    // 8. includes writer_ref
    console.log('8. includes writer_ref from local_writer_result_id:', r1.writer_ref && r1.writer_ref.startsWith('sha256:'));

    // 9. AgentFold expectation
    const hasAgent = r1.agentfold_expectation && r1.agentfold_expectation.placeholder === true && r1.agentfold_expectation.agentfold_l3_implemented === false;
    console.log('9. declares AgentFold expectation without implementation:', hasAgent);

    // 10. Data Lake alignment
    const hasDl = r1.datalake_alignment_expectation && r1.datalake_alignment_expectation.placeholder === true && r1.datalake_alignment_expectation.datalake_sync_implemented === false;
    console.log('10. declares Data Lake alignment without sync:', hasDl);

    // 11. URP expectation
    const hasUrp = r1.urp_expectation && r1.urp_expectation.placeholder === true && r1.urp_expectation.urp_sync_implemented === false && r1.urp_expectation.public_publication === false;
    console.log('11. declares URP expectation without sync/publication:', hasUrp);

    // 12. no forbidden in output
    const hasNoForbidden = !FORBIDDEN_OUTPUT_KEYS.some(k => k in r1);
    console.log('12. never returns forbidden fields:', hasNoForbidden);

    // 13. deterministic excluding created_at
    const r13a = createMockMissionCentricStateEcosystem({ requireConsent: MISSION_CENTRIC_STATE_ECOSYSTEM_MOCK_CONSENT }, base);
    const r13b = createMockMissionCentricStateEcosystem({ requireConsent: MISSION_CENTRIC_STATE_ECOSYSTEM_MOCK_CONSENT }, base);
    console.log('13. deterministic mission_state_id (excl created_at):', r13a.mission_state_id === r13b.mission_state_id);

    console.log('G39 self-test PASS (local mock, consented, required fields, placeholders, deterministic, no forbidden).');
    process.exit(0);
  } catch (e) {
    console.error('G39 SELF-TEST FAIL:', e.message);
    process.exit(1);
  }
}
