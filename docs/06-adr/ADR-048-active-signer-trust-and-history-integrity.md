# ADR-048 — Active signer trust and historical signature integrity

- **Status:** Proposed (security-containment implementation candidate)
- **Date:** 2026-07-24
- **Related:** ADR-005 exact consent; ADR-006 verify-without-mint;
  ADR-047 immutable identity generations
- **Supersedes:** only the ambiguous authorship-verifier meaning that treated an
  embedded receipt key as its own trust anchor. It does not supersede or rewrite
  historical receipts or Proof Passport v0.1.

## Problem

An authorship receipt carries `signature.public_key_pem`. The v0.1 verifier used
that embedded key for acceptance, so any newly generated key could create a
self-consistent receipt claiming Node0 authorship. Signature integrity was
proved, but signer trust was not.

The same API fed two different jobs:

1. current-authority verification, which must consult the active local trust
   registry; and
2. portable replay of historical receipts, which may have no current local key
   store and can prove only embedded signature integrity.

Calling both results `VERIFIED` without a mandatory scope overclaimed the proof.

## Decision

### Current-authority verification

`verifyAuthorshipReceipt` and `verifyAuthorshipReceiptFile` are strict v0.2
verification surfaces with mandatory scope `ACTIVE_SIGNER_TRUST`.

Strict acceptance requires:

- one externally supplied trust snapshot;
- an exact trust-snapshot shape with only the active SPKI public key, its
  canonical fingerprint, and the retired-fingerprint list;
- claimed fingerprint = embedded SPKI fingerprint = externally trusted active
  fingerprint;
- a valid Ed25519 signature; and
- the embedded fingerprint absent from the retired set.

Every result projects canonical artifact/author fields and reports the claimed,
embedded, and trusted fingerprints when derivable. It never republishes
arbitrary receipt fields or private-key material.

### Public-only trust source

`loadAuthorshipTrustSnapshot(demaHome)` follows one `active-key.json` snapshot
and reads only public authority material. It:

- rejects symlinked `keys/`, `keys/generations/`, generation directories, and
  generation files;
- proves the selected generation remains inside the real generations root;
- validates metadata schema, algorithm, public-content hash, SPKI Ed25519 type,
  and canonical fingerprint;
- validates every retirement-registry entry;
- rejects an active fingerprint that is retired; and
- for a non-genesis pointer, requires `previous_generation` to appear in the
  retirement registry.

It never opens `private.pem`. Signing continues to use
`loadActiveKeyPair(demaHome)`, whose private/public pair checks remain stricter.

### Historical compatibility

`verifyAuthorshipReceiptIntegrity` and
`verifyAuthorshipReceiptIntegrityFile` retain the v0.1 result schema solely for
portable historical replay. They have mandatory scope
`SIGNATURE_INTEGRITY_ONLY` and trust state `NOT_EVALUATED`.

They prove:

- the receipt embeds a valid Ed25519 SPKI public key;
- the claimed fingerprint matches that key; and
- the payload matches the embedded signature.

They do not prove that the signer is active, trusted, or non-retired.

Caller routing is explicit:

| Surface | Verification contract |
| --- | --- |
| `dema authorship verify` | active signer trust |
| authorship closeout | active signer trust |
| Proof Passport generation | signature integrity only |
| Proof Passport deep verification | signature integrity only |
| URP local index | inherits deep integrity-only scope |
| signing/demo self-check | existing immediate signature self-check |

## Historical classification

Existing receipts are preserved byte-for-byte. Proof Passport v0.1 remains a
portable historical format through a compatibility verifier that treats absent
scope fields as signature-integrity-only and rejects any contradictory
active-trust claim. Newly generated Passports use v0.2 and bind
`SIGNATURE_INTEGRITY_ONLY` at the Passport, boundary, and per-receipt levels;
deep verification results use v0.2. No historical receipt is silently promoted
to current active-signer proof, and no receipt is rewritten during key
rotation.

## What this decision does not authorize

- no real key generation, rotation, revocation, signing, or registry write;
- no mutation of the operator's real `DEMA_HOME`;
- no push, merge, deployment, runtime activation, or public claim;
- no acceptance of a legacy flat-key home as current active trust; and
- no replacement for the separately consented rotation transaction and
  rotation receipt required by TASK-029.

## Verification

The security contract is exercised with generated keys under throwaway explicit
homes plus a frozen receipt/public-key fixture containing no private key.
Regression coverage includes rogue self-signing, retired and wrong keys,
tampered retired signatures, private PEM in public slots, secret-bearing trust
objects, malformed registries, incomplete rotation lineage, JSON `null`,
symlinked generations-root escape, public metadata corruption, strict CLI and
closeout routing, hostile receipt leaf projection, forged Passport scope
claims, one frozen Passport v0.1 compatibility fixture, and explicit
Passport/deep/URP integrity-only propagation.
