---
id: TASK-088
title: >-
  INSTALL-CANDIDATE-PERF-ADMISSION-1A: integrate verified failed-probe admission
  into the readiness candidate
status: Done
assignee:
  - '@codex'
created_date: '2026-10-16 15:33'
updated_date: '2026-10-16 15:55'
labels: []
dependencies: []
references:
  - TASK-087
priority: high
type: task
ordinal: 89000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The clean 90e33ea1 readiness candidate still has the failed-probe aggregation defect repaired by TASK-087 in Dema-clean. Carry only those exact three source/test files into an isolated candidate, qualify it, and preserve current installation, services and all inherited dirty work. The full objective remains operational installation with independent proof; this local slice does not close that objective.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Unchanged readiness source demonstrates RED for failed-probe admission before copying the two collector repairs.
- [x] #2 The candidate contains the exact two TASK-087 collectors and existing behavioral test plus its required TESTING.md matrix registration, with no unrelated source changes.
- [x] #3 Focused and required repository gates run with recorded exits, exact test scopes, failure evidence and no lowered thresholds.
- [x] #4 Installed payload and process observations, original evidence corrections, source hashes and rollback patch are retained in an unsigned local engineering packet. No protected effect occurs.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Preserve primary dirty-file hashes and bind readiness HEAD. 2. Reproduce failed-child RED on unchanged source in a disposable worktree. 3. Copy the already verified TASK-087 collectors and run focused GREEN. 4. Register the carried test in TESTING.md as required by the unchanged integration gate; preserve the initial two-failure run. 5. Re-run focused/integration checks and required gates serially, including the required claim corpus gate for TESTING.md. Bind the resulting source commit and retain readback/correction/rollback evidence.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Created local source commit 866f418b with exactly three TASK-087 files. RED4 and focused6 passed as expected. Initial full npm test rejected two integration-check cases because the now-tracked test lacked its mandatory TESTING.md row. Correcting that required registration; no threshold or gate behavior changes.

Final source cf896009cefe2a3aa2f2f419fe596131ca40611d is clean and has exactly four paths relative to 90e33ea1. Root tests: 10196 pass/4 skip; canonical serial auto-discovery: 10280 pass/4 skip; coverage: 95.37 lines/84.03 branches/97.55 functions. All five required local gates exit 0. Four-path disposable reverse patch restores base; 57 protected primary files and prior receipts unchanged. Native installed payload integrity passes, but full native qualification refuses toolchain drift and the effective Homebase service uses a separate local-talk runtime. Packaging tooling is absent from candidate source; installed/runtime/mission closure remains open.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Carry the exact TASK-087 failed-child admission repair into the isolated readiness lineage so a fast crash, timeout, missing executable or signal cannot be scored as fast boot latency. The only additional file is the required TESTING.md registration for the carried behavioral regression. Candidate cf896009cefe2a3aa2f2f419fe596131ca40611d is unsigned, unpushed and clean. Verification: four unchanged-source entrypoint RED cases, six focused tests including 36 injected failure positions, 13 focused/integration tests, and all required local gates pass (npm test, npm run check, llm:guidance, claim:check:corpus, diff checks). The initial two documentation-registration failures remain preserved. Evidence, exact test scopes, additive count correction, native readback, service observations and rollback proof are in .artifacts/source-install-truth-spine-20261016/REPORT.md and receipt.json. No installation, service transition, remote write, model/provider call, signing or economic action occurred. This closes only local source integration; release packaging, current-source installation, loaded-code proof, remote qualification and an independently verified human mission remain open.
<!-- SECTION:FINAL_SUMMARY:END -->
