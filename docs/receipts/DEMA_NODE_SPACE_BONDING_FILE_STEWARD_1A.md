# DEMA-NODE-SPACE-BONDING-FILE-STEWARD-1A

**Slice:** Preview-only file action receipt atom for Node Space bonding.  
**Truth label:** `DEMA_NODE_SPACE_BONDING_FILE_STEWARD_PREVIEW_ONLY`

## What Shipped

| Module | Role |
| --- | --- |
| `packages/core/src/dema-node-space-bonding-file-steward.js` | Pure File Steward preview builder and verifier |
| `scripts/review/dema-node-space-bonding-file-steward-check.mjs` | Hermetic review gate |
| `tests/dema-node-space-bonding-file-steward.test.js` | Acceptance proof |
| `docs/02-architecture/DEMA_NODE_SPACE_BONDING_FILE_STEWARD_v0_1.md` | Architecture contract |

## Receipt Atom

Each proposed file action preview carries:

```text
claim
evidence
consent_required
boundary
verification_result
receipt_preview_id
```

The receipt hash is a deterministic SHA-256 over the preview action body. It is
not an execution receipt and does not imply that a file was changed.

## Commands

```bash
node --test tests/dema-node-space-bonding-file-steward.test.js
node scripts/review/dema-node-space-bonding-file-steward-check.mjs
```

## Boundaries

- No rename
- No move
- No merge
- No delete
- No file content read
- No OCR
- No embeddings
- No upload
- No network
- No autonomous action
- Preview plan only

## Replay Meaning

A passing replay means the metadata-only preview envelope is structurally
coherent, all proposed file actions remain non-mutating, and every action has a
receipt hash preview plus explicit consent requirement.

It does not prove content understanding, duplicate equivalence, safe mutation,
live file management, reward eligibility, URP sharing, token logic, or runtime
autonomy.
