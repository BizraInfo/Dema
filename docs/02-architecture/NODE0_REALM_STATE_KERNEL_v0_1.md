# NODE0-REALM-STATE-KERNEL-1A

Truth label: `NODE0_REALM_STATE_KERNEL_MEASURED_REPO`

## Purpose

Reconstruct Node0 realm state deterministically from durable event history while preserving an all-false execution boundary.

## Input Contract

```js
runNode0RealmStateKernel({ consent, input })
```

Exact consent:

```text
GO: node0 realm state kernel preview
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
verifyNode0RealmStateKernel(payload)
```

Body-bound re-derivation. Tampering any field breaks the bind.

## Boundaries

- Pure kernel; any effect is injected and documented in the kernel header
- No network, daemon, wallet, token, federation, or live execution
- All-false boundary invariant — signing/preview authority ≠ execution authority

## Files

```text
packages/core/src/node0-realm-state-kernel.js
tests/node0-realm-state-kernel.test.js
scripts/review/node0-realm-state-kernel-check.mjs
scripts/check.mjs
packages/core/src/dema-capability-truth-registry.js
docs/receipts/NODE0_REALM_STATE_KERNEL_1A.md
docs/02-architecture/NODE0_REALM_STATE_KERNEL_v0_1.md
```

## Commands

```bash
node --test tests/node0-realm-state-kernel.test.js
node scripts/review/node0-realm-state-kernel-check.mjs --json
npm test
npm run check
```
