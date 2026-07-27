---
id: TASK-018
title: 'CHECK-EXIT-INTEGRITY-1B: preserve real gate exit status'
status: Done
assignee:
  - '@codex'
created_date: '2026-07-18 23:51'
updated_date: '2026-07-21 02:43'
labels:
  - next
  - product-proof
dependencies: []
ordinal: 18000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Audit 2026-07-19 finding 2 (SNR rank 2), spot-verified: package.json 'check' script is 'check.mjs | tee log; classifier --log' — the semicolon discards check.mjs's real exit status and the TAP classifier determines the final result; a failing late non-TAP gate after a green TAP summary can exit 0 (false-green). Preserve check.mjs exit (PIPESTATUS) and AND it with classifier verdict; classifier may only mask enumerated environmental TAP failures, never non-TAP gate failures.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Green TAP followed by failing non-TAP gate yields non-zero final exit (test)
- [x] #2 Classifier still masks only the enumerated environmental set
- [x] #3 Combined masked TAP noise plus a simultaneous late non-TAP gate failure exits non-zero with structured per-gate evidence
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Bind origin/main and the candidate branch to exact SHAs. 2. Reproduce and classify stale-trailer, exit-status, run-boundary, and skipped-late-gate false greens. 3. Isolate the canonical raw TAP command behind a runner-owned temporary log while preserving fd-side aggregate evidence. 4. Harden per-run TAP structure, exact exit eligibility, and unconditional outer authority. 5. Prove AC1-AC3 with red-green adversarial tests and separate-lens review. 6. Commit locally and run the required exact-SHA ladder in a basename-correct detached worktree. 7. Stop before push, PR, workflow, merge, or release.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verified 2026-07-19: tests/check-exit-integrity.test.js 9/9 (T1 green-TAP+exit1 fails closed via [G8 EXIT]; T6 runner end-to-end nonzero; T3/T8 masking preserved; T9 script wiring). Existing g8-classifier contract 22/22 unchanged. no-overclaim 0, integration-check 0, doc-freshness OK. Commit afd6c77 on fix/check-exit-integrity-1b (off origin/main c047b4e). Residual documented in-code: masked TAP noise + simultaneous late non-TAP failure still passes — needs per-gate structured exits from check.mjs (later slice).

REOPENED BY RECONCILIATION 2026-07-19: afd6c77 closes clean-TAP plus late-failure laundering but its own code documents a residual false-green when enumerated TAP noise and a late non-TAP failure happen together. Recreate on current main, add the combined-case red test, and preserve structured per-gate exits before requesting push/PR authority.

AC3 CLOSED by parallel Codex session 2026-07-19 @ e5886a1 (fix/check-exit-integrity-1b, rebased onto efc2b43, merges CLEAN). The edge case I'd documented as open (allowlisted TAP noise + simultaneous non-TAP failure) is now fully closed via a dedicated fd-3 side-channel evidence contract (start + terminal record, signal/spawn-abnormal authoritative, fd-selector stripped from child env, oversized/start-only/malformed all fail closed). 23 AC3 tests + independent review clean. This SUPERSEDES my afd6c77 — use e5886a1.

2026-07-19 solo corridor: e5886a1 requalified vs main efc2b43 — merge-tree CLEAN, 23/23 focused tests green (worktree check-exit-integrity-ac3), whitespace clean. Conflicts with consent-nonce branch (shared tests/check-exit-integrity.test.js): land check-exit first, nonce rebases+requalifies after. Push blocked: gh token invalid.

2026-07-21 autonomous continuation activated by /A /@ /L /1 after BIZRA-PDMLC-BASELINE-1A. Closure target is existing remote branch fix/check-exit-integrity-1b@e5886a10c87d78b142797da1819b2b651d998e6e, two commits over exact main efc2b4381c6d4f641bdfa1f64db9e383e5425c45. Scope is local verification and truthful Backlog reconciliation only; hard-stop gates remain in force for push/PR/workflow/merge.

2026-07-21 adversarial RED findings at candidate e5886a10c87d78b142797da1819b2b651d998e6e:
- False green 1: classifier scans the aggregate check log, takes the first # fail summary, and accepts earlier completeness markers; stale earlier green TAP can mask a later truncated or undercounted allowlisted failure.
- False green 2: canonical direct TAP failure evidence with exit_code greater than 1 is accepted as tap_allowlist and can be masked; only exit code 1 is an ordinary test-failure candidate.
- Related completion risk: the direct TAP gate occurs before 75 later checks, so masking only after check.mjs exits can skip unexecuted authoritative gates.
These findings keep AC3 and task finalization open. Repair proceeds red-first; no push, PR, merge, workflow dispatch, or release is authorized.

FINAL LOCAL PROOF 2026-07-21: commit 19e7e278e7354566f9a5bd051b7f8844c034c077 supersedes afd6c77 and e5886a1 closure claims. The canonical raw TAP command is isolated at check gate 119 through run-with-classifier --temp-log; later gates continue after enumerated exit-1 TAP noise; every outer failure is authoritative. Per-run TAP validation rejects stale trailers, cross-run count borrowing, pre-version/post-plan/nested failures, malformed or missing exits, signals, and uncaptured failures. Exact-SHA focused suite: 75/75 PASS. Separate-lens reviews: no blocking findings. In the development worktree, npm test and npm run check correctly exposed the known basename portability failure instead of masking it. In a temporary detached worktree named Dema at the identical SHA: npm test PASS 7727/7727; npm run check PASS with all 195 gates and aggregate start+complete; coverage 95.32% lines, 84.32% branches, 97.76% functions; npm run llm:guidance PASS; git diff --check PASS. Temporary worktree removed. No push, PR, workflow, merge, or release performed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Closed CHECK-EXIT-INTEGRITY-1B at local commit 19e7e278e7354566f9a5bd051b7f8844c034c077. The direct TAP gate now owns isolated classification, aggregate failures are always authoritative, and coherent per-run evidence is required before environmental masking. AC1-AC3 are proved by 75/75 focused tests and two separate-lens reviews. Exact-SHA verification in a detached worktree named Dema passed 7727/7727 tests, all 195 check gates, coverage, LLM guidance, and diff hygiene. Remote state is unchanged.
<!-- SECTION:FINAL_SUMMARY:END -->
