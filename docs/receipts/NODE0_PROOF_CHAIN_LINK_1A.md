# Receipt: NODE0-PROOF-CHAIN-LINK-1A

Truth label: `NODE0_APPEND_ONLY_SIGNED_RECEIPT_CHAIN`

## Slice

Bind ordered `#307` signed-receipt `content_hash` anchors into a content-addressed
append-only hash chain. Builds directly on `#307` (receipt → attestation → chain).

```text
plan → build chain → verify (re-derive every link) → reorder/tamper reject
```

Canon extension:

```text
Receipts become a chain.
```

## Proof Contract

The default gate must pass only while:

- the exact GO phrase matches byte-for-byte,
- receipt anchors are positively validated (`sha256:<hex>`; empty/malformed blocked),
- the index-0 link binds the genesis sentinel and each link commits to the prior link hash,
- the chain is content-addressed and `verifyNode0ProofChainLink` re-derives every link,
- in-place receipt tampering, link-hash forgery, and reorder/fork all fail closed,
- the boundary stays all-false (no signing, no key custody, no execution authority).

`npm run check` runs `node0-proof-chain-link-check.mjs` and keeps `NODE0_PROOF_CHAIN_LINK_1A` at `MEASURED_REPO`.

## Commands

```bash
node --test tests/node0-proof-chain-link.test.js
node scripts/review/node0-proof-chain-link-check.mjs --json
npm run check
```
