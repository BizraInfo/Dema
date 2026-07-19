---
id: TASK-018
title: 'CHECK-EXIT-INTEGRITY-1B: preserve real gate exit status'
status: In Progress
assignee: []
created_date: '2026-07-18 23:51'
updated_date: '2026-07-19 10:00'
labels:
  - next
  - product-proof
dependencies: []
ordinal: 18000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Audit 2026-07-19 finding 2 (SNR rank 2), spot-verified: package.json 'check' script is 'check.mjs | tee log; classifier --log' — the semicolon discards check.mjs's real exit status and the TAP classifier determines the final result; a failing late non-TAP gate after a green TAP summary can exit 0 (false-green). Preserve check.mjs exit (PIPESTATUS) and AND it with classifier verdict; classifier may only mask enumerated environmental TAP failures, never non-TAP gate failures.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Green TAP followed by failing non-TAP gate yields non-zero final exit (test)
- [x] #2 Classifier still masks only the enumerated environmental set
- [ ] #3 Combined masked TAP noise plus a simultaneous late non-TAP gate failure exits non-zero with structured per-gate evidence
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Red-first meta-test tests/check-exit-integrity.test.js (green-TAP log + nonzero check exit must fail; masking preserved; runner end-to-end). 2. Classifier: optional --check-exit <n> — nonzero exit with zero TAP failures = fail closed (non-TAP gate cannot launder). 3. New scripts/ci/run-with-classifier.mjs preserving real command exit; package.json check/test/coverage route through it (one shared fix for all three callers). 4. Gates + commit on fix/check-exit-integrity-1b off origin/main.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verified 2026-07-19: tests/check-exit-integrity.test.js 9/9 (T1 green-TAP+exit1 fails closed via [G8 EXIT]; T6 runner end-to-end nonzero; T3/T8 masking preserved; T9 script wiring). Existing g8-classifier contract 22/22 unchanged. no-overclaim 0, integration-check 0, doc-freshness OK. Commit afd6c77 on fix/check-exit-integrity-1b (off origin/main c047b4e). Residual documented in-code: masked TAP noise + simultaneous late non-TAP failure still passes — needs per-gate structured exits from check.mjs (later slice).

REOPENED BY RECONCILIATION 2026-07-19: afd6c77 closes clean-TAP plus late-failure laundering but its own code documents a residual false-green when enumerated TAP noise and a late non-TAP failure happen together. Recreate on current main, add the combined-case red test, and preserve structured per-gate exits before requesting push/PR authority.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Closed the false-green laundering path: new scripts/ci/run-with-classifier.mjs preserves the real exit of check/test/coverage and forwards it as --check-exit; classifier fails closed on nonzero exit with clean TAP log. Verified with 9 new tests + 22 existing classifier tests; gates green. Commit afd6c77.
<!-- SECTION:FINAL_SUMMARY:END -->
