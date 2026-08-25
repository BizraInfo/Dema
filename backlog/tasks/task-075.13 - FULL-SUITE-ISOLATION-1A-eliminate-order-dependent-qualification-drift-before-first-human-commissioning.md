---
id: TASK-075.13
title: >-
  FULL-SUITE-ISOLATION-1A: eliminate order-dependent qualification drift before
  first-human commissioning
status: To Do
assignee:
  - '@codex'
created_date: '2026-08-23 08:51'
labels:
  - first-human-node0
  - precommissioning
  - proof
  - reproducibility
dependencies:
  - TASK-077
parent_task_id: TASK-075
priority: high
type: bug
ordinal: 60000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Before any first-human Node0 runtime commissioning, explain and eliminate the observed full-suite-only failure: the Proof Room CLI test passes in isolation and direct core checks pass, but the full suite has reported 9519/9520. This task is limited to reproducibility and isolation. It must not start a runtime, consume human GO, mutate real DEMA_HOME, modify the production package, promote a candidate, push, merge, or widen authority.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Reproduce the exact full-suite red from declared source bytes, command, process environment, cwd, and test ordering; a retry-until-green result is not acceptance.
- [ ] #2 Identify and minimize the predecessor test or state condition required to trigger the failure, or report the evidence required to distinguish an environment-specific failure.
- [ ] #3 Demonstrate the leaked or coupled state with a red control before repair.
- [ ] #4 Repair only the actual ownership, cleanup, isolation, or dependency defect; preserve unrelated worktree changes.
- [ ] #5 Prove isolated green, minimized-sequence green, order-perturbed/reverse control green, and two fresh-process full-suite runs with the same declared environment.
- [ ] #6 Record exact source identity, commands, environment inputs, logs/hashes, remaining limits, and whether the result qualifies the clean first-human production candidate.
<!-- AC:END -->
