# LOCAL-MODEL-ADAPTER-PREVIEW-1A

Truth label: `LOCAL_MODEL_ADAPTER_PREVIEW_MEASURED_REPO`

## Purpose

Preview-only local model adapter contract: binds an injected discovery report into a content-addressed adapter envelope (model always null, boundary all-false) that refuses live-invocation, wallet, mint, and URP fields — no model invocation, no network.

## Input Contract

```js
runLocalModelAdapterPreview({ consent, input })
```

Exact consent:

```text
GO: build preview-only local model adapter
```

## Output Contract

```text
schema
truth_label
ok
content_hash
boundary.execution_allowed (false)
blocked_by[]
```

## Verification

```js
verifyLocalModelAdapterPreview(payload)
```

Body-bound re-derivation. Tampering any field breaks the bind.

## Boundaries

- Pure kernel; any effect is injected and documented in the kernel header
- No network, daemon, wallet, token, federation, or live execution
- All-false boundary invariant — signing/preview authority ≠ execution authority

## Files

```text
packages/core/src/local-model-adapter-preview.js
tests/local-model-adapter-preview.test.js
scripts/review/local-model-adapter-preview-check.mjs
scripts/check.mjs
packages/core/src/dema-capability-truth-registry.js
docs/receipts/LOCAL_MODEL_ADAPTER_PREVIEW_1A.md
docs/02-architecture/LOCAL_MODEL_ADAPTER_PREVIEW_v0_1.md
```

## Commands

```bash
node --test tests/local-model-adapter-preview.test.js
node scripts/review/local-model-adapter-preview-check.mjs --json
npm test
npm run check
```
