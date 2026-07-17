# Receipt: TEST-ARTIFACT-ISOLATION-1A

Truth label: `MEASURED` — in-repository harness-hygiene repair and regression
tests. The historical `/data/bizra/logs` captures below are `LOCAL_ONLY` operator
observations, not portable release proof. `authority_delta: 0`.

## Slice

The `test`, `coverage`, and `check` entrypoints must not erase a pre-existing
operator edit as setup. This slice retires the `[PROTOTYPE CI ISOLATION]`
preflight (`scripts/ci/restore-urp-artifacts.mjs`, lineage `448711b`,
2026-06-06) that ran `git restore artifacts/proofs/node0-local-urp/` before
`npm test`, `npm run coverage`, and `npm run check`.

Both test write-mode call sites inject an `mkdtemp` root
(`tests/node0-local-urp-proof.test.js`, `tests/node0-self-check.test.js`). The
same tests and `scripts/check.mjs` use read-only verification mode for the
committed goldens. Direct operator invocation of either builder without
`--verify` remains write-capable and is outside this repair.

## Historical local observation (before repair, at `403c674` lineage)

These absolute-path logs are mutable and unavailable in a clean checkout. Their
hashes bind only the bytes reviewed on 2026-07-15; they do not establish
provenance or remote/CI execution.

1. `/data/bizra/logs/tai-1a-red-receipt.log` — SHA-256
   `3f8b6eeecce220e5ca8d5cfd90d284bd12f14c595cdac06459420e2041752d77`.
   It records that a tracked operator edit to
   `artifacts/proofs/node0-local-urp/critic_report_001.json`
   (golden `bad8633735f0…86ce84` → edited `dc2add3a21a2…e877c2`) was silently reverted to
   the golden hash by the preflight with exit 0. An untracked sentinel survived
   byte-for-byte (`9946725823…e485732`). This is a local observation of the
   tracked-file effect of `git restore`, not a durable release artifact.
2. `/data/bizra/logs/tai-1a-raw-suite-no-restore.log` — SHA-256
   `453e91b5a2fda790006cce5fa716db3568d4bc6a8f27ae60e8a47703dd57c13a`.
   The raw diagnostic reports 7,488 tests / 358 suites / 7,484 pass / 4 fail.
   Re-running the repository classifier over this log recognizes one failure and
   rejects three as unrecognized, exit 1. The log has no before/after porcelain
   markers and no with-restore baseline, so it is not evidence of a green or
   drift-free suite.
3. The pre-repair source contains the forbidden package-script prefix and the
   retired file, so the current two regression assertions are source-derivable
   failures on that tree. No separate red-test execution log is claimed.

## Rebind observation (1B, 2026-07-17, `LOCAL_ONLY`)

Reconciliation of this repair with current `main`, recorded as local operator
observations under the same caveats as the section above.

- Parents of the reconciliation lineage: `32b0670` (review-fix head) merged
  with `816cd31` (main, PR #396) as `dd5d05d`, then merged with `a8db3f7`
  (main, PR #397). Both merges auto-resolved; the second touched only
  `docs/02-architecture/key-maker-epistemic-conduct-v0.1.md` and
  `docs/06-adr/ADR-045-diagnostic-schema-versioning-and-fail-closed-negation.md`.
- `git diff 816cd31..a8db3f7 -- package.json scripts/ci/ scripts/review/ tests/`
  is empty, so the 2026-07-17 disposable-worktree red observation at `816cd31`
  (preflight reverted a tracked edit to
  `artifacts/proofs/node0-local-urp/critic_report_001.json`, exit 0) remains
  the effective pre-repair baseline for `a8db3f7`.
- Preservation observation at `dd5d05d`
  (`/data/bizra/logs/tai-1b-preservation-npm-test.log`): a tracked sentinel
  edit (`165cdfac…0a8cd5`) and an untracked sentinel (`b5f7e7d2…25cd51`)
  hashed byte-identical before and after a full `npm test` run.
- Suite at `dd5d05d` in the sandboxed session
  (`/data/bizra/logs/tai-1b-clean-npm-test.log`): 7,510 tests, 7,506 pass,
  4 fail — all with sandbox-environment signatures (`EROFS` under `$HOME`,
  `uv_os_get_passwd` `ENOENT`); the three G8-unrecognized failing test files
  are byte-identical to both merge parents. No mask or allowlist was widened.
  Coverage thresholds measured 95.28 line / 84.24 branch / 97.76 funcs
  (`/data/bizra/logs/tai-1b-coverage.log`). These are `LOCAL_ONLY`
  observations; remote CI on the pushed head remains the required authority.

## Repair (minimum)

- `package.json`: removed the `node scripts/ci/restore-urp-artifacts.mjs &&`
  prefix, including its following separator space, from `test`, `coverage`,
  and `check`. No other package script changed.
- Deleted `scripts/ci/restore-urp-artifacts.mjs`.
- Added `tests/test-artifact-isolation.test.js` (2 tests): the three in-scope
  package entrypoints — and their npm `pre`/`post` lifecycle siblings, which npm
  runs automatically — may not directly contain `git restore|checkout|clean|stash`
  or the retired preflight name, and the retired file must remain absent.
- Hardened `scripts/review/no-overclaim.mjs` to exclude deleted paths from its
  current-body scan. `tests/no-overclaim.test.js` reproduces a deletion in a
  disposable Git repository, preventing the aggregate gate from reopening the
  deleted file with `readFileSync`.

## Boundary

```text
No runtime execution beyond the test harness · no model invocation · no network
No workflow (.github) change · no schema change · no dependency change
No consent-surface change · no receipt-issuance change · authority_delta: 0
```

## What this does not prove

- That the suite is fully hermetic — tests still read committed goldens in
  `artifacts/proofs/node0-local-urp/` (read-only verify paths); an operator edit there
  now makes those tests fail HONESTLY instead of being silently reverted. That is the
  intended fail-closed behavior, not a defect.
- That the static package-script guard detects indirect helpers, `git` global-option
  variants, arbitrary filesystem writes, or a caller-selected `TMPDIR` inside the
  checkout. Merge-readiness therefore also requires a fresh before/after worktree
  comparison around the real verification commands.
- Greenness of the historical raw log; it is explicitly non-green and classifier-rejected.
- Remote CI or Node-version-matrix proof on the final branch SHA.
- Anything about federation, URP liveness, tokens, or the artifacts' semantic truth.
