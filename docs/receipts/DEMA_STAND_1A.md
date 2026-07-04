# Receipt: DEMA-STAND-1A

Truth label: `FIRST_USER_STANDING_LOCAL_ONLY`

## Slice

Morning Standing Receipt: composes injected local evidence (git state, gate-log metadata, declared blockers) into a daily first-user standing card with FDE lens, exactly one next action, drain metric, stale-proof detection, and orbit warning.

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

`npm run check` runs `dema-stand-check.mjs` and keeps `DEMA_STAND_1A` at `MEASURED_REPO`.

## Commands

```bash
node --test tests/dema-stand.test.js
node scripts/review/dema-stand-check.mjs --json
npm run check
```
