---
id: TASK-075.03
title: PROD-02 — DEMA-RUNTIME-OBSERVATION-AND-EXECUTION-TRANSPORT-1A
status: To Do
assignee: []
created_date: '2026-08-21 21:20'
updated_date: '2026-08-25 02:42'
labels:
  - production
  - dema
  - status
  - execution-transport
dependencies:
  - TASK-075.02
parent_task_id: TASK-075
priority: high
type: task
ordinal: 48000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Bind Dema status and mission execution to actual Node0 runtime observation. Dema must derive runtime identity, health, mission state, receipt head, and recovery state from real runtime endpoints. Execution transport must carry bounded mission work from supervisor to runtime and back without mutating the mission contract. A fabricated status command must not be able to produce production-ready state.

Normative spec: NODE0_DEMA_PRODUCTION_CLOSURE_SPEC_v1_0.md @ b01b4b32e9e978287a97a6a3db6cd04fd02fc488 sha256:6ebb7a0dca40451eab030052dd267a1f5c5ad03f9b23ac13f8f34de695add840
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Dema status derives runtime identity from /principal/status or equivalent observation
- [ ] #2 Dema status derives runtime health from real health endpoint
- [ ] #3 Dema status derives model provider/identity from observed broker route
- [ ] #4 Dema status derives mission state from Mission Supervisor
- [ ] #5 Dema status derives receipt head from receipt store
- [ ] #6 Dema status derives recovery state from recovery checkpoint
- [ ] #7 No hardcoded production-green literals
- [ ] #8 Execution transport carries mission_id, contract_hash, execution_id, eligible_action, bounded_input, authority_ceiling_reference, consent_fate_references
- [ ] #9 Execution transport returns execution_id, worker_identity, typed_result, observed_side_effects, runtime_receipt_reference, failure_code
- [ ] #10 Runtime MUST NOT mutate mission contract
- [ ] #11 Kill runtime individually; Dema detects loss and recovers truthfully
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 DEMA_BOUND_TO_NODE0 proven with runtime observation
- [ ] #2 Execution bridge live with typed request/response
- [ ] #3 authority_delta = 0
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-08-25 G2 DEMA TRUTH BINDING: PROVEN. Three-cycle proof at bf1a6ba: LIVE(source=gateway-http-composed,truth=MEASURED_PARTIAL,missionExecuted=true) -> KILL -> DEAD(truth=DEGRADED,consoleReady=false,findings contain health-unreachable) -> RESTART -> RECOVERED(truth=MEASURED_PARTIAL restored,missionExecuted=true). No stale GREEN, no fabricated state, no config fallback. Receipt: G2-DEMA-TRUTH-BINDING-RECEIPT.json sha256 490ea2e0.
<!-- SECTION:NOTES:END -->
