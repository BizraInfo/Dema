# DEMA-RECEIPT-SIGNATURE-ANCHOR-PREVIEW-1A

Truth label: `DEMA_RECEIPT_SIGNATURE_ANCHOR_PREVIEW_MEASURED_REPO`

## Purpose

Preview-only signed receipt anchor: Ed25519 signature over a canonical-JSON receipt payload with injected keys; verifies signer identity and rejects payload/signature/canonicalization tamper and forge-and-recompute laundering. Mints nothing, binds no live identity.

## Input Contract

```js
runDemaReceiptSignatureAnchorPreview({ consent, input })
```

Exact consent:

```text
GO: dema receipt signature anchor preview
```

## Signed envelope (output of `signReceipt(payload, private_key)`)

```text
schema · truth_label
payload                      the receipt content
payload_hash                 sha256 of canonical(payload) — reference only
signature_alg: "ed25519"
signer_key_id                sha256 of the signer's SPKI DER
authority_delta: 0 · grants_action: false · mint_allowed: false · boundary: all-false
signature                    Ed25519 over canonical(body-without-signature), base64
```

## Verification

```js
verifySignedReceipt(envelope, trustedPublicKey)   // NOT the envelope's self-asserted key
```

The signature covers the **whole canonical body** (not just the payload), so any field tamper breaks
it. Verification is against a **trusted** public key (defends signer substitution). Blocks:
`unsigned_not_accepted` · `payload_hash_mismatch` · `signer_mismatch` · `signature_invalid`
(covers payload tamper, signature tamper, canonicalization drift) · `authority_delta_nonzero` ·
`grants_action_true` · `mint_allowed_true` · `boundary_not_all_false`.

**Forge-and-recompute defense:** changing a field and recomputing `payload_hash` still fails, because
re-signing requires the private key. This is the independent anchor content-addressing (#334) lacked.

## Boundaries

- Pure kernel; **keys are injected** — the kernel generates no keys and binds no live Node0 identity
  (the genesis signing-key ceremony is separate and operator-consented). Ed25519 is deterministic.
- No network, daemon, wallet, token, mint, federation, or live execution
- All-false boundary invariant — signing a preview receipt ≠ execution authority

## Files

```text
packages/core/src/dema-receipt-signature-anchor-preview.js
tests/dema-receipt-signature-anchor-preview.test.js
scripts/review/dema-receipt-signature-anchor-preview-check.mjs
scripts/check.mjs
packages/core/src/dema-capability-truth-registry.js
docs/receipts/DEMA_RECEIPT_SIGNATURE_ANCHOR_PREVIEW_1A.md
docs/02-architecture/DEMA_RECEIPT_SIGNATURE_ANCHOR_PREVIEW_v0_1.md
```

## Commands

```bash
node --test tests/dema-receipt-signature-anchor-preview.test.js
node scripts/review/dema-receipt-signature-anchor-preview-check.mjs --json
npm test
npm run check
```
