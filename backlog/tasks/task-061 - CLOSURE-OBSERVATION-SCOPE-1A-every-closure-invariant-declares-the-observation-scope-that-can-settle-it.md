---
id: TASK-061
title: >-
  CLOSURE-OBSERVATION-SCOPE-1A: every closure invariant declares the observation
  scope that can settle it
status: Done
assignee:
  - '@claude'
created_date: '2026-08-09 10:49'
updated_date: '2026-08-09 11:03'
labels: []
dependencies: []
modified_files:
  - packages/core/src/node0-closure-invariants.js
  - tests/node0-closure-invariants.test.js
  - docs/CURRENT_LIMITS.md
  - docs/TESTING.md
priority: high
ordinal: 36000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-060 proved that a narrow source-surface scan must not settle the deployment-scoped closure invariant remote_write. The fix added a required_scope only to that one row; the other nine closure invariants in packages/core/src/node0-closure-invariants.js still accept any observation carrying only { observed, source }. Nine of the ten rows are therefore open to the exact class of promotion that TASK-060 was created to refuse, and no adapter has been written for any of them yet, so the guard can be installed before the first one lands rather than retrofitted after.

Outcome: each of the ten invariants declares the observation scope that can lawfully settle it, and an observation whose scope does not match is UNKNOWN with reason observation_scope_mismatch, exactly as remote_write already behaves. Scope is mandatory, not conditional, so a future eleventh invariant cannot be added scope-less.

This does not implement any evidence adapter and does not move any invariant out of UNKNOWN.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every entry in CLOSURE_INVARIANTS declares a non-empty required_scope, enforced by a test that fails if any invariant omits it.
- [x] #2 An observation for a non-remote_write invariant whose scope is absent or wrong is UNKNOWN with reason observation_scope_mismatch, and closure stays OPEN.
- [x] #3 A correctly scoped observation still evaluates normally: SATISFIED when it matches required, VIOLATED when it does not.
- [x] #4 remote_write keeps the node0_deployment_remote_write scope string byte-identical, so TASK-060's NCI-11 control still holds.
- [x] #5 Focused tests and repo-required gates pass on the final bytes, with docs/CURRENT_LIMITS.md carrying an honest row for the closure-invariant kernel.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. RED: add NCI-12 (every invariant declares a non-empty required_scope) and NCI-13 (a non-remote_write observation with absent or wrong scope is UNKNOWN/observation_scope_mismatch). Both must fail against current bytes.
2. RED expected on NCI-08: worker_is_replaceable VIOLATED fixture carries no scope, so it becomes UNKNOWN. Repair the fixture to carry the declared scope so the test measures violation-vs-unknown, not scope. Same for NCI-07's authority_delta fixture, which would otherwise pass vacuously.
3. GREEN: declare required_scope on the nine remaining invariants, naming the kind of observation that can settle each; keep remote_write's node0_deployment_remote_write byte-identical. Make the scope check unconditional in readObservation so a scope-less invariant cannot exist.
4. Bump the schema to v0.3 — previously-valid evidence is now refused, which is a semantic break. Only one pin exists (the kernel itself).
5. Add the missing docs/CURRENT_LIMITS.md row for the closure-invariant kernel and update the docs/TESTING.md row.
6. Gates on final bytes: focused tests, npm test, npm run check, npm run llm:guidance, git diff --check. Re-verify the live ledger stays 0 SATISFIED / 10 UNKNOWN.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
RED first: NCI-12 and NCI-13 failed against the pre-change bytes (2 of 13 red, closure kernel only). Predicted collateral RED also arrived — NCI-08's VIOLATED fixture carried no scope and turned UNKNOWN, and NCI-07's authority_delta fixture would have started passing at the scope gate without ever comparing a value; both fixtures now carry the declared scope so they measure the value rule.

GREEN: nine invariants gained a distinct required_scope; remote_write's node0_deployment_remote_write is unchanged. The scope check in readObservation is unconditional, and an invariant declaring no scope fails closed as invariant_declares_no_scope rather than reverting to the permissive path. Schema bumped v0.2 -> v0.3 because previously-valid evidence is now refused; the kernel held the only pin.

CONTROL RUN (the working tree cannot be trusted this session: git exits 128 on .git/config.worktree, which is a /dev/null character device, and 21 git-dependent tests fail there for that reason alone). Two fresh extractions of 6cc7cb9 with a real commit: baseline (unmodified) 8634 pass / 2 fail; candidate (this slice) 8636 pass / 2 fail with a byte-identical failure set, so the slice adds zero failures and two passes. The two shared failures are outward — an EROFS mkdtemp under a read-only $HOME, and one summary test. Repairing that outward blocker with a writable HOME: candidate npm test 8635 pass / 0 fail exit 0, and npm run check exit 0 with full aggregate gate evidence. npm run check on the baseline had separately tripped the performance budget gate under parallel load; run alone it passes at cli_boot_latency_ms 109 against a 150 budget, so that too is load, not code.

Live ledger after the change is unchanged and honest: schema v0.3, verdict OPEN, 0 SATISFIED / 0 VIOLATED / 10 UNKNOWN, every reason no_evidence, verdict re-derived ok.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Generalised the observation-scope rule TASK-060 introduced for one closure invariant to all ten. Each invariant now declares a distinct required_scope naming the kind of observation that can settle it, the check is unconditional in the kernel, and a mismatched or absent scope reads UNKNOWN with reason observation_scope_mismatch. Verified by NCI-12 (every invariant declares a non-empty distinct scope, remote_write's string pinned) and NCI-13 (for each of the ten, both an unscoped observation and a scope borrowed from a sibling are refused), red before the change and green after; plus two fresh extractions of the base commit showing an identical failure set and npm run check exit 0. No adapter was written and no invariant moved out of UNKNOWN: closure stays OPEN at 0/10.
<!-- SECTION:FINAL_SUMMARY:END -->
