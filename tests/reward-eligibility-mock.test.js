/**
 * ADR-024 / G20 Reward Eligibility Mock Local Prototype
 * [PROTOTYPE]
 * [DESIGNED_NOT_LIVE]
 * LOCAL_ONLY
 *
 * This test proves a local mock review object only. It does not prove reward
 * eligibility, reward logic, token logic, contracts, marketplace behavior,
 * Node1 propagation, public URP publication, or Shariah-compliance claims.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createMockRewardEligibilityReview,
  loadExampleRewardEligibilityInput,
  REWARD_ELIGIBILITY_MOCK_CONSENT
} from '../scripts/reward-eligibility-mock.mjs';

const forbiddenOutputKeys = [
  'token_amount',
  'reward_amount',
  'eligibility',
  'payout',
  'mint',
  'contract_call',
  'market_value',
  'public_leaderboard',
  'apy',
  'apr',
  'yield',
  'shariah_compliant',
  'node1_propagation',
  'public_urp_publication'
];

test('G20 requires exact consent for mock reward eligibility review', () => {
  assert.throws(
    () => createMockRewardEligibilityReview(
      { requireConsent: 'GO' },
      loadExampleRewardEligibilityInput()
    ),
    /CONSENT_REQUIRED/
  );
});

test('G20 accepts ADR-024 allowed input fields and emits local mock review shape', () => {
  const input = loadExampleRewardEligibilityInput();
  const result = createMockRewardEligibilityReview(
    { requireConsent: REWARD_ELIGIBILITY_MOCK_CONSENT },
    input
  );

  assert.match(result.id, /^sha256:[a-f0-9]{64}$/);
  assert.equal(result.review.schema, 'bizra.impact.reward-eligibility.mock-review.v0.1');
  assert.equal(result.review.score_id, input.score_id);
  assert.equal(result.review.contribution_id, input.contribution_id);
  assert.equal(result.review.proposal_id, input.proposal_id);
  assert.equal(result.review.claim_label, input.claim_label);
  assert.equal(result.review.consent_status, 'required');
  assert.equal(result.review.review_status, 'local_review_only');
  assert.equal(result.review.receipt_expectation.schema, 'bizra.impact.reward.eligibility.v0.1.local');
  assert.equal(result.review.receipt_expectation.placeholder, true);
  assert.equal(result.review.prototype_posture, '[PROTOTYPE] [DESIGNED_NOT_LIVE] LOCAL_ONLY');
  assert.ok(result.review.proof_gaps.length > 0);
  assert.equal(Object.isFrozen(result.review), true);
});

test('G20 rejects fields outside ADR-024 allowed input boundary', () => {
  const input = {
    ...loadExampleRewardEligibilityInput(),
    token_amount: 100
  };

  assert.throws(
    () => createMockRewardEligibilityReview({ requireConsent: REWARD_ELIGIBILITY_MOCK_CONSENT }, input),
    /FORBIDDEN_INPUT: field "token_amount"/
  );
});

test('G20 rejects forbidden reward, token, market, bridge, and Shariah language', () => {
  const forbiddenNotes = [
    'expected payout after token mint',
    'market value and public leaderboard',
    'node1 propagation through public URP bridge',
    'shariah-compliant claim'
  ];

  for (const note of forbiddenNotes) {
    const input = {
      ...loadExampleRewardEligibilityInput(),
      local_context: { note }
    };

    assert.throws(
      () => createMockRewardEligibilityReview({ requireConsent: REWARD_ELIGIBILITY_MOCK_CONSENT }, input),
      /FORBIDDEN_PROMOTION/
    );
  }
});

test('G20 covers the four ADR-024 eligibility_status values as local prototype outcomes', () => {
  const statuses = [
    ['needs_more_evidence', 'not_eligible_needs_more_evidence'],
    ['needs_human_review', 'not_eligible_needs_human_review'],
    ['rejected_for_forbidden_claim', 'rejected_for_forbidden_claim'],
    ['candidate_for_local_review_only', 'candidate_for_local_review_only']
  ];

  for (const [scenario, expected] of statuses) {
    const input = {
      ...loadExampleRewardEligibilityInput(),
      local_context: {
        node: 'Node0',
        prototype_scenario: scenario
      }
    };
    const result = createMockRewardEligibilityReview(
      { requireConsent: REWARD_ELIGIBILITY_MOCK_CONSENT },
      input
    );

    assert.equal(result.review.eligibility_status, expected);
    assert.equal(result.review.review_status, 'local_review_only');
    assert.equal(result.boundary.noReward, true);
  }
});

test('G20 output excludes forbidden economic, public, bridge, and certification fields', () => {
  const result = createMockRewardEligibilityReview(
    { requireConsent: REWARD_ELIGIBILITY_MOCK_CONSENT },
    loadExampleRewardEligibilityInput()
  );

  for (const key of forbiddenOutputKeys) {
    assert.equal(Object.hasOwn(result.review, key), false, `${key} must not be emitted`);
  }

  assert.deepEqual(result.boundary, {
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
});

test('G20 proof markers preserve consent, review, receipt, proof gap, and non-claim boundary', () => {
  const result = createMockRewardEligibilityReview(
    { requireConsent: REWARD_ELIGIBILITY_MOCK_CONSENT },
    loadExampleRewardEligibilityInput()
  );

  assert.equal(result.proof.claim_label, result.review.claim_label);
  assert.equal(result.proof.consent_required, true);
  assert.equal(result.proof.review_boundary, true);
  assert.equal(result.proof.receipt_expectation.placeholder, true);
  assert.equal(result.proof.proof_gaps_present, true);
  assert.equal(result.proof.non_claim_boundary, true);
});
