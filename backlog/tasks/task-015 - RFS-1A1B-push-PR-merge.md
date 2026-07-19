---
id: TASK-015
title: RFS-1A+1B-push-PR-merge
status: To Do
assignee: []
created_date: '2026-07-18 20:40'
updated_date: '2026-07-19 17:04'
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

Steward freeze REMEDIATION 2026-07-19 (three-source reconciliation with parallel Codex session): verified 2 of 3 adversarial findings REAL against my code and FIXED them at commit f99741b on feat/reversible-file-steward-1c (stacked on ebf7367). (1) verifyDemaReversibleFileSteward boundary check was the vacuous subset pattern my own memory feedback_vacuous_all_false_boundary_check warned about — a forged extra boundary key + rehash rode through; now deep-equals the 8-key canonical set (regression T12d). (3) dema steward undo mutated files with no consent gate; now requires the exact execute phrase (regression: undo without consent refuses, mutates nothing). Finding (2) '1B leaves atom applied on partial failure' = PARTIALLY real: receipts ARE returned (Codex's 'omitting receipts' is wrong) and ok:false+stopped_at signal it, so state is recoverable-via-undo, NOT silently lost — auto-rollback-on-partial is a deliberate later-slice design choice, flagged not bug. 28/28 focused tests + gates green. Remote still holds OLD pre-restack refs ab386b2/7e4198a/1a263dc (my Block-2 force-push was NOT run) — restacked+hardened local head is now f99741b; a clean force-with-lease is required before any steward PR.

PEAK-OUTPUT FINALIZATION 2026-07-19: full wave verified mergeable onto live main efc2b43 — all 6 candidates CLEAN via git merge-tree (steward-1c f99741b, check-exit afd6c77, nonce 77873fc, first-run-doc b58f5ec, sbom-doc 380fc46, repo-health 5cce798). This session CANNOT push (keyring unreachable in sandbox; api.github.com blocked) — one operator runbook /data/bizra/research/land-the-wave.sh lands the whole wave value-ordered (security→features→docs) with merge_when_green binding so no red check reaches a merge. Steward remote is STALE (old pre-restack refs) — runbook force-with-leases feat/reversible-file-steward-1c to f99741b. Codex repo-health 5cce798 not yet on remote — runbook first-pushes it.

Assessment reconciliation 2026-07-19: external audit's 'steward BLOCKED, 3 defects' is STALE on 2 of 3 — claims 1 (boundary deep-equal) and 3 (undo consent) are FIXED on disk at f99741b (verified: deep-equal key-count present, undo consent_phrase_mismatch present; 28/28 green). Claim 2 remains the sole real gap: 1B leaves earlier renames applied on a failed atom — recoverable via the RETURNED receipts (audit's 'omitting receipts' is factually wrong) but NOT auto-rolled-back. Steward correctly HELD from the immediate wave until transactional all-or-nothing rollback lands (assessment item 6). Removed steward B1 from land-the-wave.sh.

STEWARD FULLY UNBLOCKED 2026-07-19 @ b3d45d8: closed the last adversarial finding (claim 2 / assessment item 6). Execution is now TRANSACTIONAL — sequenceExecuteStewardJob auto-rolls-back every applied atom on any failure, returning the sandbox to genesis (net executed_count 0); a non-provable rollback surfaces as execute_stopped_rollback_incomplete, never a silent partial mutation. Red-first test (atom0 succeeds, atom1 missing -> genesis restored). All 3 findings now closed: (1) boundary deep-equal, (3) undo consent, (2) transactional rollback. 29/29 steward suite + no-overclaim/kernel-purity/review-gate/doc-freshness green; merges CLEAN onto efc2b43; full 6-branch wave cascade 0 conflicts. Restored as wave D1 (own PR, sequenced last) in land-the-wave.sh.

STEWARD RECONCILIATION 2026-07-19 (three-source: my session + Codex + disk): the 3 adversarial BUGS are fixed and stand (boundary deep-equal, undo consent, transactional rollback @ b3d45d8 — code is sound). BUT Codex raises a deeper, VALID constitutional objection I was too hasty to dismiss: dema steward run mutates the USER'S OWN arbitrary files from the Dema face. Disk check: executeReversibleRename is wired to NO live apps/cli command on main — it's a kernel. The only live fs-executing dema commands (node0 spine run) write their OWN receipts under DEMA_HOME, not user files. So the steward would be the first Dema-face command mutating user files, which arguably crosses 'Dema is the face, not the whole system / governed runtime issues receipts' (rules 01/04). VERDICT: steward code is bug-free but WHETHER dema steward run should exist is an unresolved FOUNDER constitutional call — HOLD, not because buggy, but pending that ruling or routing execution behind the governed Node0 adapter. My earlier 'fully unblocked' was premature on the boundary axis.

2026-07-19: steward-1c b3d45d8 HELD on founder constitutional decision (Dema-face execution vs governed Node0 adapter). Decision record staged: /data/bizra/research/push-corridor-2026-07-19/steward-decision-record.md
<!-- SECTION:NOTES:END -->
