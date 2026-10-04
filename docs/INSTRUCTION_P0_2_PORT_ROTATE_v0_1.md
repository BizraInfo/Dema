# INSTRUCTION — P0.2 · Port rotate onto current main, gated by real-layout fixtures

> Paste this whole block to the local agent. Bounded, read-only until proven, no operator
> key touched. Sprint: `BIZRA_SPRINT_01_ONE_REF_ONE_KEY_v0_1_DRAFT.md`.

---

## TASK

Execute sprint **P0.2**: produce one canonical ref where `dema authorship key rotate` exists
on top of the fetched current `origin/main` — but only if the ported command passes the
real-layout fixture matrix that represents the operator home. If no real-layout sequence
passes, **abandon the port** and report; do not fix forward into a larger slice.

> **HISTORICAL DESIGN BASE — 2026-07-28.** This instruction was analyzed against `a148cf2`
> after PRs #432 and #433 moved `origin/main` from `340e96f → 52f92c0 → a148cf2`.
> `a148cf2` is evidence for the design analysis, not permanent authority for execution.

## EXECUTION-TIME BASE INVARIANT

At execution time:

1. fetch `origin/main`;
2. record its exact full SHA;
3. create the isolated worktree from that fetched SHA;
4. verify the authorship surface still has `loadActiveKeyPair`,
   `loadAuthorshipTrustSnapshot`, `migrateLegacyAuthorshipKey`, and `checkRetired`;
5. verify current main still lacks the intended `rotate` command;
6. stop if those assumptions changed.

Never build from a stale SHA merely because this document names it historically.

## STATE VERIFIED DURING THE DESIGN SESSION

- Historical analysis base `a148cf2` had `loadActiveKeyPair`,
  `loadAuthorshipTrustSnapshot`, `migrateLegacyAuthorshipKey`, and `checkRetired`, with no
  usable `rotate` verb.
- `feat/authorship-key-rotate-1a` local `eb828a0` had rotate with 24/24 tests green but did
  not contain the post-#419 trust model.
- `3fdfa61` was dangling and superseded; preserve it with an archive tag if still reachable.
- Legacy implementation result:
  - `rotate → migrate` passed all five strict checks;
  - `migrate → rotate` produced `retired_generation`, followed by
    `recovery_required` on migration retry.
- The operator home was observed read-only as a pre-#419 layout with two key files and no
  active pointer, generations directory, retired directory, or rotation journal.

## HARD CONSTRAINTS

1. **Isolated worktree from fetched `origin/main` only.** Never switch the dirty primary tree.
2. **The operator's real `~/.dema` is untouchable.** No write, rotate, migration, private-key
   readout, or repeated inspection. All tests use throwaway fixture homes.
3. No push, merge, PR, ceremony, or network beyond required fetch/read-only repository access.
4. Red-first for new tests. Do not weaken, delete, skip, or mask an existing gate.
5. If a gate fails, report the exact failure. Environmental classification requires
   reproduction on unmodified current main in a separate worktree.
6. Do not change `checkRetired`, active-pointer semantics, or trust verification to make a
   port pass.

## STEPS

### 1. Establish current base

Fetch `origin/main`, record the full SHA, verify the assumptions above, and create:

```text
feat/authorship-key-rotate-1b-on-main
```

### 2. Port the rotate commits

Replay or cherry-pick the required rotate changes from the canonical legacy branch.
Resolve conflicts toward current main's active-pointer and trust model. The rotate command
adapts to the trust model; the trust model does not regress to the legacy command.

### 3. Re-green the rotate suite

Run:

```bash
node --test tests/authorship-key-rotate.test.js
```

All expected rotate tests must pass. If an old assertion contradicts the current trust
model, report the contradiction; do not delete the test to obtain green.

### 4. Execute the full fixture matrix

Every case uses a fresh throwaway fixture home and captures before/after state.

#### B — legacy compatibility control

```text
pre-#419 init → legacy rotate → current migrate → current verify
```

Record the five checks:

1. `loadActiveKeyPair` succeeds;
2. trust snapshot is readable;
3. active fingerprint equals NEW;
4. OLD fingerprint is retired;
5. NEW fingerprint is not retired.

#### A — legacy bricking control

```text
pre-#419 init → current migrate → legacy rotate → current verify
```

Record the exact result. Expected historical result was `retired_generation`; do not assume
it remains identical without running the control.

#### B′ — current-layout compatibility evidence

```text
current-main init → ported rotate → current verify
```

Record all five checks. B′ proves the port works on current-main-created homes, but it does
**not** decide whether the port is safe for the operator's pre-#419 home.

#### C′ — real-layout candidate order 1

```text
pre-#419 layout → ported rotate → migrate if required → current verify
```

This tests whether the ported command can operate before an active pointer exists.

#### D′ — real-layout candidate order 2

```text
pre-#419 layout → current migrate → ported rotate → current verify
```

This tests whether the ported command correctly moves the active pointer while retiring the
old generation.

For C′ and D′, also prove:

- old-key receipt is rejected specifically as retired;
- new-key receipt verifies;
- no successful result leaves `retired_generation`, `recovery_required`,
  `no_active_pointer`, or an active fingerprint in the retired set;
- no refusal occurs after partial mutation.

### 5. Apply the authoritative decision table

| C′ | D′ | Decision |
| --- | --- | --- |
| PASS | FAIL or refuse before mutation | Accept port; pin `rotate → migrate` for this exact SHA. |
| FAIL or refuse before mutation | PASS | Accept port; pin `migrate → rotate` for this exact SHA. |
| PASS | PASS | Accept only after selecting one order in advance, documenting the rationale, and pinning it in a ceremony test. No runtime choice during the real ceremony. |
| FAIL | FAIL | Abandon port. Touch no real key. |
| Partial mutation or contradictory state | Any | Abandon port and open a separately reviewed recovery/design slice. |
| Any | Partial mutation or contradictory state | Abandon port and open a separately reviewed recovery/design slice. |

C′ and D′ are authoritative because they reproduce the real home's starting layout. B′ is
supporting compatibility evidence only and cannot override the real-layout result.

### 6. Repository gates on the exact SHA

Run and report verbatim:

```bash
npm test
npm run check
npm run llm:guidance
git diff --check
```

Run any additional repository-required gates exposed by the current package scripts. Do not
invent a command that does not exist.

### 7. Commit locally and stop

Commit on the isolated branch. Do not push. Report the exact SHA and the complete fixture
matrix.

## DEFINITION OF DONE

- Ported branch starts from the fetched current `origin/main` full SHA.
- Exact base SHA and ported head SHA are recorded.
- Worktree is clean.
- All rotate tests pass.
- A, B, and B′ are recorded as compatibility evidence.
- C′ and D′ are both executed against a faithful pre-#419 starting layout.
- At least one of C′ or D′ passes every strict check.
- The passing real-layout case selects one ceremony order for the exact ported SHA.
- The non-selected order is recorded with its exact refusal or failure.
- Old-key receipt rejection and new-key receipt verification are proven after the successful
  real-layout sequence.
- No success leaves an unresolved trust or recovery state.
- Repository gates are reported on the exact SHA.
- No trust-model semantic or test was weakened to obtain success.

## ABANDON CRITERIA

Report and stop without fixing forward when:

- neither C′ nor D′ passes all strict postconditions;
- a supposedly successful case leaves the active pointer referencing a retired key;
- a case returns `recovery_required` after mutation;
- a refusal occurs only after partial key or registry mutation;
- the port requires weakening `checkRetired` or bypassing active-pointer verification;
- the port requires deleting or weakening an existing test;
- C′/D′ cannot be constructed as a faithful pre-#419 layout;
- the result depends on unrecorded filesystem residue;
- one ceremony order cannot be selected before the real ceremony begins.

A B′ failure alone is not an abandonment condition unless it reveals a general trust-model
violation that also invalidates C′ and D′.

## ALSO DO

- If `3fdfa61` remains reachable, tag it:

  ```text
  archive/authorship-key-rotate-1a-original
  ```

- Confirm the Sprint's 2026-07-28 real-home inventory remains the latest read-only
  observation. Do not repeat filesystem inspection unless the operator reports that
  `~/.dema/keys/` changed after that observation.

## REPORT BACK

1. Fetched base SHA, branch, and exact ported SHA—or the abandon reason.
2. Rotate suite result.
3. A and B legacy controls.
4. B′ compatibility result.
5. C′ and D′ five-check tables plus old/new receipt verification.
6. The authoritative decision-table row applied.
7. The pinned ceremony order for the exact ported SHA, or `NO SAFE ORDER`.
8. Repository gate results verbatim.
9. Archive-tag result.
10. Anything unverified, labeled `U`.
