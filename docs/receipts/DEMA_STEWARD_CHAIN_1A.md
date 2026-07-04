# Receipt: DEMA-STEWARD-CHAIN-1A

Truth label: `FIRST_USER_STEWARD_CHAIN_LOCAL_ONLY`

## Slice

Steward-chain verifier: verifies the FIRST_USER standing-receipt chain (consecutive UTC days, per-receipt re-derivation, drain series) and emits honest day-N-of-7 / broken / complete verdicts with the Day-7 report payload.

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

`npm run check` runs `dema-steward-chain-check.mjs` and keeps `DEMA_STEWARD_CHAIN_1A` at `MEASURED_REPO`.

## Commands

```bash
node --test tests/dema-steward-chain.test.js
node scripts/review/dema-steward-chain-check.mjs --json
npm run check
```
