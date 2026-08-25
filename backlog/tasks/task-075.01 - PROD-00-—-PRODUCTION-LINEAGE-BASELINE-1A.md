---
id: TASK-075.01
title: PROD-00 — PRODUCTION-LINEAGE-BASELINE-1A
status: Done
assignee:
  - '@codex'
created_date: '2026-08-21 21:09'
updated_date: '2026-08-22 03:21'
labels:
  - production
  - baseline
  - repair
dependencies: []
parent_task_id: TASK-075
priority: high
type: task
ordinal: 46000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Establish one clean, current, green production baseline on the 815ef107 lineage before new Node0 production integration begins. Controlled reproduction must distinguish exact-815 behavior, failures introduced by the production spec, and host-state-revealed test defects. Re-derive only the minimum valid repairs; do not wholesale cherry-pick 5961e03 and do not add feature work while the baseline evidence contract is inconsistent.

Normative sealed spec object: NODE0_DEMA_PRODUCTION_CLOSURE_SPEC_v1_0.md @ b01b4b32e9e978287a97a6a3db6cd04fd02fc488 sha256:6ebb7a0dca40451eab030052dd267a1f5c5ad03f9b23ac13f8f34de695add840. Any correction must preserve these sealed bytes and use a bounded, hash-linked erratum.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Reproduce the reported five failures under controlled isolated and host-observation modes; exact-815 must be reported from measured exact-815 bytes, never inferred from a descendant
- [x] #2 For every reported failure record test/gate, exact failure, classification, root cause, governing invariant, 5961 related hunk if any, minimum repair, positive control, and negative control
- [x] #3 No wholesale cherry-pick of 5961
- [x] #4 No production feature work while the baseline evidence contract is inconsistent
- [x] #5 Port only repairs whose invariant is independently re-derived
- [x] #6 Re-run focused RED to GREEN test after each repair
- [x] #7 npm test = 0 fail, npm run check = 0, npm run llm:guidance = 0, git diff --check = 0 on exact final bytes under a documented isolated environment
- [x] #8 Re-test current atomic nonce behavior; TASK-017 Done does not settle it
- [x] #9 Reproduce PR #451 mission-health routing defect on current 815; if absent classify SUPERSEDED_BY_CURRENT_EVIDENCE, if present re-derive the minimum fix
- [x] #10 Production organ map binds every PROD-01..07 requirement to an existing authority/state owner or a precisely named missing integration edge; existing-but-unqualified is not MISSING
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Clean baseline comparison begins from exact 815ef107 bytes and records the exact tree
- [x] #2 All five reported failures are individually classified without attributing descendant or host-state failures to exact-815
- [x] #3 Each applied repair has a RED witness, positive control, and negative control
- [x] #4 No unrelated 5961 behavior imported
- [x] #5 No shared remote ref changed
- [x] #6 authority_delta = 0
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Restore the v1.0 spec to its sealed bytes and add only the minimum hash-bound erratum/guard needed for truthful canon and organ classification. 2. Make closure-gate tests hermetic while preserving the host-observation CLI path; retain the valid key-store seam repair. 3. Reproduce exact-815, post-spec-parent, host-state, nonce, and PR-451 controls. 4. Run final gates on exact candidate bytes with isolated HOME/DEMA_HOME provenance. 5. Emit an UNSIGNED evidence receipt unless a real signature is produced, then finalize only proven criteria.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-08-22: prior wording that exact-815 inherited five failures is preserved here as SUPERSEDED_BY_CONTROLLED_REPRODUCTION. Current evidence: exact-815 targeted relevant tests 38/38 green in isolation; two canon failures were introduced by the added spec; two NCG failures plus one key-store failure were revealed by shared operator state. No acceptance criterion is marked complete by this task correction.

2026-08-22 final evidence: candidate 4566e1e4c82b2f8a496e137a69eb00c9db1d84a3 tree 8e1c7f8b206f475f5b3583ff8956e9c1fa29119a. Controlled fresh archives: exact-815 38/38 isolated, 35/38 operator; post-spec 4842ff2 36/38 isolated, 33/38 operator; b66153b 38/38 both. Final isolated gates: npm test 9500 total / 9497 pass / 0 fail / 3 skipped; check 0; llm:guidance 0; diff-check 0. Atomic nonce 26/26 on exact-815 and final candidate. PR-451 dispatch SUPERSEDED_BY_CURRENT_EVIDENCE: 9/9 plus dry-run exit 0, saved=false. Existing organ map covers PROD-01..07. Evidence root: /data/bizra/node0-production-closure/prod00/4566e1e4c82b2f8a496e137a69eb00c9db1d84a3/. Receipt is UNSIGNED; authority_delta=0; no remote ref changed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Restored the immutable spec seal, added its hash-linked erratum, made closure tests hermetic without opening the production boundary, retained the correct active-keypair injection seam, and bound every acceptance item to controlled lineage, nonce, dispatch, organ-map, and isolated-gate evidence at candidate 4566e1e4. No production feature behavior or shared remote ref changed.

Machine-verifiable UNSIGNED receipt sha256: 89a11fa193f3e7781118df97754b771f87efe09a0e9ad3797e9295a517d78ab9.
<!-- SECTION:FINAL_SUMMARY:END -->
