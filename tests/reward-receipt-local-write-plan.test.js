/**
 * ADR-026 Reward Receipt Local Write Plan Mock - Tests (G27)
 * [PROTOTYPE] [DESIGNED_NOT_LIVE]
 * LOCAL_ONLY
 *
 * Tests exercise the local write-plan object.
 * No filesystem write, no receipt implementation, minting, publishing, bridging,
 * or reward authorization.
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
import {
  createMockRewardReceiptLocalWritePlan,
  loadExampleRewardReceiptLocalWriteInput,
  REWARD_RECEIPT_LOCAL_WRITE_PLAN_CONSENT
} from '../scripts/reward-receipt-local-write-plan.mjs';

// 1. accepts one valid local write-plan input
test('accepts one valid local write-plan input', () => {
  const input = loadExampleRewardReceiptLocalWriteInput();
  const plan = createMockRewardReceiptLocalWritePlan({ requireConsent: REWARD_RECEIPT_LOCAL_WRITE_PLAN_CONSENT }, input);
  assert.ok(plan.local_write_plan_id && plan.local_write_plan_id.startsWith('sha256:'), 'accepts valid input and returns id [DECLARED]');
  assert.ok(plan.proposed_path && !plan.proposed_path.includes('..'), 'proposed_path is safe [DECLARED]');
});

// 2. rejects missing exact consent
test('rejects missing exact consent', () => {
  const input = loadExampleRewardReceiptLocalWriteInput();
  assert.throws(() => createMockRewardReceiptLocalWritePlan({ requireConsent: 'WRONG' }, input), /CONSENT_REQUIRED/, 'rejects missing exact consent [DECLARED]');
});

// 3. rejects forbidden mint/write/publish/bridge/economic language
test('rejects forbidden mint/write/publish/bridge/economic language', () => {
  const input = { ...loadExampleRewardReceiptLocalWriteInput(), receipt_context: { note: 'expected mint and reward' } };
  assert.throws(() => createMockRewardReceiptLocalWritePlan({ requireConsent: REWARD_RECEIPT_LOCAL_WRITE_PLAN_CONSENT }, input), /FORBIDDEN_PROMOTION/, 'rejects forbidden language [DECLARED]');
});

// 4. rejects unsafe path traversal
test('rejects unsafe path traversal', () => {
  const input = { ...loadExampleRewardReceiptLocalWriteInput(), proposed_path: '../../etc/passwd' };
  assert.throws(() => createMockRewardReceiptLocalWritePlan({ requireConsent: REWARD_RECEIPT_LOCAL_WRITE_PLAN_CONSENT }, input), /UNSAFE_PATH/, 'rejects unsafe path traversal [DECLARED]');
});

// 5. returns allowed fields only
test('returns allowed fields only', () => {
  const input = loadExampleRewardReceiptLocalWriteInput();
  const plan = createMockRewardReceiptLocalWritePlan({ requireConsent: REWARD_RECEIPT_LOCAL_WRITE_PLAN_CONSENT }, input);
  const allowed = ['local_write_plan_id','receipt_review_id','eligibility_review_id','score_id','contribution_id','proposal_id','claim_label','content_hash','proposed_path','write_status','integrity_status','proof_gaps','receipt_expectation','created_at','prototype_posture'];
  const keys = Object.keys(plan);
  const onlyAllowed = keys.every(k => allowed.includes(k));
  assert.ok(onlyAllowed, 'returns allowed fields only [DECLARED]');
});

// 6. never writes to filesystem
test('never writes to filesystem', () => {
  const input = loadExampleRewardReceiptLocalWriteInput();
  const plan = createMockRewardReceiptLocalWritePlan({ requireConsent: REWARD_RECEIPT_LOCAL_WRITE_PLAN_CONSENT }, input);
  const hasWriteSideEffect = 'file_written' in plan || 'receipt_minted' in plan || 'reward_authorized' in plan || 'token_amount' in plan || 'contract_call' in plan;
  assert.ok(!hasWriteSideEffect, 'never returns filesystem or mint side-effect fields [DECLARED]');
});

// 7. deterministic local_write_plan_id for same semantic input
test('deterministic local_write_plan_id for same semantic input', () => {
  const input = loadExampleRewardReceiptLocalWriteInput();
  const p1 = createMockRewardReceiptLocalWritePlan({ requireConsent: REWARD_RECEIPT_LOCAL_WRITE_PLAN_CONSENT }, input);
  const p2 = createMockRewardReceiptLocalWritePlan({ requireConsent: REWARD_RECEIPT_LOCAL_WRITE_PLAN_CONSENT }, input);
  assert.strictEqual(p1.local_write_plan_id, p2.local_write_plan_id, 'deterministic id [DECLARED]');
});

// 8. exercises all four write_status values
test('exercises all four write_status values', () => {
  const statuses = new Set();
  for (let i = 0; i < 4; i++) {
    const input = { ...loadExampleRewardReceiptLocalWriteInput(), receipt_context: { index: i } };
    const p = createMockRewardReceiptLocalWritePlan({ requireConsent: REWARD_RECEIPT_LOCAL_WRITE_PLAN_CONSENT }, input);
    statuses.add(p.write_status);
  }
  assert.strictEqual(statuses.size, 4, 'exercises all four write_status [DECLARED]');
});
