# DEMA-MISSION-CONTRACT-1A

Truth label: `DEMA_MISSION_CONTRACT_MEASURED_REPO`

## Purpose

Content-addressed immutable mission contract: canonical-json-v1 hash identity, fail-closed field validation, worker-channel amendment rejection.

## Input Contract

```js
runDemaMissionContract({ consent, input })
```

Exact consent:

```text
GO: dema mission contract preview
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
verifyDemaMissionContract(payload)
```

Body-bound re-derivation. Tampering any field breaks the bind.

## Boundaries

- Pure kernel; any effect is injected and documented in the kernel header
- No network, daemon, wallet, token, federation, or live execution
- All-false boundary invariant — signing/preview authority ≠ execution authority

## Files

```text
packages/core/src/dema-mission-contract.js
tests/dema-mission-contract.test.js
scripts/review/dema-mission-contract-check.mjs
scripts/check.mjs
packages/core/src/dema-capability-truth-registry.js
docs/receipts/DEMA_MISSION_CONTRACT_1A.md
docs/02-architecture/DEMA_MISSION_CONTRACT_v0_1.md
```

## Commands

```bash
node --test tests/dema-mission-contract.test.js
node scripts/review/dema-mission-contract-check.mjs --json
npm test
npm run check
```
