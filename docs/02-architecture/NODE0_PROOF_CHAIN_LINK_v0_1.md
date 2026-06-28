# NODE0-PROOF-CHAIN-LINK-1A

Truth label: `NODE0_APPEND_ONLY_SIGNED_RECEIPT_CHAIN`

## Purpose

Bind an ordered set of `#307` signed-receipt `content_hash` anchors into a
content-addressed **append-only hash chain**. Each link commits to the previous
link's hash from a genesis sentinel, so altering or reordering any past receipt
breaks every downstream link. It consumes already-signed attestations — it does not
sign, hold keys, or mint.

## Input Contract

```js
runNode0ProofChainLink({ consent, receiptHashes })
// receiptHashes: ordered array of `sha256:<hex>` #307 attestation content_hash anchors
```

Exact consent:

```text
GO: append signed receipt to proof chain
```

## Output Contract

```text
schema
truth_label
ok
head_hash            // hash of the last link
link_count
content_hash         // content address over the full link list
boundary.execution_allowed (false)
blocked_by[]
```

Each link: `{ index, prev_link_hash, receipt_content_hash, link_hash }`. The index-0
link's `prev_link_hash` is the genesis sentinel `NODE0_PROOF_CHAIN_GENESIS_PREV`.

## Verification

```js
verifyNode0ProofChainLink(payload)
```

Body-bound re-derivation: recomputes every `link_hash`, enforces index order, genesis
anchoring, prev-hash continuity, `head_hash`, and `content_hash`. Fails closed on
in-place receipt tampering (`link_hash_mismatch`), link-hash forgery, reorder/fork
(`link_index_mismatch` / `prev_link_break`), and head/content-hash mismatch.

## Boundaries

- Pure kernel; no fs / network / process / clock / random
- Consumes already-signed #307 anchors — no signing, no key custody, no mint
- No network, daemon, wallet, token, federation, or live execution; no §1 identity surface
- All-false boundary invariant — chain/preview authority ≠ execution authority

## Files

```text
packages/core/src/node0-proof-chain-link.js
tests/node0-proof-chain-link.test.js
scripts/review/node0-proof-chain-link-check.mjs
scripts/check.mjs
packages/core/src/dema-capability-truth-registry.js
docs/receipts/NODE0_PROOF_CHAIN_LINK_1A.md
docs/02-architecture/NODE0_PROOF_CHAIN_LINK_v0_1.md
```

## Commands

```bash
node --test tests/node0-proof-chain-link.test.js
node scripts/review/node0-proof-chain-link-check.mjs --json
npm test
npm run check
```
