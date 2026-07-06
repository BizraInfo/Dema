# Receipt: DEMA-ACTIVE-WORKLOOP-COMPOSER-PREVIEW-1A

Truth label: `DEMA_ACTIVE_WORKLOOP_COMPOSER_PREVIEW_MEASURED_REPO`

## Slice

Preview-only composer that binds existing Dema organs (pain-goal, mission, NodeSpace boundary, homebase, proposed task, receipt preview, monitor, absence queue, return review) into one fail-closed operator work-envelope; references organs, does not run them or execute tasks.

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

`npm run check` runs `dema-active-workloop-composer-preview-check.mjs` and keeps `DEMA_ACTIVE_WORKLOOP_COMPOSER_PREVIEW_1A` at `MEASURED_REPO`.

## Commands

```bash
node --test tests/dema-active-workloop-composer-preview.test.js
node scripts/review/dema-active-workloop-composer-preview-check.mjs --json
npm run check
```
