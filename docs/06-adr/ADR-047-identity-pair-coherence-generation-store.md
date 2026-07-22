# ADR-047 — Identity pair coherence: immutable generations + atomic active pointer

- **Status:** Accepted (slice IDENTITY-PAIR-COHERENCE-1A)
- **Date:** 2026-07-22
- **Supersedes:** the two-flat-file authorship key layout as the *authority*
  model (legacy files remain readable pre-migration; see Migration)
- **Related:** PR #411 (frozen draft, architectural spike — rotation transaction
  will be rebuilt on this substrate as AUTHORSHIP-ROTATION-TRANSACTION-1B)

## Problem

The authorship key store served `loadPrivateKey()` and `loadPublicKey()` as two
independent reads of two flat files (`keys/node0-ed25519.pem`,
`keys/node0-ed25519.pub.pem`). 25 measured signing consumers in `packages/`
called both loaders separately. Any future rotation implemented as sequential
file replacement lets a consumer read the private half of one identity and the
public half of another — a cross-generation mixed pair — during the transition
window, after a crash between writes, or on partial rollback.

## Decision

One invariant, enforced structurally:

> No signing operation may obtain its private and public identity from
> different active generations.

Mechanism (`packages/receipts/src/authorship-key-store.js`):

```text
keys/
├── active-key.json            ← sole canonical selector (atomic rename only)
├── generations/
│   └── <fingerprint>/         ← immutable after creation
│       ├── private.pem        (0600)
│       ├── public.pem
│       └── metadata.json      (schema, fingerprint, content hashes, created_at, source)
└── retired-registry.json      ← fail-closed retirement check
```

- `loadActiveKeyPair(demaHome)` is the only signing-path identity API: reads
  the pointer once, verifies schema, containment (no escape from
  `keys/generations/`, no symlinks), metadata schema + fingerprint agreement,
  content hashes, private↔public pair consistency (derived DER equality), and
  retirement status — then returns one frozen snapshot
  (`fingerprint, generation_path, private_key_pem, public_key_pem,
  metadata_hash, active_pointer_hash`) or a structured `{ok:false,error}`.
  It never serves a partial or mixed pair.
- Pointer replacement: write `active-key.json.next` → fsync → parse-verify →
  atomic `rename` → fsync dir. A stale `.next` is inert (crash-before-rename
  preserves the old pair; crash-after-rename exposes the new complete pair).
- `initAuthorshipKey` now creates generation + pointer (no legacy flat files).
- `migrateLegacyAuthorshipKey` / `dema authorship key migrate` is the ONLY
  path from a legacy flat pair into the store: exact consent phrase
  `MIGRATE AUTHORSHIP KEY`, pair-consistency proof before any write, legacy
  files preserved in place. Ordinary signing never migrates silently, and
  `loadActiveKeyPair` never falls back to legacy files
  (`no_active_pointer` fails closed).
- Legacy `loadPrivateKey`/`loadPublicKey` remain for public-only verification
  consumers and pre-migration fixtures: pointer-aware first; legacy fallback
  ONLY when no pointer exists at all; present-but-unloadable pointer fails
  closed rather than serving stale material.
- Static gate `scripts/review/identity-pair-coherence-check.mjs` (wired into
  `scripts/check.mjs`): any `packages/`/`apps/` module referencing BOTH legacy
  loaders fails the check — regression to separate pair loads is extinct by
  construction. Allowlist: the key store itself.

All 25 pair-consuming signing modules were migrated to one
`loadActiveKeyPair()` call (matrix:
`artifacts/identity-pair-coherence/R0I_IDENTITY_CONSUMER_MIGRATION_MATRIX.json`).

## What this slice does NOT do

- No key rotation command, no rotation consent envelope, no nonce ledger, no
  retirement writes — that is AUTHORSHIP-ROTATION-TRANSACTION-1B, to be built
  on this substrate.
- No real `~/.dema/keys` mutation: all proofs run under throwaway `DEMA_HOME`s;
  the real signer is untouched and real homes migrate only by explicit
  operator consent.
- No change to signature formats, receipt schemas, or verification semantics —
  existing receipt fixtures still verify (T16).

## Consequences

- Rotation becomes a pointer swap between immutable generations — the mixed-
  pair failure class is structurally unrepresentable, not merely tested-for.
- Identity presence checks (`hasAuthorshipKey`, realm/first-look/observe
  gatherers) answer true for pointer OR legacy presence, so pre-migration homes
  keep their honest `VERIFIED` display until migration.
- Tests asserting the legacy flat layout were updated to the generation layout;
  the invariants they protected (0600 mode, PEM validity, no secret material in
  result envelopes, fail-closed on unreadable keys) are unchanged.
