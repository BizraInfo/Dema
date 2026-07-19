---
id: TASK-015
title: RFS-1A+1B-push-PR-merge
status: To Do
assignee: []
created_date: '2026-07-18 20:40'
updated_date: '2026-07-19 10:00'
labels: []
dependencies: []
ordinal: 15000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Ship the reversible-file-steward stack: push fix/env-hygiene-sort-1a (3655f92), feat/reversible-file-steward-1a (ab386b2), feat/reversible-file-steward-1b (7e4198a) from worktree /data/bizra/worktrees/reversible-file-steward; open PRs; merge hotfix FIRST (1A/1B CI inherits main T-08 env-hygiene breakage without it). Integration pre-verified in worktree integration-check @ d8612ff (T-08 green, 38/38 slice tests, no file overlap). 1A = pure planner kernel (15 tests), 1B = sequenced execution + proven undo over shipped reversible-rename gate (5 real-fs tests). Distinct from origin/feat/dema-node-space-bonding-file-steward-1a (different surface). Requires operator: gh auth setup-git + exact GO per branch.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 fix/env-hygiene-sort-1a merged to main; T-08 green on main CI
- [ ] #2 feat/reversible-file-steward-1a PR merged with CI green on exact head SHA
- [ ] #3 feat/reversible-file-steward-1b PR merged with CI green on exact head SHA
- [ ] #4 CURRENT_LIMITS.md steward rows verified on main post-merge
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Scope addition available: feat/reversible-file-steward-1c (1a263dc, dema steward CLI, TASK-016 Done) stacks on 1b and merges after it — same push sequence, one more PR.

Live remote verification 2026-07-19 (git ls-remote via Node-CA workaround, read-only): main=c047b4e; fix/env-hygiene-sort-1a ABSENT on remote; steward branches ABSENT on remote. Single outward blocker for the whole corridor: gh token for BizraInfo is INVALID (gh auth status) — push/PR/merge impossible until operator re-authenticates (gh auth login -h github.com). Operator sheet 2026-07-19 supplies exact corridor commands: hotfix push -> hotfix PR -> exact-head CI -> squash-merge -> re-run PR #405 checks -> merge #405 only when green.

Push wave STARTED 2026-07-19 via operator terminal runbook: fix/env-hygiene-sort-1a pushed, remote ref verified in-session; hotfix PR = #406. Runbook exited at the checks-watch step ('no checks reported' — checks had not spawned yet; continue with PR-number form). Note: GitHub reports 4 moderate Dependabot vulnerabilities on main's default branch (UI dependency surface — logged to TASK-019).

2026-07-19 wave status: hotfix MERGED (#406, f0777d4, 9/9 green incl. both check matrices + Review Gate). All 7 staged branches pushed; every remote ref verified byte-exact in-session (ab386b2/7e4198a/1a263dc/afd6c77/77873fc/b58f5ec/380fc46). Remaining for this task: open steward PR ladder (1a -> 1b -> 1c, each after predecessor merges) + 4 independent PRs; merge only on exact-head green — one phase at a time, no unconditional paste-blocks.

Restack complete 2026-07-19: steward stack rebased onto efc2b43 as cc394fc(1a)→c1be5e3(1b)→ebf7367(1c); all predicted conflicts resolved (registry dual-entry, count 69→70, check.mjs, canonical consumers, scaffold allowlist, docs); 74/74 binding tests + consent-matrix/no-overclaim/integration/kernel-purity green. Old remote steward refs (ab386b2/7e4198a/1a263dc) are STALE — force-with-lease push required. Local verify of merged main efc2b43: full npm test+check run — unrecognized failure set = exactly the 3 known sandbox-only tests (human-summary, proof-artifacts, self-check); T-08 green; proof-room green. Corridor per reconciliation: fresh-CI verify PR → check-exit → nonce → docs×2 → ONE steward PR from 1c.

2026-07-19: Block 1 complete per operator — empty-commit verification PR ran fresh CI against efc2b43 and was closed (verify branch deleted from remote). Merge freeze LIFTED: main formally green. Proceeding to Block 2 (force-with-lease steward push) + Block 3 (bound merge ladder).

CORRECTION to previous note: verify/main-after-405 branch STILL EXISTS on remote at 7b68f88 (empty commit atop efc2b43) — the close+delete step has not run yet. 'Block 1 done' = pushed + PR + checks watched; close pending. Do not treat the freeze as lifted until the operator confirms the watch ended green.

INDEPENDENT RECONCILIATION 2026-07-19: DO NOT PUSH OR FORCE-PUSH the restacked steward branches. Direct adversarial review found (1) 1A semantic verification accepts an unexpected authority key after rehash, (2) 1B can leave atom 1 applied when atom 2 fails while omitting receipts, and (3) 1C exposes run/undo filesystem execution inside the Dema face with no exact undo consent, conflicting with the no-runtime boundary. Preserve all tips as evidence. Required redesign: preview-only Dema planning with exact boundary-key validation; governed runtime owns atomic execution/rollback/undo.
<!-- SECTION:NOTES:END -->
