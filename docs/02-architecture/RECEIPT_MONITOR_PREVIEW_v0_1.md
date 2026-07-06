# RECEIPT-MONITOR-PREVIEW-1A

Truth label: `RECEIPT_MONITOR_PREVIEW_MEASURED_REPO`

## Purpose

Operator-invoked proof-health monitor: classifies injected proof-surface facts (stale proof, registry/docs drift, missing review gates, evidence-free verified claims, forbidden-claim markers) into severity findings with evidence refs — deterministic, no daemon, no autofix, no authority increase.

## Input Contract

```js
runReceiptMonitorPreview({ consent, input })
```

Exact consent:

```text
GO: run receipt monitor preview
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
verifyReceiptMonitorPreview(payload)
```

Body-bound re-derivation. Tampering any field breaks the bind.

## Boundaries

- Pure kernel; any effect is injected and documented in the kernel header
- No network, daemon, wallet, token, federation, or live execution
- All-false boundary invariant — signing/preview authority ≠ execution authority

## Files

```text
packages/core/src/receipt-monitor-preview.js
tests/receipt-monitor-preview.test.js
scripts/review/receipt-monitor-preview-check.mjs
scripts/check.mjs
packages/core/src/dema-capability-truth-registry.js
docs/receipts/RECEIPT_MONITOR_PREVIEW_1A.md
docs/02-architecture/RECEIPT_MONITOR_PREVIEW_v0_1.md
```

## Commands

```bash
node --test tests/receipt-monitor-preview.test.js
node scripts/review/receipt-monitor-preview-check.mjs --json
npm test
npm run check
```
