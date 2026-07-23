# IDENTITY-POST-MERGE-CONVERGENCE-1C — post-merge defect repair receipt

- **Date:** 2026-07-23 (GST)
- **Branch:** `fix/identity-post-merge-convergence-1c` off `6bf4f74` (identical
  tree to merged main squash `b1e3b0d`, since the merged branch was based on
  `719ec02` — record BASE_MOVED if main differs at push time)
- **Truth label:** LOCAL_ONLY · not remotely re-verified

Repairs the two edge defects the post-merge audit confirmed in PR #412's merged
code, plus the governance gap that let it merge on a green *status* while the
reviewer's *verdict* still listed blocking findings. No key rotation, real
signer untouched.

## Confirmed-then-fixed (verified against merged code before accepting)

- **Finding A — classification validated presence, not content.** Merged
  `classifyGeneration` returned `complete` when three files existed + keys
  matched, WITHOUT parsing `metadata.json`. A truncated-but-present metadata
  → `complete` → `migrated:true`, yet `loadActiveKeyPair` rejects
  `metadata_corrupt`. **Fix:** semantic classification —
  `absent` / `complete_verified` / `incomplete_repairable` / `conflict` /
  `recovery_required`. `verifyGenerationContent` runs the loader's full
  contract (regular files, parse, schema, fingerprint, algorithm, content
  hashes, Ed25519 pair, fingerprint match). Malformed metadata is regenerated
  from the still-verified legacy pair via an atomic staged replace, the bad
  bytes preserved as `metadata.json.recovery` (never deleted). Wrong-hash /
  irregular-object states → `recovery_required`, zero mutation.
- **Finding B — success declared before authoritative convergence.** Migration
  returned `migrated:true` right after pointer activation, without confirming
  the canonical loader accepts the result. **Fix:** both `migrate` and `init`
  call `loadActiveKeyPair` after activation and refuse success unless
  `ok && fingerprint === expected && generation_path === activated` — else
  `recovery_required` + `transition_state: pointer_committed_verification_failed`.
  Law: *a transition is complete only when the post-transition loader accepts
  the identity.*
- **Finding C — observation counted non-regular objects as present.** The
  content-free `safePresent` required non-symlink but not regular-file, so a
  directory / FIFO / socket at `active-key.json` or the legacy pub-key path
  read as present while the loader rejects it. **Fix:** `info.isFile()`
  (`lstat`-based, already excludes symlinks). Still content-free — never reads
  key material.

## Governance — a review STATUS is an execution receipt, not a verdict

New pure kernel `packages/core/src/review-admissibility.js`:
`evaluateReviewAdmissibility({review_executed, blocking_findings,
highest_severity, admissible})` → `MERGE_ALLOWED` only when the review both
executed AND concluded admissible with zero blocking findings; otherwise
`MERGE_BLOCKED`. Missing/ill-typed input fails closed. This encodes the lesson
of the premature #412 merge: a green "Greptile Review" check meant the job ran,
not that no blocking edge cases remained — the DEMA-FDE-DUAL-DIAGNOSTIC
laundering class. A normalized fixture is consumed (no vendor API this slice).

## Local qualification (logs `/data/bizra/logs/1c-*`)

```text
tests/identity-pair-coherence.test.js : 59 tests green (incl. 1C-A/B/C + review-admissibility)
affected suites (12 files)            : 206 green
npm test        : only the 4 pre-existing environmental fails, zero new
npm run coverage: 95.34 L / 84.32 B / 97.74 F ≥ 95/84/95;
                  review-admissibility.js 100/100/100
npm run check   : clears all gates incl. claim-corpus (119); stops only at the
                  env-masked TAP gate (120), green on CI
kernel-purity · ipc-gate · no-overclaim · negative-verdict · integration-check ·
git diff --check : all exit 0
```

## Promotion discipline for this PR (applying the governance fix to ourselves)

Draft PR. Before any merge, require INDEPENDENTLY: all workflow executions
successful AND zero unresolved Critical/P1/P2 findings AND the final review
summary contains no blocking edge cases AND the exact head SHA is recorded AND
human merge consent names that exact SHA. A green reviewer *status* is not
approval — read the reviewer's *report*.

## Not done / consent-gated

- ADR-047 body update (now also covering the semantic classification +
  post-transition verify) is μ-C1-gated (`docs/06-adr/*`). Deferred to an
  operator grant; delta captured here + in the two prior receipts.
- Remote steps (push, draft PR, review reply) need the operator shell.

## Non-claims

No signer rotation · real `~/.dema` signer untouched · PR #411 unchanged
(closed/superseded) · no dependency remediation · no federation/mint/network ·
Node0 NOT closed · DEMA active-bounded NOT claimed.
