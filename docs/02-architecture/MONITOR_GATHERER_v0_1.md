# MONITOR-GATHERER-1A

Truth label: `MONITOR_GATHERER_MEASURED_REPO`

## Purpose

Read-only monitor-facts derivation: compiles injected raw repo artifacts (git metadata, gate-log ages, registry rows, check.mjs source, docs texts, receipt metadata) into the receipt-monitor input facts, content-addressed and fully re-derivable — no fs in kernel, no network, no mutation.

## Input Contract

```js
runMonitorGatherer({ consent, input })
```

Exact consent:

```text
GO: gather monitor facts
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
verifyMonitorGatherer(payload)
```

Body-bound re-derivation. Tampering any field breaks the bind.

## Boundaries

- Pure kernel; any effect is injected and documented in the kernel header
- No network, daemon, wallet, token, federation, or live execution
- All-false boundary invariant — signing/preview authority ≠ execution authority

## Files

```text
packages/core/src/monitor-gatherer.js
tests/monitor-gatherer.test.js
scripts/review/monitor-gatherer-check.mjs
scripts/check.mjs
packages/core/src/dema-capability-truth-registry.js
docs/receipts/MONITOR_GATHERER_1A.md
docs/02-architecture/MONITOR_GATHERER_v0_1.md
```

## Commands

```bash
node --test tests/monitor-gatherer.test.js
node scripts/review/monitor-gatherer-check.mjs --json
npm test
npm run check
```
