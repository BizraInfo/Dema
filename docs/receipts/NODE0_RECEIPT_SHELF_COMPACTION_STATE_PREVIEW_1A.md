# Receipt: NODE0-RECEIPT-SHELF-COMPACTION-STATE-PREVIEW-1A

Truth label: `NODE0_RECEIPT_SHELF_COMPACTION_STATE_PREVIEW_MEASURED_REPO`

## Slice

Pure preview-only receipt-shelf compaction: turns a verified local URP receipt shelf into a compacted, hash-bound mission state that RETAINS only verified signals (mission ids, file/pulse hashes, review status, counts, boundary) and explicitly lists what was DROPPED (raw content, unverified semantic claims, model-generated meaning), what can no longer be claimed, and exactly one next safe action; no RL, no model, no network, no live URP write, kernel stays pure.

```text
plan → build → verify → tamper-reject
```

## The Dema-native compaction thesis

Everyone else compacts **meaning** (lossy, unverifiable prose). Dema compacts **proof** — the
receipt shelf (#347), not conversation history. `dema mission compact` reads receipts → shelf → a
hash-bound state that keeps only verified signals and *names what it dropped*.

```text
CompactionRL: summaries optimized for future reward.
Dema:          summaries verified against consent, receipts, and Ihsān before they may guide action.
```

## Proof Contract

The gate must pass only while:

- the exact GO phrase matches byte-for-byte,
- the source shelf re-verifies (`verifyNode0LocalUrpShelfIndexPreview`) — a forged shelf is rejected,
- every compacted count is re-derived from the embedded shelf, so a forged `valid_receipt_count` etc. is rejected,
- the **Ihsān gate** is answered in full — `retained_signals`, `dropped_content`,
  `what_can_no_longer_be_claimed`, and one `one_next_safe_action` are ALL present; verify rejects a
  compaction that dropped its own dropped-list (no obligation may be silently dropped),
- a `live_leak` (a receipt claiming `committed_live`) turns the next action into a **quarantine**, not an act,
- `committed_live` stays false and the boundary stays all-false.

Honest limit: it compacts PROOF, not meaning — the dropped raw content/semantics can never be
recovered (by design). Its launder-resistance is **content-addressing only** (the shelf holds hashes,
not payloads) — it re-verifies the shelf's internal consistency but cannot re-derive the original
genesis signature chain from summaries. Declared, not hidden.

## Boundary

`compaction_state_complete` verdict only. No RL, no model, no live URP write, no publication to any
shared/federated URP, no mint, no daemon, no network, no world-state commit. `boundary` all-false ·
`authority_delta` 0 · `committed_live` false · `mint_allowed` false.

`npm run check` runs `node0-receipt-shelf-compaction-state-preview-check.mjs` and keeps `NODE0_RECEIPT_SHELF_COMPACTION_STATE_PREVIEW_1A` at `MEASURED_REPO`.

## Commands

```bash
node --test tests/node0-receipt-shelf-compaction-state-preview.test.js
node --test tests/node0-receipt-shelf-compaction-cli.test.js
node scripts/review/node0-receipt-shelf-compaction-state-preview-check.mjs --json
dema mission compact
npm run check
```
