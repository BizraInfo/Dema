# Sprint 01 — "One Ref, One Key" v0.1 — DRAFT

> `DECLARED_DRAFT`. Sprint slice of `BIZRA_NODE0_GENESIS_CLOSURE_SPRINT_v0_1_DRAFT.md`.
> That doc is the roadmap (phases 0–4, multi-week). This is the **next bounded window**:
> capacity-scoped, P0/stretch split, one definition of done.

## Sprint goal (one sentence)

**Rotate the compromised Node0 signing key with tooling that current `main` can verify,
and move task-029 to a terminal state.**

Not "close Node0" — that needs G1/G2 plus an operator gate outside this repo. This sprint
buys the one thing every later claim rests on: authenticity.

---

## ⚠ Blocking finding — the rotate branch predates the trust model

The last session concluded 1.3 was analysis-complete: canonical ref `eb828a0`, 24/24 tests
green, `3fdfa61` safely superseded. All correct. **But the ref comparison stopped at the
branch's own lineage.** Measured against `main`:

| Fact | Measured |
| --- | --- |
| `origin/main` has a `rotate` verb | **No** — `V`. [MEASURED] The only match is an error string: *"Use `dema authorship key rotate` (future) to replace."* |
| `feat/authorship-key-rotate-1a` ahead of main | 7 commits |
| `feat/authorship-key-rotate-1a` **behind** main | **24 commits** — `V` |
| Branch contains current main (`a148cf2`, incl. #419 active-signer-trust) | **No** — `V`, not an ancestor. Was measured against `340e96f`; PRs #432/#433 merged since, so the branch is now **26 behind**, not 24. Neither merge touched the authorship surface — the finding is unchanged. |

**The risk**: `eb828a0` predates #419, the active-signer-trust + integrity split that landed
on main *today*. Rotating with pre-#419 tooling produces key material and a retired-registry
written by a code path that does not know the current trust model. Main's
`loadAuthorshipTrustSnapshot` may then be unable to validate the result — a rotation that
cannot be proven afterward, which is exactly the failure 1.3 exists to prevent.

**Therefore 1.3's deliverable changes**: not "push `eb828a0` and update the citation," but
**bring the rotate command forward onto current main before the ceremony.**

`U` — I have not verified that post-#419 loaders actually reject pre-#419 rotation output.
That check is P0.1 below and must run before any key is touched.

---

## ✅ P0.1 EXECUTED — verdict, and it is worse than the premise

Run 2026-07-28 in throwaway fixture homes; no operator key touched. **The conclusion holds,
the mechanism above is wrong, and the probe found a bricking failure mode.**

**Correction to the mechanism.** The break is **not** at rotate — it is at **init/layout**.
Control: a pre-#419 home with *no rotation at all* is already invisible to main
(`no_active_pointer`). Rotation was never the variable. Main ships the bridge:
`migrateLegacyAuthorshipKey({ demaHome, consent: "MIGRATE AUTHORSHIP KEY" })`.

**The finding that matters — order is forced, and the wrong order is unrecoverable:**

| Order | main `loadActiveKeyPair` | Verdict |
| --- | --- | --- |
| **B — rotate, THEN migrate** | OK | **All 5 gate checks pass** |
| A — migrate, THEN rotate | `retired_generation` | **Identity unusable** |

Order A: `migrate` sets the active pointer to the old key; pre-#419 `rotate` then adds that
same fingerprint to the retired registry **without moving the pointer**. Main's
`checkRetired` (`authorship-key-store.js:893`, `:1111`) refuses to serve an active pointer
whose fingerprint is retired — fail-closed, working as designed. Re-running migrate does
**not** repair it: `migrated:false, error:"recovery_required"`. The home is left pointing at
a revoked key and needs deliberate surgery.

**This invalidates a recommendation that was on the table.** "Migrate first, then rotate"
was previously ranked viable-but-second. It is not viable. On the real `~/.dema` — which
holds the only Node0 signing identity ([DECLARED] — one keypair observed on disk;
exclusivity is inferred, not enumerated) — it would have bricked it. This is exactly the check
P0.1 existed to force, and it earned its place.

### Consequences for P0.2 — both of my earlier options were mis-ranked

- **Option (b) "migrate then rotate" — DELETED.** Not second-choice. Invalid.
- **Option (a) "port rotate onto main" — now SUSPECT, not preferred.** Porting puts rotate
  on post-#419 code *where the active pointer already exists* — structurally the **same
  shape as order A**. `U`: a ported rotate may reproduce the bricking behaviour.
  **Any ported command must be re-run against this same fixture before it is trusted.**
- **Currently safest known path: order B on the un-ported command** — rotate with
  `eb828a0`, then migrate with main. Proven in fixture, all five gate checks green.

### Hard constraints now binding on P0.5

1. **Ceremony order is `rotate → migrate` for the legacy `eb828a0` implementation.** Not a
   preference. The reverse has no clean undo. A ported implementation must use the order
   selected by its own real-layout C′/D′ fixture; it may not inherit the legacy order by
   assumption.
2. **`migrateLegacyAuthorshipKey` is a mandatory ceremony step whenever the selected
   implementation and starting layout require it.** Without migration, current main may not
   be able to read the home and P0.5's strict success gate cannot be evaluated.
3. **Back up `~/.dema/keys/` before the ceremony.** Order A is unrecoverable in-tool; a
   filesystem copy is the only undo that exists. [DECLARED] — `migrate` was measured
   returning `recovery_required`; no exhaustive search for another repair path was run.
4. ~~`U` — the real `~/.dema` has a `retired/` history that was not inspected.~~
   **RESOLVED 2026-07-28** (`V`, read-only `ls`/`find`, no key material read). `~/.dema/keys/`
   contains **only** the two key files:

   ```
   node0-ed25519.pem       0600  119 bytes  Jun 18 14:05
   node0-ed25519.pub.pem   0644  113 bytes  Jun 18 14:05
   ```

   There is **no** `retired/`, no `generations/`, no `rotation-journal.json`, and no retired
   registry anywhere under `~/.dema/keys` (`find -maxdepth 2 -type f` returns those two files
   and nothing else). Combined with `loadActiveKeyPair → no_active_pointer`, the real home is
   a **pristine pre-#419 layout — byte-for-byte the starting state order B was proven against
   in fixture.** No prior retired entries exist to alter its behaviour. Constraint 3
   (filesystem backup) still stands. [DECLARED] — same basis as constraint 3 above.

---

## Capacity (honest)

| Resource | State |
| --- | --- |
| Operator | Meeting today; awake all night. Assume **one focused block**, not a full day. |
| Codex agent | **Out** — under 5% of weekly limit. Not available this sprint. |
| Local Claude agent | Available. Demonstrated: verification, isolated worktrees, red-first TDD. |
| Primary tree | 64 dirty, 7 files collide with `main..HEAD` — **worktrees only**, never `checkout main`. |

Plan for one agent lane and a thin operator lane. Do not plan parallel implementation on
shared code.

---

## P0 — must land

- [ ] **P0.0 — Rehearse the demo.** Before the meeting. 20 min, operator.
      Gate: step 3 prints `round_trip_ok:true`. *(Independent of everything below.)*

- [ ] **P0.1 — Prove or refute the compatibility risk.** Read-only, agent.
      Does a pre-#419 rotation output validate under current main's loaders?
      Construct in a fixture `DEMA_HOME`: run `eb828a0`'s rotate against throwaway keys,
      then load the result with **main's** `loadActiveKeyPair` + `loadAuthorshipTrustSnapshot`.
      Gate: a written verdict — compatible, or the exact incompatibility.
      **This decides P0.2's shape. No key ceremony before it returns.**

- [ ] **P0.2 — One ref, forward-ported.** Agent, isolated worktree off the fetched current
      `origin/main` SHA. Port the rotate commits and execute the implementation-specific
      fixture matrix. B/B′ are compatibility evidence; C′/D′ are authoritative because they
      reproduce the real pre-#419 home layout. Deliverable: `dema authorship key rotate`
      present and green on a branch containing current main, with exactly one ceremony order
      selected and pinned for the exact ported SHA.
      Gate: rotate suite + C′/D′ real-layout matrix + `npm test` + `npm run check` on the
      exact SHA. No real key access.

- [ ] **P0.3 — Tag the dangling commit.** 10 seconds, preserves the audit trail:
      `git tag archive/authorship-key-rotate-1a-original 3fdfa61` (it is reachable from no
      ref and absent from the reflog — one GC from gone).

- [ ] **P0.4 — Update task-029 via the Backlog CLI.** Replace the stale `3fdfa61` citation
      with the canonical SHA; drop the false "unpushed" note (it *is* on the remote, at a
      SHA the task never named).

- [ ] **P0.5 — THE CEREMONY.** Operator + agent, separate exact consent, off-transcript.
      This step is forbidden until P0.2's implementation-specific real-layout fixture has
      selected the correct order for the exact command SHA that will be used.

      **P0.5.0 — Preconditions**

      - [ ] Operator is rested and explicitly authorizes this ceremony.
      - [ ] Exact implementation SHA is recorded.
      - [ ] Implementation class is recorded: `LEGACY_EB828A0` or `PORTED_ON_MAIN`.
      - [ ] For `PORTED_ON_MAIN`, C′ and D′ results exist and select one order.
      - [ ] No signer, watcher, cron, or background process can access the key directory.
      - [ ] Network use is disabled unless a named verification step explicitly requires it.

      **P0.5.1 — Verified recovery copy before mutation**

      - [ ] Record filenames, permissions, sizes, timestamps, and public fingerprints without
            printing private-key material.
      - [ ] Create an encrypted offline recovery copy of `~/.dema/keys/` outside active
            `DEMA_HOME`.
      - [ ] Hash the encrypted recovery artifact.
      - [ ] Verify the artifact is readable and structurally contains the expected files.
      - [ ] Record the recovery hash and location in the private ceremony receipt.

      If the recovery copy cannot be created and verified, **STOP**.

      **P0.5.2 — Execute only the fixture-proven order**

      - `LEGACY_EB828A0`: `legacy rotate → current-main migrate → current-main verify`.
        Migration consent is exactly `MIGRATE AUTHORSHIP KEY`.
      - `PORTED_ON_MAIN`: use only the C′/D′ order proven for the exact ported SHA. Do not
        inherit the legacy order by assumption.

      Execute no later step after an unexpected result.

      **P0.5.3 — Strict postconditions; every item must pass**

      - [ ] `loadActiveKeyPair` succeeds under current main.
      - [ ] `loadAuthorshipTrustSnapshot` succeeds.
      - [ ] Active fingerprint equals the newly generated fingerprint.
      - [ ] Old fingerprint is present in the retired registry.
      - [ ] New fingerprint is absent from the retired registry.
      - [ ] A receipt signed by the old key is rejected specifically as retired.
      - [ ] A receipt signed by the new key verifies successfully.
      - [ ] Migration receipt is present when migration was required.
      - [ ] Rotation and revocation evidence are sealed.
      - [ ] No private-key bytes appeared in stdout, logs, CI, git, or receipts.
      - [ ] Recovery artifact remains intact and independently readable.

      Any failed postcondition means the ceremony is **not complete**. Do not update
      `CURRENT_LIMITS.md` or close task-029.

      **P0.5.4 — Recovery halt states**

      If any step returns `retired_generation`, `recovery_required`, `no_active_pointer`, or
      an active/retired fingerprint contradiction: halt immediately; perform no automatic
      repair; preserve the failed state and receipts; use the verified offline copy only
      through a separately reviewed recovery instruction; do not describe the identity as
      rotated, migrated, or active.

- [ ] **P0.6 — Same-slice ledger update.** `CURRENT_LIMITS.md` in the same commit.
      Nothing is `MEASURED` until that file says so.

**Definition of done**:

- task-029 is terminal under Backlog finalization rules;
- the exact ceremony implementation SHA is recorded;
- its real-layout fixture determined the ceremony order;
- the recovery copy was created and verified before mutation;
- the new key is active under current main;
- the old fingerprint is retired and the new fingerprint is not retired;
- an old-key receipt is rejected specifically as retired;
- a new-key receipt verifies;
- migration completed when required by the selected implementation and starting layout;
- rotation, migration, verification, and revocation receipts are sealed;
- `CURRENT_LIMITS.md` is updated in the same slice;
- no unresolved recovery state remains.

---

## Stretch — only if P0 closes early

- [ ] **S1** Open PRs for `docs/demo-activation-scan-corrections` (`3cb2825`) and
      `fix/diffusion-noise-marker-word-boundary` (`22c4878`). Do **not** rebase; both are
      pushed and "N behind" is cosmetic.
- [ ] **S2** Commit the two sprint docs on their own branch off `main`.
- [ ] **S3** Stand #2 cron (`3 9 22 7 *`) — inspect and disable before re-arm.
- [ ] **S4** Fast-forward local `main` (worktree; never in the primary tree).
- [ ] **S5** Land or explicitly defer `feat/authorship-rotation-transaction-1b` (`863b2ed`,
      the fixture slice — **different branch** from the rotate command; easy to conflate).

---

## Explicitly OUT of this sprint (and why)

| Item | Why not now |
| --- | --- |
| Helper consolidation (~1,750 lines, 279 divergent definitions) | Real finding, wrong sprint. 13/14/23 divergent bodies means a correctness review per call site, not a sweep. It would consume the whole window and compete with the goal. |
| `parseArgs` migration (81 CLI files) | Flag strings carry exact-match consent phrases. Touching argv parsing touches a trust boundary. Per-command with tests, never as a sweep — and never in the same sprint as a key ceremony. |
| G1 / G2 (sovereign runtime, local model) | Operator actions, one depends on a different repo. Cheap, but they do not block P0 and P0 blocks them in importance. |
| Phase 4 (spearpoint, Block0, planes) | Next sprint. 4.1 is gated on a clean tree and a rotated key. |
| 64-file dirty triage | Stretch at best. Do not open it mid-ceremony. |

---

## Risks

| Risk | Mitigation |
| --- | --- |
| P0.1 returns "incompatible" → P0.2 becomes a port, not a push | Budgeted. The commits are small and the rotate tests are the safety net. |
| Rotating from a worktree whose tooling is not on main | P0.2 exists precisely to prevent this. **Do not shortcut it.** |
| Operator fatigue during an irreversible ceremony | P0.5 is the one irreversible step in the sprint. It must be the first thing done rested, not the last thing done tired. |
| Two branches both named task-029 work | Named in S5. `-transaction-1b` = fixture; `-key-rotate-1a` = the command. |

## What this sprint does not promise

Node0 activation (needs G1/G2 + the operator gate outside this repo), federation, or any
Phase 4 rung. It promises one measurable thing: **the leaked key stops being the active
signer, and that fact is provable with current tooling.**
