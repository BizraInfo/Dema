# Receipt: POI-TIME-COMPRESSION-1A

Truth label: `POI_TIME_COMPRESSION_CANDIDATE_LOCAL_ONLY`

## Slice

Local-only PoI time-compression candidate receipt: declared baseline estimate vs declared actual duration under required quality gates; fail-closed, observation-aware, no mint.

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

`npm run check` runs `poi-time-compression-check.mjs` and keeps `POI_TIME_COMPRESSION_1A` at `MEASURED_REPO`.

## Commands

```bash
node --test tests/poi-time-compression.test.js
node scripts/review/poi-time-compression-check.mjs --json
npm run check
```
