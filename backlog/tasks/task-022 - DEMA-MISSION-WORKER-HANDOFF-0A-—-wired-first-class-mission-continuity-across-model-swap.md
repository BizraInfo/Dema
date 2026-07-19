---
id: TASK-022
title: >-
  DEMA-MISSION-WORKER-HANDOFF-0A — wired first-class (mission continuity across
  model swap)
status: Done
assignee: []
created_date: '2026-07-19 15:53'
updated_date: '2026-07-19 17:04'
labels: []
dependencies: []
ordinal: 22000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Third-worker (GPT) authored the kernel/test/gate/docs (bundle at ~/Downloads/Dema/dema-mission-worker-handoff-0a). I verified it against the REAL realm kernel and wired the 4 missing integration points. Complement to NODE0-MODEL-SWAP-INVARIANCE-1A: that proves the verdict is model-blind; this proves the mission STATE survives a worker/model swap (recorded as one hash-chained MISSION_CHECKPOINT in the existing Node0 realm log).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 28 tests green against the REAL node0-realm-state-kernel (event-hash/state.head/missions/checkpoint-payload shapes all verified to match)
- [ ] #2 wired: registry row + count 69->70, CURRENT_LIMITS [PREVIEW_ONLY], TESTING row+cmd, check.mjs gate
- [ ] #3 npm run check adds zero new failures (exit1 = known sandbox-basename set only); handoff gate runs green inside check.mjs
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Committed 0ff5399 on feat/dema-mission-worker-handoff-0a (off efc2b43, merges CLEAN). Registry-count interaction with model-swap-invariance + steward (all 69->70): serial re-bump on merge. HONEST CORRECTION LOGGED: my first assessment falsely accused the worker's receipt of overclaiming 28-vs-23 (I anchored on a stale mid-log number instead of running it) and falsely claimed the bundle wasn't on disk — both wrong; the receipt's 28/28 is accurate, verified by running against the real kernel. Kept truth_label PREVIEW (honest): no persistence, worker selection, model invocation, or independent anchor.

2026-07-19: 0ff5399 qualified vs main efc2b43 — merge CLEAN, 46/46 focused green, slice gate blocked_by []. Rebase+requalify after model-swap lands (registry conflict).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Verified + wired the third worker's mission-worker-handoff slice to first-class: 28/28 against the real kernel, all 4 integration points, all gates green, merges clean. Model-swap continuity now proven from both sides (verdict-invariance + state-continuity). Commit 0ff5399.
<!-- SECTION:FINAL_SUMMARY:END -->
