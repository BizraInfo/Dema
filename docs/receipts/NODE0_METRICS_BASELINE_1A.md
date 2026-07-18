# Receipt: NODE0-METRICS-BASELINE-1A

Truth label: `NODE0_METRICS_BASELINE_MEASURED_REPO`

## Slice

Derive event-bound baseline metrics from realm event history; UNKNOWN is never zero; every metric carries its derivation evidence.

```text
plan → build → verify → tamper-reject
```

## Proof Contract

The default gate must pass only while:

- the exact GO phrase matches byte-for-byte,
- the canonical payload is content-addressed,
- verification re-derives from the body and rejects tamper; UNKNOWN metrics carry value null and a named reason (never zero); corrupt history yields no metrics,
- stale-hash tamper is rejected by body re-derivation (KNOWN LIMIT, do not overclaim: a forger who changes a field AND recomputes the hash is not caught — the independent anchor is a later slice, same declared limit as NODE0-REALM-STATE-KERNEL-1A),
- the boundary stays all-false (no execution authority).

`npm run check` runs `node0-metrics-baseline-check.mjs` and keeps `NODE0_METRICS_BASELINE_1A` at `MEASURED_REPO`.

## Commands

```bash
node --test tests/node0-metrics-baseline.test.js
node scripts/review/node0-metrics-baseline-check.mjs --json
npm run check
```
