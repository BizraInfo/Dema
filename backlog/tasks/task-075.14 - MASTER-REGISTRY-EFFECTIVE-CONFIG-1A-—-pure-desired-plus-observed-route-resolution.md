---
id: TASK-075.14
title: >-
  MASTER-REGISTRY-EFFECTIVE-CONFIG-1A — pure desired-plus-observed route
  resolution
status: Done
assignee:
  - '@codex'
created_date: '2026-08-23 11:25'
updated_date: '2026-08-23 11:46'
labels:
  - composition
  - mr
  - effective-config
  - local-first
  - authority-zero
dependencies: []
parent_task_id: TASK-075
priority: high
type: feature
ordinal: 61000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create the minimum pure Master Registry composition layer for Dema/Node0. The resolver accepts a declared MR desired-state revision and a caller-supplied verified observation snapshot, then returns one deterministic effective route or an explicit REFUSE/UNKNOWN diagnostic.

MR desired state remains authoritative; observations remain observational; native configuration and secret material stay outside MR. MR-1A is a dependency for TASK-075.04 / PROD-03 and does not activate any provider or runtime.

Excluded: persistence/pointers, filesystem/network/process access, provider discovery or probing, model/provider/agent CLI invocation, provider-state mutation, fallback activation, Dema/Node0 runtime activation, consent capture/consumption, receipt minting, secret migration, and TASK-075.04 integration.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Pure resolver consumes only supplied desired-state and observation values; it performs no filesystem, network, process, clock, random, provider, or runtime action.
- [x] #2 For identical desired state, observation snapshot, role request, and native/environment input, resolution is structurally identical and selects the same explicit primary binding.
- [x] #3 A route is EFFECTIVE only when its binding is explicitly ACTIVE, READY, qualified, role-allowed, locality-compliant, authority-compliant, and bound to the supplied MR revision.
- [x] #4 Unknown, malformed, stale/mismatched, disabled, unqualified, offline, role-ineligible, locality-ineligible, authority-ineligible, or conflicting inputs yield explicit UNKNOWN or REFUSE with no selection.
- [x] #5 Native or environment configuration never overrides desired MR state; a material conflict is observable and refuses the route.
- [x] #6 The resolver rejects raw secret-bearing MR fields and does not expose any secret value in its output.
- [x] #7 Fallback is disabled in MR-1A: an unavailable primary refuses rather than selecting another capability.
- [x] #8 All outputs declare authority_delta = 0 and all boundary effect flags false; no consent is requested or consumed.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Focused red-first test, review gate, npm test, npm run check, npm run llm:guidance, and git diff --check pass.
- [x] #2 TASK-075.04 retains its existing dependency and also depends on this independently proven task before consuming the resolver.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reconfirm the existing preview registry/broker seams and generator wiring, then dry-run the required red-first scaffold.
2. Create the red MR-1A slice and execute its focused test to capture the unimplemented control.
3. Implement the smallest pure desired-plus-observed resolver: validation, secret rejection, deterministic primary route selection, conflict/refusal diagnostics, all-false boundary, and authority_delta=0.
4. Prove focused behavior and review gate; complete the generated truth/docs only to the measured scope; run the repository ladder and final independent closeout.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Red-first proof captured the unimplemented scaffold and then the missing resolver export. Final evidence: 12 MR focused cases, 18 capability-registry cases, and 17 check-exit integrity cases passed together (47 total); MR review gate passed with a fictional static fixture only; npm test passed (9532 pass, 4 skipped); npm run check, npm run llm:guidance, and git diff --check passed. The generated check-gate wiring exposed an unrelated brittle command-count assertion in tests/check-exit-integrity-adversarial.test.js; it now verifies the actual isolated-TAP-to-coverage topology rather than a global command count. TASK-075.04 remains To Do and has dependencies TASK-075.02,TASK-075.14.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented and independently qualified the pure MR desired-plus-observed resolver with deterministic select/refuse/unknown outcomes, secret rejection, non-authoritative native conflict handling, disabled fallback, all-false boundary, and authority_delta=0. Verified by focused tests/review gate plus npm test, npm run check, npm run llm:guidance, and git diff --check; TASK-075.04 now depends on this task and remains unstarted.
<!-- SECTION:FINAL_SUMMARY:END -->
