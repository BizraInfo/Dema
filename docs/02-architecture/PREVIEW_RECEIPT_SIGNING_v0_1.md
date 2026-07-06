# PREVIEW-RECEIPT-SIGNING-1A

Truth label: `PREVIEW_RECEIPT_SIGNING_MEASURED_REPO`

## Purpose

Close the preview-stack cryptographic gap: `dema peak-self-loop` (and sibling
`mode: "preview_only"` kernels) produce content-addressed reports with no
signature bind. This adapter wraps any preview report in a canonical envelope and
signs it through the existing Ed25519 authorship rail. It introduces no new
signing system and no CLI command.

## Input Contract

```js
runPreviewReceiptSigning({ consent, input, generateKeypair, signedAt })
signPreviewReceipt({ preview, consent, privateKeyPem, publicKeyPem, ... })
signPreviewReceiptWithKeyStore({ preview, consent, demaHome, ... })
```

Exact consent (byte match, fail-closed):

```text
GO: sign preview-stack receipt
```

Eligibility is positive: `input.schema` must be a `bizra.dema.*` string,
`input.mode` must equal `"preview_only"`, and the report must carry no
private-key material. Execute receipts do not pass this adapter — they sign via
NODE0-RECEIPT-SIGNING-ED25519-1A.

## Output Contract

```text
unsigned envelope: schema · truth_label · source_schema · preview (embedded)
                   · content_hash (whole body) · signed:false · signature:null
                   · boundary (all-false, incl. public_safe_claim:false)
signed envelope:   + signed:true · signed_at · signature{algorithm:"ed25519",
                   value, public_key_fingerprint, public_key_pem}
                   · consent{go_phrase_hash, mode:"exact_sign"}
orchestrator:      ok · content_hash · unsigned_marked_unsigned ·
                   signed_has_signature_metadata · hash_stable ·
                   tamper_hash_rejected · launder_rejected · blocked_by[]
```

## Verification

```js
verifyPreviewReceiptSigning(envelope, { publicKeyPem })
```

Body-bound re-derivation: the whole-body hash is recomputed from the
reconstructed unsigned body. For signed envelopes the Ed25519 signature is
verified over the SIGNING SUBJECT — the canonical unsigned envelope (hash
included) plus the consent block — so the verifier proves "these preview bytes
were signed under this exact consent assertion", not merely "some bytes were
signed". A forged field with a recomputed self-consistent `content_hash` still
fails with `signature_invalid`; a signature computed without the consent block
in the subject also fails; a displayed fingerprint that does not re-derive from
the embedded PEM fails with `public_key_fingerprint_mismatch`. `content_hash`
itself remains the consent-free unsigned-body hash and is unchanged by signing.

## Boundaries

- Pure kernel; keypair generation and key-store loaders are injected
- Signing authority ≠ execution authority — a signature attests preview bytes only
- No network, daemon, wallet, token, mint, federation, or live execution
- No public-safe claim: `public_safe_claim: false` on every envelope
- Signing a preview does not promote its claims — truth labels ride along unchanged

## Files

```text
packages/core/src/preview-receipt-signing.js
tests/preview-receipt-signing.test.js
scripts/review/preview-receipt-signing-check.mjs
scripts/check.mjs
packages/core/src/dema-capability-truth-registry.js
docs/receipts/PREVIEW_RECEIPT_SIGNING_1A.md
docs/02-architecture/PREVIEW_RECEIPT_SIGNING_v0_1.md
```

## Commands

```bash
node --test tests/preview-receipt-signing.test.js
node scripts/review/preview-receipt-signing-check.mjs --json
npm test
npm run check
```
