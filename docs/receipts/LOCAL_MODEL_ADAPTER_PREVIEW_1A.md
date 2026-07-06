# Receipt: LOCAL-MODEL-ADAPTER-PREVIEW-1A

Truth label: `LOCAL_MODEL_ADAPTER_PREVIEW_MEASURED_REPO`

## Slice

Preview-only local model adapter contract: binds an injected discovery report into a content-addressed adapter envelope (model always null, boundary all-false) that refuses live-invocation, wallet, mint, and URP fields — no model invocation, no network.

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

`npm run check` runs `local-model-adapter-preview-check.mjs` and keeps `LOCAL_MODEL_ADAPTER_PREVIEW_1A` at `MEASURED_REPO`.

## Commands

```bash
node --test tests/local-model-adapter-preview.test.js
node scripts/review/local-model-adapter-preview-check.mjs --json
npm run check
```
