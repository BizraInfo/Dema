---
id: TASK-075.20
title: P1 secret-safe estate-map payload and session capture exclusion
status: Done
assignee:
  - '@codex'
created_date: '2026-08-23 21:02'
updated_date: '2026-08-25 11:35'
labels:
  - security
  - review-followup
  - estate-map
dependencies: []
modified_files:
  - packages/core/src/node0-estate-map.js
  - tests/node0-estate-map.test.js
  - docs/02-architecture/NODE0_ESTATE_MAP_0A.md
  - .gitignore
parent_task_id: TASK-075
priority: high
type: bug
ordinal: 67000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Resolve the P1 review findings without expanding the COMPONENT-only estate-map boundary: never serialize rejected secret-bearing input into a content-addressed estate-map payload, and prevent generated root-level Codex session captures from entering source control.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A secret-bearing rejected descriptor is not present in the returned payload, its content hash, or JSON serialization.
- [ ] #2 Normal valid estate-map payloads remain independently rederivable and verifiable.
- [ ] #3 Focused tests cover the rejected-secret regression and existing payload verification.
- [ ] #4 Root-level generated codex-session captures are ignored and the reviewed capture is removed from the worktree.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reuse the repository secret-field detector and reduce rejected inputs to a deterministic safe refusal payload. 2. Add one regression test that scans the payload serialization and hash for the supplied synthetic secret. 3. Ignore root-level session captures, remove the reviewed untracked capture, and run focused plus repository checks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Focused regression now proves both output and rehashed forged payloads cannot carry a rejected secret-bearing input. The payload omits all caller input and verifier rederivation requires input separately. Added root-level session capture ignore and moved the reviewed transcript to system trash.

Verification: focused estate-map test passed (5/5); canonical JSON check, npm test (9563 pass, 0 fail, 4 skipped), llm guidance, and git diff --check passed. npm run check remains red only because its aggregate coverage process once hit an intermittent node0-recovery-proof.mjs JSON read race (RCA-02); the exact coverage-instrumented recovery test passed 5/5. No recovery-system change was made; task stays In Progress pending a scoped decision.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Closed by measurement: all four ACs landed at 9975f06 (estate-map secret-exclusion kernel, regression test, .gitignore /codex-session-*.md, capture removed). The only holdout — RCA-02 intermittent recovery-proof JSON read race under the coverage aggregate — classified INWARD/NOT-REPRODUCED-AT-CURRENT-BYTES with 8 bounded observations today (3 full npm run check aggregates exit 0 containing coverage gate scripts/check.mjs:176 + 5/5 plain producer runs RECOVERY_AFTER_EXIT_PROVEN). Receipt: docs/audits/RCA02_FLAKE_CLASSIFICATION_0A.md. Residual risk named; recurrence rule pinned (real-signal-first, atomic-read repair inward, never classifier weakening).
<!-- SECTION:FINAL_SUMMARY:END -->
