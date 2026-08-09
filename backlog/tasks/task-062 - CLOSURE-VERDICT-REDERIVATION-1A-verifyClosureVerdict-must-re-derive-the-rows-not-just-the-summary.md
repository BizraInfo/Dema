---
id: TASK-062
title: >-
  CLOSURE-VERDICT-REDERIVATION-1A: verifyClosureVerdict must re-derive the rows,
  not just the summary
status: Done
assignee:
  - '@claude'
created_date: '2026-08-09 11:35'
updated_date: '2026-08-09 12:53'
labels: []
dependencies: []
modified_files:
  - packages/core/src/node0-closure-invariants.js
  - tests/node0-closure-invariants.test.js
  - docs/CURRENT_LIMITS.md
  - docs/TESTING.md
priority: high
ordinal: 37000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Measured on 097447d: verifyClosureVerdict returned {ok:true} after all ten rows were relabeled SATISFIED and node0_closed was set true even though those rows carried no source or matching scope. The verifier trusted row.status and checked only whether all claimed statuses agreed with the closure flag; it did not re-derive row status, counts, blocked_by, verdict, or the full canonical report envelope. NCI-09 covered a forged summary over honest rows, not forged rows themselves.

Outcome: verify the exact canonical in-process data envelope. Snapshot enumerable own data-property records and dense ordinary arrays once; re-derive each row status against the canonical invariant definition; compare blocked_by as ordered structure; and check schema, truth label, proof boundaries, all counts, total, and verdict. Refuse holes, accessors, array annotations, inherited fields, live Proxies, missing canonical fields, and unreadable reflective input. Preserve the original schema v0.3 proof-boundary string. UNKNOWN reason values remain vocabulary-checked, not independently re-derived, because v0.3 discards the refused raw observation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A report whose ten rows claim SATISFIED without a source or a matching scope is rejected, with a reason naming the row evidence rather than the summary.
- [x] #2 A row that redefines its own required value or required_scope is rejected.
- [x] #3 satisfied_count, violated_count, unknown_count, total and blocked_by are each re-derived from the rows and an edited value is rejected.
- [x] #4 A report whose schema is not the kernel's schema is rejected.
- [x] #5 The honest path is unchanged: a real evaluator output still returns exactly {ok:true}, and NCI-09's three existing forgeries keep their current reasons.
- [x] #6 blocked_by is compared as ordered structure, so delimiter-bearing content cannot collapse or prune blocker entries.
- [x] #7 Every verdict row has the canonical evidence shape; a missing observed field or unsupported reason encoding is rejected instead of being reclassified or ignored.
- [x] #8 The report truth label and proof-boundary statements are either matched to the kernel constants or explicitly excluded from verifier authority; no unchecked field is described as re-derived.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. RED: add adversarial controls for structural blocked_by equality, missing row evidence fields, unsupported or malformed reason values, forged report-boundary fields, sparse or annotated arrays, accessors, and split-view Proxies.
2. GREEN: snapshot canonical record and array data once; re-derive decision-bearing evidence; compare blocked_by structurally; bind the canonical truth label and proof-boundary strings; refuse unreadable reflective input.
3. Keep the evaluator API, invariant scopes, honest OPEN/CLOSED paths, and NCI-09 established failure reasons stable. Do not add adapters, check wiring, registry rows, runtime, or remote effects.
4. Correct only TASK-062 proof language so it states what is independently re-derived and what remains instrument or transport provenance.
5. Run focused and complete proof gates on final bytes, obtain independent review, then seal locally only if every residual acceptance criterion is observed.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
RED and root cause:
- On 097447d, NCI-14/NCI-15 reproduced a verifier that trusted forged row statuses and summary fields.
- On 021e2f1, NCI-16 through NCI-21 reproduced delimiter collision, unchecked row/report fields, and unchecked proof labels.
- NCI-22 through NCI-25 reproduced accessor and TOCTOU reads, sparse or annotated arrays, schema-v0.3 proof-text drift, and throwing reflective input.
- NCI-26 reproduced an active Proxy whose honest descriptor view verified while normal reads and JSON exposed forged values.

GREEN:
- Canonical records are snapshotted once from exact enumerable own data properties; report, row, and blocker Proxies are refused.
- Invariant and blocker arrays must be dense ordinary arrays with exact index and length descriptors; holes, annotations, symbols, accessor indices, custom prototypes, and Proxies are refused.
- Row status, all counts, ordered structural blocked_by, truth label, proof boundaries, schema, and verdict are checked from stable snapshots.
- The original v0.3 proof-boundary string remains byte-compatible. NCI-09 established failure reasons remain unchanged.

Final-byte proof before local seal:
- focused closure plus remote-write tests: 38 pass / 0 fail / 0 skipped.
- npm test: 8651 total / 8651 pass / 0 fail / 0 skipped, exit 0.
- npm run check: exit 0 with aggregate gate-exit evidence.
- npm run coverage: exit 0; 95.42 percent lines / 84.34 branches / 97.69 functions.
- npm run llm:guidance: 7 PASS.
- kernel purity: 464 scanned / 0 violations / 93 allowlisted.
- git diff --check and cached diff check: clean.
- independent adversarial review: code APPROVE; 14 hostile-object probes found no remaining false-CLOSED path.

Honest limits:
- Schema v0.3 normalizes refused observations, so an allowed UNKNOWN reason is vocabulary-checked but its specific cause is not independently re-derived.
- Arbitrary non-satisfying observed values are not certified JSON-serializable.
- No evidence adapter or consumer is wired; the empty-evidence evaluation remains OPEN at 0 SATISFIED / 10 UNKNOWN.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @codex
created: 2026-08-09 12:09
---
Reopened by explicit operator GO after independent review reproduced residual verifier bypasses on 021e2f1. Scope is TASK-062 verifier repair only.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Repaired TASK-062 verifier bypasses only. verifyClosureVerdict now validates a stable canonical in-process data envelope: exact enumerable data records, dense arrays, no accessors or Proxies, decision-bearing row status re-derivation, structural ordered blockers, exact counts, schema, truth label, proof boundaries, and verdict. NCI-14 through NCI-26 transport each reproduced bypass; 38 focused tests and the 8651-test suite pass with zero failures or skips, aggregate checks and coverage pass, and independent review found no remaining false-CLOSED path. No closure observation, adapter, consumer, runtime, or remote effect was added; closure evidence remains 0 of 10.
<!-- SECTION:FINAL_SUMMARY:END -->
