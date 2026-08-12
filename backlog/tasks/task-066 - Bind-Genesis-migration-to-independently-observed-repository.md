---
id: TASK-066
title: Bind Genesis migration to independently observed repository
status: Done
assignee: []
created_date: '2026-08-12 03:52'
updated_date: '2026-08-12 04:12'
labels:
  - security
  - node0
dependencies: []
references:
  - apps/cli/src/commands/genesis.js
  - packages/mission/src/executing-repository-binding.js
  - packages/genesis/src/genesis-authorship-migration-binding.js
modified_files:
  - apps/cli/src/commands/genesis.js
  - packages/genesis/src/genesis-authorship-migration-binding.js
  - tests/genesis-authorship-migration-production-wiring.test.js
  - docs/TESTING.md
priority: high
type: bug
ordinal: 41000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The governed Genesis key-migration CLI currently derives both preview.repository and executingRepository from the same caller --repo-commit value. This makes repository verification a self-comparison and permits execution under a fake commit. Scope is fixture-only code and tests at exact 10a05824; no real DEMA_HOME, key, signer, ceremony, push, PR, or merge.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The real bin/dema migration lifecycle derives executing commit and tree from the checked-out repository rather than trusting --repo-commit
- [x] #2 A caller-supplied fake or stale repository identity is refused before nonce claim or identity mutation
- [x] #3 A disposable-home positive control reaches the governed executor when the independently measured repository identity matches the sealed preview
- [x] #4 Documentation no longer claims caller-supplied repository identity is independently derived
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a real-binary RED proving a fake --repo-commit can currently migrate. 2. Reuse readExecutingRepositoryBinding with an injected CLI git runner. 3. Bind both measured commit and tree into the preview and independently remeasure on execute. 4. Run focused migration suites and final repository gates.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
RED-first evidence: PW-05B accepted caller-forged repository identity before repair. Independent review then found ambient GIT_DIR could redirect the observer; PW-05D reproduced that bypass RED before GIT_* scrubbing. Final evidence: focused 82/82, full npm test 9504/9504, npm run check PASS, npm run llm:guidance PASS, claim corpus ratchet current=133 baseline=133 new=0, and git diff --check PASS. Independent reviewer APPROVE for TASK-066 only. Candidate remains an uncommitted detached-worktree delta based on 10a05824; no integration, real identity ceremony, external write, or production readiness is claimed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Bound Genesis migration previews and execution checks to the CLI checkout's independently measured commit+tree, removed caller/ambient Git repository selectors, and added real-binary fake-identity, exact-positive, pre-nonce, and hostile-GIT_DIR controls. Verified locally on fixture keys/disposable homes; broader subject/home/workflow authority gaps remain outside this task.
<!-- SECTION:FINAL_SUMMARY:END -->
