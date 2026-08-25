---
id: TASK-075.07
title: PROD-06 — FATE-CONSENT-EFFECT-OBSERVATION-RECEIPT-RECOVERY-1A
status: To Do
assignee: []
created_date: '2026-08-21 21:22'
labels:
  - production
  - fate
  - consent
  - effect
  - receipt
  - recovery
dependencies:
  - TASK-075.06
parent_task_id: TASK-075
priority: high
type: task
ordinal: 52000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the full production effect authority stack: FATE, human consent, atomic nonce, transactional effect, independent postcondition observation, trusted receipt signing, and exactly-once recovery. The four questions must remain distinct: Season, FATE, human consent, nonce. Effect lifecycle is PROPOSED -> VERIFIED -> FATE_PERMITTED -> CONSENTED -> STAGED -> EXECUTED -> POSTCONDITION_VERIFIED -> COMMITTED -> RECEIPTED. Command exit 0 never equals COMMITTED. No crash may cause a consequential effect to execute twice. Receipt is trusted only when active signer trust is empirically resolved per ADR-048.

Normative spec: NODE0_DEMA_PRODUCTION_CLOSURE_SPEC_v1_0.md @ b01b4b32e9e978287a97a6a3db6cd04fd02fc488 sha256:6ebb7a0dca40451eab030052dd267a1f5c5ad03f9b23ac13f8f34de695add840
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Four distinct questions preserved: Season, FATE, human consent, nonce
- [ ] #2 FATE evaluates constitutional permissibility, not just exact-string match
- [ ] #3 Season may action be requested
- [ ] #4 Human consent authorizes exact context
- [ ] #5 Nonce ensures one permitted use
- [ ] #6 Effect lifecycle states enforced in order; no skip
- [ ] #7 Command exit 0 never equals COMMITTED
- [ ] #8 Effect is bounded and reversible until COMMITTED
- [ ] #9 Independent postcondition observation verifies world state after effect
- [ ] #10 SAT final verdict occurs after independent observation
- [ ] #11 Receipt is trusted only when active signer trust resolved
- [ ] #12 Active generation resolved, pointer resolved, succession ledger valid, fingerprint matches
- [ ] #13 Legacy PEM mtime alone is insufficient
- [ ] #14 Crash before/after each of 11 crash points has legal recovery action and forbidden recovery action
- [ ] #15 NO CRASH MAY CAUSE A CONSEQUENTIAL EFFECT TO EXECUTE TWICE
- [ ] #16 Atomic tmp+rename writes used for all durable state transitions
- [ ] #17 TASK-029 remains human ceremony gate for rotation if necessary
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 One real reversible transaction from PROPOSED to RECEIPTED
- [ ] #2 Trusted signer empirically established
- [ ] #3 No crash causes duplicate effect
- [ ] #4 authority_delta = 0
<!-- DOD:END -->
