---
id: TASK-075.10
title: >-
  REMOTE-WRITE-DERIVATION-BINDING-1A: re-derive deployment observations before
  closure admission
status: Done
assignee:
  - '@codex'
created_date: '2026-08-23 02:13'
updated_date: '2026-08-23 02:28'
labels:
  - node0
  - proof
  - security
  - no-false-green
dependencies: []
modified_files:
  - packages/core/src/node0-deployment-remote-write.js
  - packages/core/src/node0-deployment-remote-write-adapter.js
  - scripts/proof/node0-deployment-remote-write-proof.mjs
  - tests/node0-deployment-remote-write.test.js
  - docs/CURRENT_LIMITS.md
  - docs/TESTING.md
parent_task_id: TASK-075
priority: high
type: bug
ordinal: 55000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Prevent the Node0 remote-write adapter from admitting a rehashed deployment artifact as clean based only on its carried verdict. Bind the normalized measured deployment surface into a new observation schema, independently re-derive the verdict at the adapter, and refuse legacy or mismatched evidence. This is an inward proof-soundness repair only: it must not start a runtime, alter host listeners, mutate DEMA_HOME, touch keys, or claim Node0 closure.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A v0.2 observed artifact binds the normalized deployment surface used to derive the remote-write decision
- [x] #2 The adapter independently re-derives verdict, reason, exposure flag, and findings before producing an observation
- [x] #3 A rehashed artifact whose carried clean verdict conflicts with a recorded non-loopback listener is refused and cannot settle remote_write as clean
- [x] #4 Legacy v0.1 evidence is non-authoritative for closure admission and leaves Node0 OPEN rather than green
- [x] #5 Focused tests and required project checks report exact results; no runtime or host state is changed
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Create a detached clean worktree at current HEAD. 2. Add a red regression using a rehashed mismatched clean artifact with a non-loopback listener. 3. Introduce a v0.2 observation surface binding and adapter re-derivation with explicit diagnostic states. 4. Verify producer/test fixtures emit self-consistent v0.2 bytes without running the host producer. 5. Run focused tests and project gates; report the still-open closure boundary.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-08-23 closeout: implemented in detached worktree /data/bizra/worktrees/remote-write-derivation-binding-1a at base HEAD 9eb7f3f8287fd7e4e979a7922bcd718a8d49b0e3. Patch SHA-256: 7239342a2b79306f1ce3d308a701439ca5620d37b4ca354dad32a6d4d7de4f55. Focused node --test tests/node0-deployment-remote-write.test.js: 22 pass, 0 fail. The final closure gate remains OPEN with 9 satisfied, 0 violated, 1 unknown; remote_write is UNKNOWN because existing v0.1 evidence is now LEGACY_DERIVATION_UNVERIFIED. npm test: 9516 pass, 3 fail. npm run check: 9552 pass, 3 fail. Both report the same known baseline failures: NCG-01, NCG-02, and key-store signing path blocks when the store is unavailable. npm run llm:guidance and git diff --check pass. No host producer, runtime, key, DEMA_HOME, network, Node1, federation, token, or canonical execution action was started.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented schema-v0.2 surface binding and independent adapter re-derivation. Rehashed conflicting observations and every decision-bearing carried field are refused; v0.1 evidence is non-authoritative. Focused proof and guidance/diff checks pass. Repository-wide gates remain red only on the three documented baseline failures, so this task is done with known remaining risk and does not close Node0.
<!-- SECTION:FINAL_SUMMARY:END -->
