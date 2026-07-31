---
id: TASK-032
title: >-
  DOCTOR-EXIT-CONTRACT-1A: preserve why unbridged doctor exits non-zero (record
  recovery)
status: Done
assignee:
  - '@claude'
created_date: '2026-07-31 00:46'
updated_date: '2026-07-31 00:46'
labels:
  - doctor
  - truth-gate
  - regression-guard
dependencies: []
priority: high
type: task
ordinal: 32000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
RECORD RECOVERY, not new code. The doctor honesty work landed on ops/first-witness-d2 (verified on disk: expected/⏸ status, previewNote, doctorState, --preview, runtime_not_bridged, 51/51 tests) but its task records did not survive the carve — the backlog on this branch stops at TASK-030, and the work was committed under the T-036 message. The reasoning below now exists only in test comments, and it is the piece most likely to be 'simplified' back into a false GREEN by someone reading only the calm output.

THE CONSTRAINT THAT MUST NOT REGRESS: the display softening and the exit code are different channels and must not be collapsed again. An earlier revision softened the display AND flipped the default exit to 0, which let any script wrapping `dema doctor` read healthy off a node with no runtime bridged, no readiness, and a BLOCKED activation gate. Humans read stdout — calm ⏸ rows, no ❌, an explicit 'Nothing is broken' line. Machines read $? — non-zero until actually operational. `--preview` is the opt-in that asks the narrower question and exits 0.

FAIL-CLOSED SIGNAL: softening is granted ONLY on an explicit `status.adapter.available === false`. A gateway-http payload carries no adapter field at all, and absent must never read as unbridged, or a real outage would launder itself into 'expected'.

REGRESSION GUARD: a BRIDGED runtime (adapter.available true) reporting the same BLOCKED/false values keeps status=fail, keeps its fix text, still prints ❌, and still reads Verdict: blocked. Those tests were green before the kernel changed — they are the reason the softening cannot hide an outage.

INVARIANT: doctorState().operational === (doctorVerdict() === 'ready and consent-gated') across every status fixture. This closed a pre-existing disagreement where a warn-only state printed Verdict: blocked while the process exited 0.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The exit code answers 'is this node operational?' — unbridged is not operational and exits non-zero
- [x] #2 --preview asks 'is the preview shell intact?' and exits 0 on the same home
- [x] #3 Softening is fail-closed on an explicit adapter.available === false; absent never softens
- [x] #4 A bridged-but-failing runtime stays red at exit 1
- [x] #5 doctorState().operational is bound by test to doctorVerdict() === 'ready and consent-gated'
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
No code changed — this record recovers reasoning that the carve dropped. Verified the landed behaviour on ops/first-witness-d2 by execution: `node bin/dema doctor` on a fresh DEMA_HOME exits 1, `node bin/dema doctor --preview` on the same home exits 0, and tests/doctor-dashboard{,-cli}.test.js are 51/51 green. All five constraints are already enforced by tests in the tree; this task exists so the next reader knows WHY before changing them.
<!-- SECTION:FINAL_SUMMARY:END -->
