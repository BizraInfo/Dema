---
id: TASK-076
title: Process-mining worktree observation 1A
status: Done
assignee: []
created_date: '2026-08-23 02:55'
updated_date: '2026-08-23 03:10'
labels:
  - node0
  - read-only
  - proof
dependencies: []
modified_files:
  - apps/cli/src/commands/process-mining-gatherer.js
  - apps/cli/src/commands/process-mining.js
  - packages/core/src/process-mining-preview.js
  - packages/core/src/homebase-preview.js
  - tests/process-mining-worktree-observation.test.js
  - tests/process-mining-preview.test.js
  - tests/homebase-preview.test.js
  - docs/CURRENT_LIMITS.md
  - docs/TESTING.md
  - docs/ARCHITECTURE.md
priority: high
type: enhancement
ordinal: 56000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace the process-mining CLI's placeholder decision metrics with one bounded, actual Git worktree observation. This is a preview-only sensory slice: identity and porcelain-status counts only; it emits no repository path, filename, or file content, and performs no governed runtime action, receipt issuance, or authority change.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 dema process-mining reports a measured-or-unavailable Git worktree observation rather than metrics_unavailable.
- [x] #2 The observation exposes no filenames or file contents and explicitly records its partial scope and correlation limit.
- [x] #3 A failing Git probe is represented as unavailable without raw command output or an exception.
- [x] #4 Focused tests prove parser counts, fail-closed unavailable behavior, command wiring, and no runtime/network/write capability.
- [x] #5 No runtime execution, receipt minting, model invocation, consent consumption, or authority delta occurs.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add red-first tests for a CLI-layer Git observation gatherer and command output. 2. Implement the smallest injected, read-only Git probe. 3. Wire only dema process-mining, run focused and repository gates, then close out honestly.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Red-first evidence: missing gatherer produced ERR_MODULE_NOT_FOUND; adding the measurement-effect contract first produced three focused RED assertions, then all 51 focused tests passed. Command evidence: dema process-mining --summary measured HEAD 9eb7f3f8287fd7e4e979a7922bcd718a8d49b0e3, correctly marked this implementation worktree DIRTY, disclosed measurement_process_invoked=true, and kept ring state explicitly unobserved. Scope is Git HEAD plus porcelain-v1 status metadata only; output emits no paths, filenames, or content and names its non-atomic correlation limit.

Closeout: npm test ran after the final implementation and reported 9522 tests / 9519 pass / 3 fail; exact failures are known baseline NCG-01, NCG-02, and key-store signing path blocks when the store is unavailable. npm run check failed only through the same classifier result. npm run llm:guidance PASS; docs gates 28/28 PASS; git diff --check PASS. No runtime, model, network, receipt, consent, authority, canonical execution, commit, push, merge, or PR mutation occurred.

Claim correction during self-critique: Git may inspect repository files internally while producing porcelain status, so the contract intentionally guarantees no path/name/content EMISSION rather than claiming no file reads by Git. The output names measurement_process_invoked=true separately from governed effects.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented the minimum real process-mining sensor in isolated worktree /data/bizra/worktrees/process-mining-worktree-observation-1a. It replaces placeholder CLI metrics with bounded read-only Git HEAD/porcelain observation, fails closed, records its own measurement-process effect separately, and refuses unsupported ring claims. Focused proof is green; repository-wide gates retain the documented three unrelated baseline failures. Patch is uncommitted and unmerged by design.
<!-- SECTION:FINAL_SUMMARY:END -->
