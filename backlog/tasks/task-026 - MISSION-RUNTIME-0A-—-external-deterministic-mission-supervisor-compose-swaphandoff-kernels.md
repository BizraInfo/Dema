---
id: TASK-026
title: >-
  MISSION-RUNTIME-0A — external deterministic mission supervisor (compose
  swap+handoff kernels)
status: To Do
assignee: []
created_date: '2026-07-20 02:56'
labels:
  - mission
dependencies: []
ordinal: 26000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build the first integrated mission supervisor: a deterministic stage machine (DISCOVER→CONTRACT→PLAN→FATE→EXECUTE→VERIFY→REVIEW→RECEIPT→DECIDE) that conducts one bounded local code-repair mission with replaceable workers. Composes already-measured kernels — `packages/core/src/node0-model-swap-invariance.js` (model-blind verdict) and `packages/core/src/dema-mission-worker-handoff.js` (checkpoint continuity) — into a runtime instead of isolated judges. Why: thesis §14 (BIZRA_NATIVE_MARKET_THESIS_v0_1) shows every demo primitive is measured but nothing conducts them; this is the category proof. DEPENDS: wave branches feat/node0-model-swap-invariance-1a + feat/dema-mission-worker-handoff-0a merged to main. CONSTITUTIONAL BOUND: Dema repo carries only the pure supervisor kernel + preview (boundary all-false); live worker execution stays outside the Dema face or behind the governed Node0 adapter — same founder ruling line that HOLDs the steward. Spec: /data/bizra/research/MISSION_RUNTIME_0A_SPEC_v0_1/
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Supervisor kernel walks all 9 stages with a bounded iteration budget; budget exhaustion is a terminal receipt-bearing state, never a silent loop
- [ ] #2 Mission state persists outside any worker; a test kills worker A mid-mission and worker B resumes from checkpoint with identical contract_hash
- [ ] #3 A worker-proposed contract mutation is rejected fail-closed and receipted
- [ ] #4 Verdict is model-blind: identical output from two worker identities yields byte-identical verdict (reuses model-swap-invariance kernel, not a reimplementation)
- [ ] #5 Every stage transition emits a receipt; replaying the receipt chain reproduces the exact final mission state
- [ ] #6 Dema-repo preview boundary is all-false: runtime_execution_performed, model_invocation_performed, network_call_performed all false, deep-equal key check
- [ ] #7 Live-execution adapter is spec-referenced but NOT implemented in the Dema repo
<!-- AC:END -->
