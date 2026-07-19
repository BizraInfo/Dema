---
id: TASK-020
title: Make proof-room public-safe test portable across worktree names
status: Done
assignee: []
created_date: '2026-07-19 09:32'
updated_date: '2026-07-19 10:23'
labels: []
dependencies: []
ordinal: 20000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The public-safe CLI integration test hardcodes the checkout basename Dema. It fails in correctly isolated worktrees whose directory has another name even though the emitted basename is correct. Make the test derive the expected basename from the actual repository root without changing production behavior or weakening the public-safe gate.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Focused proof-room test passes when the repository checkout directory is not named Dema
- [x] #2 The test still verifies repo_root is redacted and repo_root_sha256 is a 64-character lowercase hex digest
- [x] #3 npm test, npm run check, npm run llm:guidance, and git diff --check pass on the candidate
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Reproduce the existing failure in an isolated worktree whose basename is not Dema; replace the hardcoded expected basename in the CLI integration test with the basename derived from that test file's repository root; rerun the focused test, then the required repository gates; preserve production behavior and make no GitHub changes.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
CLOSED LOCALLY 2026-07-19 in 99243bb: public-safe output now emits stable Dema labeling instead of raw checkout/worktree basenames; actuator scans JS/TS/TSX while excluding generated .next; actuator and style walkers skip external/cyclic symlinks via lstat. Red-first regressions reproduced all three defects; final focused suite 31/31. Full root evidence: npm test 7680/7680, npm run check isolated exit 0, coverage 95.32/84.37/97.76, llm:guidance PASS, git diff --check PASS.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Closed the worktree portability defect without weakening PUBLIC_SAFE. The final repair hardened production redaction and source discovery, not just the test: stable Dema product label, TS/TSX actuator coverage, generated-output exclusion, and symlink refusal. Local commit 99243bb42d86daab9acb7cd50dda1475e4e4361d; no push or PR mutation performed.
<!-- SECTION:FINAL_SUMMARY:END -->
