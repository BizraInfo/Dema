# Receipt: REWARD-ELIGIBILITY-CONTRACT-PREVIEW-1A

Truth label: `REWARD_ELIGIBILITY_CONTRACT_PREVIEW_MEASURED_REPO`

## Slice

Preview-only reward-eligibility contract: classifies a DEMA lifecycle outcome as reward-eligible or reward-ineligible from evidence refs, monitor state, and claim flags — inert output with no score, no authority signal, no action-permission field; forbidden claims and monitor-hiding are dominant refusals; evidence refs mandatory.

```text
plan → build → verify → tamper-reject
```

## Proof Contract

The default gate must pass only while:

- the exact GO phrase matches byte-for-byte,
- the canonical payload is content-addressed,
- verification re-derives from the body and rejects tamper,
- a forged body with a recomputed hash is still rejected,
- the boundary stays all-false (no execution authority).

`npm run check` runs `reward-eligibility-contract-preview-check.mjs` and keeps `REWARD_ELIGIBILITY_CONTRACT_PREVIEW_1A` at `MEASURED_REPO`.

## Commands

```bash
node --test tests/reward-eligibility-contract-preview.test.js
node scripts/review/reward-eligibility-contract-preview-check.mjs --json
npm run check
```
