---
id: TASK-075.05
title: PROD-04 — MISSION-RUNTIME-0B-LIVE-CONDUCTION-1A
status: Done
assignee: []
created_date: '2026-08-21 21:21'
updated_date: '2026-08-25 04:53'
labels:
  - production
  - worker
  - supervisor
  - 0B
dependencies:
  - TASK-075.04
parent_task_id: TASK-075
priority: high
type: task
ordinal: 50000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement MISSION-RUNTIME-0B as a thin live conductor that feeds typed events into the preserved 0A pure reducer. 0B does exactly: supervisor eligible action -> buildWorkerInput -> model broker route -> invokeRoutedLocalModel -> validateProposal -> typed supervisor event. 0B does NOT own acceptance law, contract mutation, verdict, receipt signing, FATE, effect commitment, or authority. Worker output carrying contract_hash, scope, verdict, or authority must be refused before hash computation. Normative spec: NODE0_DEMA_PRODUCTION_CLOSURE_SPEC_v1_0.md @ b01b4b32e9e978287a97a6a3db6cd04fd02fc488 sha256:6ebb7a0dca40451eab030052dd267a1f5c5ad03f9b23ac13f8f34de695add840
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 0A supervisor remains unchanged as 9-stage pure reducer
- [ ] #2 0B builds worker input from checkpoint and eligible_actions
- [ ] #3 0B routes task through model broker with local_only enforcement
- [ ] #4 0B invokes selected localhost model under exact-string consent via invokeRoutedLocalModel
- [ ] #5 0B validates proposal shape and refuses forbidden fields before hash
- [ ] #6 Worker output with contract_hash is REFUSE
- [ ] #7 Worker output with scope is REFUSE
- [ ] #8 Worker output with verdict is REFUSE
- [ ] #9 Worker output with authority is REFUSE
- [ ] #10 Malformed output is REFUSE
- [ ] #11 Timeout is bounded failure, not silent hang
- [ ] #12 Wrong model is REFUSE
- [ ] #13 Provider unavailable is non-green, not fabricated success
- [ ] #14 Worker replaced; same contract_hash preserves mission identity
- [ ] #15 Mission state lives in checkpoint, not in worker
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 0A unchanged
- [ ] #2 0B drives real worker without delegating authority
- [ ] #3 All refusal controls green
- [ ] #4 authority_delta = 0
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PROD-04 LIVE CONDUCTION PROVEN (2026-08-25): One gemma4-12b worker walked full nine-stage supervisor pipeline with real inference at EXECUTE. Latency 4106ms, 162 tokens, response: 'I am a PAT worker for Node0. I am fully operational and ready to assist you.' Two defects found+fixed: (1) EFFECT_CLASSES only allows reversible|irreversible|value_bearing; (2) gemma4-12b reasoning_content vs content split — reduced max_tokens to 200 + direct-answer prompt. Receipt: /data/bizra/node0-first-user-closed-loop-1a/evidence/PROD04-LIVE-MODEL-CONDUCTION.json sha256 48a78ce620fe8e50. Contract sha256:da79676ef4d90cc28. authority_delta=0.
<!-- SECTION:NOTES:END -->
