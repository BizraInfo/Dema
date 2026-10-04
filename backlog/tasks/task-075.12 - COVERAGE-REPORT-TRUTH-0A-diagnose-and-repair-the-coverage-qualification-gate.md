---
id: TASK-075.12
title: 'COVERAGE-REPORT-TRUTH-0A: diagnose and repair the coverage qualification gate'
status: Done
assignee: []
created_date: '2026-08-23 04:06'
updated_date: '2026-08-23 04:17'
labels:
  - node0
  - proof
  - quality
dependencies: []
parent_task_id: TASK-075
priority: high
type: bug
ordinal: 58000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Diagnose the evidence-honest candidate's coverage-report failure: TAP passes 9,518/9,518 but npm run coverage fails with Unexpected end of JSON input. Preserve no-false-GREEN discipline. This task may repair only a proven inward cause and does not authorize TASK-076 integration, main mutation, commit, merge, push, runtime activation, PROD-01, C3, Root Canon changes, or authority increase.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Fresh clean reproduction records Git HEAD/tree, Node/npm versions, lockfile hash, command exit code, and sanitized coverage output
- [x] #2 A minimal test or reproducible harness is observed RED before any production-code change
- [x] #3 Cause is classified INWARD, OUTWARD, NON_REPRODUCED, or UNKNOWN with evidence
- [x] #4 If INWARD, the minimal repair is proved by the original RED becoming GREEN without skipping, disabling, or weakening coverage
- [x] #5 All required repository gates are reported exactly; TASK-076 is not touched unless all are green under a separate authorization
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reproduce npm run coverage in a fresh clean candidate worktree and record exact conditions. 2. Write a minimal failing regression test or reproducible harness for the observed coverage-report contract before modifying production code. 3. Disambiguate inward repository cause from outward Node/toolchain cause. 4. Make the smallest causal repair only if inward cause is proved. 5. Re-run focused tests, npm test, npm run coverage, npm run check, npm run llm:guidance, and git diff --check; stop before TASK-076 promotion.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Evidence: prior red coverage run is preserved at /tmp/bizra-coverage-output.1482076.log sha256 cd4db0fa2fc26832148bc02cb637f25c0d2f2fe40afe6dc1708dc1971e516714 (9518 pass / 0 fail, then JSON parse warning). Two later exact coverage runs on the unchanged evidence-honest candidate passed with complete reports: 1514807 log sha256 4ab8865cbe9b063c33281a31162d6f1b51ecb6468350283ffd93b33df2f15e30 and 1538828 log sha256 d5bb7f6d2b5abf8d5d0b1d6da97e86851b65b409649feabdcaca1f58c979aa6c. Candidate binding: HEAD 9eb7f3f, tree 4f1d41f, EHS patch sha256 85f5595ee1eab96afd59fd9edc3d74d79c9fa7e01d634cccd5394900ca3249df; Node v22.22.2, npm 10.9.7, package-lock absent. No production change was made because the observed red did not reproduce; classification NON_REPRODUCED_WITH_RESIDUAL_RISK. Fresh gate results: npm test 9518/9518 pass; npm run coverage pass twice; npm run check exit 0 (aggregate log sha256 62f1669a4920323370a3ad13fbb61a9266883aa5a19fe961f76e638282255f40); llm guidance pass; diff check pass. TASK-076 remains untouched and unintegrated.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
No production repair was made: the previously observed npm run coverage JSON parse failure was preserved as red evidence but did not reproduce in two exact reruns. The unchanged evidence-honest candidate passed npm test (9518/9518), npm run coverage twice, npm run check, llm guidance, and diff check. Classified NON_REPRODUCED_WITH_RESIDUAL_RISK. TASK-076 remains untouched; no authority-bound action occurred.
<!-- SECTION:FINAL_SUMMARY:END -->
