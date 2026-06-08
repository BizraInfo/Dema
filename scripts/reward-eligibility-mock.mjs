#!/usr/bin/env node
/**
 * ADR-024 / G20 Reward Eligibility Mock Local Prototype
 * [PROTOTYPE] [DESIGNED_NOT_LIVE] LOCAL_ONLY
 *
 * Mock review object only. No reward eligibility implementation, reward logic,
 * token logic, contract linkage, marketplace signal, public economic copy,
 * Node1 propagation, public URP bridge, Shariah-compliance claim, runtime, or
 * receipt mint/write is introduced here.
 */

import { createHash } from 'node:crypto';

export const REWARD_ELIGIBILITY_MOCK_CONSENT = 'GO: MOCK REWARD ELIGIBILITY REVIEW FOR ADR-024';

const ALLOWED_INPUT_FIELDS = new Set([
  'score_id',
  'contribution_id',
  'proposal_id',
  'claim_label',
  'evidence_status',
  'consent_status',
  'review_status',
  'anti_gaming_status',
  'proof_gaps',
  'reviewer_reference',
  'local_context',
  'timestamp'
]);

const FORBIDDEN_PROMOTION_TERMS = new Set([
  'token price',
  'expected payout',
  'trading volume',
  'public ranking',
  'market demand',
  'apr',
  'apy',
  'yield',
  'investment language',
  'automatic mint trigger',
  'contract address',
  'shariah-compliance assertion',
  'shariah-compliant',
  'node1 propagation',
  'public urp bridge',
  'token mint',
  'token amount',
  'reward amount',
  'market value',
  'public leaderboard',
  'guaranteed payment',
  'fixed return',
  'payout=true',
  'mint=true'
]);

const ELIGIBILITY_STATUS_BY_SCENARIO = Object.freeze({
  needs_more_evidence: 'not_eligible_needs_more_evidence',
  needs_human_review: 'not_eligible_needs_human_review',
  rejected_for_forbidden_claim: 'rejected_for_forbidden_claim',
  candidate_for_local_review_only: 'candidate_for_local_review_only'
});

export function createMockRewardEligibilityReview(
  { requireConsent },
  input = loadExampleRewardEligibilityInput()
) {
  if (requireConsent !== REWARD_ELIGIBILITY_MOCK_CONSENT) {
    throw new Error(`CONSENT_REQUIRED: exact "${REWARD_ELIGIBILITY_MOCK_CONSENT}" marker required`);
  }

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('VALIDATION_FAILED: input must be object');
  }

  for (const key of Object.keys(input)) {
    if (!ALLOWED_INPUT_FIELDS.has(key)) {
      throw new Error(`FORBIDDEN_INPUT: field "${key}" not in allowed set per ADR-024`);
    }
  }

  if (!input.claim_label || typeof input.claim_label !== 'string' || input.claim_label.trim().length === 0) {
    throw new Error('VALIDATION_FAILED: claim_label required');
  }

  const serialized = JSON.stringify(input).toLowerCase();
  for (const term of FORBIDDEN_PROMOTION_TERMS) {
    if (serialized.includes(term)) {
      throw new Error(`FORBIDDEN_PROMOTION: detected "${term}" per ADR-024`);
    }
  }

  const scenario = input.local_context && input.local_context.prototype_scenario;
  const eligibilityStatus = ELIGIBILITY_STATUS_BY_SCENARIO[scenario] ||
    ELIGIBILITY_STATUS_BY_SCENARIO.needs_more_evidence;

  const proofGaps = Array.isArray(input.proof_gaps) && input.proof_gaps.length > 0
    ? [...input.proof_gaps]
    : [
        'GAP_REWARD_ELIGIBILITY_IMPLEMENTATION_BLOCKED',
        'GAP_HUMAN_REVIEW_NOT_COMPLETED',
        'GAP_LOCAL_RECEIPT_NOT_WRITTEN',
        'GAP_PUBLIC_OR_ECONOMIC_USE_NOT_AUTHORIZED'
      ];

  const receiptExpectation = Object.freeze({
    schema: 'bizra.impact.reward.eligibility.v0.1.local',
    placeholder: true,
    mode: 'read_list_future_only',
    note: 'MOCK REVIEW ONLY - no reward, no token, no contract, no marketplace, no public economic signal [PROTOTYPE] [DESIGNED_NOT_LIVE]'
  });

  const review = Object.freeze({
    schema: 'bizra.impact.reward-eligibility.mock-review.v0.1',
    eligibility_review_id: null,
    score_id: input.score_id || 'local-score-001',
    contribution_id: input.contribution_id || 'local-contrib-001',
    proposal_id: input.proposal_id || 'local-prop-001',
    claim_label: input.claim_label,
    evidence_status: input.evidence_status || 'partial',
    consent_status: 'required',
    review_status: 'local_review_only',
    anti_gaming_status: input.anti_gaming_status || 'enforced',
    eligibility_status: eligibilityStatus,
    proof_gaps: Object.freeze(proofGaps),
    receipt_expectation: receiptExpectation,
    created_at: new Date(0).toISOString(),
    prototype_posture: '[PROTOTYPE] [DESIGNED_NOT_LIVE] LOCAL_ONLY'
  });

  const proof = Object.freeze({
    claim_label: review.claim_label,
    consent_required: true,
    review_boundary: true,
    anti_gaming_enforced: true,
    proof_gaps_present: review.proof_gaps.length > 0,
    receipt_expectation: review.receipt_expectation,
    non_claim_boundary: true
  });

  const boundary = Object.freeze({
    localOnly: true,
    mockOnly: true,
    noRewardEligibilityImplementation: true,
    noReward: true,
    noToken: true,
    noContracts: true,
    noMarketplace: true,
    noPublicEconomic: true,
    noNode1: true,
    noPublicURPBridge: true,
    noShariahClaim: true,
    noReceiptMint: true,
    noRuntime: true
  });

  const bodyForSeal = {
    review: { ...review, eligibility_review_id: 'pending' },
    proof,
    boundary
  };
  const id = `sha256:${createHash('sha256').update(JSON.stringify(bodyForSeal)).digest('hex')}`;
  const sealedReview = Object.freeze({ ...review, eligibility_review_id: id });

  return Object.freeze({
    id,
    review: sealedReview,
    proof,
    boundary,
    status: 'MOCK_REVIEW_ONLY_READY_FOR_HUMAN_REVIEW',
    created_at: 0
  });
}

export function loadExampleRewardEligibilityInput() {
  return {
    score_id: 'local-score-001',
    contribution_id: 'local-contrib-001',
    proposal_id: 'local-prop-001',
    claim_label: 'Local review candidate state only [PROTOTYPE] [DESIGNED_NOT_LIVE]',
    evidence_status: 'partial',
    consent_status: 'required',
    review_status: 'local_review_only',
    anti_gaming_status: 'enforced',
    proof_gaps: ['GAP_HUMAN_REVIEW_NOT_COMPLETED'],
    reviewer_reference: 'Node0-local-reviewer-placeholder',
    local_context: {
      node: 'Node0',
      phase: 'G20',
      prototype_scenario: 'needs_more_evidence'
    },
    timestamp: 0
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const result = createMockRewardEligibilityReview(
      { requireConsent: REWARD_ELIGIBILITY_MOCK_CONSENT },
      loadExampleRewardEligibilityInput()
    );
    console.log('G20 reward eligibility mock local prototype PASS.');
    console.log('ID:', result.id);
    console.log('eligibility_status:', result.review.eligibility_status);
    console.log('boundary noReward:', result.boundary.noReward);
    process.exit(0);
  } catch (error) {
    console.error('G20 reward eligibility mock local prototype FAIL:', error.message);
    process.exit(1);
  }
}
