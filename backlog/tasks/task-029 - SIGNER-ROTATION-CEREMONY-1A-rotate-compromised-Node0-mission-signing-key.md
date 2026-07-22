---
id: TASK-029
title: 'SIGNER-ROTATION-CEREMONY-1A: rotate compromised Node0 mission-signing key'
status: To Do
assignee: []
created_date: '2026-07-22 07:56'
labels:
  - security
  - node0
dependencies: []
priority: high
ordinal: 29000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
2026-07-21 session leaked the mission-signing private key into an AI transcript (recorded in 'UX chat historyنظام مهيأ للعمل (1).md'). Sweep 2026-07-22 confirms NO rotation occurred: ~/.dema/keys/node0-ed25519.pem unchanged since 2026-06-18, no rotation receipt, latest stand receipt is stand-2026-07-21-28dccf7d.json (no Stand #2). Founder-supervised ceremony required — key generation binds identity and is a hard halt gate; no autonomous key creation. Also inspect/disable the Stand #2 cron (3 9 22 7 * — annual-recurring defect) before re-arm.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Old key revoked and revocation receipt sealed
- [ ] #2 Receipts signed between leak (2026-07-21) and rotation are labeled custody-uncertain
- [ ] #3 New keypair generated under founder ceremony with consent phrase, outside any transcript
- [ ] #4 Stand #2 cron inspected and corrected before any further mission receipt
<!-- AC:END -->
