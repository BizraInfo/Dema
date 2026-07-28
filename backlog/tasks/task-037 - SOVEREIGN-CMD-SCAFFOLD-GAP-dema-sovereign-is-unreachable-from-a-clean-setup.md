---
id: TASK-037
title: 'SOVEREIGN-CMD-SCAFFOLD-GAP: dema sovereign is unreachable from a clean setup'
status: To Do
assignee: []
created_date: '2026-07-28 05:24'
labels:
  - cli
  - ux
dependencies: []
references:
  - apps/cli/src/commands/sovereign.js
priority: medium
type: bug
ordinal: 37000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`dema sovereign` is advertised in `dema help tasks` as "Render local Sovereign Mission Interface (view-only)", but on a fresh DEMA_HOME created by `dema setup` it exits 1 with:

  dema sovereign: scaffold not found: $DEMA_HOME/kernel/sovereign_tui/sovereign.py

`dema setup` creates receipts/, memory/, logs/, skills/, profile.json, config.local.json and .dema-root.json — it does not create kernel/sovereign_tui/, and no help text tells the operator where that Python scaffold comes from or that it lives outside this repo.

The failure itself is honest (clear message, nonzero exit, no false claim), so this is a discoverability/lifecycle gap rather than a truth defect: a command listed in the primary help surface can never succeed for any operator who followed the documented first run. Either the help entry should state the external prerequisite, or the command should refuse with a routing hint the way other gated surfaces do.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 dema sovereign either states its external prerequisite in help/refusal text, or the help entry marks it as requiring an out-of-repo scaffold
- [ ] #2 A fresh `dema setup` followed by `dema sovereign` leaves the operator with an actionable next step, not a bare missing-path error
<!-- AC:END -->
