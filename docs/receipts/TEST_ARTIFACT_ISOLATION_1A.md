# Receipt: TEST-ARTIFACT-ISOLATION-1A

Truth label: `MEASURED` — harness-hygiene repair with red-first evidence. `authority_delta: 0`.

## Slice

Repository verification must not delete, overwrite, restore, consume, or depend on
operator-created or operator-modified worktree artifacts. This slice retires the
`[PROTOTYPE CI ISOLATION]` preflight (`scripts/ci/restore-urp-artifacts.mjs`, lineage
`448711b`, 2026-06-06) that ran `git restore artifacts/proofs/node0-local-urp/` before
every `npm test` / `npm run coverage` / `npm run check`.

The script's own header declared the exit: *"Future: replace with true artifact fixtures
under the test harness so restore is unnecessary."* That future arrived earlier than the
header knew — every write-mode caller of the URP artifact builders already injects an
`mkdtemp` root (`tests/node0-local-urp-proof.test.js`, `tests/node0-self-check.test.js`),
so the drift the restore guarded against no longer occurs.

## Red-first proof (before repair, at `403c674` lineage)

Log: `/data/bizra/logs/tai-1a-red-receipt.log`

1. **Drift is gone** — full raw suite (`node --test tests/*.test.js`, 7,488 tests / 358
   suites) with NO restore preflight: `git status --porcelain` empty before and after.
   The only failures were the 4 known sandbox-environmental ones (EROFS/ENOENT), identical
   to the with-restore baseline. Log: `/data/bizra/logs/tai-1a-raw-suite-no-restore.log`.
2. **Harm is real** — a tracked operator edit to
   `artifacts/proofs/node0-local-urp/critic_report_001.json`
   (golden `bad8633735f0…86ce84` → edited `dc2add3a21a2…e877c2`) was silently reverted to
   the golden hash by the preflight with exit 0 and a clean porcelain — the edit erased
   without a trace. An untracked sentinel in the same directory survived byte-for-byte
   (`9946725823…e485732`), confirming the harm is scoped to tracked files via `git restore`.
3. **Guard test red** — `tests/test-artifact-isolation.test.js` failed 2/2 against the
   pre-repair tree (scripts contained the restore prefix; the script file existed).

## Repair (minimum)

- `package.json`: removed the `node scripts/ci/restore-urp-artifacts.mjs && ` prefix from
  `test`, `coverage`, and `check`. No other script changed.
- Deleted `scripts/ci/restore-urp-artifacts.mjs`.
- Added `tests/test-artifact-isolation.test.js` (2 tests): no npm script may invoke
  `git restore|checkout|clean|stash` or the retired preflight; the preflight file stays
  deleted. Fails closed if either returns.

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
- Operator-terminal / CI greenness of the 4 known sandbox-environmental failures
  (EROFS mkdtemp under `$HOME`, ENOENT `uv_os_get_passwd`) — environment-bound, unchanged
  by this slice.
- Anything about federation, URP liveness, tokens, or the artifacts' semantic truth.
