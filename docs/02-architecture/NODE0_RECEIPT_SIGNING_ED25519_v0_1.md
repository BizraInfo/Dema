# NODE0-RECEIPT-SIGNING-ED25519-1A

Truth label: `NODE0_SIGNED_SANDBOX_RECEIPT_ATTESTATION`

## Purpose

`NODE0-RECEIPT-SIGNING-ED25519-1A` adds **identity attestation** to `#306` sandbox execute receipts. Signing binds authorship to the receipt’s `content_hash` and `state_hash` anchors. It does **not** grant execution authority.

```text
Signing authority ≠ execution authority.
```

Canon extension:

```text
Receipt becomes attestation.
```

## Input Contract

```js
signExecuteReceiptAttestation({
  receipt,           // executed #306 sandbox receipt
  consent,           // exact GO phrase (byte match)
  privateKeyPem,     // consented key material (never emitted in output)
  publicKeyPem,
  publicKeyFingerprint,
})
```

Exact signing consent:

```text
GO: sign sandbox execute receipt attestation
```

## Output Contract

Signed attestation envelope:

```text
schema
truth_label
signed
signed_at
payload.content_hash
payload.state_hash
payload.source_receipt_schema
payload.consent.go_phrase_hash   (v0.2 — consent inside the signed subject)
payload.consent.mode
signature.algorithm
signature.value
signature.public_key_fingerprint (must re-derive from the verifying key)
signature.public_key_pem
consent.go_phrase_hash           (displayed; must match the signed assertion)
boundary.signing_authority_not_execution
boundary.execution_authority_granted
```

Private key material is never included in the attestation envelope.

Parity round (NODE0-RECEIPT-SIGNING-PARITY-1A, payload schema v0.2, matching
PREVIEW-RECEIPT-SIGNING-1A): the consent assertion is part of the signed
payload, so a valid signature over a consent-free payload fails
`consent_not_in_signed_subject`; the displayed fingerprint must re-derive from
the key used for verification (`public_key_fingerprint_mismatch` otherwise;
malformed PEM fails `public_key_invalid` instead of throwing).

## Verification

```js
verifyExecuteReceiptAttestation(attestation, { publicKeyPem })
attestationBindsExecuteReceipt(receipt, attestation)
```

Verification uses **public key only**. Tampering `content_hash`, `state_hash`, or forging receipt body hashes breaks the bind.

## Boundaries

- Sandbox execute receipts only (`NODE0_REVERSIBLE_EXECUTE_RECEIPT_SCHEMA`, `executed === true`)
- No operator-path mutation beyond consented key-store reads
- No network, daemon, wallet, federation, or unattended signing
- Unsigned `#306` receipts remain valid integrity receipts without attestation

## Files

```text
packages/core/src/node0-receipt-signing-ed25519.js
tests/node0-receipt-signing-ed25519.test.js
scripts/review/node0-receipt-signing-ed25519-check.mjs
scripts/check.mjs
packages/core/src/dema-capability-truth-registry.js
docs/receipts/NODE0_RECEIPT_SIGNING_ED25519_1A.md
docs/02-architecture/NODE0_RECEIPT_SIGNING_ED25519_v0_1.md
```

## Commands

```bash
node --test tests/node0-receipt-signing-ed25519.test.js
node scripts/review/node0-receipt-signing-ed25519-check.mjs --json
npm test
npm run check
```
