# INSTRUCTION — P0.2 · Port rotate onto current main, gated by fixture re-run

> Paste this whole block to the local agent. Bounded, read-only until proven, no operator
> key touched. Sprint: `BIZRA_SPRINT_01_ONE_REF_ONE_KEY_v0_1_DRAFT.md`.

---

## TASK

Execute sprint **P0.2**: produce one canonical ref where `dema authorship key rotate` exists
on top of **current `origin/main` (`a148cf2`)** — but **only if** the ported command passes
the same fixture that P0.1 used. If it fails that fixture, **abandon the port** and report;
do not "fix forward" into a bigger slice.

> **BASE UPDATED 2026-07-28** — this instruction previously named `340e96f`. PRs #432 and
> #433 squash-merged after it was written, moving `origin/main` `340e96f → 52f92c0 → a148cf2`.
> **Port onto `a148cf2`, not `340e96f`.** Re-verified on the new base (`V`): main still has
> `loadActiveKeyPair`, `loadAuthorshipTrustSnapshot`, `migrateLegacyAuthorshipKey`,
> `checkRetired`, and still has **no `rotate` verb** (one match in `authorship.js`, the
> "(future)" error string). Neither merged PR touched the authorship surface, so every P0.1
> finding transfers unchanged.

## STATE YOU MAY ASSUME (all `V`, verified this session)

- `origin/main` = `a148cf2` — has `loadActiveKeyPair`, `loadAuthorshipTrustSnapshot`,
  `migrateLegacyAuthorshipKey`, `checkRetired`. **Has no `rotate` verb.**
- `feat/authorship-key-rotate-1a` local = `eb828a0` — has `rotate`, 24/24 tests green.
  Remote branch vs new main: **diverged, 5 ahead / 26 behind** (was 24 behind before the
  two merges). Does **not** contain `a148cf2`.
- `3fdfa61` — dangling, fully superseded, safe to abandon (tag it if you want the trail).
- **P0.1 verdict**: order `rotate → migrate` = all 5 gate checks pass.
  Order `migrate → rotate` = `retired_generation`, unrecoverable (`recovery_required`).
- **The hypothesis this task tests**: porting rotate onto post-#419 code places it where the
  active pointer already exists — structurally the same shape as the bricking order. The
  port may reproduce it.

## HARD CONSTRAINTS

1. **Isolated worktree off `main` only.** Never `git checkout main` in the primary tree —
   7 of the 64 dirty files collide and would be clobbered.
2. **The operator's real `~/.dema` is untouchable.** Read-only inspection is permitted;
   no write, no rotate, no migrate, no key read-out. Every test uses a throwaway fixture
   `DEMA_HOME` under the scratchpad.
3. No push, no merge, no PR, no ceremony, no network beyond `git fetch` / read-only API.
4. Red-first where you add tests. Do not weaken or mask an existing gate.
5. If a gate fails, stop and report the exact failing gate. Do not reclassify a failure as
   environmental without reproducing it on unmodified `main` in a separate worktree.

## STEPS

1. **Fresh worktree** off `a148cf2` (current `origin/main` — fetch first; it is newer than
   any local `main`), new branch `feat/authorship-key-rotate-1b-on-main`.
2. **Port the 7 commits** from `eb828a0` (cherry-pick or replay). Expect conflicts in
   `packages/receipts/src/authorship-key-store.js` — main changed it heavily in #419.
   Resolve toward **main's** structure; the rotate command adapts to the active-pointer
   model, not the reverse.
3. **Re-green the rotate suite**: `node --test tests/authorship-key-rotate.test.js`.
   All 24 must pass. If a test now contradicts main's model, do not delete it — report it;
   it is a design signal, not a nuisance.
4. **THE GATE — re-run P0.1's fixture against the ported command.** In throwaway homes:
   - **B**: init(pre-#419 layout) → `rotate` → `migrate` → assert all five:
     `loadActiveKeyPair` OK · trust snapshot readable · active fingerprint == NEW ·
     OLD fingerprint retired · NEW not retired.
   - **A**: init → `migrate` → `rotate` → record the result.
   - Also run **B′**: init on **main's own layout** → `rotate` → assert the same five.
     This is the case the port creates and `eb828a0` never had.
4b. **[ADDED — the test matrix above is incomplete and B′ may not be the deciding case.]**

   The real `~/.dema` is now confirmed (`V`, read-only) a **pristine pre-#419 layout**:
   only `node0-ed25519.pem` + `.pub.pem`, **no** `retired/`, `generations/`, or
   `rotation-journal.json`, and `loadActiveKeyPair → no_active_pointer`.

   B′ as written seeds **main's own layout** — a shape the real home does not have. So B′
   can pass while telling you nothing about the ceremony you actually intend to run.

   **Add these two cases. They are the decisive ones:**

   | # | Home layout | rotate impl | order | Question it answers |
   | --- | --- | --- | --- | --- |
   | **C′** | pre-#419 (real shape) | **ported** | rotate → migrate | Does the ported rotate even *run* on a home with no active pointer, or refuse with `no_active_pointer`? |
   | **D′** | pre-#419 (real shape) | **ported** | migrate → rotate | Order A's shape — but a ported rotate lives on main's model and should update the pointer. **This may be the correct path for a ported command, and it is the exact order that bricks with `eb828a0`.** |

   Assert the same five gate checks on whichever of C′/D′ succeeds.

   **Why this matters**: order A bricked because pre-#419 rotate writes the old fingerprint
   to the retired registry **without moving the active pointer**. A ported rotate,
   built on main's active-pointer model, plausibly does move it — which would make **D′
   correct and C′ impossible**, inverting the forced order for the ported command only.
   `U` — untested. Do not assume either way. If C′ and D′ disagree with B/B′, the ceremony
   order is **implementation-dependent**, and that must be stated as such in the report.

5. **Repository gates on the exact SHA**: `npm test`, `npm run check`,
   `npm run llm:guidance`, `git diff --check`.
6. **Commit** on the new branch. Do not push.

## DEFINITION OF DONE

- Ported branch exists on top of `a148cf2`, committed, worktree clean.
- 24/24 rotate tests green.
- **B′ passes all five gate checks** — the ported rotate produces state current main can
  serve. This is the whole point; without it the port is worthless.
- A/B behaviours recorded, whether or not they match `eb828a0`.
- Repository gates run and reported verbatim, including any pre-existing failures with their
  reproduction on unmodified main.
- Exact SHA reported.

## ABANDON CRITERIA — report and stop, do not fix forward

- **B′ fails** (ported rotate leaves state main cannot serve) → the port is the wrong shape.
  Recommend ceremony on `eb828a0` in order B instead, and say so plainly.
- Porting requires changing `checkRetired`, the active-pointer semantics, or any #419
  trust surface → that is a design slice with its own review, not this task.
- Conflict resolution would require deleting or weakening an existing test.

## ALSO DO (cheap, while you are in there)

- `git tag archive/authorship-key-rotate-1a-original 3fdfa61` — the dangling commit is one
  GC from gone; the tag costs nothing and preserves the audit trail.
- **Read-only** inspect `~/.dema/retired/` (or wherever the retired registry lives) and
  report whether prior entries exist. Sprint has this as an open `U` and it could change
  order B's behaviour on the real home. **Read only — list and describe, do not parse out
  key material.**

## REPORT BACK

1. Ported branch name + exact SHA, or the abandon reason.
2. Rotate suite: N/24.
3. **The B′ verdict** — five checks, pass/fail each.
3b. **The C′ and D′ verdicts** — five checks each, on the real home's layout. State plainly
   which order the *ported* command requires, and whether it matches or inverts the order
   proven for `eb828a0`.
4. A and B behaviours on the ported command vs. `eb828a0`.
5. Repository gate results, verbatim.
6. Real `~/.dema` retired-registry inspection: present/absent, entry count.
7. Anything you could not verify, labeled `U`.
