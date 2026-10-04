---
id: TASK-075.15
title: >-
  OPENROUTER-ADMISSION-POLICY-COMPILER-1A — deterministic external-route plan
  only
status: Done
assignee:
  - '@codex'
created_date: '2026-08-23 11:53'
updated_date: '2026-08-23 12:12'
labels:
  - composition
  - mr
  - openrouter
  - external
  - authority-zero
dependencies:
  - TASK-075.14
parent_task_id: TASK-075
priority: high
type: feature
ordinal: 62000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create the smallest pure OpenRouter admission-policy compiler. It accepts only a supplied external route declaration and produces a deterministic non-executable request plan or explicit refusal. It must preserve MR authority, require an explicit remote privacy/metadata/provider policy, reject raw secrets and random free routing, and prove that no self-consent, network request, provider call, provider state change, runtime activation, fallback, cost/credit action, or receipt mint occurs. This task does not modify the live local-model route, does not call OpenRouter, and does not start TASK-075.04.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The pure compiler consumes only supplied route and policy values and performs no filesystem, network, process, clock, random, credential, provider, or runtime action.
- [x] #2 Only an explicit OpenRouter external proposal-only route with an exact model identifier, a non-empty underlying-provider allowlist, disabled fallback, data collection denial, ZDR requirement, and router metadata requirement compiles.
- [x] #3 The compiler explicitly refuses random free routing, missing or malformed privacy/routing controls, unsupported locality or authority, and any attempt to broaden the route.
- [x] #4 Native credentials are represented only by an approved reference; raw secrets or Authorization values are refused and never appear in output.
- [x] #5 Same supplied inputs yield an identical content-addressed non-executable plan; independent re-derivation rejects a rehashed altered plan.
- [x] #6 Every output declares EXTERNAL_PROCESSING, consent required but NOT_REQUESTED, authority_delta = 0, and all invocation, provider-state, runtime, fallback, cost, and receipt boundary effects false.
- [x] #7 Focused red-first tests, a review gate, documentation, and the repository ladder pass without contacting OpenRouter.
- [x] #8 The canonical all-agent LLM flow explains policy, boundary, and constitutional authority in operational terms and makes clear that a model or deterministic harness cannot self-consent or enlarge authority.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 TASK-075.04 remains unstarted; no local or remote model invocation is claimed.
- [x] #2 No OpenRouter key, credit, or prompt leaves the machine during qualification.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reuse MR-1A canonical hashing and all-false-boundary patterns; dry-run the mandatory red-first slice scaffold. 2. Generate and capture the intentionally red compiler contract. 3. Implement the smallest pure compiler that accepts only an explicit OpenRouter external proposal route and emits a safe non-executable plan or refusal. 4. Add the policy/boundary/constitution instruction to the canonical all-agent flow. 5. Prove deterministic re-derivation, privacy/allowlist/fallback/refusal controls, no self-consent, all-false effects, and the documentation contract; update measured docs and run the repository ladder.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Scope clarification authorized by the human: include a concise policy, boundary, and constitutional-authority instruction in docs/LLM_SYSTEM_FLOW.md, the canonical all-agent flow. No runtime scope is added.

Implemented and fully verified 2026-08-23: pure OpenRouter admission-policy compiler plus canonical policy/boundary/constitutional guidance and the human-habit-not-actor clarification. Red-first scaffold recorded 3 pass / 5 fail (not_implemented), then focused compiler proof 11/11 PASS; review gate PASS; registry 18/18 PASS; canonical JSON gate PASS; fresh standalone npm test PASS (9,543 pass / 0 fail / 4 skip); npm run check PASS (9,543 pass / 0 fail); npm run llm:guidance PASS; git diff --check PASS. No OpenRouter key, prompt, API call, provider invocation/state change, runtime activation, fallback, consent, credit action, receipt mint, network, or external effect occurred.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented a deterministic, zero-authority OpenRouter external-admission plan compiler and canonical agent policy/boundary/constitution guidance. Verified with focused 11/11, standalone npm test 9,543/0, npm run check 9,543/0, guidance, and whitespace gates; no live OpenRouter operation occurred.
<!-- SECTION:FINAL_SUMMARY:END -->
