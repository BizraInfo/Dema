---
id: TASK-075.08
title: PROD-07 — OPERATIONAL-CAMPAIGN-AND-PRODUCTION-SEAL-1A
status: To Do
assignee: []
created_date: '2026-08-21 21:22'
labels:
  - production
  - seal
  - soak
  - adversarial
  - urp
dependencies:
  - TASK-075.07
parent_task_id: TASK-075
priority: high
type: task
ordinal: 53000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Run the full operational closure campaign and seal NODE0_DEMA_PRODUCTION_ACTIVE if and only if the production closure equation is TRUE. Campaign includes adversarial failure injection, local URP proof, 72h isolated soak, and final evidence receipt. No truth label may become LIVE unless a production evidence adapter can derive the state from runtime observation. Live status is an observation, not a declaration.

Normative spec: NODE0_DEMA_PRODUCTION_CLOSURE_SPEC_v1_0.md @ b01b4b32e9e978287a97a6a3db6cd04fd02fc488 sha256:6ebb7a0dca40451eab030052dd267a1f5c5ad03f9b23ac13f8f34de695add840
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Adversarial campaign green for: PAT crash, SAT crash, model crash, gateway crash, Dema restart, host process restart, corrupt receipt, corrupt checkpoint, duplicate request, stale consent, expired consent, scope widening, wrong signer, wrong runtime identity, postcondition failure, model timeout, malformed model output
- [ ] #2 Local URP live and observed
- [ ] #3 72h local-only soak green
- [ ] #4 False green count = 0
- [ ] #5 No truth label becomes LIVE without production evidence adapter deriving state
- [ ] #6 Production closure equation evaluated with all terms TRUE or documented UNKNOWN
- [ ] #7 Any UNKNOWN makes the equation FALSE; seal does not proceed
- [ ] #8 Final evidence receipt bound to spec commit SHA
- [ ] #9 No Node1/2/3, federation, public URP, mobile, token economy, or PoI rewards introduced
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Adversarial campaign complete and green
- [ ] #2 72h soak complete and green
- [ ] #3 Production closure equation TRUE
- [ ] #4 NODE0_DEMA_PRODUCTION_ACTIVE sealed
- [ ] #5 authority_delta = 0
<!-- DOD:END -->
