# REWARD-ELIGIBILITY-CONTRACT-PREVIEW-1A

Truth label: `REWARD_ELIGIBILITY_CONTRACT_PREVIEW_MEASURED_REPO`

## Purpose

Preview-only reward-eligibility contract: classifies a DEMA lifecycle outcome as reward-eligible or reward-ineligible from evidence refs, monitor state, and claim flags — inert output with no score, no authority signal, no action-permission field; forbidden claims and monitor-hiding are dominant refusals; evidence refs mandatory.

## Input Contract

```js
runRewardEligibilityContractPreview({ consent, input })
```

Exact consent:

```text
GO: evaluate reward eligibility
```

## Output Contract

```text
schema
truth_label
ok
content_hash
boundary.execution_allowed (false)
blocked_by[]
```

## Verification

```js
verifyRewardEligibilityContractPreview(payload)
```

Body-bound re-derivation. Tampering any field breaks the bind.

## Boundaries

- Pure kernel; any effect is injected and documented in the kernel header
- No network, daemon, wallet, token, federation, or live execution
- All-false boundary invariant — signing/preview authority ≠ execution authority

## Files

```text
packages/core/src/reward-eligibility-contract-preview.js
tests/reward-eligibility-contract-preview.test.js
scripts/review/reward-eligibility-contract-preview-check.mjs
scripts/check.mjs
packages/core/src/dema-capability-truth-registry.js
docs/receipts/REWARD_ELIGIBILITY_CONTRACT_PREVIEW_1A.md
docs/02-architecture/REWARD_ELIGIBILITY_CONTRACT_PREVIEW_v0_1.md
```

## Commands

```bash
node --test tests/reward-eligibility-contract-preview.test.js
node scripts/review/reward-eligibility-contract-preview-check.mjs --json
npm test
npm run check
```
