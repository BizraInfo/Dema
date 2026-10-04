# DEMA-PRESENCE-1A

Truth label: `DEMA_PRESENCE_MEASURED_REPO`

## Purpose

Truthful DEMA avatar presence state machine: maps verified Node0 runtime events (receipt-bound) to avatar states; refuses unbound theatrical state; UNKNOWN state makes uncertainty visible.

## Input Contract

```js
runDemaPresence({ consent, input })
```

Exact consent:

```text
GO: dema presence preview
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
verifyDemaPresence(payload)
```

Body-bound re-derivation. Tampering any field breaks the bind.

## Boundaries

- Pure kernel; any effect is injected and documented in the kernel header
- No network, daemon, wallet, token, federation, or live execution
- All-false boundary invariant — signing/preview authority ≠ execution authority

## Files

```text
packages/core/src/dema-presence.js
tests/dema-presence.test.js
scripts/review/dema-presence-check.mjs
scripts/check.mjs
packages/core/src/dema-capability-truth-registry.js
docs/receipts/DEMA_PRESENCE_1A.md
docs/02-architecture/DEMA_PRESENCE_v0_1.md
```

## Commands

```bash
node --test tests/dema-presence.test.js
node scripts/review/dema-presence-check.mjs --json
npm test
npm run check
```
