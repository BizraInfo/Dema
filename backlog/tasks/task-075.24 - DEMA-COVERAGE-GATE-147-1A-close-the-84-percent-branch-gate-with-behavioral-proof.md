---
id: TASK-075.24
title: >-
  DEMA-COVERAGE-GATE-147-1A: close the 84 percent branch gate with behavioral
  proof
status: In Progress
assignee:
  - '@codex'
created_date: '2026-10-14 12:08'
updated_date: '2026-10-15 07:59'
labels:
  - proof
  - coverage
  - first-human-node0
dependencies: []
modified_files:
  - apps/cli/src/commands/consent.js
  - tests/dema-consent-cli.test.js
  - tests/receipts-verify-reject-coverage.test.js
  - tests/authorship-key-store-negative.test.js
  - tests/homebase-gather.test.js
  - tests/consent-nonce-claim.test.js
  - tests/consent-proof.test.js
parent_task_id: TASK-075
priority: high
type: bug
ordinal: 83000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Resolve the active local Dema qualification failure at gate 147 without changing the 84 percent branch threshold or scanner scope. Reproduce the score in a fresh isolated DEMA_HOME, identify load-bearing uncovered behavior, and add only meaningful behavior-level tests. Preserve unrelated dirty work and report a RED result honestly if the aggregate gate remains below threshold.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Exact repository identity and pre-existing dirty work are rebound and preserved.
- [x] #2 The uncovered behavior is tied to a source-level coverage row and meaningful contract.
- [x] #3 A focused regression test exercises the selected positive and negative behavior and improves the target source coverage.
- [x] #4 The branch threshold and scanner safety rules remain unchanged.
- [x] #5 The required aggregate qualification result, exit code, hashes, and any remaining red gates are recorded.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Current bounded continuation (2026-10-15): 1. Preserve fresh dirty-tree preimages and the prior season receipts. 2. Prove the precision gap against installed Node source and a real failing coverage command. 3. RED-first test that the canonical coverage command retains native LCOV branch counters. 4. Add only built-in LCOV output beside the existing TAP log, keeping thresholds/classifier/scanner unchanged, and document correlation. 5. Run focused failure/success controls, rollback in disposable copies, then required gates once. 6. Record exact counts, exits and remaining blockers; do not equate observability repair with branch-gate closure.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Repository rebind: branch agent/receipt-verify-1e, HEAD daa20685cb3a7b80718bb3664ce2399b9af672da, tree 8b799eee3867d5053695fb1357c07065bea26ce8. No reset or cleanup was run. The exact initial dirty-set preimage manifest is unavailable, so acceptance criterion #1 remains unchecked.

Coverage investigation tied the selected caller-bound expectedActionScope behavior to `consent-verify-command.js` lines 57-65: baseline branch coverage was 62.50%; a focused 10/10 test run raised it to 90.00%. Before/after focused log hashes: 04e0c7ac172043f4b16537feac25803d15598cb44ddc546675a9cce53d8ec903 and f5e1f9a2f19e5c94c1ce90bffd25ff299bd4a53e366354c124759dd36a755837. Additional behavior tests cover consent proof write failure, wrong-key proof refusal, mobile challenge invalid input, missing challenge path, wrong/missing phrase, and unknown command. The final focused `dema-consent-cli.test.js` run passed 21/21; log SHA-256 f5e6c2660f01047c3ae14b067ce9b1b8ce9bbdc1a376fa7c352951c45e11ae38. Focused source rows: `consent.js` 100.00% lines / 47.06% branches; `mobile-qr-challenge-preview.js` 94.07% lines / 93.02% branches. These remain test evidence, not runtime activation.

Final candidate 15 (`npm run check`) exited 1 at gate 147. Main suite: 10,399 tests, 10,395 passed, 0 failed, 4 skipped. Coverage suite: 10,284 tests, 10,280 passed, 0 failed, 4 skipped. Coverage table prints 95.40% lines, 84.00% branches, 97.56% functions, but the native 84% branch threshold still fails. The exact unrounded branch value is UNKNOWN; no GREEN claim is made. Full check log SHA-256 69c535eab888a4e9d99dd584a15d123c9445c85dabeb1be8dce971a7649d378b. `git diff --check` exited 0. Scoped seven-file patch SHA-256 a65b57661bcc49f46db0c545b1f68a29a17777651c369fc27ea6940c9bdaaec6.

Latest file SHA-256: consent.js 65c6acba7686a53a6a70e95a50af25f7a0a79193bdf4198559599a1ab00af689; dema-consent-cli.test.js d631c41be996e47cee2cb32f5e539141f6224cb3f92705bf0b45c2da44afcd3d; receipts-verify-reject-coverage.test.js 7358e7c0ae64bbf1782eccee10260cb505b28e7ad3d0aeb6b67ea0d1db346f5b; authorship-key-store-negative.test.js 389f7834bcb8db2171ef9e80c7f09af6cace98984a5e844239b2d9db1469bf56; homebase-gather.test.js d6c3adcbd70e93fc708ce3e67fe1ed407471d6ea4c1bf21cd6ff0dab9424bdbc; consent-nonce-claim.test.js bd5411735690741aaaf7d79da4b66f6c709965a0beaae43103d74f4aaf1f6d0b; consent-proof.test.js 124da58fd02d2319e13b82d149f70298688db9aa5d7170100588166ecfd8c4b9.

Candidate 9 had one gate 146 failure: a child Node process segfaulted (exit 139) during the season-handoff S1 test. That same test passed in isolation; candidate 10-15 main suites passed. Cause remains UNKNOWN and is not normalized. The 84% threshold and scanner were not edited during this task; a scanner diff was already present in the inherited worktree and was left untouched. No commit, push, deployment, model, provider, or runtime operation occurred. Task remains In Progress because aggregate gate 147 has not passed. Rollback must target task-owned hunks only; do not reverse-apply the whole patch because these paths may include inherited changes.

Fresh continuation is limited to coverage evidence precision. Existing behavior tests and historical failures are preserved. Preimages and a fresh mission boundary are at .artifacts/audits/dema-coverage-counts-20261015. No runtime, provider, service or authority change is authorized by this continuation.

2026-10-15 bounded precision continuation: added only native LCOV reporter options to package.json, 3 canonical-command failure/pass controls in tests/check-exit-integrity.test.js, and docs/TESTING.md explanation. RED controls failed 3/3 against unchanged package command because counters were absent; focused exit/classifier suite passed 72/72 after change. npm test exited 0: 10,288 total / 10,284 pass / 4 skip / 0 fail. npm run check exited 1 at gate 147 after serial suite 10,403 total / 10,399 pass / 4 skip / 0 fail and coverage suite 10,288 total / 10,284 pass / 4 skip / 0 fail. Native same-run LCOV records 52,052 / 61,968 branches = 83.9981926155435%, rounded to 84.00; strict 84% rejection is correct. Fixed-denominator deficit is 2 covered branches, not a license for coverage-padding tests. No threshold, classifier, scanner or runtime logic changed. A separate native fixture reproduced 677/806 = 83.99503722084367%, printed 84.00 and exit 1. Forward/reverse/forward scratch patch restoration matched bytes. Guidance, corpus (130 inherited / 0 new) and diff-check passed. Source repair stops at the failed aggregate gate; task remains In Progress and historical AC1 remains unproved. Fresh intake preservation and exact hashes are recorded separately; they do not repair the old missing preimage. Full audit, source/claim indices, raw paired TAP/LCOV and unsigned engineering receipt: .artifacts/audits/dema-coverage-counts-20261015/. No commit, push, runtime, model/provider, service, signing or economic operation was issued. Next bounded verification is to map the measured uncovered rows to one meaningful behavior before any further test/source edit.
<!-- SECTION:NOTES:END -->
