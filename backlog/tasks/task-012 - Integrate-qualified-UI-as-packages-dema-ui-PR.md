---
id: TASK-012
title: Integrate qualified UI as packages/dema-ui (#PR)
status: Done
assignee: []
created_date: '2026-07-18 08:37'
updated_date: '2026-07-18 11:54'
labels:
  - now
  - ui
dependencies: []
ordinal: 12000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Committed 225d1d5fe19339e7b002da7ebca6f8b725c31c3c on feat/dema-ui-package (from main ab61aa3). 204 UI files + .gitignore + ADR-046. Qualification DEMA-UI-DONOR-TRUTH-TELEMETRY-0A passed. Constitutional gates verified passing WITH package present (zero-dep root-scoped, kernel-purity/no-overclaim/canonical-json/style-pillar green, 0 not-ok reference dema-ui). node_modules/.next NOT committed (verified 0). Push+PR = operator terminal (npm run check green precondition); body /data/bizra/logs/dema-ui-donor-truth-telemetry-0a/pr-body-dema-ui.md.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
MERGED clean: #404 dema-ui -> main c047b4e on exact head a156120 (the CLEANED commit). Post-merge verified: dema-ui on main has 0 private-data leaks, 0 .zscripts, 0 p*.json. Two security corrections landed (raw HOME path -> runtime resolve; 18 donor-debris files removed). The leaky c090bc7 did NOT land (--match-head-commit safety net). Season lesson: verify remote PR head + real-terminal check before merge; sandbox env-failures mask real ones.
<!-- SECTION:NOTES:END -->
