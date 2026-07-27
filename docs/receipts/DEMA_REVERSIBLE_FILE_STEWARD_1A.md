# Receipt: DEMA-REVERSIBLE-FILE-STEWARD-1A

Truth label: `DEMA_REVERSIBLE_FILE_STEWARD_MEASURED_REPO`

## Slice

Compose the proven reversible-rename, sanitizer, consent and receipt primitives into one bounded, consented, fully-reversible multi-file steward job (RENAME-only, metadata-only, no model/network).

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

`npm run check` runs `dema-reversible-file-steward-check.mjs` and keeps `DEMA_REVERSIBLE_FILE_STEWARD_1A` at `MEASURED_REPO`.

## Commands

```bash
node --test tests/dema-reversible-file-steward.test.js
node scripts/review/dema-reversible-file-steward-check.mjs --json
npm run check
```
