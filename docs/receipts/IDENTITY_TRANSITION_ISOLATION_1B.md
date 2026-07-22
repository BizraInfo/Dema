# IDENTITY-TRANSITION-ISOLATION-1B — PR #412 review convergence receipt

- **Date:** 2026-07-23 (GST)
- **Worktree:** `/data/bizra/worktrees/ipc-1a/Dema` · branch `feat/identity-pair-coherence-1a`
- **Base:** main `719ec02` · builds on `2dd44f5` (IPC-1A + truth closure)
- **Truth label:** LOCAL_ONLY · not remotely re-verified

Resolves the five Greptile findings on PR #412 (3 P1 + 2 P2) + the code-scanning
unused-import finding. No key rotation, no real signer access.

## Review finding matrix

| # | Sev | Finding | Fix | Test |
|---|-----|---------|-----|------|
| 1 | P1 | concurrent init shares `active-key.json.next`; a success can name a fingerprint that is not active | exclusive O_EXCL lease `keys/transactions/identity-transition.lock`; unique per-transition staged path `active-key.json.<transitionId>.next`; pointer re-checked UNDER the lease; loser mutates nothing | R1: T1-T4, T2b |
| 2 | P1 | migration accepts non-Ed25519 pairs (consistency ≠ algorithm) | `pairConsistency` requires both keys `asymmetricKeyType === "ed25519"` → `unsupported_key_algorithm` before mutation; `algorithm` bound in metadata; loader verifies metadata↔key agreement | R2: T5-T8 |
| 3 | P1 | interrupted migration cannot resume (O_EXCL EEXIST deadlock) | `classifyGeneration` → absent/complete/incomplete/conflict; write-if-absent fills gaps only, never overwrites a valid byte; conflict → `recovery_required`; retry is idempotent by fingerprint | R3: T9-T11 + partial-resume |
| 4 | P2 | `PRESENT_UNVERIFIED` collapsed to `UNINITIALIZED` → init dead-end | state preserved distinct; `recommended_action: MIGRATE_AUTHORSHIP_KEY`; realm home + status surface it | R4: T12-T13 |
| 5 | P2 | `existsSync(active-key.json)` follows symlinks → observer disagrees with loader | observer presence is symlink-safe `lstat` (content-free — the "never read key material" boundary of `observe-gatherer` is preserved; `inspectActiveIdentity` loads the private key and MUST NOT be called here); escaped/symlinked pointer no longer counts present | R5: T14-T15 |
| — | scan | unused `chmodSync` / `rmSync` imports | removed; `rmSync` re-added only where genuinely used | R6: T16 |

## Design note — the one place the reviewer's letter and the codebase disagreed

The finding said "the observer should consume `inspectActiveIdentity()`." But
`observe-gatherer` carries a hard, tested boundary: it checks key PRESENCE via
`existsSync` and **never reads key content** (`tests/node0-activation-observe-cli.test.js`
asserts the injected fs has no `readFileSync`). `inspectActiveIdentity` →
`loadActiveKeyPair` reads `private.pem`. Calling it from the observer would
break that safety boundary. The finding's own alternative — "a read-only
observation adapter derived from the same authoritative validation path" — is
the correct resolution: the observer now does the same symlink-rejection the
loader does, via `lstat`, with zero content read. It reports presence + safety,
never `VERIFIED` (which genuinely requires the private key). Observer and loader
now agree on the safety-critical case (a symlinked pointer is not present).

## Local qualification (logs `/data/bizra/logs/iti1b-*`)

```text
tests/identity-pair-coherence.test.js : 47 tests green (28 base + 19 new)
npm test        : only the 4 pre-existing environmental fails (273, 2492,
                  4130/4131, 4563/4564) — zero new failures vs baseline
npm run coverage: thresholds pass (95.35 L / 84.34 B / 97.74 F ≥ 95/84/95;
                  authorship-key-store.js branch 84.72)
ipc-gate (now allowlist = store + observe-gatherer only) · kernel-purity ·
no-overclaim · negative-verdict · integration-check · llm:guidance ·
git diff --check : all exit 0
```

## Not done / consent-gated

- **ADR-047 body update** (transition lease, Ed25519 restriction, resumable
  migration) is μ-C1-gated (`docs/06-adr/*` blocked without a ledger grant).
  Not self-bypassed. Delta captured here; ADR edit pending an operator grant.
- Remote steps (push new head, update PR #412 body to the exact SHA, per-finding
  replies, `@coderabbitai review`) require the operator shell — the sandbox
  cannot reach origin (CA-cert wall). Commands handed off.

## Non-claims

No signer rotation · real `~/.dema` signer untouched · PR #411 unchanged
(frozen) · no dependency remediation · no federation/mint/network/PoI · Node0
NOT closed · DEMA active-bounded NOT claimed.
