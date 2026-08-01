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
- [ ] #5 CP5 closed: crash after `appendRetiredRegistry` / before `activateGeneration` cannot leave `retired_generation` with no usable active key
- [ ] #6 R2 closed: ceremony path validates `expected_old_fingerprint` against the live active key before mutation (never skip / never trust caller-only)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### PRESERVATION-1B Phase 0 seal — 2026-07-31 (re-sealed; 2026-07-29 claim was report-only)

These defects must live in backlog, not only in transcript or `/data/bizra/logs/PRESERVATION_REPORT_*`.

**CP5 — crash-law / identity-transition stranding (P0.2b crash matrix 2026-07-29).**
Crash after `appendRetiredRegistry` and before `activateGeneration` can leave authority in `retired_generation` with no usable active key. Ceremony is blocked until CP5 closes. Cross-ref: `docs/gtm/TASK029_PRE_CEREMONY_HALT.md`.

**R2 — `expected_old_fingerprint` never validated.**
Rotation / ceremony acceptance must bind the operator-supplied old fingerprint to the actual active key material before any registry mutation. Absence of this check is a false-consent path. Close before founder ceremony GO.

**Related (already sealed elsewhere):** two-nonce lost-update defect → TASK-017 (Done on exclusive-create path; keep as cautionary fixture for any new shared-JSON RMW).

**Key custody note (metadata only; agent did not open key material):** `~/.dema/keys/` exists with plaintext PEM files (not an encrypted container). Separately-encrypted offline backup remains a human-only ceremony — see KEY-BACKUP-CHECKLIST staging in Phase 2.
<!-- SECTION:NOTES:END -->
