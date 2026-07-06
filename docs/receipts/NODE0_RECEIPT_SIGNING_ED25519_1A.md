# Receipt: NODE0-RECEIPT-SIGNING-ED25519-1A

Truth label: `NODE0_SIGNED_SANDBOX_RECEIPT_ATTESTATION`

## Slice

This slice closes the attestation hinge for sandbox execute receipts:

```text
execute receipt → canonical payload → Ed25519 sign → public-key verify → tamper reject
```

`#306` proved integrity (`content_hash`, `state_hash`, sealed log, proven undo). `#307` proves authorship binding without expanding execution power.

## Proof Contract

The default gate must pass only while:

- exact signing GO phrase matches byte-for-byte,
- a real `#306` sandbox execute receipt is signed,
- verification succeeds with public key only,
- `content_hash` and `state_hash` tamper binds fail closed,
- private key material is absent from the attestation envelope,
- unsigned execute receipts still pass integrity verification,
- (parity round NODE0-RECEIPT-SIGNING-PARITY-1A, payload schema v0.2) the
  consent assertion is inside the signed payload — a valid signature over a
  consent-free payload fails `consent_not_in_signed_subject`,
- the displayed public-key fingerprint re-derives from the verifying key —
  a swapped fingerprint fails `public_key_fingerprint_mismatch`, a malformed
  PEM fails `public_key_invalid` instead of throwing,
- altered or removed displayed consent fails `consent_hash_invalid`.

This binds the same semantics PREVIEW-RECEIPT-SIGNING-1A proved for
preview-stack receipts: "these receipt hashes were signed under this exact
consent assertion, by a key whose displayed fingerprint matches the verifying
key" — not merely "these bytes were signed". It does not prove operator key
custody.

`npm run check` runs `node0-receipt-signing-ed25519-check.mjs` and keeps `NODE0_RECEIPT_SIGNING_ED25519_1A` at `MEASURED_REPO`.

## Commands

```bash
node --test tests/node0-receipt-signing-ed25519.test.js
node scripts/review/node0-receipt-signing-ed25519-check.mjs --json
npm run check
```
