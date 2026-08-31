---
id: TASK-075.10
title: >-
  REMOTE-WRITE-DERIVATION-BINDING-1A: re-derive deployment observations before
  closure admission
status: Done
assignee:
  - '@codex'
created_date: '2026-08-23 02:13'
updated_date: '2026-08-31 13:15'
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
1. Reclassify the historical detached candidate as noncanonical and preserve the current main plus no-runtime boundary.
2. Port schema v0.2 surface binding onto current main; hash observed_at and bind the exact producer bytes.
3. Make the adapter verify kernel, producer, timestamp admission, one pure surface re-derivation, and every decision-bearing field plus facet counts.
4. Reuse the shared facet-count derivation in the producer without running it.
5. Add forged-clean, timestamp, collector, legacy, mismatch, and correlation negative controls; update truthful limits/testing docs.
6. Run focused tests, npm test, npm run check, npm run llm:guidance, npm run claim:check:corpus, and git diff --check; rebind final commit/tree/status.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-08-23 closeout: implemented in detached worktree /data/bizra/worktrees/remote-write-derivation-binding-1a at base HEAD 9eb7f3f8287fd7e4e979a7922bcd718a8d49b0e3. Patch SHA-256: 7239342a2b79306f1ce3d308a701439ca5620d37b4ca354dad32a6d4d7de4f55. Focused node --test tests/node0-deployment-remote-write.test.js: 22 pass, 0 fail. The final closure gate remains OPEN with 9 satisfied, 0 violated, 1 unknown; remote_write is UNKNOWN because existing v0.1 evidence is now LEGACY_DERIVATION_UNVERIFIED. npm test: 9516 pass, 3 fail. npm run check: 9552 pass, 3 fail. Both report the same known baseline failures: NCG-01, NCG-02, and key-store signing path blocks when the store is unavailable. npm run llm:guidance and git diff --check pass. No host producer, runtime, key, DEMA_HOME, network, Node1, federation, token, or canonical execution action was started.

2026-08-31 canonical reconciliation authorized. Historical v0.2 candidate remains detached at /data/bizra/worktrees/remote-write-derivation-binding-1a and is source material only; canonical main at 9f13a8d is v0.1. No host producer, DEMA_HOME, runtime, service, network, key, or signer action is authorized or will be run.

2026-08-31 canonical repair verification: focused node --test tests/node0-deployment-remote-write.test.js: 30 pass, 0 fail. npm test: 9836 tests, 9832 pass, 0 fail, 4 skipped, exit 0. npm run check: exit 0; its temporary DEMA_HOME attempt was correctly refused by env hygiene, then a rerun with DEMA_HOME unset passed. npm run llm:guidance, npm run claim:check:corpus, and git diff --check all exit 0. No host producer was run; no real DEMA_HOME, runtime, service, network, key, or signer state was modified.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Canonical schema-v0.2 repair complete: the artifact now binds its surface, observed_at, evaluator bytes, and collector bytes; the adapter re-derives every decision field and facet count, refuses legacy/stale/future/missing-surface/mismatched evidence, and the rehashed deleted-findings forged-clean control is refused. Focused and full project gates pass. This is evidence-admission repair only; remote_write and Node0 closure remain unresolved pending a separately authorized host observation.
<!-- SECTION:FINAL_SUMMARY:END -->
