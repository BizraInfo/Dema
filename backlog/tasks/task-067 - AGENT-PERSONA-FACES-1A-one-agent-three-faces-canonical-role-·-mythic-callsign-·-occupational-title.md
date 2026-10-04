---
id: TASK-067
title: >-
  AGENT-PERSONA-FACES-1A: one agent, three faces (canonical role · mythic
  callsign · occupational title)
status: Done
assignee: []
created_date: '2026-08-15 01:51'
updated_date: '2026-08-15 01:53'
labels: []
dependencies: []
ordinal: 42000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Presentation layer over the frozen AGENT-PROFILE-1A registry. Every canonical agent keeps ONE stable identity (agent_id/agent_role — what keys, receipts and consent bind to) and gains two display faces: mythic callsign (NEXUS/ORACLE/FORGE/JUDGE/CROWN/ATLAS/HERALD) and occupational title (O*NET-style). SAT referees deliberately keep canonical-only (a verifier wears no mask). Operator-designed 2026-08-15; occupation titles are DRAFT pending operator ratification and the offline O*NET snapshot. Presentation-only: never enters stable_profile_hash or the signing path.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Pure kernel packages/agents/src/agent-persona-faces.js maps all 7 PAT roles to 7 distinct mythic callsigns and draft occupation titles
- [x] #2 SAT-5 roles resolve canonical-only in every display mode
- [x] #3 resolvePersonaFace fails closed on unknown role and unknown mode
- [x] #4 Occupation titles carry DRAFT_PENDING_OPERATOR_RATIFICATION status; no invented O*NET codes
- [x] #5 Red-first test tests/agent-persona-faces.test.js green; docs/TESTING.md row added
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Red-first test file (module absent = red). 2. Implement pure kernel reusing CANONICAL_AGENTS export. 3. TESTING.md row. 4. Focused green + git diff --check. 5. Finalize.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verification: red-first observed (ERR_MODULE_NOT_FOUND, 1 fail) -> kernel implemented -> tests/agent-persona-faces.test.js 8/8 pass; regression tests/agent-profile-registry.test.js 28/28 pass (identity/signing untouched); kernel-purity-check 493 scanned 0 violations; docs/TESTING.md row added beside AGENT-PROFILE-1A; git diff --check clean. Occupation titles + callsign<->role pairing remain the operator's edit surface (DRAFT_PENDING_OPERATOR_RATIFICATION). O*NET codes deliberately absent until offline snapshot lands at /data/bizra/reference/onet/.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added AGENT-PERSONA-FACES-1A: pure presentation kernel giving each of the 12 canonical agents three faces (canonical role, mythic callsign, occupational title) with fail-closed resolution and honesty labels; verified by 8 new focused tests + 28-test registry regression + kernel-purity gate.
<!-- SECTION:FINAL_SUMMARY:END -->
