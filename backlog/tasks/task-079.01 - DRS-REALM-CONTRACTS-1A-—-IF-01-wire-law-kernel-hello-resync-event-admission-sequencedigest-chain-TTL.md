---
id: TASK-079.01
title: >-
  DRS-REALM-CONTRACTS-1A — IF-01 wire-law kernel (hello/resync/event, admission,
  sequence+digest chain, TTL)
status: Done
assignee: []
created_date: '2026-08-25 08:28'
updated_date: '2026-08-25 17:25'
labels:
  - realm-shell
  - kernel
  - wire-law
dependencies: []
parent_task_id: TASK-079
priority: high
ordinal: 71000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Pure kernel in packages/core: 11-value SemanticState, 27-code ReasonCode registry, ADMIT_HELLO predicate (authority_delta==0, uid/pid binding injected, revision + contracts_digest match, fail-closed exe-digest hook), snapshot-before-stream FSM, sequence contract (idempotent duplicate / contradiction / gap / rollback -> UNKNOWN + resync), sha256-canonical-json-v1 digest chain, state-specific evidence constraints (forged VERIFIED_DONE refused), TTL freshness with injected clock. Tests mirror ICD C01-C20 + G-01..G-05. Red-first via dema-slice-scaffold.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-08-25 amendment: receipt's 'mirrors ICD C01-C20' was overbroad — C16 (oversize frame) and C17 (malformed UTF-8) had no mirror. Repaired in-repo: decodeRealmFrame pins ICD §13 min/max_frame_bytes (oversize refused before decode) and §6.1 strict fatal UTF-8 (overlong/truncated/CESU-8 refuse by name) + FRAME_JSON_INVALID; codes joined REFUSAL_REASON_CODES. Focused 42→47 green. Receipt amended; CURRENT_LIMITS row updated.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
DRS-REALM-CONTRACTS-1A closed MEASURED: pure IF-01 wire-law kernel (packages/core/src/drs-realm-contracts.js) with 42-test conformance suite mirroring ICD C01-C20 + golden G-01..G-05; review gate walks golden transcript through plan->walk->verify->tamper-probe; registered as capability 84; drift rulings pinned in docs/02-architecture/DRS_REALM_CONTRACTS_v0_1.md (TTL 2500, async 3-method trait, i18n keys, canonical-json-v1, duplicate-before-chain precedence, UNKNOWN-on-close vs OFFLINE-on-disconnect). Ladder: focused 42/42, npm test 9651/0, check exit 0, guidance PASS, diff-check clean.
<!-- SECTION:FINAL_SUMMARY:END -->
