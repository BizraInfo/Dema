---
id: TASK-017
title: 'CONSENT-NONCE-ATOMIC-1A: exclusive-create nonce consumption'
status: Done
assignee: []
created_date: '2026-07-18 23:51'
updated_date: '2026-07-19 01:21'
labels:
  - next
  - product-proof
dependencies: []
ordinal: 17000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Audit BIZRA-GENESIS-NODE-OMNI-AUDIT-2026-07-19-1A S1 (SNR rank 1), spot-verified on disk: recordConsentNonce (packages/receipts/src/consent-nonce-registry.js:145) is a shared-JSON read-modify-write — concurrent presentations can double-consume, and parse/read failures degrade to {} (corrupt state appears unused). Replace with one-file-per-nonce exclusive-create under $DEMA_HOME/consent/used-nonces/<nonce>.json (0o700 dir, 0o600 file, no-follow + realpath, malformed state = hard stop, read-back verify, consumption permanent even if later signing fails).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 100 concurrent presentations of one nonce produce exactly one success (test)
- [x] #2 Malformed/unreadable registry state refuses consumption (fail-closed test)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Evidence-bound plan (read 2026-07-19, packages/receipts/src/consent-nonce-registry.js 243 lines + tests + verdict-attest.js:145 caller): 1. Canonical storage moves to $DEMA_HOME/consent/used-nonces.d/<nonce>.json created with flag 'wx' (kernel-level exclusive create), dir 0o700 file 0o600, read-back verify; EEXIST -> read existing -> consent_nonce_already_used. 2. Malformed/unreadable per-nonce file on EEXIST = fail-closed consent_nonce_state_corrupt (never 'unused'). 3. Legacy consent/used-nonces.json becomes READ-ONLY compat (already-used lookups); never written — note: the legacy JSON RMW also loses updates when two DIFFERENT nonces race (defect beyond the audit's same-nonce replay). 4. recordConsentNonce/isConsentNonceUsed signatures + return shapes preserved (verdict-attest depends). 5. Test migration: re-pin ~15 layout assertions in tests/consent-nonce-registry.test.js to the new layout at equal strictness; keyconsent-2b-nonce-integration must stay green. 6. New contract: Promise.all(100 same nonce) -> exactly 1 recorded:true; parallel different nonces -> both durable. 7. TESTING.md row + kernel-purity allowlist check + gates.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Scoping session 2026-07-19: fix shape confirmed against disk; implementation deferred to a dedicated slice because the pinned-test migration on a consent-authority path deserves full budget. Branch will be fix/consent-nonce-atomic-1a off origin/main.

Verified 2026-07-19: tests/consent-nonce-atomic.test.js 8/8 — T1 100 concurrent same-nonce presentations = exactly 1 success (red-first run reproduced multiple wins under old RMW code); T2 racing different nonces all durable (lost-update defect beyond the audit, also closed); T3/T5 corrupt per-nonce/legacy state refuses (no fail-open {}); T6 path-escape refused; T4 legacy compat; T8 sequential replay contract unchanged. Existing pinned contracts untouched-green: consent-nonce-registry + keyconsent-2b = 25/25 (mirror strategy avoided the 15-assertion migration). Gates: no-overclaim 0, integration-check 0, doc-freshness OK, kernel-purity OK (430 scanned), diff-check clean. Commit 77873fc on fix/consent-nonce-atomic-1a (off origin/main c047b4e).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Made consent-nonce consumption atomic: authority moved to exclusive-create (wx) per-nonce files under $DEMA_HOME/consent/used-nonces.d/ with fail-closed corrupt-state handling and path-safe nonce validation; legacy used-nonces.json kept as read-compat mirror so the API and all existing tests are unchanged. Verified with 8 new red-first tests + 25 existing tests + full local gates. Commit 77873fc.
<!-- SECTION:FINAL_SUMMARY:END -->
