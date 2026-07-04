# DEMA-STEWARD-CHAIN-1A

Truth label: `FIRST_USER_STEWARD_CHAIN_LOCAL_ONLY`

## Purpose

Steward-chain verifier: verifies the FIRST_USER standing-receipt chain (consecutive UTC days, per-receipt re-derivation, drain series) and emits honest day-N-of-7 / broken / complete verdicts with the Day-7 report payload.

## Input Contract

```js
runDemaStewardChain({ consent, input })
```

Exact consent:

```text
GO: verify steward chain
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
verifyDemaStewardChain(payload)
```

Body-bound re-derivation. Tampering any field breaks the bind.

## Boundaries

- Pure kernel; any effect is injected and documented in the kernel header
- No network, daemon, wallet, token, federation, or live execution
- All-false boundary invariant — signing/preview authority ≠ execution authority

## Files

```text
packages/core/src/dema-steward-chain.js
tests/dema-steward-chain.test.js
scripts/review/dema-steward-chain-check.mjs
scripts/check.mjs
packages/core/src/dema-capability-truth-registry.js
docs/receipts/DEMA_STEWARD_CHAIN_1A.md
docs/02-architecture/DEMA_STEWARD_CHAIN_v0_1.md
```

## Commands

```bash
node --test tests/dema-steward-chain.test.js
node scripts/review/dema-steward-chain-check.mjs --json
npm test
npm run check
```
