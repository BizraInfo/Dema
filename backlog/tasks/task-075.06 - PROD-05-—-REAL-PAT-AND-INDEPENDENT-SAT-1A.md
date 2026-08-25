---
id: TASK-075.06
title: PROD-05 — REAL-PAT-AND-INDEPENDENT-SAT-1A
status: To Do
assignee: []
created_date: '2026-08-21 21:21'
labels:
  - production
  - pat
  - sat
  - verification
dependencies:
  - TASK-075.05
parent_task_id: TASK-075
priority: high
type: task
ordinal: 51000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Establish one real PAT and one independently invoked SAT as the production verification substrate. PAT_LIVE_COUNT=1, SAT_LIVE_COUNT=1. PAT produces proposals only and holds no commitment, verdict, FATE, or effect authority. SAT runs under separately identified role, receives immutable evidence, re-derives governing law independently, never trusts executor success, and never executes effect. The adversarial control must be green: executor claims SUCCESS but postcondition violates contract, and SAT REJECTS. Only after this works may the system generalize to PAT-7 / SAT-5. Normative spec: NODE0_DEMA_PRODUCTION_CLOSURE_SPEC_v1_0.md @ b01b4b32e9e978287a97a6a3db6cd04fd02fc488 sha256:6ebb7a0dca40451eab030052dd267a1f5c5ad03f9b23ac13f8f34de695add840
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 PAT_LIVE_COUNT=1 and SAT_LIVE_COUNT=1 proven by runtime observation
- [ ] #2 PAT produces proposals only; no commitment authority
- [ ] #3 PAT holds no verdict, FATE, or effect authority
- [ ] #4 SAT runs under separately identified role
- [ ] #5 SAT receives immutable evidence, not executor claims
- [ ] #6 SAT re-derives governing law independently
- [ ] #7 SAT never trusts executor success
- [ ] #8 SAT never executes effect
- [ ] #9 Adversarial control green: executor claims SUCCESS, postcondition violates contract, SAT REJECTS
- [ ] #10 No generalization to PAT-7 / SAT-5 until single PAT/SAT control is green
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 One real PAT and one independently invoked SAT live
- [ ] #2 Executor self-certification fails under SAT
- [ ] #3 authority_delta = 0
<!-- DOD:END -->
