# Receipt: NODE0-CONSENTED-INVENTORY-GATHERER-PREVIEW-1A

Truth label: `NODE0_CONSENTED_INVENTORY_GATHERER_PREVIEW_MEASURED_REPO`

## Slice

Consent-scoped, metadata-only inventory summary kernel: derives a triage (categories, total bytes, stale/duplicate-name/sensitive-name candidates, largest) from injected file-metadata rows under a user-selected scan mode; metadata_only implemented, all five scan modes as future user options; no content read.

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

`npm run check` runs `node0-consented-inventory-gatherer-preview-check.mjs` and keeps `NODE0_CONSENTED_INVENTORY_GATHERER_PREVIEW_1A` at `MEASURED_REPO`.

## Commands

```bash
node --test tests/node0-consented-inventory-gatherer-preview.test.js
node scripts/review/node0-consented-inventory-gatherer-preview-check.mjs --json
npm run check
```
