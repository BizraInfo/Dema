---
id: TASK-075.03
title: PROD-02 — DEMA-RUNTIME-OBSERVATION-AND-EXECUTION-TRANSPORT-1A
status: In Progress
assignee:
  - '@codex'
created_date: '2026-08-21 21:20'
updated_date: '2026-08-26 15:45'
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Preserve the active Homebase worktree and keep the implementation diff isolated at its exact base. 2. Replace only the count-only Node0 status route with a local-only observer of existing gateway health and principal-status contracts; propagate UNAVAILABLE, ABSENT, and VERIFIED truth without a hardcoded production-green or PAT-live literal. 3. Add focused adapter tests and run focused plus repository checks. 4. Do not start a gateway, alter identity, invoke a model, or use public network. A direct later user instruction to make Dema active locally permits only compile/restart of the existing loopback Homebase service after a successful build. 5. After PROD-01 identity is green under separate exact authorization, extend this same observation path to mission, receipt, recovery, and loss/recovery proof.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-08-25 NODE0-REALM-SSE-COMPOSITION-1A landed (uncommitted): the JOIN proven — SSE envelope-stream transport law + DRS frame/wire law + presence reducer composed into one pipeline over real serialized SSE text; 10 join-law tests; layer-tagged refusals (sse:/sse-chain:/frame:/realm:) degrade render to UNKNOWN never stale-success; simulated survives end-to-end; join ceiling measured (chain owns non-object payloads before frame layer); gate wired into npm run check; registry row #88. Serves PROD-02 client contract + TASK-079.04 acceptance oracle.

2026-08-26 direct closure rebind: the active dema-homebase.service is running from /data/bizra/worktrees/node0-local-runtime-1a at 4c264556 with user-owned tracked and untracked changes. Its current /api/node0-state route counts local JSON and emits PAT active=0 / NOT_LIVE; it does not observe the Node0 gateway. Port 7421 is currently unbound. This task begins with the minimal truthful observation bridge only; it cannot close PROD-01 identity or fabricate PAT liveness.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @codex
created: 2026-08-26 14:27
---
Starting only the existing PROD-02 observation bridge. The live dirty Homebase worktree will be preserved; implementation occurs in an isolated clean worktree. No runtime activation, principal action, model, network, or deploy occurs in this code slice.
---

author: @codex
created: 2026-08-26 15:45
---
PROD-02 observation bridge is implemented and live-served. Clean source: /data/bizra/worktrees/node0-dema-binding-4a. Focused gateway adapter: 20 pass/0 fail; preview signing: 24 pass/0 fail; repository npm test: 8,800 pass/0 fail; npm run check: exit 0; llm guidance: PASS; diff check: PASS. Direct later user instruction authorized only the existing Homebase service build/restart: dema-homebase.service is active on 127.0.0.1:3000. GET /api/node0-state returns schema bizra.dema.node0_status.v0.2 and truth_label DEGRADED: gateway 127.0.0.1:7421 unreachable; principal UNAVAILABLE/null; local task=1 and memory=16. Port 7421 remains unbound. No Node0 gateway start, principal action, model invocation, public network, GitHub/Drive write, push, merge, mint, federation, or authority increase. No PROD-02 AC is checked: there is no live Node0 runtime or identity. Remaining hard gate: TASK-075.02 AC #5 requires independently authorized, externally signed principal activation.
---
<!-- COMMENTS:END -->
