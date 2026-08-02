---
id: TASK-058
title: C2-HARDENING-1A qualify claim labels and no-replace publication failures
status: Done
assignee: []
created_date: '2026-08-02 05:39'
updated_date: '2026-08-02 06:55'
labels: []
dependencies: []
modified_files:
  - docs/CURRENT_LIMITS.md
  - docs/TESTING.md
  - packages/receipts/src/mission-closure-transaction.js
  - tests/claim-corpus-gate.test.js
  - tests/claim-ledger-check.test.js
  - tests/mission-closure-transaction.test.js
type: bug
ordinal: 34000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Harden Gate C C2 at exact base 26ee8d6 without starting C3.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Canonical claim labels clear the corpus gate without a baseline change.
- [x] #2 Injected no-replace publication failures fail closed without rename or overwrite.
- [x] #3 Required focused and repository gates are reported exactly.
- [x] #4 No C3 route, real DEMA_HOME, push, merge, Titan, mint, signer, or Node0 activation occurs.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add red-first claim-label tests and correct only the two affected rows. 2. Add red-first publication failure tests and a narrow production-default seam. 3. Run required gates, review, commit once, and stop before C3.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Exact base 26ee8d6b7be34034c4066985f724c0f5c6959929 in clean worktree /tmp/dema-node0-c2-hardening-1a-codex. Claim corpus: current=122 baseline=122 added=0 removed=0; baseline unchanged. Publication injection covers EXDEV, EPERM, EIO, EEXIST, cleanup failure, directory-fsync uncertainty, PREPARED recovery, strict replay validation, and hostile BigInt/cyclic/Symbol proposals. Focused claim+NRC+TXJ: 85/85. Full npm test: 8476/8476, 0 fail, 0 skipped. npm run check and npm run llm:guidance: PASS. Independent whole-branch re-review: APPROVE. One piped npm-test attempt correctly failed freshness because the classifier log was empty; the required direct rerun passed 8476/8476.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Canonicalized closure-weld claim wording to [MEASURED] [LOCAL_ONLY] without changing the baseline, and qualified no-replace mission-closure publication/recovery with injected fail-closed tests and strict replay/proposal validation. Verified focused 85/85, full 8476/8476, claim corpus 122/122/0/0, check and LLM guidance PASS. No C3, live route, real-home, push, merge, Titan, signer, mint, or Node0 activation.
<!-- SECTION:FINAL_SUMMARY:END -->
