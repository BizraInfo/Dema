# DEMA-STAND-1A

Truth label: `FIRST_USER_STANDING_LOCAL_ONLY`

## Purpose

Morning Standing Receipt: composes injected local evidence (git state, gate-log metadata, declared blockers) into a daily first-user standing card with FDE lens, exactly one next action, drain metric, stale-proof detection, and orbit warning.

## Input Contract

```js
runDemaStand({ consent, input })
```

Exact consent:

```text
GO: write first-user standing receipt
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
verifyDemaStand(payload)
```

Body-bound re-derivation. Tampering any field breaks the bind.

## Boundaries

- Pure kernel; any effect is injected and documented in the kernel header
- No network, daemon, wallet, token, federation, or live execution
- All-false boundary invariant — signing/preview authority ≠ execution authority

## Files

```text
packages/core/src/dema-stand.js
tests/dema-stand.test.js
scripts/review/dema-stand-check.mjs
scripts/check.mjs
packages/core/src/dema-capability-truth-registry.js
docs/receipts/DEMA_STAND_1A.md
docs/02-architecture/DEMA_STAND_v0_1.md
```

## Commands

```bash
node --test tests/dema-stand.test.js
node scripts/review/dema-stand-check.mjs --json
npm test
npm run check
```
