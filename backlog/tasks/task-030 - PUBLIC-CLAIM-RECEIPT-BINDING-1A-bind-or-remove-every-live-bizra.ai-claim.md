---
id: TASK-030
title: 'PUBLIC-CLAIM-RECEIPT-BINDING-1A: bind or remove every live bizra.ai claim'
status: To Do
assignee: []
created_date: '2026-07-22 07:56'
labels:
  - gtm
  - no-overclaim
dependencies: []
priority: high
ordinal: 30000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Both 2026-07-21 dev logs flag live bizra.ai/bizra.info claims with no per-claim receipts: '8,072 Verified Tests / 100% pass', 'Formally Verified', 'every action Ed25519-signed', 'no cloud / no telemetry', '96% cheaper', '73 of 100 nodes'. Status: RED_PENDING_RECEIPT_BINDING. Claim-by-claim audit against the receipt chain; each claim gets bound to evidence (commit + receipt hash) or is edited/removed. Blocks invitations and Program G1 ignition. GitHub also reports 4 moderate Dependabot vulnerabilities on the default branch (likely dema-ui subtree) — triage in the same honesty pass.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every live public claim mapped to receipt+commit or removed
- [ ] #2 Dependabot 4 moderate findings triaged with verdicts
- [ ] #3 Result recorded in docs/CLAIM_REGISTER and CURRENT_LIMITS same slice
<!-- AC:END -->
