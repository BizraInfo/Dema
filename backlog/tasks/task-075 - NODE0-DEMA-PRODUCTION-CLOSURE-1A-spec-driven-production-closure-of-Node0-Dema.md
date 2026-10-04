---
id: TASK-075
title: >-
  NODE0-DEMA-PRODUCTION-CLOSURE-1A: spec-driven production closure of Node0 +
  Dema
status: In Progress
assignee: []
created_date: '2026-08-21 18:18'
updated_date: '2026-08-25 17:40'
labels:
  - production
  - closure
  - spec-driven
  - first-human-node0
dependencies: []
priority: high
ordinal: 45000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
MISSION: NODE0-DEMA-PRODUCTION-CLOSURE-1A. Convert the existing Node0/Dema proof architecture into one spec-defined, test-defined, production execution path for one human on one local Node0. SUCCESS IS NOT: a preview, a simulation, a docs-only clean-state journey, an accounting role, a fake status bridge, a model fixture, an injected worker result, an unmerged PR, green unit tests without runtime execution. SUCCESS IS: Mumu gives Dema one bounded goal once; Dema persists that mission; a real local runtime receives it; a real model-backed PAT performs bounded reasoning; an independent SAT verifies/challenges it; FATE controls consequential authority; a real reversible effect occurs; the world state is independently observed; a trusted receipt binds the transition; the processes can die; the same mission resumes without duplicate effects or widened authority; Dema reports the recovered state truthfully. NETWORK: LOCAL NODE0 ONLY. NODE1: FORBIDDEN UNTIL PRODUCTION CLOSURE. FEDERATION: FORBIDDEN. TOKEN/ECONOMY: FORBIDDEN. AUTHORITY_DELTA: MUST REMAIN 0.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 PROD-00 integration baseline: one coherent current-lineage production tree (PRODUCTION_BASE_SHA known, REQUIRED_PORTS identified, SUPERSEDED_BRANCHES identified, DEFERRED_FEATURES identified, MISSING_PRODUCTION_BEHAVIOR identified, zero unexplained duplicate implementations, zero shared-ref mutation)
- [ ] #2 PROD-01 real persistent Node0 runtime: real PID + real localhost endpoint + real persisted state + kill/restart proof (NODE0_RUNTIME_ALIVE)
- [ ] #3 PROD-02 Dema status + execution bridge: dema status, doctor, mission execution, receipt retrieval, runtime loss, runtime restoration all derive from actual runtime state (DEMA_BOUND_TO_NODE0); a fabricated status command cannot produce production-ready state
- [ ] #4 PROD-03 real local model: provider_process_observed + exact_model_identity_observed + direct_probe_passes + broker_probe_passes + Dema_observation_matches; stop provider -> Dema non-model-ready; restart provider -> recovery; no hardcoded model-health literal
- [ ] #5 PROD-04 MISSION-RUNTIME-0B live conduction: 0A supervisor -> eligible action -> LIVE WORKER ADAPTER -> real worker result -> typed event -> 0A supervisor; worker contract mutation/verdict/wider-authority refused; worker timeout bounded; malformed model response refused; worker replacement same contract_hash
- [ ] #6 PROD-05 one real PAT + one independently invoked SAT: PAT_LIVE_COUNT=1, SAT_LIVE_COUNT=1; PAT proposes, SAT independently evaluates; neither holds commitment authority
- [ ] #7 PROD-06 FATE + real reversible effect + observation + trusted receipt: proposal -> verification -> FATE -> STAGED -> effect -> independent observation -> COMMITTED -> receipt; exactly-once/replay behavior (crash after effect before receipt never performs effect twice); signer integrity resolved (ACTIVE_SIGNER empirically established)
- [ ] #8 PROD-07 operational closure: restart, soak, failure campaign, production seal; adversarial campaign green (PAT crash, SAT crash, model crash, gateway crash, Dema restart, host process restart, corrupt receipt, corrupt checkpoint, duplicate request, stale consent, expired consent, scope widening, wrong signer, wrong runtime identity, postcondition failure, model timeout, malformed model output); 72h local-only soak green; authority_delta == 0
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 NODE0_DEMA_PRODUCTION_ACTIVE: production_lineage_coherent AND runtime_alive AND runtime_persistent AND Dema_runtime_bound AND execution_bridge_live AND model_live AND mission_persistent AND real_PAT_live AND independent_SAT_live AND FATE_binding AND bounded_effect_real AND postcondition_independent AND signer_trusted AND receipts_complete AND replay_exact AND recovery_exact AND no_duplicate_effects AND local_URP_live AND adversarial_campaign_green AND 72h_soak_green AND authority_delta == 0
- [ ] #2 npm test GREEN is necessary but insufficient
- [ ] #3 Truth labels (PAT-7/SAT-5/DEMA_ALPHA) become LIVE only when a production evidence adapter can DERIVE the state; live status is an observation, not a declaration
- [ ] #4 NODE0_DEMA_PRODUCTION_CLOSURE_SPEC_v1.0 authored BEFORE production integration
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-08-25 wording ruling applied: correlation contract status is IMPLEMENTED_LOCAL / TESTED_LOCAL / HOST_OBSERVED / UNCOMMITTED / NOT_CANONICAL — 'landed' was rejected by operator audit; canonicalization proceeds via G6-CANONICAL-PROMOTION-1A candidate (verifier v0.2: candidate-scoped aggregate in fresh clone, declared scaffold exclusions, candidate tree sha, zero-drift recheck) emitting READY_FOR_COMMIT_GO; commit/push remain separate explicit human words.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @codex
created: 2026-08-23 08:51
---
FROZEN TARGET — FIRST-HUMAN-NODE0 (2026-08-23): the only closure target is one sovereign human using one local Node0 through the complete living chain: human -> Dema -> real Node0 -> approved local model/PAT -> independent SAT -> FATE/exact consent -> reversible useful effect -> independent observation -> receipt -> persistent mission state -> kill/restart recovery -> Dema renders the recovered truth. VRO-1 VERIFIED is earned at the first end-to-end mission that survives restart with no duplicate effect; the adversarial campaign and 72-hour local soak earn VRO-1 OPERATIONALLY STABLE later. Do not add Node1/Node2, federation, public/shared URP, token/economy, marketplace, World Map expansion, or new agent society before VRO-1 VERIFIED. Historical pointers and flags are evidence, not current authority. Runtime launch authority stays separate. The locally recorded e632 producer qualification is historical evidence only and still needs exact clean consumer rebind; b6df2e01 has not been independently bound from current local disk and is not launch authority. A second comparable mission showing measured reduction in manual burden is a first-human product KPI after the living recovery loop, not a precondition that delays first use.
---
<!-- COMMENTS:END -->
