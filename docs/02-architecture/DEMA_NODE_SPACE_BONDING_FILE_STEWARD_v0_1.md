# Dema Node Space Bonding File Steward v0.1

**Slice:** `DEMA-NODE-SPACE-BONDING-FILE-STEWARD-1A`  
**Truth label:** `DEMA_NODE_SPACE_BONDING_FILE_STEWARD_PREVIEW_ONLY`  
**Stage:** `NODE_SPACE_AWARENESS_PREVIEW`

## Purpose

The File Steward is the first preview-only bonding layer between Dema and the
human Node Space. It turns a file inventory into an organization plan without
reading content or changing files.

The atomic proof unit is:

```text
claim + evidence + consent requirement + receipt hash preview + verification result
```

## Scope

| Surface | Role |
| --- | --- |
| `packages/core/src/dema-node-space-bonding-file-steward.js` | Pure metadata-only preview kernel |
| `tests/dema-node-space-bonding-file-steward.test.js` | Acceptance contract and regression tests |
| `scripts/review/dema-node-space-bonding-file-steward-check.mjs` | Hermetic review gate |

## Kernel Contract

```js
buildDemaNodeSpaceBondingFileSteward({
  root_label,
  file_inventory,
  user_context,
  classification_policy,
  rename_policy,
  organization_policy,
  merge_policy,
  consent_proof,
  boundary
})
```

The output includes:

- schema and truth label
- inventory summary
- file type clusters
- project context candidates
- unstructured data map
- duplicate candidate plan
- batch rename preview
- folder organization preview
- merge candidate preview
- file action receipt previews
- content-awareness consent requests
- receipt requirements
- risk register
- all-false boundaries

## Hard Boundaries

The 1A kernel does not:

- rename, move, merge, or delete files
- read file content
- perform OCR, embeddings, summaries, uploads, or network calls
- perform autonomous action
- create execution receipts
- activate daemon, URP, federation, token, wallet, or reward rails

## Consent Ladder

Metadata-only planning is the default. Any content-aware classification requires
a separate exact consent phrase. Any later file mutation would require a future
execution surface with its own consent, receipt, and verification gate.

## What This Proves

This slice proves Dema can derive deterministic organization previews from a
metadata-only file inventory and attach receipt hash previews to proposed file
actions.

## What This Does Not Prove

This slice does not prove file contents are understood. It does not execute file
actions. It does not provide live autonomy, file cleanup, reward eligibility, or
economic settlement.
