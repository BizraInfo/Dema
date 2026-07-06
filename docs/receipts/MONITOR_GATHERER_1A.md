# Receipt: MONITOR-GATHERER-1A

Truth label: `MONITOR_GATHERER_MEASURED_REPO`

## Slice

Read-only monitor-facts derivation: compiles injected raw repo artifacts (git metadata, gate-log ages, registry rows, check.mjs source, docs texts, receipt metadata) into the receipt-monitor input facts, content-addressed and fully re-derivable — no fs in kernel, no network, no mutation.

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

`npm run check` runs `monitor-gatherer-check.mjs` and keeps `MONITOR_GATHERER_1A` at `MEASURED_REPO`.

## Commands

```bash
node --test tests/monitor-gatherer.test.js
node scripts/review/monitor-gatherer-check.mjs --json
npm run check
```
