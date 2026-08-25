# DRS-PRESENCE-REDUCER-2A

Truth label: `DRS_PRESENCE_REDUCER_MEASURED_REPO`

## Purpose

Realm Shell presence reducer v2: reduce IF-01-accepted RealmEvents into an 11-state projection snapshot and i18n-keyed RenderRequest with no-stale-success freshness

## Input Contract

```js
runDrsPresenceReducer({ consent, input })
```

Exact consent:

```text
GO: dema realm presence reducer
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
verifyDrsPresenceReducer(payload)
```

Body-bound re-derivation. Tampering any field breaks the bind.

## Boundaries

- Pure kernel; any effect is injected and documented in the kernel header
- No network, daemon, wallet, token, federation, or live execution
- All-false boundary invariant — signing/preview authority ≠ execution authority

## Files

```text
packages/core/src/drs-presence-reducer.js
tests/drs-presence-reducer.test.js
scripts/review/drs-presence-reducer-check.mjs
scripts/check.mjs
packages/core/src/dema-capability-truth-registry.js
docs/receipts/DRS_PRESENCE_REDUCER_2A.md
docs/02-architecture/DRS_PRESENCE_REDUCER_v0_1.md
```

## Commands

```bash
node --test tests/drs-presence-reducer.test.js
node scripts/review/drs-presence-reducer-check.mjs --json
npm test
npm run check
```
