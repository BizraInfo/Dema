---
id: TASK-075.09
title: >-
  EVIDENCE-HONEST-SUITE-1A: repair host-dependent closure gate and ignored
  key-store injection
status: Done
assignee:
  - '@codex'
created_date: '2026-08-23 01:28'
updated_date: '2026-08-23 01:40'
labels:
  - node0
  - tests
  - proof
dependencies: []
modified_files:
  - packages/core/src/preview-receipt-signing.js
  - tests/node0-closure-invariants-gate.test.js
  - tests/preview-receipt-signing.test.js
  - docs/TESTING.md
parent_task_id: TASK-075
priority: high
type: bug
ordinal: 54000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make the local suite evidence-honest on machines carrying real Node0 artefacts. Remove host-biography assumptions from the closure-gate tests and ensure preview key-store signing refuses ignored loader options instead of falling through to the default operator key loader.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Closure-gate tests accept truthful host-specific settled-row counts while retaining a hermetic exact-count control
- [x] #2 Preview key-store signing uses the injected active-key loader and refuses unrecognized options fail-closed
- [x] #3 Targeted closure-gate and preview-signing suites pass on the current host without starting a runtime or using an operator key
- [x] #4 The full repository suite/check result is reported exactly
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Apply the already-reviewed 934d84e closure-gate assertions so dynamic host evidence is tested by content, with a controlled acceptance-only count test. 2. Replace the misnamed key-loader test injection with the actual loader seam and reject unknown signing options. 3. Run targeted suites first, then npm test, npm run check, llm guidance, and diff check; record exact results without claiming Node0 closure.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Validation 2026-08-23: targeted node --test tests/node0-closure-invariants.test.js tests/node0-closure-invariants-gate.test.js tests/preview-receipt-signing.test.js passed 62/62. npm test passed 9,518/9,518. npm run check exited 0. npm run llm:guidance and git diff --check passed. These are test/quality results only: no canonical PROD-01 runtime, real GO, or Node0 closure was invoked or established.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Removed host-biography assumptions from the closure gate while retaining a hermetic count control; made the active key-pair injection seam explicit and fail-closed on unknown options. Verified targeted 62/62, npm test 9,518/9,518, npm run check exit 0, llm guidance pass, and clean diff. No runtime or Node0-closure claim.
<!-- SECTION:FINAL_SUMMARY:END -->
