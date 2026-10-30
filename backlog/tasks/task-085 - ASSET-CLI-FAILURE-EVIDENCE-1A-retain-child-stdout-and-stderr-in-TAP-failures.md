---
id: TASK-085
title: 'ASSET-CLI-FAILURE-EVIDENCE-1A: retain child stdout in TAP failures'
status: In Progress
assignee:
  - '@codex'
created_date: '2026-10-15 06:22'
updated_date: '2026-10-15 06:56'
labels: []
dependencies: []
references:
  - tests/homebase-asset-awareness-cli.test.js
  - .artifacts/audits/bizra-design-context-20261015/npm-check-clean-env.log
priority: medium
type: bug
ordinal: 86000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The retained gate-146 asset-scan CLI failure does not recur in 25 fresh-process focused runs; its root cause remains unknown. Red-first controls now prove a narrower observability defect: native execFileSync stderr already appears in the error message, while captured JSON stdout does not. Append stdout only, rethrowing the original error. Production CLI parsing, consent, scanning, and gate policy stay unchanged.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Red-first checks prove that both JSON stdout and human stderr from real nonzero CLI exits are visible in the failure message.
- [x] #2 The helper rethrows the original child error and retains exit status, output fields and stack; successful CLI behavior is unchanged.
- [x] #3 Focused consent tests pass; only the selected test source changes. Protected tracked source remains byte-identical, and observed unrelated task-record drift is preserved and disclosed.
- [x] #4 Required repository gate outcomes, source binding, rollback evidence and an unsigned engineering receipt are recorded without claiming the intermittent CLI defect is repaired.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Preserve the clean test file preimage and dirty-tree hashes. 2. Record RED with the helper unchanged: human stderr retained, JSON stdout missing from error.message. 3. Append only captured stdout and rethrow the same error; verify GREEN, actual TAP failure rendering, scratch reverse/reapply recovery, consent tests and required repository gates. 4. Bind the one-file patch and unsigned receipt to exact working-tree bytes; keep the intermittent root cause UNKNOWN.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
RED: node --test --test-name-pattern="missing --root" tests/homebase-asset-awareness-cli.test.js exits 1: human stderr control passes; JSON stdout control fails with missing stdout in failure diagnostics. Helper bytes were unchanged. Narrow the implementation to stdout; duplicating stderr is unnecessary.

Recovery: the initial npm test passed (10,285 total / 10,281 pass / 4 skip / 0 fail). The first aggregate wrapper was interrupted, not a measured code failure; its session/process disappeared and no final exit was recorded. One bounded recovery aggregate is running on candidate SHA 8addd258a8c2224ca35d2b3d4f171313f36bb32cb2ba6ccf296e48d7914241b5. Clarified AC3 from requiring every unrelated record to stay byte-identical to preserving protected source and disclosing unrelated metadata drift: TASK-083 changed during the run (actor UNKNOWN); its current bytes were not reset. Intake task wording is preserved in task-before-finalization.txt. No source or gate-policy change accompanies this clarification.

Implemented the bounded failure-evidence slice only: scan() appends captured stdout and rethrows the original execFileSync error. Native human stderr was already preserved. RED JSON diagnostic control fails before repair; final focused boundary tests pass 25/25; actual TAP before/after probes both exit 1, with JSON cause visible only after repair. npm test: 10,285 total, 10,281 pass, 4 skip, 0 fail, exit 0. First aggregate attempt was INTERRUPTED (exit UNKNOWN). Single recovery aggregate exits 1 at gate147 coverage: serialized suite 10,400 total / 10,396 pass / 4 skip / 0 fail; coverage suite 10,285 total / 10,281 pass / 4 skip / 0 fail. Printed coverage 95.40% lines, 84.00% branches, 97.57% functions; native 84% branch threshold is refused. Unrounded coverage and causal attribution remain UNKNOWN; downstream aggregate gates NOT_RUN. Guidance, claim corpus (130 inherited / 0 new), and diff check pass. Candidate SHA-256 8addd258a8c2224ca35d2b3d4f171313f36bb32cb2ba6ccf296e48d7914241b5; patch SHA-256 1a75c3062eb044d57d7fe8ffc71f308adfb3b5eb9ab6992c6b79603ad82d7386. Scratch forward/reverse/reapply is byte-identical. Protected tracked source unchanged; 41 of 42 pre-existing changed files remain identical, with TASK-083 metadata drift recorded (actor UNKNOWN) and current bytes preserved. Original intermittent asset CLI failure remains unexplained. Partial unsigned engineering receipt: .artifacts/audits/dema-assets-cli-diagnostic-20261015/receipt.json. Task remains In Progress because project qualification is non-green; no threshold/allowlist, production CLI, runtime, signer, model or external change was introduced.

Mechanical receipt readback passes: candidate/patch/preimage hashes, unchanged RED helper, actual TAP visibility controls (both exit 1), raw TAP counts, gate147 refusal, proof command exits and scratch rollback all agree. All slice acceptance evidence is recorded; project qualification remains non-green and task stays In Progress. No independent reviewer or external immutable seal exists.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
One-file test-helper stdout evidence improvement is implemented and locally verified. Repository qualification remains blocked at native branch coverage gate147; no original CLI root-cause repair or Node0 closure is claimed. Evidence, rollback patch and unsigned partial receipt are retained under .artifacts/audits/dema-assets-cli-diagnostic-20261015.
<!-- SECTION:FINAL_SUMMARY:END -->
