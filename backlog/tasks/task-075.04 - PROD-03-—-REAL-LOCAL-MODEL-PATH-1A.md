---
id: TASK-075.04
title: PROD-03 — REAL-LOCAL-MODEL-PATH-1A
status: To Do
assignee: []
created_date: '2026-08-21 21:20'
updated_date: '2026-08-23 11:25'
labels:
  - production
  - model
  - llm
  - local
dependencies:
  - TASK-075.02
  - TASK-075.14
parent_task_id: TASK-075
priority: high
type: task
ordinal: 49000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Qualify the existing local model invocation path as the production PAT model substrate. Provider process must be observed, exact model identity must be measured, direct probe and broker probe must both pass, and Dema observation must match. Provider loss must be detected and recovery must restore model readiness. No hardcoded model-health literal. Normative spec: NODE0_DEMA_PRODUCTION_CLOSURE_SPEC_v1_0.md @ b01b4b32e9e978287a97a6a3db6cd04fd02fc488 sha256:6ebb7a0dca40451eab030052dd267a1f5c5ad03f9b23ac13f8f34de695add840
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Provider process observed running on localhost
- [ ] #2 Exact model identity observed via direct probe
- [ ] #3 Direct probe passes under exact-string consent
- [ ] #4 Broker probe passes with routeForTask selection
- [ ] #5 Dema observation matches actual model provider and identity
- [ ] #6 Stop provider -> Dema reports non-model-ready
- [ ] #7 Restart provider -> Dema recovers model-ready
- [ ] #8 No hardcoded model-health literal
- [ ] #9 Model whitelist enforced; non-whitelisted model refused
- [ ] #10 Prompt length bounded; empty prompt refused
- [ ] #11 Timeout bounded; provider unavailability is non-green, not silent failure
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 provider_process_observed
- [ ] #2 exact_model_identity_observed
- [ ] #3 direct_probe_passes
- [ ] #4 broker_probe_passes
- [ ] #5 Dema_observation_matches
- [ ] #6 authority_delta = 0
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Dependency added 2026-08-23: TASK-075.14 (MASTER-REGISTRY-EFFECTIVE-CONFIG-1A) must independently prove deterministic desired-plus-observed effective route resolution before PROD-03 may consume it. This does not authorize runtime activation in MR-1A.
<!-- SECTION:NOTES:END -->
