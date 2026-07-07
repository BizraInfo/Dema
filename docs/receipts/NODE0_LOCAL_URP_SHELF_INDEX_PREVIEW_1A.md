# Receipt: NODE0-LOCAL-URP-SHELF-INDEX-PREVIEW-1A

Truth label: `NODE0_LOCAL_URP_SHELF_INDEX_PREVIEW_MEASURED_REPO`

## Slice

Pure preview-only local URP shelf index: composes an injected set of dema mission pulse receipts into a queryable, content-addressed local shelf catalog (mission ids, file/pulse hashes, per-receipt review status, counts) so the write-only receipts become readable; commits no live world-state, reads no model/network/daemon, receipts read-only via the CLI adapter, kernel stays pure.

```text
plan → build → verify → tamper-reject
```

## The shelf it opens

The first House-of-Wisdom shelf. `#345` wrote receipts; `#346` read one back; **this makes them all
queryable at once** — `URP_LOCAL_ACTIVE` becomes a thing you can *ask*, not just *write*.

```text
dema mission shelf  →  reads $DEMA_HOME/mission/receipts/*.json (read-only)
                    →  one content-addressed catalog: mission ids · file/pulse hashes · review status · counts
```

## Proof Contract

The gate must pass only while:

- the exact GO phrase matches byte-for-byte,
- the shelf is deterministic — entries are order-independent, so the content hash is stable no matter
  what order the receipts arrive in,
- each entry's `receipt_ok` reuses the return-review validator (shelf and review agree on "valid"),
- a **bad** receipt is still catalogued (the shelf shows what is held) but counted `invalid`; a
  `committed_live` receipt is surfaced as a `live_leak`,
- `verify` re-derives `entry_count` / `valid_count` / `invalid_count` / `live_leak_count` / `all_preview`
  from the entries, so a forged count is rejected,
- the boundary stays all-false (no execution authority).

Honesty: the kernel reads no file (the CLI adapter reads the receipts dir; an absent dir is an empty
shelf, a corrupt file is skipped). It commits NOTHING live and PUBLISHES nothing to any shared or
federated URP — a live URP remains `DESIGNED_NOT_LIVE`. The shelf is a local reading view, not a
network.

## Boundary

`shelf_index_complete` verdict only. No live URP publish, no mint, no wallet, no settlement, no
federation, no daemon, no model invocation, no network, no world-state commit. `boundary` all-false ·
`authority_delta` 0 · `mint_allowed` false.

`npm run check` runs `node0-local-urp-shelf-index-preview-check.mjs` and keeps `NODE0_LOCAL_URP_SHELF_INDEX_PREVIEW_1A` at `MEASURED_REPO`.

## Commands

```bash
node --test tests/node0-local-urp-shelf-index-preview.test.js
node --test tests/node0-local-urp-shelf-index-cli.test.js
node scripts/review/node0-local-urp-shelf-index-preview-check.mjs --json
dema mission shelf
npm run check
```
