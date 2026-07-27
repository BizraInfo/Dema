---
id: TASK-011
title: Dema UI data-truth rebind (roster/numbers/wiring vs canon)
status: Done
assignee: []
created_date: '2026-07-18 06:21'
updated_date: '2026-07-18 08:31'
labels:
  - later
  - ui
dependencies: []
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Full audit done 2026-07-18: /data/bizra/research/ui-audit-CONSOLIDATED-2026-07-18.md. GUI approved; data layer is fiction. P0 diagnostic.ts+melae.ts impersonate shipped kernels; P1 roster (12+11 invented vs 7PAT+5SAT+alpha, no team/serves); P2 dead controls; P3 i18n 3/33; P4 invented sequences. Bind to canon.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PRE-INTEGRATION QUALIFICATION PASSED (DEMA-UI-DONOR-TRUTH-TELEMETRY-0A). All 3 blockers cleared + independently re-verified: tsc=0, tests=35/35, next build=0 (fonts self-hosted, zero build egress), P0 impersonations removed, fleet 7+5+alpha canon, telemetry observation-only+redacted+22 adversarial tests. Qual copy: /data/bizra/worktrees/dema-ui-donor-truth-telemetry-0a. Card: /data/bizra/logs/dema-ui-donor-truth-telemetry-0a/QUALIFICATION_CARD.md. UNCOMMITTED — donor still untracked; needs chosen integration home + commit identity. NO push/PR.
<!-- SECTION:NOTES:END -->
