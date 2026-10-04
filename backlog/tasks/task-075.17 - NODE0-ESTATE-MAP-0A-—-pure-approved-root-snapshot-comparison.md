---
id: TASK-075.17
title: NODE0-ESTATE-MAP-0A — pure approved-root snapshot comparison
status: Done
assignee:
  - '@codex'
created_date: '2026-08-23 15:42'
updated_date: '2026-08-23 15:54'
labels:
  - composition
  - estate-map
  - metadata-only
  - authority-zero
dependencies: []
references:
  - docs/LLM_SYSTEM_FLOW.md
  - docs/02-architecture/POT_CLAIM_SCOPE_v0_1.md
  - packages/core/src/node0-space-index.js
  - packages/core/src/local-asset-awareness.js
modified_files:
  - packages/core/src/node0-estate-map.js
  - tests/node0-estate-map.test.js
  - docs/02-architecture/NODE0_ESTATE_MAP_0A.md
  - docs/CURRENT_LIMITS.md
  - docs/TESTING.md
  - scripts/review/canonical-json-v1-check.mjs
parent_task_id: TASK-075
priority: high
type: feature
ordinal: 64000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the minimum pure estate-map comparison kernel. It consumes caller-supplied approved-root registry and prior/current metadata-only observation descriptors, then derives canonical comparable state and a deterministic delta. It performs no scan, filesystem access, process/network/model/runtime/consent/receipt action. It must preserve UNAVAILABLE separately from deletion and remain only a COMPONENT proof surface.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The kernel accepts only caller-supplied approved-root registry and prior/current observation descriptors; malformed schema, unknown roots, and missing identities safely HOLD or REFUSE.
- [x] #2 Canonical comparison is deterministic for identical inputs and binds registry, root, and observation identities without raw paths or secrets.
- [x] #3 A current UNAVAILABLE observation is reported UNAVAILABLE and never as a removal or deletion.
- [x] #4 Incomplete or incomparable observations cannot claim an unchanged zero delta.
- [x] #5 The result can be independently rederived and verifies authority_delta = 0 with all boundary flags false.
- [x] #6 Focused tests cover baseline, unchanged, controlled metadata change, unavailable, restoration, malformed input, and non-effect boundaries.
- [x] #7 Documentation states COMPONENT scope only and excludes mission execution, receipts, recovery, VRO, runtime, provider, and model invocation.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reuse caller-supplied metadata-only observer snapshots; establish a red-first test for unavailable and incomplete states.
2. Implement only canonical normalization, deterministic comparison, and independent rederivation/verification with no scanner or side effects.
3. Document the COMPONENT-only proof boundary, run focused tests and the repository ladder, then close only on green evidence.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented a pure, content-addressed approved-root snapshot comparator. It deterministically classifies baseline, unchanged, changed, unavailable, incomplete, and restoration states; refuses malformed or unapproved inputs; and verifies all-false operational boundaries with authority_delta=0. Focused tests passed (25/25 with canonical regressions), npm test passed (9559 pass, 0 fail, 4 skipped), npm run check passed, npm run llm:guidance passed, and git diff --check passed. This remains COMPONENT-only: no source root scan, runtime, provider/model invocation, receipt minting, recovery, mission, VRO, or Node0 closure claim.
<!-- SECTION:FINAL_SUMMARY:END -->
