# NODE0-METRICS-BASELINE-1A

Truth label: `NODE0_METRICS_BASELINE_MEASURED_REPO`

## Purpose

Derive event-bound baseline metrics from realm event history; UNKNOWN is never zero; every metric carries its derivation evidence.

## Input Contract

```js
runNode0MetricsBaseline({ consent, input })
```

Exact consent:

```text
GO: node0 metrics baseline preview
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
verifyNode0MetricsBaseline(payload)
```

Body-bound re-derivation. Tampering any field breaks the bind.

## Boundaries

- Pure kernel; any effect is injected and documented in the kernel header
- No network, daemon, wallet, token, federation, or live execution
- All-false boundary invariant — signing/preview authority ≠ execution authority

## Files

```text
packages/core/src/node0-metrics-baseline.js
tests/node0-metrics-baseline.test.js
scripts/review/node0-metrics-baseline-check.mjs
scripts/check.mjs
packages/core/src/dema-capability-truth-registry.js
docs/receipts/NODE0_METRICS_BASELINE_1A.md
docs/02-architecture/NODE0_METRICS_BASELINE_v0_1.md
```

## Commands

```bash
node --test tests/node0-metrics-baseline.test.js
node scripts/review/node0-metrics-baseline-check.mjs --json
npm test
npm run check
```
