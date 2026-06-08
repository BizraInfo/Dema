# G20 Reward Eligibility Mock Local Prototype Design

## Status

Working artifact / approved by exact operator GO on 2026-06-08.

## Goal

Advance from the ADR-024/G19 reward eligibility test scaffold to a minimal local mock review object without implementing reward eligibility, reward logic, token logic, contracts, marketplace behavior, Node1 propagation, public URP bridging, or Shariah/economic claims.

## Scope

This slice creates a pure local mock module and tests only. It is:

- `[PROTOTYPE]`
- `[DESIGNED_NOT_LIVE]`
- `LOCAL_ONLY`
- consent-bound
- review-boundary-only
- receipt-expectation-only

It does not write receipts, mint receipts, run runtime work, publish public state, calculate economic value, or authorize any reward.

## Architecture

Add `scripts/reward-eligibility-mock.mjs` following the local patterns in `scripts/impact-scoring-mock.mjs` and `scripts/real-scoring-minimal.mjs`.

The module exposes:

- `createMockRewardEligibilityReview({ requireConsent }, input)`
- `loadExampleRewardEligibilityInput()`
- `REWARD_ELIGIBILITY_MOCK_CONSENT`

The function returns a deterministic `sha256:`-identified object with:

- allowed ADR-024 input fields only
- forbidden input rejection by serialized term scan
- exact consent gate
- all four ADR-024 `eligibility_status` values reachable through explicit local prototype simulation markers
- required `proof_gaps`
- receipt expectation object only
- explicit no-economics boundary flags

## Test Surface

Add `tests/reward-eligibility-mock.test.js` with focused native Node tests for:

1. exact consent gate
2. allowed input boundary
3. forbidden input rejection
4. allowed output shape
5. forbidden output absence
6. four-value `eligibility_status` enum coverage
7. consent/review/receipt/non-claim boundary

## Delivery Gate Integration

Extend `scripts/delivery-check.mjs` with a non-fatal ADR-024/G20 exercise mirroring the ADR-021 mock scoring integration pattern. The delivery check must prove the module emits the expected markers without making the A+ orchestrator responsible for reward eligibility behavior.

## Boundaries

The implementation must not include any of these fields or effects in the returned review object:

- `token_amount`
- `reward_amount`
- `eligibility`
- `payout`
- `mint`
- `contract_call`
- `market_value`
- `public_leaderboard`
- `apy`
- `apr`
- `yield`
- `shariah_compliant`
- `node1_propagation`
- `public_urp_publication`

## Verification

Minimum local checks:

```bash
node --test tests/reward-eligibility-mock.test.js
npm run delivery:check
npm test
npm run check
npm run llm:guidance
git diff --check
```

Push remains a separate hard stop requiring explicit operator GO.
