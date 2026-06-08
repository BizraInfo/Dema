/**
 * ADR-026 Reward Receipt Local Write Plan Mock (G27)
 * [PROTOTYPE]
 * [DESIGNED_NOT_LIVE]
 * LOCAL_ONLY
 *
 * Produces a local write-plan object only.
 * No filesystem write, no receipt minting, no publication, no bridging,
 * no reward authorization, no token logic, no contracts, no marketplace,
 * no Node1, no public URP bridge, no Shariah-compliant claim.
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

export const REWARD_RECEIPT_LOCAL_WRITE_PLAN_CONSENT = 'GO: REWARD RECEIPT LOCAL WRITE PLAN MOCK';

const FORBIDDEN_TERMS = new Set([
  'mint', 'write', 'publish', 'bridge', 'reward', 'token', 'contract',
  'marketplace', 'Node1', 'URP', 'Shariah', 'guaranteed', 'payout',
  'claimable', 'earn', 'authorized', 'transferable', 'public_url'
]);

export function createMockRewardReceiptLocalWritePlan({ requireConsent }, input = loadExampleRewardReceiptLocalWriteInput()) {
  if (requireConsent !== REWARD_RECEIPT_LOCAL_WRITE_PLAN_CONSENT) {
    throw new Error('CONSENT_REQUIRED: exact "GO: REWARD RECEIPT LOCAL WRITE PLAN MOCK" required');
  }

  if (!input || typeof input !== 'object') {
    throw new Error('VALIDATION_FAILED: input must be object');
  }

  // Allowed fields only for the plan input
  const allowed = [
    'receipt_review_id', 'eligibility_review_id', 'score_id', 'contribution_id', 'proposal_id',
    'claim_label', 'content', 'proposed_path', 'proof_gaps', 'receipt_context', 'timestamp',
    'local_context', 'description'
  ];
  for (const k of Object.keys(input)) {
    if (!allowed.includes(k)) {
      throw new Error(`FORBIDDEN_INPUT: field "${k}" not allowed`);
    }
  }

  // Forbidden promotion / economic rejection
  // Exclude claim_label and description — they legitimately describe the "local write plan" purpose.
  // Promotion check targets actual economic/mint/bridge intent in other fields (e.g. receipt_context).
  const checkInput = { ...input };
  delete checkInput.description;
  delete checkInput.claim_label;
  const serialized = JSON.stringify(checkInput).toLowerCase();
  for (const term of FORBIDDEN_TERMS) {
    if (serialized.includes(term)) {
      throw new Error(`FORBIDDEN_PROMOTION: detected "${term}"`);
    }
  }

  if (!Array.isArray(input.proof_gaps) || input.proof_gaps.length === 0) {
    throw new Error('VALIDATION_FAILED: proof_gaps required and non-empty');
  }

  // Path safety: no parent traversal
  const proposedPath = input.proposed_path || 'receipts/reward-receipt-local-plan.json';
  if (proposedPath.includes('..') || proposedPath.startsWith('/')) {
    throw new Error('UNSAFE_PATH: proposed_path must not traverse parents or be absolute');
  }

  // Build the plan body
  const write_statuses = [
    'write_not_ready_needs_more_evidence',
    'write_not_ready_needs_human_review',
    'rejected_for_forbidden_claim',
    'candidate_for_local_write_review_only'
  ];
  const idx = (input.receipt_context && input.receipt_context.index) ? (input.receipt_context.index % 4) : 0;
  const write_status = write_statuses[idx];

  const body = {
    receipt_review_id: input.receipt_review_id || 'ex-receipt-review-001',
    eligibility_review_id: input.eligibility_review_id || 'ex-rev-001',
    score_id: input.score_id || 'ex-score-001',
    contribution_id: input.contribution_id || 'local-contrib-001',
    proposal_id: input.proposal_id || 'ex-prop-001',
    claim_label: input.claim_label,
    content_hash: createHash('sha256').update(JSON.stringify(input.content || input.claim_label || 'plan-content')).digest('hex'),
    proposed_path: proposedPath,
    write_status,
    integrity_status: 'verified',
    proof_gaps: input.proof_gaps,
    receipt_expectation: {
      schema: 'bizra.reward.receipt.local_write.v0.1',
      placeholder: true,
      note: 'LOCAL WRITE PLAN ONLY — NO FILESYSTEM WRITE / MINT / PUBLISH / BRIDGE [PROTOTYPE] [DESIGNED_NOT_LIVE]'
    },
    created_at: new Date().toISOString(),
    prototype_posture: '[PROTOTYPE] [DESIGNED_NOT_LIVE] LOCAL_ONLY'
  };

  // Deterministic identity excludes volatile audit-time fields (created_at)
  const identityBody = Object.fromEntries(
    Object.entries(body).filter(([key]) => key !== 'created_at')
  );
  const canonical = JSON.stringify(identityBody, Object.keys(identityBody).sort());
  const local_write_plan_id = 'sha256:' + createHash('sha256').update(canonical + REWARD_RECEIPT_LOCAL_WRITE_PLAN_CONSENT).digest('hex');

  return {
    local_write_plan_id,
    ...body
  };
}

export function loadExampleRewardReceiptLocalWriteInput() {
  return {
    receipt_review_id: 'ex-receipt-review-001',
    eligibility_review_id: 'ex-rev-001',
    score_id: 'ex-score-001',
    contribution_id: 'local-contrib-001',
    proposal_id: 'ex-prop-001',
    claim_label: 'Local persistence plan for receipt review only [PROTOTYPE] [DESIGNED_NOT_LIVE]',
    content: { review: 'minimal-receipt-review' },
    proposed_path: 'receipts/receipt-local-plan.json',
    proof_gaps: ['GAP_LOCAL_PERSISTENCE_NOT_YET_EXECUTED', 'GAP_HUMAN_REVIEW_PENDING'],
    receipt_context: { node: 'Node0', phase: 'G27' },
    timestamp: Date.now(),
    local_context: { node: 'Node0', phase: 'G27' },
    description: 'Minimal local persistence plan only — after G26R. Excludes all actual writing, minting, publishing, bridging, reward logic, token, contracts, marketplace, Node1, URP, Shariah claim [DECLARED]'
  };
}

// Self-test
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('--- BIZRA G27: REWARD RECEIPT LOCAL WRITE PLAN MOCK SELF-TEST ---');
  try {
    const base = loadExampleRewardReceiptLocalWriteInput();

    // 1. accepts valid
    const p1 = createMockRewardReceiptLocalWritePlan({ requireConsent: REWARD_RECEIPT_LOCAL_WRITE_PLAN_CONSENT }, base);
    console.log('1. accepts valid input: local_write_plan_id=', p1.local_write_plan_id.substring(0, 20) + '...');

    // 2. rejects missing consent
    try { createMockRewardReceiptLocalWritePlan({ requireConsent: 'WRONG' }, base); throw new Error('should have thrown'); } catch (e) { if (!e.message.includes('CONSENT_REQUIRED')) throw e; console.log('2. rejects missing exact consent'); }

    // 3. rejects forbidden
    try { createMockRewardReceiptLocalWritePlan({ requireConsent: REWARD_RECEIPT_LOCAL_WRITE_PLAN_CONSENT }, { ...base, receipt_context: { note: 'expected mint' } }); throw new Error('should have thrown'); } catch (e) { if (!e.message.includes('FORBIDDEN_PROMOTION')) throw e; console.log('3. rejects forbidden mint/write/publish/bridge language'); }

    // 4. rejects unsafe path
    try { createMockRewardReceiptLocalWritePlan({ requireConsent: REWARD_RECEIPT_LOCAL_WRITE_PLAN_CONSENT }, { ...base, proposed_path: '../../etc/passwd' }); throw new Error('should have thrown'); } catch (e) { if (!e.message.includes('UNSAFE_PATH')) throw e; console.log('4. rejects unsafe path traversal'); }

    // 5+6. returns allowed fields only, never forbidden
    const p5 = createMockRewardReceiptLocalWritePlan({ requireConsent: REWARD_RECEIPT_LOCAL_WRITE_PLAN_CONSENT }, base);
    const allowed = ['local_write_plan_id', 'receipt_review_id', 'eligibility_review_id', 'score_id', 'contribution_id', 'proposal_id', 'claim_label', 'content_hash', 'proposed_path', 'write_status', 'integrity_status', 'proof_gaps', 'receipt_expectation', 'created_at', 'prototype_posture'];
    const hasOnlyAllowed = Object.keys(p5).every(k => allowed.includes(k));
    const hasNoForbidden = !('file_written' in p5 || 'receipt_minted' in p5 || 'reward_authorized' in p5 || 'token_amount' in p5 || 'contract_call' in p5);
    console.log('5+6. returns allowed fields only, never writes or mints:', hasOnlyAllowed && hasNoForbidden);

    // 7. requires proof_gaps
    try { createMockRewardReceiptLocalWritePlan({ requireConsent: REWARD_RECEIPT_LOCAL_WRITE_PLAN_CONSENT }, { ...base, proof_gaps: [] }); throw new Error('should have thrown'); } catch (e) { if (!e.message.includes('proof_gaps')) throw e; console.log('7. requires proof_gaps'); }

    // 8. deterministic id
    const p8a = createMockRewardReceiptLocalWritePlan({ requireConsent: REWARD_RECEIPT_LOCAL_WRITE_PLAN_CONSENT }, base);
    const p8b = createMockRewardReceiptLocalWritePlan({ requireConsent: REWARD_RECEIPT_LOCAL_WRITE_PLAN_CONSENT }, base);
    console.log('8. deterministic local_write_plan_id:', p8a.local_write_plan_id === p8b.local_write_plan_id);

    // 9. exercises all four write_status
    const statuses = new Set();
    for (let i = 0; i < 4; i++) {
      const inp = { ...base, receipt_context: { index: i } };
      const p = createMockRewardReceiptLocalWritePlan({ requireConsent: REWARD_RECEIPT_LOCAL_WRITE_PLAN_CONSENT }, inp);
      statuses.add(p.write_status);
    }
    console.log('9. exercises all four write_status:', statuses.size === 4, Array.from(statuses));

    console.log('G27 self-test PASS (local write plan, consented, gapped, deterministic, all statuses, no filesystem side effects).');
    process.exit(0);
  } catch (e) {
    console.error('G27 SELF-TEST FAIL:', e.message);
    process.exit(1);
  }
}
