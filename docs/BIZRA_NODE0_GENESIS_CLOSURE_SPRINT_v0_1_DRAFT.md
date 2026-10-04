# Node0 Genesis Closure Sprint — one ordered path v0.1 — DRAFT

> `DECLARED_DRAFT`. Grounded by live execution 2026-07-28: `dema node0 ladder`,
> `dema node0 activation observe`, `dema node0 chain`, and the steward loop.
> **Sandbox caveat**: G1/G2 are localhost reachability probes and ran in a review sandbox
> with a per-call network namespace — they must be re-observed on the operator machine
> (step 2.0). Everything else is `V`.
>
> **Re-verified 2026-07-28** against the working tree. The ladder counts, the `node0 chain`
> `blocked_by` pair, the blueprint reference, and all four Phase 4 task IDs bind verbatim.
> Corrections in that pass are marked `[corrected]`: a third gap that the tool does not
> report was removed, and Phase 3.1's already-built tooling — in a three-way ref split —
> was added. G3's removal is a filesystem fact and carries no sandbox caveat.

---

## The one thing to understand before starting

`dema node0 ladder` reports **8 SHIPPED / 0 partial / 0 missing / 1 GATED**. The single
remaining rung is `activate`, marked **`GATED_OPERATOR_ONLY`** with `command: null`.

That is not a bug and not unfinished code. Per `.claude/rules/02-node0-activation.md`,
activation happens **outside this repo**, requires BIZRA-DATA-LAKE and explicit GO, and
**Dema observes the runtime — it never starts it.** "Closing Node0" therefore is not a
coding task. It is: close **two** observable gaps `[corrected]`, then cross an operator gate.

Everything below is ordered so no step can be faked by the step before it.

---

## PHASE 0 — Meeting safety (today, ≤ 20 min)

The demo is already live. Only rehearsal remains.

- [ ] **0.1** Paste §3 steps 0–4 of `BIZRA_DEMO_ACTIVATION_SCAN` verbatim. Wifi **off**.
- [ ] **0.2** Confirm four verdict lines: `consent_phrase_mismatch` → `ok:true` →
      `round_trip_ok:true` → receipt bytes on screen.
- [ ] **0.3** Print 6× one-pager + Third Fact PDF. Charge laptop.
- **Gate**: step 3 prints `round_trip_ok:true` on your machine. Nothing else needed.

---

## PHASE 1 — Repo hygiene (unblocks every later phase)

Known drags, all measured. Do these before touching activation — each one otherwise
makes a later proof ambiguous. **1.3 is a hard prerequisite for Phase 3.1.**

- [ ] **1.1** Open PRs for the two pushed branches
      (`docs/demo-activation-scan-corrections`, `fix/diffusion-noise-marker-word-boundary`).
      `[corrected]` — **do not rebase first.** Both are already pushed; rebasing rewrites
      published history and forces a force-push. Reading "N behind" is cosmetic, blocks
      neither the PR nor its diff, and each branch's own diff is exactly 1 commit.
- [ ] **1.2** Fast-forward local `main` to `origin/main`. **Warning (`V`)**: 7 of the
      64 dirty files collide with `main..HEAD` — `git checkout main` in the primary tree
      would clobber operator WIP. Use a worktree, as the last session did.
- [ ] **1.3** `[added]` **Reconcile the task-029 refs before any ceremony.** Task-029 has
      work spread over **two** branches and **three** divergent SHAs. Rotating a key while
      this is unresolved produces a rotation nobody can later prove.

| Ref | SHA | Measured state |
| --- | --- | --- |
| task-029 cites as "BUILT … unpushed" | `3fdfa61` | **NOT an ancestor** of the local branch — orphaned or superseded |
| remote `feat/authorship-key-rotate-1a` | `0945a1c` | on remote; vs `main` **diverged, +5 / −24** |
| local `feat/authorship-key-rotate-1a` | `eb828a0` | **2 commits ahead** of remote, unpushed |

      The rotate surface is `apps/cli/src/commands/authorship.js`. There is **no `rotate`
      verb in current HEAD's `--help`** — it is not on the branch you would demo from.
      Deliverable: one canonical ref, and task-029's stale `3fdfa61` citation updated.
- [ ] **1.4** Land or explicitly defer `feat/authorship-rotation-transaction-1b` (holds
      `863b2ed`, the 029 **fixture** slice). Note this is a **different branch** from the
      rotate-command branch in 1.3 — both are task-029 work and they are easy to conflate.
      While it sits off-HEAD, "we shipped it" is true only of a branch.
- [ ] **1.5** `[added]` Inspect and disable the **Stand #2 cron** (`3 9 22 7 *` — an
      annual-recurring defect flagged in task-029) before any re-arm.
- [ ] **1.6** Triage the 64 dirty files under task-033. Target: primary tree clean or
      every remaining file explained in the task.
- [ ] **1.7** Dependabot: 13 advisories on default branch (7 high / 6 moderate) — triage
      under tasks 031/032. UI surface only; the kernel is zero-dependency.
- **Gate**: `git status --short` in the primary tree is explainable line-by-line, local
  `main` == `origin/main`, and **the task-029 rotate work resolves to exactly one ref**.

---

## PHASE 2 — Dema activation (BLOCKED → ready)

`dema status` prints `Activation gate: BLOCKED`. `dema node0 activation observe` names
exactly **two** gaps `[corrected]`. **Neither requires new code.**

- [ ] **2.0** Re-run on the operator machine (not a sandbox):
      `dema node0 activation observe --json`. Record the real `activation_gap_map`.
      Both rows below are localhost probes and must be confirmed there.

| # | Gap (`observed`) | Action | Whose |
| --- | --- | --- | --- |
| G1 | `sovereign_not_live_ready` — `provider_unreachable` at `http://127.0.0.1:8000` | Start the sovereign runtime via **its own governed entrypoint** (BIZRA-DATA-LAKE, not this repo) | Operator |
| G2 | `no_local_model_reachable` — LM Studio + Ollama unreachable/empty | Load one model locally. **Ollama is already installed on your machine** (`V` — `ollama` group present); it just needs a model loaded and served | Operator |

> **A third gap was removed** `[corrected]`. An earlier draft listed
> `G3 identity_uninitialized — no key file`. The tool does not report it: the live
> `activation_gap_map` has **two** entries, and the report carries
> `identity_status: "LOCAL_ONLY"` — not *uninitialized*. Key material is present:
> `~/.dema/keys/node0-ed25519.pem` (`0600`) and `node0-ed25519.pub.pem`, both `Jun 18 14:05`.
>
> The risk read backwards. Task-029 names **that exact file at that exact date** as the
> compromised signing key. Nothing needs initializing; something needs **rotating** — which
> is Phase 3.1. G3 and 3.1 were the same work counted twice, with an invented ordering
> constraint between them. A ✅ on G3 would also have been unfalsifiable: you cannot close
> a gap the tool never opened. This removal is a filesystem fact, not a localhost probe,
> so it carries no sandbox caveat.

- [ ] **2.1** Close G2 first — cheapest, and it unblocks `dema eval baseline` /
      `eval route` becoming *measured* rather than merely shipped.
- [ ] **2.2** Close G1 — start the sovereign runtime. Then `activation observe` should
      flip `sovereign_runtime_status.live`.
- [ ] **2.3** ~~Close G3 — key ceremony.~~ `[corrected]` **Removed** — no such gap. Key
      rotation is Phase 3.1 and is gated on **1.3**, not on this phase.
- [ ] **2.4** Re-run `dema node0 chain --json`. Currently `blocked_by:
      ["mission_plan_not_consent_ready", "blackboard_not_quiescent"]` (`V`, verbatim) —
      both must clear.
- **Gate**: `dema status` no longer prints `BLOCKED`; `activation_gap_map` is empty;
  `node0 chain` `blocked_by` is empty.

---

## PHASE 3 — Node0 closure (the operator gate)

- [ ] **3.1** **Close task-029 for real.** The fixture slice proves the *protocol*; the
      ceremony rotates the *key*. This is the single highest-value action in the sprint —
      it converts "integrity proven" into "authenticity proven", which is what every
      later claim rests on. Separate exact consent; off-transcript.
      **Prerequisite: 1.3 `[added]`.** This is not only a ceremony — the rotation command
      is already **BUILT** (task-029 line 49), living in `apps/cli/src/commands/authorship.js`
      across two branches and three divergent SHAs. Reconcile to one ref first; a ceremony
      run against an ambiguous ref yields a rotation that cannot be proven afterwards.
      Task-029's own "unpushed" note is stale — the branch *is* on the remote, at a SHA
      the task does not name.
- [ ] **3.2** Re-run the full ladder: expect 8 SHIPPED + `activate` still `GATED`.
- [ ] **3.3** Dry-run: council / mission previews with boundary all-false.
- [ ] **3.4** **Cross the activate rung** — outside this repo, BIZRA-DATA-LAKE present,
      explicit GO. Sequence is fixed and may not be reordered:
      `observe → verify → benchmark → route → dry-run → activate`.
- [ ] **3.5** Promote the newly-measured rows in `CURRENT_LIMITS.md` in the same slice.
      Nothing is `MEASURED` until that file says so.
- **Gate**: Node0 observed truthfully live, with receipts, and the ledger updated in the
  same commit. If it cannot be observed truthfully, **do not activate and do not claim it.**

---

## PHASE 4 — The flagship stack (northstar for coming nodes)

From `BIZRA_SOVEREIGN_SPINE_BLUEPRINT` §8, unchanged and still correct:

- [ ] **4.1** `NODE0-VERIFIED-MISSION-TURN-1A` carrying `transition_envelope.v1` —
      the fused spearpoint, 18 adversarial tests. **This is the flagship artifact.**
- [ ] **4.2** `GENESIS-BLOCK0-1A` — persistent identity, `constitution_hash` sealed.
      This is what makes Node0 a *northstar*: Node1 doesn't apply to join, it publishes a
      genesis block anyone verifies in one hash comparison. **Federation becomes
      verification, not administration.**
- [ ] **4.3** `PLANE-CONFORMANCE-1A` — re-home existing kernels behind the ABI.
      Six planes, authority strictly decreasing, one enforced type.
- [ ] **4.4** `PROCESS-CONFORMANCE-1A` — real process mining over real transitions.
- [ ] **4.5** `URP-RECEIPT-BINDING-1A` — offers require receipt hashes.
- [ ] **4.6** `NODE1-GENESIS-VERIFY-1A` — a second node proves inheritance by hash.
      **This is the moment BIZRA stops being a product and becomes a protocol.**
- **Gate per rung**: red-first tests, exact-SHA gates, independent review, same-slice
  `CURRENT_LIMITS.md` update. No rung starts before its predecessor is green.

---

## Dependency graph (why this order)

```text
PHASE 0 (demo)  ── independent, already live ──────────────► meeting
       │
PHASE 1 (hygiene) ─► clean tree = unambiguous proofs
       │   └─ 1.3 reconcile task-029 refs (3 SHAs, 2 branches) ─┐
       │                                                        │
PHASE 2 (G2 → G1) ─► runtime + model observable                 │  hard prerequisite
       │            two gaps, not three                         │
       │                                                        ▼
PHASE 3.1 (029 rotation: BUILT command + ceremony) ─► authenticity, not just integrity
                    │
       PHASE 3.4 (activate rung, outside repo, operator GO)
                    │
       PHASE 4.1 (spearpoint) ─► 4.2 Block0 ─► 4.3–4.6 ─► protocol
```

## Honest scope

Phases 0–2 are hours of operator action, not engineering. Phase 3.1 is a ceremony.
Phase 4 is the multi-week program — 4.1 is days at your demonstrated sprint velocity;
4.2 onward contains genuinely unproven integration and cannot be honestly time-boxed yet.

## What this sprint does not promise

That any gap closes on schedule, that the activate rung will be crossable, or that
federation works. It promises one thing: **an order in which no step can be faked by the
step before it**, with a named gate at every boundary.
