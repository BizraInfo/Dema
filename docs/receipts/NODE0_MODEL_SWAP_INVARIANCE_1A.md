# Receipt: NODE0-MODEL-SWAP-INVARIANCE-1A

Truth label: `NODE0_MODEL_SWAP_INVARIANCE_MEASURED_REPO`

## Slice

Pure kernel proving a mission-task verdict is invariant to which model produced the output: the system contract decides ACCEPT/REJECT, model identity never launders a failing output nor changes a passing one.

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

`npm run check` runs `node0-model-swap-invariance-check.mjs` and keeps `NODE0_MODEL_SWAP_INVARIANCE_1A` at `MEASURED_REPO`.

## Commands

```bash
node --test tests/node0-model-swap-invariance.test.js
node scripts/review/node0-model-swap-invariance-check.mjs --json
npm run check
```
