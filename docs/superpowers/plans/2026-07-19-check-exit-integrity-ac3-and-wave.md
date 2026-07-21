# CHECK-EXIT-INTEGRITY AC3 and Proof-Safe PR Wave Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close TASK-018 AC3 so allowlisted TAP noise can never hide a simultaneous non-TAP gate failure, then publish only the five prepared branches that remain inside Dema's canonical boundary after exact-head checks are present and successful.

**Architecture:** `scripts/check.mjs` remains the sequential gate owner. The exact raw TAP auto-discovery command is first normalized through `run-with-classifier.mjs` against its own fresh log, so a proved environmental exit `1` can return zero and every later gate still executes. In check-owner mode, start plus terminal evidence travels over a dedicated inherited file descriptor, never stdout/stderr. Aggregate success requires exactly `start + complete`; every terminal failure is authoritative. Missing, malformed, inconsistent, truncated, or early-terminal evidence fails closed.

**Tech Stack:** Node.js ESM, `node:test`, stdlib child processes, Git worktrees, GitHub CLI.

## Global Constraints

- No hard-coded secrets or environment-specific credentials.
- Keep every modified source or test file below 500 lines.
- Preserve masking only for enumerated environmental TAP failures; never broaden the allowlist.
- Malformed structured exit evidence fails closed.
- Do not touch unrelated user WIP in `/home/bizra-operating-system/Downloads/Dema`.
- No PR merge until its exact head SHA has at least one reported check and every reported check is successful or explicitly neutral/skipped by repository policy.
- Do not change branch protection or required-check settings without a separate direct `GO` because that is shared repository configuration.
- Use squash merges and preserve the safe order: check-exit, nonce, reconciliation/UI, first-run docs, SBOM docs.
- Hold the steward branch: its direct filesystem execution conflicts with the canonical "No runtime execution in this repo" boundary until execution moves behind the governed Node0 adapter and is separately reverified.

---

### Task 1: Emit and enforce structured per-gate exit evidence

**Files:**
- Modify: `scripts/check.mjs`
- Add: `scripts/ci/check-gate-evidence.mjs`
- Modify: `scripts/ci/run-with-classifier.mjs`
- Modify: `scripts/ci/classify-known-harness-failures.mjs`
- Add: `scripts/ci/tap-run-evidence.mjs`
- Modify: `package.json`
- Modify: `tests/check-exit-integrity.test.js`
- Add: `tests/check-exit-integrity-adversarial.test.js`
- Add: `tests/g8-classifier-freshness.test.js`
- Modify: `docs/TESTING.md` CHECK-EXIT-INTEGRITY-1B row

**Interfaces:**
- Produces: JSONL side-channel evidence with schema `bizra.dema.check_gate_evidence.v0.1`: one `start` record followed by exactly one `complete` or `failure` record.
- Consumes: aggregate `--check-exit <n>` plus `--require-check-gate-evidence` and the bounded side-channel content from `run-with-classifier.mjs`.
- Preserves: standalone `npm test` / coverage environmental masking, the exact raw `node --test --test-reporter=tap` discovery scope, and `runChecks(checks = commands)` behavior; optional injected execution/log/evidence functions are test-only dependency injection.

- [x] **Step 1: Add combined-failure and missing-evidence red tests**

Prove both original false-greens: masked EROFS TAP plus an authoritative failure, and check-owner nonzero exit with no terminal evidence. Preserve standalone masked-only TAP compatibility.

- [x] **Step 2: Run the red tests and verify the original defects**

Run:

```bash
node --test --test-reporter=spec tests/check-exit-integrity.test.js tests/check-exit-integrity-adversarial.test.js
```

Expected: each new regression test fails because the current classifier exits `0`.

- [x] **Step 3: Emit structured evidence over a dedicated side channel**

In `scripts/check.mjs`, wrap the exact `node --test --test-reporter=tap` command with the existing classifier runner and a runner-owned private temporary log. Remove aggregate `tap_allowlist` metadata: all outer failures are authoritative. Write one small JSON record per line to inherited fd 3. Strip the fd selector from every child gate after applying environment overrides. Emit `start` before execution, `failure` before rethrowing, and `complete` only after every child succeeds.

- [x] **Step 4: Enforce positive evidence completeness**

Require exact schema/key sets and exactly two ordered records. Bind the terminal event to the aggregate exit, bind failure index to declared command count, and reject missing/truncated/oversized/malformed evidence. A terminal `tap_allowlist` record cannot replace aggregate completion. A signaled, spawn-abnormal, or noncanonical-exit child is authoritative. Isolated TAP masking requires exact exit `1`, a coherent full trailer, consistent top-level failure counts, and per-failure name-plus-cause matching.

- [x] **Step 5: Run focused green verification**

Run:

```bash
node --test --test-reporter=spec tests/check-exit-integrity.test.js tests/check-exit-integrity-adversarial.test.js tests/g8-classifier.test.js tests/g8-classifier-freshness.test.js
```

Expected: all tests pass; isolated masked TAP returns to the owner, later gates execute, and any later non-TAP exit fails closed; masked-only environmental TAP still exits `0` only with exact exit `1`.

- [ ] **Step 6: Update proof documentation, re-review, and amend**

Update the `docs/TESTING.md` row to name the dedicated side channel and TASK-018 AC3. Run `git diff --check`, obtain a fresh independent review with no Critical/Important findings, then amend the local Task 1 commit.

```bash
git commit --amend --no-edit
```

### Task 2: Re-qualify A1 and restack its dependent nonce branch

**Files:**
- No new source files; git history and existing tests only.

**Interfaces:**
- Consumes: repaired `fix/check-exit-integrity-1b` head.
- Produces: `fix/consent-nonce-atomic-1a` rebased directly onto the repaired A1 head without conflict markers.

- [ ] **Step 1: Rebase A1 onto current remote main**

The original branch predates #406/#405 and reproduces their already-fixed env-sort and proof-room-basename failures. Rebase the repaired A1 commit onto current `origin/main` before qualification.

- [ ] **Step 2: Run A1 proof ladder**

Run focused tests, `npm test`, `npm run check`, `npm run llm:guidance`, and `git diff --check`. Any nonzero unrecognized failure blocks publication.

- [ ] **Step 3: Rebase nonce after A1 squash-merges**

After A1 squash-merges, rebase only the nonce commit onto fresh remote `main`, preserve both `docs/TESTING.md` rows, and verify zero conflict markers. This avoids repeating A1's pre-squash commit in the PR diff.

- [ ] **Step 4: Run dependent focused tests**

Run:

```bash
node --test --test-reporter=spec tests/check-exit-integrity.test.js tests/consent-nonce-atomic.test.js tests/consent-nonce-registry.test.js tests/keyconsent-2b-nonce-integration.test.js
git diff --check
```

Expected: all tests pass and the branch is clean.

### Task 3: Publish and merge the proof-safe five-PR corridor

**Files:**
- Update operationally: `/data/bizra/research/land-the-wave.sh` with repaired A1 and restacked A2 SHAs.

**Interfaces:**
- Consumes: five clean local branch heads and GitHub authentication for `BizraInfo/Dema`.
- Produces: up to five squash-merged PRs, each bound to its exact head checks, followed by a fresh `main` SHA receipt; steward remains local and unpushed.

- [ ] **Step 1: Reconcile refs and PR existence**

For every branch, compare local SHA, remote SHA, and any existing PR before deciding whether to push, force-with-lease, create, or reuse.

- [ ] **Step 2: Publish one branch at a time**

Use normal push for new refs and `--force-with-lease` only for already-divergent A1/A2 refs after verifying their leases. Never stage or commit the reconciliation worktree's untracked root `package-lock.json`.

- [ ] **Step 3: Wait for checks to exist, then wait for completion**

Poll the PR until `statusCheckRollup` is non-empty. Record `headRefOid`, then run the check watch. Re-read `headRefOid` immediately before merge and require it to equal the recorded SHA.

- [ ] **Step 4: Merge and re-derive main after each PR**

Use squash merge with `--match-head-commit`. After each merge, query remote `main` and validate the next branch's mergeability against the new base. Stop on any conflict, missing check, red/cancelled check, review blocker, or head drift.

After reconciliation/UI lands, refresh the SBOM docs branch against actual implemented UI-CI and dependency counts before publishing it; the old `380fc46` claims are stale.

- [ ] **Step 5: Final remote receipt**

Report PR number, exact head SHA, merge SHA, merged timestamp, and successful check names for every landed PR. Verify current `main` through both GitHub API and `git ls-remote`; report steward as held, not failed or shipped.

### Task 4: Backlog and completion truth

**Files:**
- Update only through `backlog task edit`: TASK-015, TASK-016, TASK-017, TASK-018, TASK-019, TASK-009, TASK-020 as evidence permits.

- [ ] **Step 1: Read finalization guidance and each task**

Run `backlog instructions task-finalization`; map objective evidence to every acceptance criterion.

- [ ] **Step 2: Check only proven criteria**

Do not mark TASK-019's required-check criterion complete unless GitHub branch/ruleset configuration actually enforces the `Dema UI` check. Do not claim the wave complete if any PR or exact-head check is absent.

- [ ] **Step 3: Finish with an attempt-completion receipt**

State shipped, locally verified, remotely merged, still unenforced, and blocked surfaces separately. Include no aspirational completion language.
