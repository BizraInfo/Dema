# NODE0-RECEIPT-SHELF-COMPACTION-STATE-PREVIEW-1A

Truth label: `NODE0_RECEIPT_SHELF_COMPACTION_STATE_PREVIEW_MEASURED_REPO`

## Purpose

The Dema-native answer to "compact the memory," inspired by CompactionRL but disciplined: **compact
verified receipt state, not raw prose.** Dema's truth lives in hashes / receipts / boundaries /
consent / verdicts — not in conversation. So compaction operates over the **receipt shelf** (#347).

Two layers:
- **Pure kernel** (`node0-receipt-shelf-compaction-state-preview.js`) — re-verifies the shelf and
  compacts it into a hash-bound state; keeps only verified signals; names what it dropped.
- **CLI adapter** (`apps/cli/src/commands/mission.js`, `dema mission compact`) — reads
  `$DEMA_HOME/mission/receipts` read-only (via the shared reader), builds the shelf, compacts it.

**The Ihsān gate** — a compaction is only trustworthy if it answers, every time:
*what did I keep · what did I drop · what can I no longer claim · what is the one safe next step.*
It NEVER silently drops an obligation (`verify` rejects a dropped dropped-list).

## Input Contract

```js
runNode0ReceiptShelfCompactionStatePreview({ consent, input })
// input = { shelf: <NODE0-LOCAL-URP-SHELF-INDEX verdict payload> }
```

Exact consent: `GO: node0 receipt shelf compaction state preview`

## Output Contract

```text
schema · truth_label · ok · status (compaction_state_complete | compaction_state_broken)
content_hash · shelf_ok
source_receipt_count · valid_receipt_count · invalid_receipt_count · live_leak_count
retained_signals[] · dropped_content[] · what_can_no_longer_be_claimed[] · one_next_safe_action
boundary (all-false) · mint_allowed:false · authority_delta:0 · committed_live:false · blocked_by[]
```

## Verification

```js
verifyNode0ReceiptShelfCompactionStatePreview(payload)
```

Body-bound re-derivation, PLUS: re-verifies the embedded shelf (launder chain compaction → shelf →
receipt hashes), re-derives every count from it (a forged count is rejected), and enforces the Ihsān
gate (dropped-list / no-longer-claimable / next-action all required).

## What this does NOT prove

No RL, no model, no file read in the kernel, nothing committed live. It compacts PROOF, not meaning —
the dropped raw content/semantics are unrecoverable by design. Launder-resistance is
content-addressing only (the shelf holds hashes, not payloads), so it cannot re-derive the genesis
signature chain from summaries. It publishes nothing to any shared/federated URP; live URP remains
`DESIGNED_NOT_LIVE`.

## Boundaries

- Pure kernel; any effect is injected and documented in the kernel header
- No network, daemon, wallet, token, federation, or live execution
- All-false boundary invariant — signing/preview authority ≠ execution authority

## Files

```text
packages/core/src/node0-receipt-shelf-compaction-state-preview.js
tests/node0-receipt-shelf-compaction-state-preview.test.js
scripts/review/node0-receipt-shelf-compaction-state-preview-check.mjs
scripts/check.mjs
packages/core/src/dema-capability-truth-registry.js
docs/receipts/NODE0_RECEIPT_SHELF_COMPACTION_STATE_PREVIEW_1A.md
docs/02-architecture/NODE0_RECEIPT_SHELF_COMPACTION_STATE_PREVIEW_v0_1.md
```

## Commands

```bash
node --test tests/node0-receipt-shelf-compaction-state-preview.test.js
node scripts/review/node0-receipt-shelf-compaction-state-preview-check.mjs --json
npm test
npm run check
```
