# Receipt: DEMA-MISSION-CONTRACT-1A

Truth label: `DEMA_MISSION_CONTRACT_MEASURED_REPO`

## Slice

Content-addressed immutable mission contract: canonical-json-v1 hash identity, fail-closed field validation, worker-channel amendment rejection.

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

`npm run check` runs `dema-mission-contract-check.mjs` and keeps `DEMA_MISSION_CONTRACT_1A` at `MEASURED_REPO`.

## Commands

```bash
node --test tests/dema-mission-contract.test.js
node scripts/review/dema-mission-contract-check.mjs --json
npm run check
```
