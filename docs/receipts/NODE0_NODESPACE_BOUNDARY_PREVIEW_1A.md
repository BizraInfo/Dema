# Receipt: NODE0-NODESPACE-BOUNDARY-PREVIEW-1A

Truth label: `NODE0_NODESPACE_BOUNDARY_PREVIEW_MEASURED_REPO`

## Slice

Metadata-only Node0 homebase boundary kernel: hardware specs + OS-tree (host to VM/container to filesystem-root ownership) with inside/outside/unknown homebase classification; references existing device/data manifests instead of re-scanning or reading content.

```text
plan → build → verify → tamper-reject
```

## Proof Contract

The default gate must pass only while:

- the exact GO phrase matches byte-for-byte,
- the canonical payload is content-addressed,
- verification re-derives from the body and rejects tamper,
- a forged body with a recomputed hash is still rejected,
- the boundary stays all-false (no execution authority),
- the scan-depth policy is encoded (metadata_only default up to full_local_content_index) with the node owner as sole authority, `content_read_allowed_now: false`, only receipts crossing nodes by default, and a forged "Dema chose the depth" claim rejected.

`npm run check` runs `node0-nodespace-boundary-preview-check.mjs` and keeps `NODE0_NODESPACE_BOUNDARY_PREVIEW_1A` at `MEASURED_REPO`.

## Commands

```bash
node --test tests/node0-nodespace-boundary-preview.test.js
node scripts/review/node0-nodespace-boundary-preview-check.mjs --json
npm run check
```
