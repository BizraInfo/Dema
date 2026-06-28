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
- unsigned execute receipts still pass integrity verification.

`npm run check` runs `node0-receipt-signing-ed25519-check.mjs` and keeps `NODE0_RECEIPT_SIGNING_ED25519_1A` at `MEASURED_REPO`.

## Commands

```bash
node --test tests/node0-receipt-signing-ed25519.test.js
node scripts/review/node0-receipt-signing-ed25519-check.mjs --json
npm run check
```
