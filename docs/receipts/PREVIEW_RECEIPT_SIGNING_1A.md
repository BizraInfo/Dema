# Receipt: PREVIEW-RECEIPT-SIGNING-1A

Truth label: `PREVIEW_RECEIPT_SIGNING_MEASURED_REPO`

## Slice

Bind preview-stack receipts to the existing Ed25519 signing rail via a canonical
envelope adapter. No new signing system: canonical stringify, hash, signature
primitives, and key-store loaders are the same modules used by
NODE0-RECEIPT-SIGNING-ED25519-1A (`packages/receipts/src/authorship-signature.js`,
`packages/consent/src/consent-common.js`, `packages/receipts/src/authorship-key-store.js`).

```text
plan (exact GO) → unsigned envelope (signed:false, signature:null)
  → sign via existing rail → verify → tamper-reject → launder-reject
```

## Proof Contract

The default gate signs the real `buildPeakSelfLoopPreview()` report and must pass
only while:

- the exact GO phrase `GO: sign preview-stack receipt` matches byte-for-byte,
- only `mode: "preview_only"` reports are eligible (execute receipts stay on the
  NODE0-RECEIPT-SIGNING-ED25519-1A rail),
- the unsigned envelope is explicitly marked unsigned (`signed: false`,
  `signature: null`) and still verifies as unsigned,
- the canonical content hash is stable across rebuilds and unchanged by signing,
- the signed envelope carries complete signature metadata (algorithm, value,
  public-key fingerprint, public-key PEM) and no private-key material,
- the exact-consent hash is inside the signed subject: a signature computed over
  the bare envelope (consent merely attached, not signed) fails verification,
- the displayed public-key fingerprint re-derives from the embedded PEM; a
  swapped fingerprint fails with `public_key_fingerprint_mismatch`,
- whole-body re-derivation rejects a tampered `content_hash`,
- the Ed25519 signature anchor rejects a forged field even when the forger
  recomputed a self-consistent `content_hash`,
- the boundary stays all-false, including `public_safe_claim: false`.

`npm run check` runs `preview-receipt-signing-check.mjs` and keeps
`PREVIEW_RECEIPT_SIGNING_1A` at `MEASURED_REPO`.

## What this does not prove

Operator key custody, a signer daemon, public-safe publication, remote CI seal,
economic activation, live autonomy, or that a signed preview's content is true —
the signature attests identity of the preview bytes only.

## Commands

```bash
node --test tests/preview-receipt-signing.test.js
node scripts/review/preview-receipt-signing-check.mjs --json
npm run check
```
