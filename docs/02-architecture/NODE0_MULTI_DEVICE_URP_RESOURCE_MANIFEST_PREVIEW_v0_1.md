# Node0 Multi-Device URP Resource Manifest Preview v0.1

**Slice:** `NODE0-MULTI-DEVICE-URP-RESOURCE-MANIFEST-PREVIEW-1A`  
**Truth label:** `NODE0_MULTI_DEVICE_URP_RESOURCE_MANIFEST_PREVIEW_ONLY`

## Purpose

This preview composes Mohamed's laptop and mobile metadata manifests into one
Node0 resource body. It gives Dema a unified, provenance-preserving view of the
human Node Space before AASR routes file-action or resource-action states.

This is a composer, not a scanner.

## Scope

| Surface | Role |
| --- | --- |
| `packages/core/src/node0-multi-device-urp-resource-manifest-preview.js` | Pure preview composer and verifier |
| `tests/node0-multi-device-urp-resource-manifest-preview.test.js` | Acceptance proof |
| `scripts/review/node0-multi-device-urp-resource-manifest-preview-check.mjs` | Hermetic review gate |

## Kernel Contract

```js
buildNode0MultiDeviceUrpResourceManifestPreview({
  node_id,
  human_owner,
  devices,
  device_resource_manifests,
  urp_policy,
  consent_proof,
  previous_state_hash,
  boundary
})
```

## Output Contract

The preview emits:

- schema and truth label
- node identity and human owner
- per-device manifests with provenance
- unified Node Space summary
- resource clusters
- noise map
- sensitive resource hints
- cross-device duplicate candidates
- cross-device version-chain candidates
- mint eligibility preview
- URP contribution preview
- receipt chain preview
- self-improvement inputs for later RSI
- all-false boundaries
- what this proves / does not prove

## Hard Boundaries

The 1A preview does not:

- scan laptop or mobile devices
- extract mobile data
- mutate files
- read content
- perform OCR, embeddings, uploads, sync, or network calls
- write URP state
- mint tokens
- access wallets
- transfer assets
- start a daemon
- perform autonomous action

## AASR Dependency

AASR should route over this resource body later. This slice only creates the
preview body and receipt-chain hash needed by a future router.

## What This Proves

This proves provided laptop and mobile metadata manifests can be composed into
one Node0 resource-body preview with provenance, risk hints, duplicate/version
candidates, and receipt-chain continuity.

## What This Does Not Prove

This does not prove live multi-device sync, content understanding, URP
contribution, reward eligibility, token minting, wallet activity, federation, or
autonomous runtime behavior.
