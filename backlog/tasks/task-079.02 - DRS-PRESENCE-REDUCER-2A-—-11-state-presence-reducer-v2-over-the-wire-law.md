---
id: TASK-079.02
title: DRS-PRESENCE-REDUCER-2A — 11-state presence reducer v2 over the wire law
status: Done
assignee: []
created_date: '2026-08-25 08:28'
updated_date: '2026-08-25 10:31'
labels:
  - realm-shell
  - kernel
  - reducer
dependencies:
  - TASK-079.01
parent_task_id: TASK-079
priority: high
ordinal: 72000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extend shipped DEMA-PRESENCE-1A eight-state machine to the ICD 11-state semantic set; reduce accepted RealmEvents into projection snapshots; enforce no-stale-success (TTL expiry degrades active-success states to OFFLINE/UNKNOWN); freshness classes Fresh/Aging/Stale/Disconnected; render-request derivation with i18n keys. Pure, DI-only.
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
DRS-PRESENCE-REDUCER-2A closed MEASURED: pure reducer over the frozen wire law (packages/core/src/drs-presence-reducer.js) — 15 tests incl. G-02 end-to-end; refused transcripts can only render UNKNOWN/OFFLINE; render-level evidence/mission blocks; null-not-zero telemetry; i18n keys + skin slots complete over 11 states; no-stale-success imported from contracts kernel. Ladder: focused 15/15, npm test 9666/0, check exit 0, guidance PASS (8 gates), diff-check clean.
<!-- SECTION:FINAL_SUMMARY:END -->
