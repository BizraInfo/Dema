# Receipt: DEMA-PRESENCE-1A

Truth label: `DEMA_PRESENCE_MEASURED_REPO`

## Slice

Truthful DEMA avatar presence state machine: maps verified Node0 runtime events (receipt-bound) to avatar states; refuses unbound theatrical state; UNKNOWN state makes uncertainty visible.

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

`npm run check` runs `dema-presence-check.mjs` and keeps `DEMA_PRESENCE_1A` at `MEASURED_REPO`.

## Commands

```bash
node --test tests/dema-presence.test.js
node scripts/review/dema-presence-check.mjs --json
npm run check
```
