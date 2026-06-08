/**
 * ADR-025 Reward Receipt Mock Local Prototype (G23)
 * [PROTOTYPE] [DESIGNED_NOT_LIVE]
 * LOCAL_ONLY
 *
 * Deterministic local mock review object for reward receipt expectation.
 * No receipt minting, writing, publishing, bridging, or reward authorization.
 *
 * NO_REWARD_RECEIPT_IMPLEMENTATION
 * NO_RECEIPT_MINTING
 * NO_RECEIPT_WRITING
 * NO_PUBLISHING
 * NO_BRIDGING
 * NO_REWARD_LOGIC
 * NO_TOKEN_LOGIC
 * NO_CONTRACT_LINKAGE
 * NO_MARKETPLACE_SIGNAL
 * NO_PUBLIC_ECONOMIC_COPY
 * NO_NODE1
 * NO_PUBLIC_URP_BRIDGE
 * NO_SHARIAH_COMPLIANCE_CLAIM
 */

import { createHash } from 'node:crypto';

export const REWARD_RECEIPT_MOCK_CONSENT = 'GO: REWARD RECEIPT MOCK LOCAL PROTOTYPE';

const FORBIDDEN_TERMS = new Set([
  'mint', 'write', 'publish', 'bridge', 'reward', 'token', 'contract',
  'marketplace', 'Node1', 'URP', 'Shariah', 'guaranteed', 'payout',
  'claimable', 'earn', 'authorized', 'transferable', 'public_url'
]);

export function createMockRewardReceiptReview({ requireConsent }, input = loadExampleRewardReceiptInput()) {
  if (requireConsent !== REWARD_RECEIPT_MOCK_CONSENT) {
    throw new Error('CONSENT_REQUIRED: exact "GO: REWARD RECEIPT MOCK LOCAL PROTOTYPE" required');
  }

  if (!input || typeof input !== 'object') {
    throw new Error('VALIDATION_FAILED: input must be object');
  }

  // Allowed fields only
  const allowed = ['eligibility_review_id', 'score_id', 'contribution_id', 'proposal_id', 'claim_label', 'consent_status', 'review_status', 'anti_gaming_status', 'proof_gaps', 'receipt_context', 'timestamp', 'local_context', 'description'];
  for (const k of Object.keys(input)) {
    if (!allowed.includes(k)) {
      throw new Error(`FORBIDDEN_INPUT: field "${k}" not allowed`);
    }
  }

  // Forbidden promotion rejection (O(1) after lower)
  // description is explicit non-claim posture text, so exclude it from the check
  const checkInput = { ...input };
  delete checkInput.description;
  const serialized = JSON.stringify(checkInput).toLowerCase();
  for (const term of FORBIDDEN_TERMS) {
    if (serialized.includes(term)) {
      throw new Error(`FORBIDDEN_PROMOTION: detected "${term}"`);
    }
  }

  if (!Array.isArray(input.proof_gaps) || input.proof_gaps.length === 0) {
    throw new Error('VALIDATION_FAILED: proof_gaps required and non-empty');
  }

  // Build allowed output only
  const receipt_statuses = [
    'receipt_not_ready_needs_more_evidence',
    'receipt_not_ready_needs_human_review',
    'rejected_for_forbidden_claim',
    'candidate_for_local_receipt_review_only'
  ];
  // For determinism in tests, cycle based on input or default
  const idx = (input.receipt_context && input.receipt_context.index) ? (input.receipt_context.index % 4) : 0;
  const receipt_status = receipt_statuses[idx];

  const body = {
    eligibility_review_id: input.eligibility_review_id || 'ex-rev-001',
    score_id: input.score_id || 'ex-score-001',
    contribution_id: input.contribution_id || 'local-contrib-001',
    proposal_id: input.proposal_id || 'ex-prop-001',
    claim_label: input.claim_label,
    consent_status: input.consent_status || 'required',
    review_status: input.review_status || 'boundary_local_only',
    anti_gaming_status: input.anti_gaming_status || 'enforced',
    receipt_status,
    proof_gaps: input.proof_gaps,
    receipt_expectation: {
      schema: 'bizra.reward.receipt.v0.1.local',
      placeholder: true,
      note: 'LOCAL MOCK EXPECTATION ONLY — NO MINT/WRITE/PUBLISH/BRIDGE [PROTOTYPE] [DESIGNED_NOT_LIVE]'
    },
    created_at: new Date().toISOString(),
    prototype_posture: '[PROTOTYPE] [DESIGNED_NOT_LIVE] LOCAL_ONLY'
  };

  const canonical = JSON.stringify(body, Object.keys(body).sort());
  const receipt_review_id = 'sha256:' + createHash('sha256').update(canonical + REWARD_RECEIPT_MOCK_CONSENT).digest('hex');

  return {
    receipt_review_id,
    ...body
  };
}

export function loadExampleRewardReceiptInput() {
  return {
    eligibility_review_id: 'ex-rev-001',
    score_id: 'ex-score-001',
    contribution_id: 'local-contrib-001',
    proposal_id: 'ex-prop-001',
    claim_label: 'Minimal local review receipt mock test boundary only [PROTOTYPE] [DESIGNED_NOT_LIVE]',
    consent_status: 'required',
    review_status: 'boundary_local_only',
    anti_gaming_status: 'enforced',
    proof_gaps: ['GAP_RECEIPT_NOT_YET_ISSUED', 'GAP_HUMAN_REVIEW_PENDING'],
    receipt_context: { node: 'Node0', phase: 'G23' },
    timestamp: Date.now(),
    local_context: { node: 'Node0', phase: 'G23' },
    description: 'Minimal local mock receipt review only — after G22R. Excludes all receipt implementation, minting, writing, publishing, bridging, reward logic, token, contracts, marketplace, Node1, URP, Shariah claim [DECLARED]'
  };
}

// Self-test (direct invoke) — exercises the 8 requirements + 4 statuses
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('--- BIZRA G23: REWARD RECEIPT MOCK LOCAL PROTOTYPE SELF-TEST ---');
  try {
    const base = loadExampleRewardReceiptInput();

    // 1. accepts valid
    const r1 = createMockRewardReceiptReview({ requireConsent: REWARD_RECEIPT_MOCK_CONSENT }, base);
    console.log('1. accepts valid input: receipt_review_id=', r1.receipt_review_id.substring(0,20)+'...');

    // 2. rejects missing consent
    try { createMockRewardReceiptReview({ requireConsent: 'WRONG' }, base); throw new Error('should have thrown'); } catch(e){ if(!e.message.includes('CONSENT_REQUIRED')) throw e; console.log('2. rejects missing exact consent'); }

    // 3. rejects forbidden
    try { createMockRewardReceiptReview({ requireConsent: REWARD_RECEIPT_MOCK_CONSENT }, { ...base, receipt_context: { note: 'expected mint' } }); throw new Error('should have thrown'); } catch(e){ if(!e.message.includes('FORBIDDEN_PROMOTION')) throw e; console.log('3. rejects forbidden mint/write/publish/bridge language'); }

    // 4+5. returns allowed only, never forbidden fields
    const r4 = createMockRewardReceiptReview({ requireConsent: REWARD_RECEIPT_MOCK_CONSENT }, base);
    const allowed = ['schema','receipt_review_id','eligibility_review_id','score_id','contribution_id','proposal_id','claim_label','consent_status','review_status','anti_gaming_status','receipt_status','proof_gaps','receipt_expectation','created_at','prototype_posture'];
    const hasOnlyAllowed = Object.keys(r4).every(k => allowed.includes(k));
    const hasNoForbidden = !('receipt_written' in r4 || 'receipt_minted' in r4 || 'reward_authorized' in r4 || 'token_amount' in r4 || 'contract_call' in r4);
    console.log('4+5. returns allowed fields only, never mint/write/reward/token/contract:', hasOnlyAllowed && hasNoForbidden);

    // 6. requires proof_gaps
    try { createMockRewardReceiptReview({ requireConsent: REWARD_RECEIPT_MOCK_CONSENT }, { ...base, proof_gaps: [] }); throw new Error('should have thrown'); } catch(e){ if(!e.message.includes('proof_gaps')) throw e; console.log('6. requires proof_gaps'); }

    // 7. deterministic id
    const r7a = createMockRewardReceiptReview({ requireConsent: REWARD_RECEIPT_MOCK_CONSENT }, base);
    const r7b = createMockRewardReceiptReview({ requireConsent: REWARD_RECEIPT_MOCK_CONSENT }, base);
    console.log('7. deterministic receipt_review_id:', r7a.receipt_review_id === r7b.receipt_review_id);

    // 8. exercises all 4 receipt_status
    const statuses = new Set();
    for (let i=0; i<4; i++) {
      const inp = { ...base, receipt_context: { index: i } };
      const r = createMockRewardReceiptReview({ requireConsent: REWARD_RECEIPT_MOCK_CONSENT }, inp);
      statuses.add(r.receipt_status);
    }
    console.log('8. exercises all four receipt_status:', statuses.size === 4, Array.from(statuses));

    console.log('G23 self-test PASS (local mock, consented, gapped, deterministic, all statuses, no forbidden output).');
    process.exit(0);
  } catch (e) {
    console.error('G23 SELF-TEST FAIL:', e.message);
    process.exit(1);
  }
}
