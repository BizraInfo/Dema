---
id: TASK-079
title: >-
  DEMA-PRESENCE-0A REALM-SHELL: one-way Node0 truth projection into the desktop
  (ICD BIZRA-DRS-ICD-0A)
status: To Do
assignee: []
created_date: '2026-08-25 08:27'
updated_date: '2026-08-25 08:28'
labels:
  - realm-shell
  - presence
  - projection
  - spec-driven
dependencies: []
priority: high
ordinal: 70000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement BIZRA-DRS spec set (PRD/TRD/SDD/DSD/ICD v0.1, 25 Aug 2026): project real Node0 state into one read-only Omarchy/Quickshell presence surface. LAW: UI projection != authority; every envelope carries authority_delta==0; UNKNOWN is first-class; current reality outranks cache; simulated != production; forged VERIFIED_DONE refused without mission_id + evidence_refs. JS pure kernels live in this repo; the Rust presence service, wrapper and QML plugin live OUTSIDE at /data/bizra/realm-shell. Any long-running process is gated behind an explicit operator GO. IF-R1 (interaction channel) RESERVED, NOT IMPLEMENTED.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 #1 IF-01 wire law frozen as pure kernel with conformance tests C01-C20 + golden scenarios G-01..G-05
- [ ] #2 #2 Presence reducer v2 covers the 11-state semantic set with state-specific evidence constraints
- [ ] #3 #3 Fixture publisher harness marks simulated:true end to end; SIMULATED_FIXTURE can never satisfy production qualification
- [ ] #4 #4 /data/bizra/realm-shell workspace: Rust presence-service FSM + AF_UNIX listener per ICD framing/admission laws
- [ ] #5 #5 Wrapper + QML plugin contracts: async ping/update_presence/hide_presence only; forbidden authority verbs absent
- [ ] #6 #6 Host conformance spike O01-O10 pins the real Omarchy revision; wrapper stays HOST_BINDING_PENDING until measured
- [ ] #7 #7 Package descriptor + verifier produce A1-A20 verdicts limited to PASS|REFUSE|CONTRADICTED|UNKNOWN; authority_delta stays 0 globally
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 No daemon/runtime execution inside the Dema repo
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spec sources (operator-supplied 2026-08-25): /home/bizra-operating-system/Downloads/BIZRA_DEMA_Realm_Shell_{PRD_v0.1.docx,TRD_v0.1.docx,SDD_v0.1.md,DSD_v0.1.md,ICD_v0.1.md}. Drift rulings pinned in slice docs: TTL default 2500ms (heartbeat 1000ms); RealmShell trait = async ping/update_presence/hide_presence (show_presence dropped per DSD); RenderRequest uses i18n accessible_label_key; canonicalization = canonical-json-v1 (packages/canon) with committed golden vectors. Ladder context: G2 binding PROVEN, PROD-05 dual-plane seam PROVEN; Realm Shell is presentation rung, PROD-06 FATE effect remains campaign frontier after .01-.03 kernels.
<!-- SECTION:NOTES:END -->
