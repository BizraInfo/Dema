# Receipt: DEMA-RECEIPT-SIGNATURE-ANCHOR-PREVIEW-1A

Truth label: `DEMA_RECEIPT_SIGNATURE_ANCHOR_PREVIEW_MEASURED_REPO`.

## Slice

A preview-only **signed receipt anchor**. Moves receipt discipline from content-addressing
(self-consistent, forgeable by recompute) to a **cryptographic signature over the whole canonical-JSON
envelope body**, using Ed25519 with **injected** keys.

```text
sign(payload, private_key) → envelope   ·   verify(envelope, TRUSTED public_key) → ok / blocked
```

## The property content-addressing lacked

The #334 verified-answer cache documented that its integrity was "content-addressing only, not
signature-based tamper-resistance" — a forge-**and**-recompute launder was not defended. This slice
closes that gap: an attacker who changes a field **and** recomputes `payload_hash` (so content-
addressing is self-consistent) still cannot produce a valid signature **without the private key**. The
signature is the independent anchor.

## Proof Contract (13 focused tests + review gate)

`verifySignedReceipt(envelope, trustedPublicKey)` rejects, each with a named block:
- payload tamper · signature tamper · `signer_mismatch` (verified against a different key)
- canonicalization drift (signature over a non-canonical serialization) → `signature_invalid`
- `authority_delta_nonzero` · `grants_action_true` · `mint_allowed_true` · `boundary_not_all_false`
- `unsigned_not_accepted` (an unsigned envelope presented as signed)
- **forge-and-recompute** — field changed + `payload_hash` recomputed → still `signature_invalid`.

## Boundaries

- Pure kernel; **keys are injected** (ephemeral preview keys in the gate/tests). The kernel generates
  no keys and **binds no live Node0 identity** — the real genesis signing-key ceremony is separate and
  operator-consented.
- Ed25519 is deterministic (RFC 8032); no fs/network/clock/random in the kernel.
- Boundary all-false · `authority_delta:0` · `grants_action:false` · `mint_allowed:false`.

## What this proves

That a receipt can be cryptographically bound to a signer such that any tamper — including
forge-and-recompute — is detectable by a holder of the trusted public key.

## What this does NOT prove

It does not bind a live identity, persist/manage keys, verify that the payload's *content* is true, or
enable execution, daemon, network, wallet, mint, or federation. The signature proves **who signed**,
not that the signed statement is true.

## Commands

```bash
node --test tests/dema-receipt-signature-anchor-preview.test.js
node scripts/review/dema-receipt-signature-anchor-preview-check.mjs --json
npm run check
```
