---
id: TASK-060
title: 'REMOTE-WRITE-OBSERVATION-SCOPE-1A: prevent source scans from closing Node0'
status: Done
assignee: []
created_date: '2026-08-09 09:58'
updated_date: '2026-08-09 10:36'
labels: []
dependencies: []
references:
  - docs/LLM_SYSTEM_FLOW.md
modified_files:
  - packages/core/src/node0-remote-write-guard.js
  - apps/cli/src/node0-remote-write-gatherer.js
  - tests/node0-remote-write-guard.test.js
  - packages/core/src/node0-closure-invariants.js
  - tests/node0-closure-invariants.test.js
  - docs/TESTING.md
  - docs/CURRENT_LIMITS.md
priority: high
type: bug
ordinal: 35000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Correct the local remote-write guard so a narrow source-syntax scan cannot satisfy the deployment-level Node0 closure invariant. The current instrument excludes the shipped Next server declarations and TypeScript API routes, silently drops unreadable roots, and then emits remote_write=false despite explicitly disclaiming deployment coverage. Preserve commit history and the six unrelated untracked files; no runtime, identity, remote, or destructive action.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A source-only listener scan cannot emit a closure-grade remote_write=false observation.
- [x] #2 The shipped Next server declaration and API route surface is represented in the scan result or makes coverage explicitly incomplete; a clean JavaScript-only scan is not closure proof.
- [x] #3 Missing or unreadable roots and files produce incomplete or UNKNOWN evidence, never SATISFIED.
- [x] #4 Focused regression tests and repo-required checks pass with no unrelated files staged or modified.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add focused RED regressions for the shipped Next server surface and partial/unreadable roots. 2. Separate the narrow source capability report from the deployment-level closure invariant and keep remote_write UNKNOWN. 3. Update tests and narrow documentation/gate wiring only as required. 4. Run focused tests, required local gates, and independent review before closeout.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Root cause reproduced: the previous gatherer omitted package manifests and TypeScript routes, silently dropped unreadable roots, and emitted a broad closure observation from narrow source evidence. RED/GREEN completed for: source-only evidence keeps remote_write UNKNOWN; Next launch scripts and non-read routes are represented; partial scans surface coverage issues; report vocabulary is source-scoped. Live corrected scan: 907 artifacts, 9 patterns, 3 inbound declarations, closure ledger 0 SATISFIED / 10 UNKNOWN.

Final-byte verification before closeout: focused closure+scan tests 21/21; npm test 8634/8634, exit 0; npm run check exit 0 with complete gate evidence; npm run coverage exit 0 at 95.41% lines / 84.29% branches / 97.70% functions; npm run llm:guidance PASS; git diff --check clean. Live scan: 907 artifacts, 9 patterns, 3 declared inbound surfaces; compatibility adapter null; closure OPEN with 0 SATISFIED / 10 UNKNOWN. Independent pilot found no promotion path and requested one stale comment correction, now applied.

Independent review caught two direct bypasses: generic source wrapping at the closure consumer and Windows path separators. Added NCI-11 plus required deployment observation scope at the remote_write ledger edge, and RWG-12 plus separator-independent path matching. Removed unbound current scan counts from public docs and corrected stale terminology. Focused regression now 23/23.

Final post-review proof: focused 23/23; npm test 8636/8636, exit 0; npm run check exit 0 with aggregate complete evidence; coverage 95.41% lines / 84.31% branches / 97.70% functions, exit 0; guidance, integration, actuator, and diff checks pass. Independent re-review: APPROVE, no Critical or Important findings. Six unrelated pre-existing untracked files remain untouched and unstaged.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Reclassified the old remote-write guard as a bounded source-listener scan, kept source-only evidence below the Node0 closure boundary, required deployment-scoped provenance for the remote_write row, covered Next/TypeScript and Windows paths, and made partial reads fail closed. Verified with 23 focused tests, 8636 full tests, the full check graph, coverage thresholds, and independent review. No runtime, remote, identity, or destructive effect.
<!-- SECTION:FINAL_SUMMARY:END -->
