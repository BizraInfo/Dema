# NODE0-MULTI-DEVICE-URP-RESOURCE-MANIFEST-PREVIEW-1A

**Slice:** Preview-only multi-device Node0 resource body composer.  
**Truth label:** `NODE0_MULTI_DEVICE_URP_RESOURCE_MANIFEST_PREVIEW_ONLY`

## What Shipped

| Module | Role |
| --- | --- |
| `packages/core/src/node0-multi-device-urp-resource-manifest-preview.js` | Pure multi-device resource manifest preview builder and verifier |
| `scripts/review/node0-multi-device-urp-resource-manifest-preview-check.mjs` | Hermetic review gate |
| `tests/node0-multi-device-urp-resource-manifest-preview.test.js` | Acceptance proof |
| `docs/02-architecture/NODE0_MULTI_DEVICE_URP_RESOURCE_MANIFEST_PREVIEW_v0_1.md` | Architecture contract |

## Receipt Chain Atom

The preview chains from `previous_state_hash` into:

```text
previous_state_hash
resource_ids
truth_label
verification_result
boundaries
block_preview_hash
```

The block hash is a deterministic SHA-256 over the preview body. It is not a
runtime receipt and does not imply any device scan or URP action occurred.

## Commands

```bash
node --test tests/node0-multi-device-urp-resource-manifest-preview.test.js
node scripts/review/node0-multi-device-urp-resource-manifest-preview-check.mjs --json
```

## Boundaries

- No scan execution
- No mobile extraction
- No file mutation
- No content read
- No OCR
- No embeddings
- No network sync
- No URP write
- No token mint
- No wallet
- No transfer
- No daemon
- No autonomous action
- Preview only

## Replay Meaning

A passing replay means the provided laptop and mobile metadata manifests compose
into one Node0 resource-body preview with provenance, risk hints, duplicate and
version-chain candidates, URP/mint previews that remain blocked, and a receipt
chain preview.

It does not prove live Node0 runtime, real mobile extraction, device sync, URP
submission, economic settlement, or autonomous RSI.
