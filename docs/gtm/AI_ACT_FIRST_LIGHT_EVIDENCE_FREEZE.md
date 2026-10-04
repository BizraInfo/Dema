# AI-ACT-FIRST-LIGHT — Evidence Freeze

**Status:** `PREPARE_ONLY` — nothing here has been published, pushed, sent, or posted.
**Prepared:** 2026-08-01, Dubai · **Operator:** Mumu · **Prepared by:** Claude Code (local session)
**Purpose:** bind every proposed public claim to disk evidence before any launch copy is written.

Truth labels follow `.claude/rules/00-claim-discipline.md`:
`V` verified on disk · `D` derived from verified evidence · `A` assumed · `U` unknown.

---

## 1. Phase 1 evidence gate — real values

The launch plan's `launch_evidence` block, filled from measurement rather than intent:

```yaml
exact_commit_sha:              present          # 07a0c65 (HEAD), 35bdcdd (Omega0-M slice)
clean_worktree:                false            # 45 modified/untracked paths remain
focused_suite:                 green            # omega0 10/10
composed_suite:                green            # 5 sealed suites 69/69; +peak pair 92/92
fresh_process_replay:          verified         # replayed=true, seal_head_matches=true
# THE WITNESS CONTRACT — full values, from the committed harness at fe2d864.
# These are CONTENT-bound: identical on any machine and any work directory.
# Superseded values 93ac3954… / 93543b7b… came from the pre-harness scratchpad
# run over COPIES OF REPO FILES; that fixture drifted with every commit and is
# not reproducible. Do not cite it anywhere.
before_manifest_hash: 403db0b4b5d97b53e9a3836c49749f86d2965bcd7d81f3d989782c779cfd2202
after_manifest_hash:  89eb646f08b7f56c9ac173a9e83d0b4999429372ea14cfc871e3936ba3f0265b
# seal_head is PATH-bound — stable per directory, different across machines.
# Never publish it as a cross-machine constant (asserted both ways by FL-07).
undo_manifest_hash:            present          # restored_hash == before_manifest_hash
restored_manifest_matches_before: true
final_receipt:                 recomputable     # seal 1001014c90c07261...f619af40
external_anchor:               enforced         # anchor_enforced=true, stored outside scope
```

**One gate is RED: `clean_worktree`.** The plan says publish nothing until it is true.

---

## 2. Claim ledger

| # | Proposed public claim | Evidence on disk | Label | Limitation that must ship with it |
|---|---|---|---|---|
| 1 | Omega0-M exists at an exact, reproducible commit | `35bdcdd` (14 files, +3210); `07a0c65` (4 files, +1138); verified via object store + reflog | **V** | Local only. Not pushed, no remote, no PR. |
| 2 | A real-folder consent-bound mission ran, reversibly | `first-light-receipt.json`, 10 real files, `status: SEALED` | **V** | Files were *copies* of real repo files into a bounded scratch root — not the operator's personal archive. |
| 3 | 0 source files lost | `verification.source_loss = 0` | **V** | One mission, 10 files, one folder. Not a scale claim. |
| 4 | 0 unauthorized mutations / content preserved | `content_hash_changes = 0`, `content_ids_preserved_exactly = true` | **V** | Measured over the declared scope root only. |
| 5 | 100% reversible; exact restoration verified | `undo_success_pct = 100`; `restored_hash == before_manifest_hash` | **V** | Undo proven for the `move` op class. Not proven for delete/overwrite — those are *forbidden*, not *recovered*. |
| 6 | A fresh reader recomputes the seal and the world | `replayed: true`, `seal_head_matches: true`, `world_state_matches: true` | **V** | Fresh adapter in a fresh process; not a separate machine. |
| 7 | The result is deterministic | Same `seal_head` `1001014c…` across 3 independent processes | **V** | Only with a **pinned anchor path** — see §4. |
| 8 | The anchor is mandatory and external | `anchor_enforced = true`; `anchor_dir_outside_scope = true`; OM0-02/OM0-03 | **V** | Mandatory on the Omega0-M route only. Anchoring stays **per-call optional** in the reusable L1 API. |
| 9 | `authority_delta = 0` | `authority_delta: 0` in the receipt | **V** | — |
| 10 | 197 of 202 repo gates pass at the sealed HEAD | gates 1–125 + 72/76 from 127 | **V** | 5 failures are sandbox-environmental; see §3. |
| 11 | "composed slice passing 87/87" | **not reproducible** — no composition yields 87 | **U** | **Do not publish this number.** Use 10/10, 69/69, or 92/92. |
| 12 | Node0 is closed | ladder rung 9 `activate` has `command: null · evidence_file: null · marker: null · tier: "gated"` | **V (negative)** | **Do not claim.** There is no activation surface in this repo to invoke — verified, not assumed. |
| 13 | Dema is activated / live | `observe` reports sovereign not confirmed live | **U** | Unmeasurable from this sandbox — see §4.2. |
| 14 | URP ready to connect Node1 | `system-snapshot.js:34` → `node1_urp status: "LOCKED"`; 3 gates require `no_node1_activation === true` | **V (negative)** | Node1 is an enforced **negative invariant**, not a missing feature — see §8. |
| 15 | Proof-of-truth verdict at the sealed commit | `proof:truth:local-lane` at `07a0c65`: formal PASS · cryptographic PASS · empirical PASS · economic `BLOCKED_UNLESS_MEASURED` | **V** | Empirical PASS requires the sanctioned local lane (`GITHUB_ACTIONS_BILLING_LOCK`); remote CI was never run. Economic is *correctly* blocked. |

---

## 3. Gate result at the sealed HEAD

```
gates 1–125     PASS
gate  126       FAIL  (test-suite gate)
gates 127–202   72 PASS / 4 FAIL
────────────────────────────────
TOTAL           197 / 202 PASS
```

Full suite at the carved branch tip: **8388 tests · 8379 pass · 6 fail · 3 skipped · 0 todo · 0 cancelled**.
The three skipped tests are why `pass + fail ≠ tests`; publish all six figures or none.
**Never write "0 failures" or "suite green"** — six failures are real, and their being
environmental is a *diagnosis*, not a pass. (Earlier best-case run: 8380 · 8371 · 6.)
Every failure is environmental, and each is named:

| Failure | Cause | Class |
|---|---|---|
| 4455, 4950 | `uv_os_get_passwd returned ENOENT` — sandbox uid has no passwd entry | sandbox |
| 6577, 6578 | `EROFS` writing `.claude/hooks/logs/` | sandbox |
| 2938, 3807 | this session's `GIT_DIR` export leaking into tests that build their own temp repos | harness |
| 139, 194 | `EROFS` under `$HOME` — **cleared** by redirecting `HOME`/`DEMA_HOME` | sandbox |

**Zero failures are attributable to the sealed code.** Verified two ways: 2938/3807 pass
31/31 with `GIT_DIR` unset, and no sealed-slice test appears in any failure set.

### 3.1 Later measurement at merged main — `2272cdd` → send SHA `8d35a51` (2026-08-01)

The figures above are **frozen at the carved branch tip and are not edited**. This is a
separate, later measurement at a different commit on a different machine.

```
FULL MEASUREMENT  2272cdd40aacc05881e2ef66bb8df7218283bdf4
                  8397 tests · 427 suites · 8397 pass · 0 fail · 0 skipped · 0 todo · 0 cancelled
                  G8 GATE: reported # fail 0 · raw not-ok lines 0 · Exit 0 · 23.1 s

SEND SHA          8d35a51df472102d64386bb8dfeef4070ae1ac0f   (origin/main, pushed 2026-08-01)
                  re-run after the docs-only commit that created it:
                  G8 GATE: reported # fail 0 · raw not-ok lines 0 · Exit 0 · 22.7 s
                  Test and pass counts were not captured in that run's output tail.
                  What is proven at the send SHA is ZERO FAILURES, not the six figures.
                  The change between the two commits is documentation only.

machine           Bizra-Node0 (operator reference machine), working git, writable HOME
```

**Why both SHAs appear.** The six-figure measurement belongs to `2272cdd`. Restamping it
onto `8d35a51` would assert counts nobody recorded there. Publish the six figures bound to
`2272cdd`, and the zero-failure result bound to `8d35a51`; an evaluator cloning the send SHA
should expect 8397/8397 but our evidence for the exact counts sits one commit earlier.

The delta from §3 reconciles exactly, which is why both records are kept:
`tests +9` (the PEAK-EVIDENCE-BINDING-1A slice added PEB-01…08 and PSL-05b);
`pass +18` (those 9, plus the 6 environmental failures and the 3 environmental
skips, all of which cleared). No test was deleted or disabled to reach this.

**The six failures were environmental and did not reproduce here** once `.git/index.lock`
was cleared and `HOME` was writable. That confirms the §3 diagnosis; it does not retract it.

**Wording rule, updated and still bounded.** The §3 prohibition on writing "0 failures"
was correct for the sealed branch, where six failures were real. At `2272cdd` the
measurement genuinely is 0. Publish it **bound to the SHA and the machine** — never as
"the suite is green" unqualified. One green run on one machine is not a property of the
software. Evaluators in constrained environments may still hit the sandbox classes
(`uv_os_get_passwd ENOENT`, `EROFS`), which remain documented in
`scripts/ci/classify-known-harness-failures.mjs`; seeing them is expected, not a defect
report. A failure *outside* those classes is still signal and still wanted.

---

## 4. Findings that change the launch

**4.1 — The three-week-stall root cause in the seal receipt is misattributed.**
That receipt blames a stale `.git/index.lock` created at 04:29 *the same morning* — a file
that cannot explain a three-week stall. Separately, `.git/config.lock` and
`.git/config.worktree` are `/dev/null` character devices dated Jul 31 07:23 (`crw-rw-rw-`,
owner 65534) — **sandbox masks, not crashed-git debris**. Git remains dead in this session
from that second, unfixed cause. The stall's real cause is **`U`**.

**4.2 — This sandbox has its own PID and network namespace.**
`ps aux` returns 5 lines; the only listening sockets are the sandbox proxy (1080, 3128);
even allowlisted `github.com` returns `000`. Therefore `observe`'s two reported gaps —
`sovereign_not_live_ready` and `no_local_model_reachable` — are **not evidence that those
services are down**. They are unobservable from here. Re-run `dema node0 activation observe`
in the operator's own terminal before believing either.

**4.3 — The anchor path is part of the seal.**
A random (`mkdtemp`) anchor directory enters the sealed body and changes `seal_head` on every
run. With the anchor pinned, three independent processes produced an identical seal. Any
"reproduce it yourself" instructions **must pin the anchor path**, or witnesses will get a
different hash and reasonably conclude the proof is fake.

**4.4 — `mission_id` is `null`.**
The Phase 3 evidence pack asks for a mission ID; the kernel does not currently emit one.
Either add it or drop it from the pack.

---

## 5. Forbidden-claim scan

Scanned against the plan's own forbidden list. Status of each in this document:

```
EU certified / EU approved / fully compliant     ABSENT
"all AI Act rules start tomorrow"                ABSENT
first in the world / first-or-only               ABSENT
tamper-proof / zero risk                         ABSENT
production ready                                 ABSENT
autonomous for life / fully autonomous           ABSENT
live PAT/SAT fleet · live token economy          ABSENT
Node0 complete / closed                          ABSENT (explicitly refused, §2 row 12)
```

The repo enforces this independently: `scripts/claims/claim-corpus-gate.mjs` failed this
session on a genuine unlabeled exclusivity claim and was resolved by labeling, not by
baseline-bumping.

---

## 6. What this package does NOT prove

- Not EU certification, approval, endorsement, or legal compliance of any kind.
- Not Node0 closure, not Dema activation, not L1 activation (that receipt stays retracted).
- Not federation, URP connection, Node1/Node2, token, mint, or PoI.
- Not production scale: one folder, 10 files, one bounded mission, one local node.
- Not durability of any anchor store; not correctness of any model output.
- No network egress, no model invocation, no key ceremony. `authority_delta = 0`.

---

## 8. The three-goal verdict — measured, not asserted

The stated goal was **Node0 closed · Dema activated · URP ready to connect Node1.**
Each was driven to the point where disk answers it.

**8.1 — Node0 closed: there is nothing to invoke.**
Rung 9 of the ladder is not "not done yet"; its definition is literally empty:

```js
{ id: "activate", label: "Live activation (governed runtime + identity)",
  command: null, evidence_file: null, marker: null, tier: "gated" }
```

No command, no evidence file, no marker. The ladder is a **status mirror, not an
activator** — its own header says it "activates no runtime, and the gated `activate` rung
is never crossed here." Closure cannot be performed from this repo by anyone, human or
agent. Rungs 1–8 are all `SHIPPED`.

**8.2 — Dema activation: the sovereign EXISTS, and the blocker looks like a port mismatch.**

`observe` probes `DEMA_SOVEREIGN_URL` (default `http://127.0.0.1:8000`) for
`/v1/health/live` and `/v1/health/ready`. From this sandbox that probe is unknowable
(§4.2) — but the runtime it wants is on disk and implements exactly those routes:

```
/data/bizra/recert-wt/core/sovereign/api.py
    @app.get("/v1/health/live")     line 2629
    @app.get("/v1/health/ready")    line 2634     (payload carries seed_engine.active)
    runtime_core.py · seed_engine.py · node_value.py · tests/core/sovereign/
```

**But the ports disagree:**

| | Port |
|---|---|
| Sovereign default (`python -m core.sovereign serve`, and its own banner) | **8080** |
| Dema's probe target (`DEMA_SOVEREIGN_URL` default) | **8000** |

Nothing in the sovereign defaults to 8000 (`--port` default is `8080` at
`core/sovereign/api.py:6722` and in the `__main__` help text). So a running sovereign
started with defaults would still make `observe` report `sovereign_not_live_ready`.

**Resolve it one of two ways, then re-run `observe`:**

```bash
# either bind where Dema looks…
cd /data/bizra/recert-wt && python -m core.sovereign serve --host 127.0.0.1 --port 8000

# …or point Dema where the sovereign lives
DEMA_SOVEREIGN_URL=http://127.0.0.1:8080 dema node0 activation observe
```

This is a configuration mismatch, **not** a missing runtime — exactly the shape of thing
that hardens into "Node0 can't activate" if nobody checks the port. `U` until re-run
outside the sandbox.

**8.3 — URP "ready to connect Node1" would BREAK the proof system.**
This is the important one, and it inverts the goal. Node1 is not an unbuilt feature; it is
an actively asserted negative invariant:

| Site | Assertion |
|---|---|
| `packages/core/src/system-snapshot.js:34` | `{ id: "node1_urp", status: "LOCKED", truth_label: "LOCKED" }` |
| `packages/core/src/node0-proof-of-truth-control-plane.js:214` | blocks unless `boundary.no_node1_activation === true` |
| `packages/core/src/node0-proof-snapshot-attachment.js:112, 225` | same assertion, twice |
| `packages/core/src/mission.js:11` | `node1_activation` in the forbidden-boundary list |
| `packages/core/src/process-value-preview.js:52, 59` | `node1_connection_blocked` |

Three or more proof gates **require `no_node1_activation` to be true in order to pass.**
Flipping URP to node1-ready would fail `proof:truth`, `node0-proof-snapshot-attachment`,
and mission gating simultaneously. The economic rail confirms the intended posture today:
`live_federation_claim: false`, `boundary_blocked: true`.

The system is not missing federation. **It is refusing it until proof gates pass** — which
is the design. Satisfying goal 3 as literally worded would mean disabling the refusal.

---

## 9. ✅ RESOLVED — the seal is now self-sufficient at `87c0d23`

**Landed 2026-08-01 as `87c0d235bbe2e37961f7d0d2fa1240c299ae620a`** on
`seal/omega0-mechanical-closure-1a` (parent `07a0c65`), 7 files, +75/−7. Local only —
not pushed.

Re-verified by a **fresh reader** (new bare mirror built from the real object store),
re-running the exact probes that returned `0` at `07a0c65`:

```
l1-micro-loop allowlisted      0 -> 1
peak imports verification-adm  0 -> 1
ask row in consent matrix      0 -> 1
omega0 row in TESTING.md       0 -> 1
```

Compliance after the carve: `claim-corpus-gate`, `integration-check`, `kernel-purity`,
`no-overclaim`, `llm:guidance`, `git diff --check` all exit `0`. Full suite
**8380 tests · 8371 pass · 6 fail** — a failure set *identical* to the pre-carve
best case (the same 6 environmental faults, §3). **Zero new failures introduced.**

⇒ **"reproducible at exact SHA" is now defensible — cite `87c0d23`, not `07a0c65`.**

The original finding is preserved below, because it is the reason the commit exists.

### What was wrong at `07a0c65`

A witness who cloned at that commit got a tree whose own purity gate fails and whose
sealed kernels have no callers.

Verified by `git show` against the sealed commits — no inference:

| Wiring the sealed code needs | Present at `07a0c65`? |
|---|---|
| `l1-micro-loop.js` in the kernel-purity allowlist | **NO** (`grep -c` → 0; present in working tree → 1) |
| `peak-self-loop-preview.js` imports `verification-admission` | **NO** (→ 0) — the sealed kernel has **no caller** |
| `"ask"` row in `cli-consent-matrix-entries.js` | **NO** (→ 0) — the sealed CLI command is unwired |

And `l1-micro-loop.js` at `35bdcdd` does `import … from "node:fs"` using
`renameSync · writeFileSync · mkdirSync · copyFileSync`. It is impure **by design** ("the fs
IS the act"), so it *must* be allowlisted to pass. At `07a0c65` it is not.
⇒ **the kernel-purity gate fails on a clean checkout of the sealed SHA.**

Gates pass today only because the working tree carries the uncommitted wiring. This is the
classic import-closure trap: green gates in a dirty tree ≠ a safe commit.

### The carve that fixes it — slice A, do this first

These 7 paths are not a separate story; they are the missing half of the seal:

```
packages/core/src/peak-self-loop-preview.js      # imports the sealed verification-admission
packages/core/src/cli-consent-matrix-entries.js  # 'ask' consent row
tests/consent-bridge-parity.test.js              # parity for that row
tests/cli-command-table.test.js                  # +1 line: the ask command
scripts/review/kernel-purity-check.mjs           # allowlists the sealed l1-micro-loop.js
docs/CURRENT_LIMITS.md                           # +4 rows for the sealed slices
docs/TESTING.md                                  # sealed-slice rows (+ 2 fixes this session)
```

Suggested message:
`fix(seal): land the wiring the Omega0-M and First Light kernels require`

Until slice A is committed, **do not publish an "at this SHA" reproduction claim.**

### Remaining carve (after A)

| Slice | Paths | Story |
|---|---|---|
| B — theme | `packages/core/src/theme.js` (+42), `tests/theme.test.js` (+32) | TUI SCALE ramps from the 2026-07-30 design handoff; explicitly *not* brand canon |
| C — GTM | `AUG2_OPERATION_FIRST_WITNESS.md`, `G0_PRIVATE_SEND_GO_CARD.md`, `G0_WITNESS_CAMPAIGN_v0_1.md`, this file | launch pack |
| D — ADR/spec | `ADR-049`, `ADR-050`, `ADR-051`, `MASTER-SPEC-NODE0-2026-07-31.md`, `SESSION-OWNERSHIP.md` | architecture decisions |
| E — backlog | `task-029`, `task-031`, `task-057`, `PRESERVATION-1B-PHASE0-SEAL` | task state |
| F — new subsystems | `pke/`, `companion/`, `.agents/skills/run-dema/` | need their own review; do **not** bundle |
| — | `NODE0_SEAL_RECEIPT_20260801.md`, `THIRD_FACT_CONVERGENCE_AUDIT_v0_1.md` | receipts, land with A or D |

### The dirty count is inflated

`git status` shows 45 paths. **Only 26 are real.**

- **18 are sandbox `/dev/null` ghosts** — `.bashrc`, `.zshrc`, `.gitconfig`, `.gitmodules`,
  `.profile`, `.vscode`, `.idea`, `.mcp.json`, `.ripgreprc`, `.claude/{commands,routines,
  output-styles,launch.json,loop.md,scheduled_tasks.json}`. All are character devices
  (`crw-rw-rw-`, owner 65534). They do not exist outside this sandbox.
- **2 are empty probes** — `.probe-del`, `.wtest2` (0 bytes).
- **26 are real** — 13 modified + 13 untracked.

`clean_worktree` is therefore much closer to green than it looks.

---

## 7. Reproduction

```bash
# at 07a0c65
node --test tests/omega0-mechanical-closure.test.js          # expect 10/10
node scripts/review/integration-check.mjs                    # expect ok:true
node scripts/claims/claim-corpus-gate.mjs                    # expect new=0
```

The First Light mission harness lives outside the repo (session scratchpad) and is **not**
committed. To make it a public reproduction target it must be committed with a pinned anchor
path, a fixed `now`, and a fixture folder — otherwise §4.3 applies.
