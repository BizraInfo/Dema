# NODE0-SIGNED-CHAIN-HEAD-1A

Truth label: `NODE0_SIGNED_PROOF_CHAIN_HEAD`

## Purpose

Compose `#307` (Ed25519 receipt attestation) and `#308` (append-only proof chain):
verify a `#308` chain, then **Ed25519-sign its `head_hash`**. One signature
transitively attests every receipt in the chain — alter or reorder any receipt and
the head changes, so the signature no longer binds. Key material is injected and
ephemeral: no persistent custody, no real-identity key generation, no §1 surface.

## Input Contract

```js
signChainHead({ chain, consent, privateKeyPem, publicKeyPem, publicKeyFingerprint })
// chain is a verified #308 buildNode0ProofChainLinkPayload(...) result.
// The signing PEMs are supplied per call and are ephemeral; never persisted, never emitted.
```

Exact consent:

```text
GO: sign proof chain head attestation
```

## Output Contract

Signed attestation envelope:

```text
schema
truth_label
signed / signed_at
payload.head_hash
payload.link_count
payload.chain_content_hash
signature.algorithm / value / public_key_fingerprint / public_key_pem
consent.go_phrase_hash
boundary.signing_authority_not_execution (true)
boundary.execution_authority_granted (false)
boundary.private_key_exposed (false)
boundary.persistent_key_custody (false)
```

Private key material never appears in the envelope.

## Verification

```js
verifySignedChainHead(attestation, { publicKeyPem })   // public-key-only
signedChainHeadBindsChain(chain, attestation)          // re-derive head, bind to chain
```

Verification uses the public key only. A tampered or reordered chain yields a
different `head_hash`, so `signedChainHeadBindsChain` fails (`head_hash_bind_failed`)
even though the signature itself is valid. Wrong key, missing consent, and any
private-key leak are rejected.

## Boundaries

- Pure kernel; randomness is the injected keypair generator (no direct random/clock)
- Consumes a verified #308 chain — no signing of unverified input
- No persistent key custody, no real-identity key, no §1 identity runtime
- No network, daemon, wallet, token, federation, or live execution
- Boundary invariant: signing authority ≠ execution authority

## Files

```text
packages/core/src/node0-signed-chain-head.js
tests/node0-signed-chain-head.test.js
scripts/review/node0-signed-chain-head-check.mjs
scripts/check.mjs
packages/core/src/dema-capability-truth-registry.js
docs/receipts/NODE0_SIGNED_CHAIN_HEAD_1A.md
docs/02-architecture/NODE0_SIGNED_CHAIN_HEAD_v0_1.md
```

## Commands

```bash
node --test tests/node0-signed-chain-head.test.js
node scripts/review/node0-signed-chain-head-check.mjs --json
npm test
npm run check
```
