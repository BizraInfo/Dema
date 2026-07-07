# NODE0-LOCAL-URP-SHELF-INDEX-PREVIEW-1A

Truth label: `NODE0_LOCAL_URP_SHELF_INDEX_PREVIEW_MEASURED_REPO`

## Purpose

The **first House-of-Wisdom shelf.** `#345` made Dema *write* mission receipts; `#346` made her
*read one back*; this makes them **all queryable at once** — `URP_LOCAL_ACTIVE` becomes a thing you
can *ask*, not just *write*. Two layers:

- **Pure kernel** (`node0-local-urp-shelf-index-preview.js`) — reads NO file. Composes an injected set
  of receipts into a deterministic, content-addressed catalog. Reuses the return-review's
  `evaluateReceipt` validator (shelf and review agree on "valid").
- **CLI adapter** (`apps/cli/src/commands/mission.js`, `dema mission shelf`) — reads
  `$DEMA_HOME/mission/receipts/*.json` read-only.

## CLI

```text
dema mission shelf [--json]
```
Reads every receipt under `$DEMA_HOME/mission/receipts`. An absent dir is an **empty shelf** (not an
error); a corrupt file is **skipped**. Prints the catalog + counts. Commits nothing, publishes nothing.

## Input Contract

```js
runNode0LocalUrpShelfIndexPreview({ consent, input })
// input = { receipts: [<receipt_artifact_preview a `dema mission pulse` run wrote>, ...] }
```

Exact consent: `GO: node0 local urp shelf index preview`

## Output Contract

```text
schema · truth_label · ok · status (shelf_index_complete | shelf_index_broken)
content_hash · entry_count · valid_count · invalid_count · live_leak_count · all_preview
entries[] (mission_id · file_content_hash · pulse_content_hash · committed_live · receipt_ok)
boundary (all-false) · mint_allowed:false · authority_delta:0 · blocked_by[]
```

Entries are **order-independent** (sorted by mission_id + pulse hash), so the content hash is stable
regardless of input order.

## Verification

```js
verifyNode0LocalUrpShelfIndexPreview(payload)
```

Body-bound re-derivation over the whole verdict, PLUS re-derivation of every count from the entries —
a forged `entry_count` / `valid_count` / `invalid_count` / `live_leak_count` / `all_preview` is rejected.

## What this does NOT prove

No file read in the kernel, no semantic verification, no live world-state commit, and no publication
to any shared or federated URP. A live URP (shared across nodes) remains `DESIGNED_NOT_LIVE`. The
shelf is a local reading view, not a network.

## Boundaries

- Pure kernel; any effect is injected and documented in the kernel header
- No network, daemon, wallet, token, federation, or live execution
- All-false boundary invariant — signing/preview authority ≠ execution authority

## Files

```text
packages/core/src/node0-local-urp-shelf-index-preview.js
tests/node0-local-urp-shelf-index-preview.test.js
scripts/review/node0-local-urp-shelf-index-preview-check.mjs
scripts/check.mjs
packages/core/src/dema-capability-truth-registry.js
docs/receipts/NODE0_LOCAL_URP_SHELF_INDEX_PREVIEW_1A.md
docs/02-architecture/NODE0_LOCAL_URP_SHELF_INDEX_PREVIEW_v0_1.md
```

## Commands

```bash
node --test tests/node0-local-urp-shelf-index-preview.test.js
node scripts/review/node0-local-urp-shelf-index-preview-check.mjs --json
npm test
npm run check
```
