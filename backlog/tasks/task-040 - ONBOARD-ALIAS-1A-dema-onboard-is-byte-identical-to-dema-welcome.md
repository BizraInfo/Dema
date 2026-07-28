---
id: TASK-040
title: 'ONBOARD-ALIAS-1A: dema onboard is byte-identical to dema welcome'
status: Done
assignee: []
created_date: '2026-07-28 07:32'
updated_date: '2026-07-28 10:10'
labels:
  - cli
  - ux
  - onboarding
dependencies: []
references:
  - apps/cli/src/commands/onboard.js
  - packages/core/src/onboarding-lifecycle.js
  - packages/core/src/help-topics.js
priority: high
type: bug
ordinal: 40000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Measured 2026-07-28 on a clean DEMA_HOME: `dema onboard` and `dema welcome` produce BYTE-IDENTICAL output (verified by diff, no differences). But `dema help orientation` advertises them as two different capabilities:

    dema welcome   -> "Show the first-run orientation"
    dema onboard   -> "Guided zero-technical onboarding path; preview-only"

So the guided zero-technical path a nontechnical operator is told exists does not exist. They run it and get the same wall of orientation text, which is the opposite of guided.

The real guided path already has a kernel. `dema onboarding-lifecycle` (packages/core/src/onboarding-lifecycle.js) emits a 7-stage flow with a language picker (ar/en/fr/es/ur), technical_level, and candidate name/ordinal/node_label fields. `dema onboard` does not use it.

Recommended fix, smallest first: have `dema onboard` render the onboarding-lifecycle stages human-readably rather than duplicating welcome. Dema is one-shot with no prompting except exact-string consent, so this is a PATH PREVIEW the operator reads and follows, not an interactive wizard — same posture as `dema diagnostics plan`. That reuses an existing kernel and needs no new state.

This is the third instance found in one clean-home walkthrough of a single pattern: Dema help/hint text promises more than the command delivers. The other two were the `dema doctor` BLOCKED-gate fix pointing at `dema setup` (which cannot move the gate) and `dema doctor` advertising `dema explain doctor` when that answered "I do not have a definition yet". Both are now closed. Worth considering a review gate that binds advertised capability text to actual command behaviour, since three of three checked promises were false.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 dema onboard is no longer byte-identical to dema welcome
- [ ] #2 dema onboard surfaces the onboarding-lifecycle 7-stage path, or its help text is corrected to stop promising a guided path it does not provide
- [ ] #3 A test asserts onboard and welcome outputs differ, so the alias cannot silently return
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Closed by commit on fix/doctor-first-run-truth-1a. onboard now renders the 7-stage onboarding-lifecycle as a path preview; welcome unchanged. Two defect-encoding tests updated and noted; boundary test strengthened from 2 sampled keys to all 16. 4 new tests red-first. Suite at measured baseline 7.
<!-- SECTION:NOTES:END -->
