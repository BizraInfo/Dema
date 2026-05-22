# Proof Room Bundle v0.1

**Goal:** One outsider-replayable composition of existing local proof gates (PDF Days 0–15 spearpoint).

**Shipped:**

- `packages/core/src/proof-room-bundle.js`
- `scripts/proof-room-bundle.mjs`
- `tests/proof-room-bundle.test.js`
- `npm run proof:room` (core gates; `--full` adds `npm test`)
- Wired into `npm run check` via `node scripts/proof-room-bundle.mjs --json`

**Micro-consent write:**

```text
GO: write proof room bundle to artifacts/proofs/proof-room-v0.1
```

**Not in scope:** network, runtime, receipt mint, investor PDF ingest.
