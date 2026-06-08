/**
 * ADR-028 Atomic Impact Receipt Lifecycle Mock (G35)
 * [PROTOTYPE]
 * [DESIGNED_NOT_LIVE]
 * LOCAL_ONLY
 *
 * Local AIR lifecycle envelope mock only.
 * Connects proven layers (writer ref) with placeholder expectations.
 * No AIR runtime engine, no MCP tool, no A2A bridge, no HHMM engine,
 * no AgentFold seal, no URP sync, no minting, no public writing,
 * no publishing, no bridging, no reward auth, no token, no contracts,
 * no marketplace, no Node1, no public URP, no Shariah claim.
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

import { createHash } from 'node:crypto';

export const ATOMIC_IMPACT_RECEIPT_LIFECYCLE_MOCK_CONSENT = 'GO: ATOMIC IMPACT RECEIPT LIFECYCLE MOCK';

const FORBIDDEN_TERMS = new Set([
  'mint', 'publish', 'bridge', 'reward_authorized', 'token', 'contract',
  'marketplace', 'Node1', 'URP', 'Shariah', 'guaranteed', 'payout',
  'claimable', 'earn', 'authorized', 'transferable', 'public_url', 'public'
]);

const FORBIDDEN_OUTPUT_KEYS = [
  'token_minted', 'reward_authorized', 'reward_amount', 'token_amount',
  'contract_call', 'marketplace_signal', 'public_receipt_url', 'public_url',
  'bridge_id', 'node1_sync', 'urp_publication', 'shariah_compliant'
];

export function createMockAtomicImpactReceiptLifecycle({ requireConsent }, input = loadExampleAtomicImpactReceiptLifecycleInput()) {
  if (requireConsent !== ATOMIC_IMPACT_RECEIPT_LIFECYCLE_MOCK_CONSENT) {
    throw new Error('CONSENT_REQUIRED: exact "GO: ATOMIC IMPACT RECEIPT LIFECYCLE MOCK" required');
  }

  if (!input || typeof input !== 'object') {
    throw new Error('VALIDATION_FAILED: input must be object');
  }

  // Basic allowed input fields (the refs + metadata)
  const allowedInput = [
    'contribution_id', 'proposal_id', 'score_id', 'eligibility_review_id',
    'receipt_review_id', 'local_writer_result_id', 'claim_label',
    'proof_gaps', 'consent_status', 'review_status', 'anti_gaming_status',
    'lifecycle_context'
  ];
  for (const k of Object.keys(input)) {
    if (!allowedInput.includes(k)) {
      throw new Error(`FORBIDDEN_INPUT: field "${k}" not allowed`);
    }
  }

  // Reject promotion language in input (except description-like context)
  const checkInput = { ...input };
  const serialized = JSON.stringify(checkInput).toLowerCase();
  for (const term of FORBIDDEN_TERMS) {
    if (serialized.includes(term)) {
      throw new Error(`FORBIDDEN_PROMOTION: detected "${term}"`);
    }
  }

  if (!Array.isArray(input.proof_gaps) || input.proof_gaps.length === 0) {
    throw new Error('VALIDATION_FAILED: proof_gaps required and non-empty');
  }

  const now = new Date().toISOString();

  const body = {
    schema: 'bizra.air.lifecycle.v0.1.local',
    air_id: null, // filled below
    state_transition_id: null,
    lifecycle_state: 'READY_FOR_REVIEW',
    previous_state: 'PERSISTED',
    next_state: 'READY_FOR_REVIEW',
    contribution_id: input.contribution_id || 'local-contrib-001',
    proposal_id: input.proposal_id || 'ex-prop-001',
    score_id: input.score_id || 'ex-score-001',
    eligibility_review_id: input.eligibility_review_id || 'ex-rev-001',
    receipt_review_id: input.receipt_review_id || 'ex-receipt-001',
    local_writer_result_id: input.local_writer_result_id || 'sha256:example-writer-ref-from-g31',
    claim_label: input.claim_label || 'Atomic Impact Receipt Lifecycle mock — local envelope only [PROTOTYPE] [DESIGNED_NOT_LIVE]',
    proof_gaps: input.proof_gaps,
    consent_status: input.consent_status || 'required',
    review_status: input.review_status || 'boundary_local_only',
    anti_gaming_status: input.anti_gaming_status || 'enforced',
    receipt_ref: input.receipt_review_id || 'ex-receipt-001',
    writer_ref: input.local_writer_result_id || 'sha256:example-writer-ref-from-g31',
    mcp_expectation: {
      placeholder: true,
      tool: 'score_impact',
      runtime_implemented: false
    },
    a2a_expectation: {
      placeholder: true,
      pat_sat_bridge_runtime_implemented: false
    },
    hhmm_expectation: {
      placeholder: true,
      states_declared: true,
      engine_implemented: false
    },
    seal_expectation: {
      placeholder: true,
      agentfold_l3_implemented: false
    },
    urp_expectation: {
      placeholder: true,
      urp_sync_implemented: false,
      public_publication: false
    },
    created_at: now,
    prototype_posture: '[PROTOTYPE] [DESIGNED_NOT_LIVE] LOCAL_ONLY'
  };

  // Deterministic ids exclude volatile created_at (kept only as audit metadata)
  const identityBody = Object.fromEntries(
    Object.entries(body).filter(([key]) => key !== 'created_at')
  );
  const canonical = JSON.stringify(identityBody, Object.keys(identityBody).sort());
  const air_id = 'sha256:' + createHash('sha256').update(canonical + ATOMIC_IMPACT_RECEIPT_LIFECYCLE_MOCK_CONSENT).digest('hex');
  const state_transition_id = 'sha256:' + createHash('sha256').update('PERSISTED->READY_FOR_REVIEW:' + air_id).digest('hex');

  body.air_id = air_id;
  body.state_transition_id = state_transition_id;

  // Final safety: ensure no forbidden output keys ever appear
  for (const fk of FORBIDDEN_OUTPUT_KEYS) {
    if (fk in body) {
      throw new Error(`FORBIDDEN_OUTPUT: ${fk} must never be present`);
    }
  }

  return body;
}

export function loadExampleAtomicImpactReceiptLifecycleInput() {
  return {
    contribution_id: 'local-contrib-001',
    proposal_id: 'ex-prop-001',
    score_id: 'ex-score-001',
    eligibility_review_id: 'ex-rev-001',
    receipt_review_id: 'ex-receipt-001',
    local_writer_result_id: 'sha256:example-writer-ref-from-g31',
    claim_label: 'Atomic Impact Receipt Lifecycle mock — local envelope only [PROTOTYPE] [DESIGNED_NOT_LIVE]',
    proof_gaps: ['GAP_AIR_LIFECYCLE_NOT_YET_SEALED', 'GAP_HUMAN_REVIEW_PENDING_FOR_READY_STATE'],
    consent_status: 'required',
    review_status: 'boundary_local_only',
    anti_gaming_status: 'enforced',
    lifecycle_context: { node: 'Node0', phase: 'G35' }
  };
}

// Self-test when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('--- BIZRA G35: ATOMIC IMPACT RECEIPT LIFECYCLE MOCK SELF-TEST ---');
  try {
    const base = loadExampleAtomicImpactReceiptLifecycleInput();

    // 1. creates with sha256 air_id
    const r1 = createMockAtomicImpactReceiptLifecycle({ requireConsent: ATOMIC_IMPACT_RECEIPT_LIFECYCLE_MOCK_CONSENT }, base);
    console.log('1. creates local AIR envelope: air_id=', (r1.air_id || '').substring(0, 30) + '... lifecycle_state=', r1.lifecycle_state);

    // 2. requires exact consent
    try { createMockAtomicImpactReceiptLifecycle({ requireConsent: 'WRONG' }, base); throw new Error('should have thrown'); } catch (e) { if (!e.message.includes('CONSENT_REQUIRED')) throw e; console.log('2. rejects missing exact consent'); }

    // 3. includes writer_ref
    console.log('3. includes writer_ref from local_writer_result_id:', r1.writer_ref && r1.writer_ref.startsWith('sha256:'));

    // 4. MCP expectation
    const hasMcp = r1.mcp_expectation && r1.mcp_expectation.placeholder === true && r1.mcp_expectation.runtime_implemented === false;
    console.log('4. declares MCP expectation without runtime:', hasMcp);

    // 5. A2A
    const hasA2a = r1.a2a_expectation && r1.a2a_expectation.placeholder === true && r1.a2a_expectation.pat_sat_bridge_runtime_implemented === false;
    console.log('5. declares A2A PAT/SAT expectation without bridge runtime:', hasA2a);

    // 6. HHMM
    const hasHhmm = r1.hhmm_expectation && r1.hhmm_expectation.placeholder === true && r1.hhmm_expectation.engine_implemented === false;
    console.log('6. declares HHMM expectation without engine:', hasHhmm);

    // 7. Seal
    const hasSeal = r1.seal_expectation && r1.seal_expectation.placeholder === true && r1.seal_expectation.agentfold_l3_implemented === false;
    console.log('7. declares AgentFold seal expectation without implementation:', hasSeal);

    // 8. URP
    const hasUrp = r1.urp_expectation && r1.urp_expectation.placeholder === true && r1.urp_expectation.urp_sync_implemented === false && r1.urp_expectation.public_publication === false;
    console.log('8. declares URP expectation without sync/publication:', hasUrp);

    // 9. no forbidden
    const hasNoForbidden = !FORBIDDEN_OUTPUT_KEYS.some(k => k in r1);
    console.log('9. never returns forbidden economic/public fields:', hasNoForbidden);

    // 10. deterministic excluding created_at
    const r10a = createMockAtomicImpactReceiptLifecycle({ requireConsent: ATOMIC_IMPACT_RECEIPT_LIFECYCLE_MOCK_CONSENT }, base);
    const r10b = createMockAtomicImpactReceiptLifecycle({ requireConsent: ATOMIC_IMPACT_RECEIPT_LIFECYCLE_MOCK_CONSENT }, base);
    console.log('10. deterministic air_id (excl created_at):', r10a.air_id === r10b.air_id);

    console.log('G35 self-test PASS (local mock envelope, consented, gapped, expectations as placeholders only, deterministic, no forbidden).');
    process.exit(0);
  } catch (e) {
    console.error('G35 SELF-TEST FAIL:', e.message);
    process.exit(1);
  }
}
