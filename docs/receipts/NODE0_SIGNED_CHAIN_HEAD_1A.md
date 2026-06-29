# Receipt: NODE0-SIGNED-CHAIN-HEAD-1A

Truth label: `NODE0_SIGNED_PROOF_CHAIN_HEAD`

## Slice

Compose `#307` (Ed25519 attestation) + `#308` (proof chain): verify a chain, then
Ed25519-sign its `head_hash` so one signature attests the whole receipt history.

```text
build chain → sign head → public-key verify → bind-to-chain → tamper-reject
```

Canon extension:

```text
One signature over the head attests the whole chain.
```

## Proof Contract

The default gate must pass only while:

- the exact GO phrase matches byte-for-byte,
- the chain is positively verified before its head is signed,
- the signed head payload binds head_hash + link_count + chain content address,
- verification succeeds with the public key only,
- a tampered/reordered chain (different head) fails `signedChainHeadBindsChain`,
- the private key never appears in the attestation envelope,
- the boundary holds signing authority ≠ execution authority (no key custody, no §1).

`npm run check` runs `node0-signed-chain-head-check.mjs` and keeps `NODE0_SIGNED_CHAIN_HEAD_1A` at `MEASURED_REPO`.

## Commands

```bash
node --test tests/node0-signed-chain-head.test.js
node scripts/review/node0-signed-chain-head-check.mjs --json
npm run check
```
