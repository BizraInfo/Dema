# IDENTITY-COMMITTED-TRANSITION-RECOVERY-1D — recovery repair receipt

- **Date:** 2026-07-23 (GST)
- **Branch:** `fix/identity-committed-transition-recovery-1d` off `96a5fa1`
  (tree `bc39af5c`, identical to merged main `a1b45587`; record BASE_MOVED if
  main differs at push time)
- **Truth label:** LOCAL_ONLY · not remotely re-verified

Repairs the strand defect Greptile reported on the merged PR #413 — and which I
merged over because my shell script bypassed the review verdict. Reproduced
first, then fixed. No key rotation, real signer untouched.

## Reproduction (before fix)

```text
init (temp home)            → initialized:true
corrupt active generation   → loadActiveKeyPair: metadata_corrupt
retry init                  → key_already_exists   ← STRANDED
loader still rejects        → no recovery path, manual fs intervention required
```

Confirmed deterministically before any change.

## Fix — recovery-aware initialization

An existing active pointer is no longer a blanket `key_already_exists`.
`classifyActivePointer(demaHome)` returns one of
`valid | absent | genesis_invalid | prior_invalid | untracked_invalid`:

- **valid** → `key_already_exists` + `verified_existing_identity:true`, zero
  mutation (never replace a working identity).
- **genesis_invalid** (loader rejects, pointer's `previous_generation === null`
  — no prior verified identity at risk) → **safe automatic recovery**: the
  failed pointer is atomically moved to
  `keys/transactions/quarantine-active-key-<hash>.json` (evidence, never
  deleted); the failed generation dir is preserved; state returns to
  NO_ACTIVE_IDENTITY with `recovery_required` /
  `recovered_from: genesis_pointer_quarantined`. A retry then establishes a
  fresh verified identity.
- **prior_invalid** (`previous_generation` set — a prior identity may exist that
  can only be restored from its recorded pointer) → `recovery_required` /
  `prior_identity_recovery_required`, **no mutation**, evidence preserved.
- **untracked_invalid** (malformed / symlinked / non-regular pointer) →
  `recovery_required` / `untracked_invalid_active_pointer`, **no mutation** —
  never silently delete or quarantine an unreadable pointer.

The init post-verify-failure path (1C Finding B) also quarantines the just-
committed genesis pointer, so a crash between activation and verification
self-heals on retry instead of stranding. All recovery mutation runs UNDER the
transition lease (single-owner; concurrent recovery admits exactly one).

## Tests (red-first, `tests/identity-pair-coherence.test.js`)

T1 strand no longer traps retries (recovers) · T2 retry then establishes fresh ·
T3 valid pointer → key_already_exists + verified_existing_identity · T4
untracked/malformed → fail closed, no quarantine · T7 prior-identity invalid →
recovery_required, no mutation · T8 quarantine stays inside DEMA_HOME · T9
symlinked pointer → untracked_invalid · T14 real ~/.dema never resolved.

## Local qualification (logs `/data/bizra/logs/1d-*`)

```text
identity suite 66 green · 199 across affected suites
npm test        : only the 4 pre-existing environmental fails, zero new
npm run coverage: 95.33 L / 84.31 B / 97.74 F ≥ 95/84/95
npm run check   : corpus-gate registered; stops only at env-masked TAP gate
kernel-purity · ipc-gate · no-overclaim · negative-verdict · git diff --check : exit 0
```

## Honest scope limits (not claimed)

- **Review-admissibility is code, not yet an enforced merge authority.** PR #413
  shipped `evaluateReviewAdmissibility` but a buggy shell poller bypassed it and
  merged over a blocking Greptile verdict. This slice does NOT wire that kernel
  into the live GitHub merge gate (branch protection is out of authority and
  can't be changed from here). The enforcement this slice offers is
  DISCIPLINE, applied to this very PR: do not merge on a green reviewer
  *status* — read the reviewer's *report*, confirm zero unresolved P0–P2, and
  bind human consent to the exact head SHA. Wiring the kernel into a required
  CI gate that consumes a normalized review fixture is a separate slice.
- Full persistent transition-record state machine (13-field record, resume the
  exact in-flight keypair) is NOT implemented — recovery uses the pointer's own
  `previous_generation` to distinguish genesis from prior-identity. For a
  corrupt genesis generation, resume is impossible (the material is bad), so
  recovery establishes fresh; that is correct for genesis and is the defect's
  actual failure mode.

## Greptile PR #414 review — 3 P1 findings, verified and fixed

Greptile's `COMMENTED` review (a green *status*, empty summary body) carried
three inline **P1** findings on the first 1D push. Read the verdict, not the
status; each confirmed against the code, then fixed:

- **P1-1 established identity replaced.** Genesis auto-recovery quarantined any
  `previous_generation:null` pointer, so a corrupt-but-USED identity (receipts
  bound to its fingerprint) was silently replaced by a fresh keypair, orphaning
  those receipts. Fix: `anyReceiptBindsFingerprint` scans `$DEMA_HOME/receipts`
  for the failed fingerprint; if bound → `established_identity_recovery_required`,
  no mutation. A symlinked/unreadable/malformed receipts dir is treated as bound
  (fail closed). Only a provably UNUSED genesis is quarantined. This is the
  "no consumer-use receipt exists" condition the 1D GO named and I first missed.
- **P1-2 quarantine follows a symlinked dir (security).** `quarantineActivePointer`
  now refuses when `keys/transactions` is a symlink or non-contained
  (`unsafe_quarantine_dir`) and reports `quarantine_move_failed` on a
  cross-device rename — pointer evidence can no longer be moved outside
  `DEMA_HOME`.
- **P1-3 migration recovery stranded.** `migrate` blanket-returned
  `already_migrated` on any pointer, so a failed migration could not recover via
  the CLI (init was then blocked by the preserved legacy files). Fix: `migrate`
  is recovery-aware — an invalid genesis pointer is quarantined and re-migrated
  from the still-present legacy pair; its own post-verify failure quarantines
  the committed pointer; valid → `already_migrated`, prior/untracked → fail
  closed.

Tests: 6 new (3 P1 + 3 fail-closed coverage). Identity suite 72 green; 212
across affected suites; coverage 95.33 L / 84.30 B / 97.73 F ≥ 95/84/95.

## Non-claims

No signer rotation · real `~/.dema` signer untouched · PR #411/#412/#413 merged
state unchanged · no dependency remediation · no federation/mint/network ·
Node0 NOT closed · identity substrate NOT declared closed until this recovery
path is independently reproduced in review.
