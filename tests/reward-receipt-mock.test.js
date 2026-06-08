/**
 * ADR-025 Reward Receipt Mock Local Prototype - Tests (G23)
 * [PROTOTYPE] [DESIGNED_NOT_LIVE]
 * LOCAL_ONLY
 *
 * Tests exercise the local mock receipt review object.
 * No receipt implementation, minting, writing, publishing, bridging, or reward authorization.
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

import test from 'node:test';
import assert from 'node:assert/strict';
import { createMockRewardReceiptReview, loadExampleRewardReceiptInput, REWARD_RECEIPT_MOCK_CONSENT } from '../scripts/reward-receipt-mock.mjs';

// 1. accepts one valid local mock receipt review input
test('accepts one valid local mock receipt review input', () => {
  const input = loadExampleRewardReceiptInput();
  const review = createMockRewardReceiptReview({ requireConsent: REWARD_RECEIPT_MOCK_CONSENT }, input);
  assert.ok(review.receipt_review_id && review.receipt_review_id.startsWith('sha256:'), 'accepts valid input and returns id [DECLARED]');
});

// 2. rejects missing exact consent
test('rejects missing exact consent', () => {
  const input = loadExampleRewardReceiptInput();
  assert.throws(() => createMockRewardReceiptReview({ requireConsent: 'WRONG' }, input), /CONSENT_REQUIRED/, 'rejects missing exact consent [DECLARED]');
});

// 3. rejects forbidden mint/write/publish/bridge language
test('rejects forbidden mint/write/publish/bridge language', () => {
  const input = { ...loadExampleRewardReceiptInput(), receipt_context: { note: 'expected mint and publish' } };
  assert.throws(() => createMockRewardReceiptReview({ requireConsent: REWARD_RECEIPT_MOCK_CONSENT }, input), /FORBIDDEN_PROMOTION/, 'rejects forbidden language [DECLARED]');
});

// 4. returns allowed fields only
test('returns allowed fields only', () => {
  const input = loadExampleRewardReceiptInput();
  const review = createMockRewardReceiptReview({ requireConsent: REWARD_RECEIPT_MOCK_CONSENT }, input);
  const allowed = ['receipt_review_id','eligibility_review_id','score_id','contribution_id','proposal_id','claim_label','consent_status','review_status','anti_gaming_status','receipt_status','proof_gaps','receipt_expectation','created_at','prototype_posture'];
  const keys = Object.keys(review);
  const onlyAllowed = keys.every(k => allowed.includes(k));
  assert.ok(onlyAllowed, 'returns allowed fields only [DECLARED]');
});

// 5. never returns mint/write/reward/token/contract fields
test('never returns mint/write/reward/token/contract fields', () => {
  const input = loadExampleRewardReceiptInput();
  const review = createMockRewardReceiptReview({ requireConsent: REWARD_RECEIPT_MOCK_CONSENT }, input);
  const forbiddenPresent = 'receipt_written' in review || 'receipt_minted' in review || 'reward_authorized' in review || 'token_amount' in review || 'contract_call' in review;
  assert.ok(!forbiddenPresent, 'never returns forbidden economic/mint fields [DECLARED]');
});

// 6. requires proof_gaps
test('requires proof_gaps', () => {
  const input = { ...loadExampleRewardReceiptInput(), proof_gaps: [] };
  assert.throws(() => createMockRewardReceiptReview({ requireConsent: REWARD_RECEIPT_MOCK_CONSENT }, input), /proof_gaps/, 'requires proof_gaps [DECLARED]');
});

// 7. deterministic receipt_review_id for same input
test('deterministic receipt_review_id for same input', () => {
  const input = loadExampleRewardReceiptInput();
  const r1 = createMockRewardReceiptReview({ requireConsent: REWARD_RECEIPT_MOCK_CONSENT }, input);
  const r2 = createMockRewardReceiptReview({ requireConsent: REWARD_RECEIPT_MOCK_CONSENT }, input);
  assert.strictEqual(r1.receipt_review_id, r2.receipt_review_id, 'deterministic id [DECLARED]');
});

// 8. exercises all four receipt_status values
test('exercises all four receipt_status values', () => {
  const statuses = new Set();
  for (let i = 0; i < 4; i++) {
    const input = { ...loadExampleRewardReceiptInput(), receipt_context: { index: i } };
    const r = createMockRewardReceiptReview({ requireConsent: REWARD_RECEIPT_MOCK_CONSENT }, input);
    statuses.add(r.receipt_status);
  }
  assert.strictEqual(statuses.size, 4, 'exercises all four receipt_status [DECLARED]');
});
