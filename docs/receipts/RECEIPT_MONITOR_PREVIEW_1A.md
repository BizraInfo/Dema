# Receipt: RECEIPT-MONITOR-PREVIEW-1A

Truth label: `RECEIPT_MONITOR_PREVIEW_MEASURED_REPO`

## Slice

Operator-invoked proof-health monitor: classifies injected proof-surface facts (stale proof, registry/docs drift, missing review gates, evidence-free verified claims, forbidden-claim markers) into severity findings with evidence refs — deterministic, no daemon, no autofix, no authority increase.

```text
plan → build → verify → tamper-reject
```

## Proof Contract

The default gate must pass only while:

- the exact GO phrase matches byte-for-byte,
- the canonical payload is content-addressed,
- verification re-derives from the body and rejects tamper,
- a forged body with a recomputed hash is still rejected,
- the boundary stays all-false (no execution authority).

`npm run check` runs `receipt-monitor-preview-check.mjs` and keeps `RECEIPT_MONITOR_PREVIEW_1A` at `MEASURED_REPO`.

## Commands

```bash
node --test tests/receipt-monitor-preview.test.js
node scripts/review/receipt-monitor-preview-check.mjs --json
npm run check
```
