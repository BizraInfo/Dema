---
id: TASK-009
title: 'First-run wizard: dema first-run'
status: Done
assignee: []
created_date: '2026-07-18 03:37'
updated_date: '2026-07-19 02:31'
labels:
  - later
  - product-proof
dependencies: []
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
PLANNED row CURRENT_LIMITS:164; spec exists docs/FIRST_RUN_WIZARD.md (welcome->setup->status->doctor). Closes the 'no coding required' README gap (100 CLI commands today). GoT G5, screen-verified.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Disk verification 2026-07-19: dema first-run is ALREADY SHIPPED on origin/main — apps/cli/src/commands/first-run.js dispatched (index.js:35), composes welcome→setup→status→doctor per spec docs/FIRST_RUN_WIZARD.md, tests/first-run.test.js 15/15 green, live smoke 'dema first-run --dry-run --json' exit 0. The only gap was doc drift: CURRENT_LIMITS PLANNED table still said 'command pending' — removed in commit b58f5ec on docs/first-run-row-truth-1a (no-overclaim 0, doc-freshness OK, integration-check 0). Branch queues for push wave.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Verified the first-run wizard already shipped and works (15 tests + live smoke); closed the remaining gap — the stale 'command pending' PLANNED row — via doc-truth commit b58f5ec.
<!-- SECTION:FINAL_SUMMARY:END -->
