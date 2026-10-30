---
id: TASK-086
title: 'UMDC-UNMODELED-OBSERVATION-1A: abstain instead of emitting false HEALTHY'
status: Done
assignee:
  - '@codex'
created_date: '2026-10-15 14:36'
updated_date: '2026-10-15 14:54'
labels: []
dependencies: []
references:
  - packages/core/src/node0-ultra-micro-diagnostic-compiler.js
  - tests/node0-ultra-micro-diagnostic-compiler.test.js
priority: high
type: bug
ordinal: 87000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The existing pure diagnostic compiler accepts stale_evidence, infra_failure and code_failure but has no emission entries for them. A missing likelihood produces NaN and defaults latent state to HEALTHY; semantic rederivation repeats the defect. Repair only latent inference and regression tests; retain FDE findings, hypotheses, preview boundaries and hand-specified parameters. No UI, runtime, network, signer, economic, campaign or promotion changes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every advertised observation produces a finite weight within [0,1]; unmodeled accepted observations yield UNKNOWN, zero weight and an empty path.
- [x] #2 Mixed modeled and unmodeled sequences abstain, malformed observations still reject, and modeled sequences retain their baseline outputs.
- [x] #3 Compiled stale, infrastructure and code episodes preserve classification and authority_delta zero; honest JSON roundtrips verify and forged HEALTHY or null-weight output rejects.
- [x] #4 Capture unchanged-source RED, focused GREEN, independent review, required repository gate outcomes and a hash-bound reversible patch without promoting local proof to Node0 closure.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Bind clean target files and protect preexisting dirty paths. 2. Capture baseline and modeled outputs; demonstrate missing-emission RED. 3. Prevalidate symbols and reuse UNKNOWN for missing emissions; also demonstrate and guard inherited-property stage names in the same decoder lookup. 4. Run focused and repository gates with their designed isolation, independently review, retain report, patch and evidence hashes.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Recorded unchanged-source RED: 21 tests, 18 pass, 3 fail. Added missing-emission abstention to existing decoder, preserving all model parameters and full alphabet validation. Focused GREEN: 21/21. Five previously captured modeled sequence outputs compare exactly. Evidence: .artifacts/umdc-unmodeled-20261015/.

Independent review passes unmapped-observation fix and found preexisting direct-decoder stage prototype lookup can also produce NaN. Extend this same numeric-inference boundary by using own-property stage salience lookup; no new model values. Initial full npm test passed 10287/10291 with four skips. Initial npm check refused injected DEMA_HOME at strict gate zero; preserve evidence and rerun canonical built-in isolation.

Final focused suite 22/22; adjacent compiler/trace/FDE/purity group 129/129; UI projection read-only suite 11/11. Final root suite: 10288 pass,4 skipped,0 fail (10292 total). Canonical check serial discovery: 10403 pass,4 skipped,0 fail (10407 total); coverage gate still running, no aggregate-green claim. Independent exact-source review PROCEED with 231 alphabet/stage cases,132 inherited-name equivalences,5 baseline comparisons and forgery/memo/roundtrip checks. Reverse patch dry run passes. Forty-six preexisting dirty files preserved.

Final canonical npm run check passed exit 0 using built-in per-gate isolation, including serial discovery and coverage; llm:guidance and git diff --check also passed. Initial temporary-DEMA_HOME refusal retained and classified as environment qualification failure, resolved by the canonical runner. No runtime campaign or remote effect was performed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Prevented false HEALTHY/NaN inference for admitted unmodeled failure observations and inherited-property stage names, preserving FDE classes, modeled output, cache validation and zero authority. Verified RED-before-edit, 22 focused tests, 129 adjacent tests, 11 existing UI projection tests, 10288 root passes plus 4 skips, complete canonical check including coverage, guidance, whitespace, independent exact-source review and reverse patch dry run. Source-bound engineering evidence and 13-section synthesis retained under .artifacts/umdc-unmodeled-20261015; no Node0 closure or runtime/economic claim.
<!-- SECTION:FINAL_SUMMARY:END -->
