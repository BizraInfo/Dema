# CAPABILITY-BLAST-RADIUS-1A

Truth label: `CAPABILITY_BLAST_RADIUS_MEASURED_REPO`

## Purpose

Deterministic blast-radius classifier: derives blast_radius (low|medium|high) and reversibility from declared action mutation flags — never from prose — so graduated consent can name what an action touches before it runs. No execution, no network, no mutation.

## Input Contract

```js
runCapabilityBlastRadius({ consent, input })
```

Exact consent:

```text
GO: classify capability blast radius
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
verifyCapabilityBlastRadius(payload)
```

Body-bound re-derivation. Tampering any field breaks the bind.

## Boundaries

- Pure kernel; any effect is injected and documented in the kernel header
- No network, daemon, wallet, token, federation, or live execution
- All-false boundary invariant — signing/preview authority ≠ execution authority

## Files

```text
packages/core/src/capability-blast-radius.js
tests/capability-blast-radius.test.js
scripts/review/capability-blast-radius-check.mjs
scripts/check.mjs
packages/core/src/dema-capability-truth-registry.js
docs/receipts/CAPABILITY_BLAST_RADIUS_1A.md
docs/02-architecture/CAPABILITY_BLAST_RADIUS_v0_1.md
```

## Commands

```bash
node --test tests/capability-blast-radius.test.js
node scripts/review/capability-blast-radius-check.mjs --json
npm test
npm run check
```
