---
id: TASK-075.23
title: >-
  PROMOTION-VERIFIER-0A — reusable candidate-promotion gate
  (verify-candidate-promotion.mjs)
status: Done
assignee: []
created_date: '2026-08-25 13:48'
labels:
  - promotion
  - devops
  - cicd
  - no-false-green
dependencies: []
parent_task_id: TASK-075
priority: high
ordinal: 78000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Release-engineering multiplier: one command converts a locally measured dirty worktree into an exactly-described, independently reconstructible promotion candidate. Emits PROMOTION_DESCRIPTOR/QUALIFICATION_REPORT/PROMOTION_RECEIPT under proof-of-promotion/<mission>/. Gates: scope allowlist (unexpected path = RED), secret scan (tightened morphology), session-capture scan, focused suites, aggregate (npm test fail=0 STRICT ok, check exit 0, guidance, diff-check), fresh-clone reconstruction with byte-exact blob-map tree equality + focused proofs inside the clone. READY_FOR_COMMIT_GO only when every gate PASS; --skip-aggregate forces BLOCKED (no false GREEN). Authority fields machine-check absence: runtime/keys/push/merge/commit all false, authority_delta 0. Apply-inside-clone-only law: git apply can never target the source worktree.
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Landed and exercised on G6-CANONICAL-PROMOTION-1A: VERDICT READY_FOR_COMMIT_GO at base b2335399 with dirty_tree_digest sealed; found+fixed two real verifier defects on first use (execFileSync 1MiB maxBuffer ENOBUFS masked as exit-0; npm_test OR-mask) and tightened secret pattern after 7 identifier false positives; session-ses_*.md ignore law extended; proof-of-promotion ignored as local evidence store.
<!-- SECTION:FINAL_SUMMARY:END -->
