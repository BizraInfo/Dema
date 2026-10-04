---
id: TASK-062
title: >-
  CLOSURE-VERDICT-REDERIVATION-1A: verifyClosureVerdict must re-derive the rows,
  not just the summary
status: Done
assignee:
  - '@codex'
created_date: '2026-08-09 11:35'
updated_date: '2026-08-09 16:15'
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
1. RED: extend NCI-15 with signed-zero edits for every derived count whose honest value is +0; prove the verifier incorrectly accepts them.
2. GREEN: compare all four re-derived numeric summary fields with Object.is so +0 is canonical and -0 is refused.
3. Re-run the 38-test focused pair, required project gates, diff checks, and independent adversarial review.
4. Update only TASK-062 evidence and return it to Done if AC #3 is re-proven on final bytes.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
RED and root cause:
- The original TASK-062 controls reproduced trusted forged row statuses, summary fields, delimiter-collapsed blockers, unchecked report fields, accessors, sparse arrays, reflective failures, and split-view Proxies.
- Exact HEAD b9276f1 retained one residual: four honest derived +0 counts could be edited to -0 and still return {ok:true}. NCI-15 produced 25 pass / 1 fail before the repair.

GREEN:
- Canonical records and dense arrays remain snapshotted and structurally checked; report, row, array, and blocker Proxies remain refused.
- Object.is now compares all four numeric summary fields to their re-derived values, so canonical +0 and supplied -0 cannot collapse under strict equality.
- NCI-15 rejects every honest signed-zero mutation with summary_not_supported_by_rows. The closure test passes 26/26 and the closure plus remote-write focused pair passes 38/38.
- Source SHA-256: 9788ba44117b55387ef1bdb2c1e3a9e26311bc4e00bb52763e4e75729275cddc.
- Test SHA-256: 9b580321cb0484ad51a05eac211eceac23033b074fe2ccd9213f46ab8b398494.

Independent and project proof:
- Hostile matrix: 178/178 expected outcomes, 0 unexpected, including 104 count-domain mutations and honest OPEN/CLOSED JSON round-trips.
- Exact candidate npm test: 9001 tests / 9001 pass / 0 fail / 0 skipped, classifier exit 0.
- Exact candidate npm run check: aggregate gate-exit evidence and coverage exit 0.
- npm run llm:guidance: 7 PASS. git diff --check and cached diff check: clean.

Harness qualifier:
- The parent tree tracks node_modules as an absolute self-referential symlink inherited from 8ef2fd7. Default npm lifecycle startup fails with ELOOP before repository tests.
- Exact repository bytes were therefore verified with a temporary shell that only reset PATH to the repository Node 22 binary. The shell was removed after proof; TASK-062 did not alter node_modules.

Honest limits:
- No additional closure-decision verifier bypass survived the exercised matrix; this is not a universal proof over unexercised inputs.
- Evaluator getter snapshot behavior, authenticated instrument provenance, allowed UNKNOWN cause selection, and JSON safety of arbitrary observed values remain outside this verifier-only slice.
- No adapter, runtime, remote effect, or closure observation was added. The current ledger remains OPEN at 1 SATISFIED / 9 UNKNOWN.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @codex
created: 2026-08-09 12:09
---
Reopened by explicit operator GO after independent review reproduced residual verifier bypasses on 021e2f1. Scope is TASK-062 verifier repair only.
---

author: @codex
created: 2026-08-09 15:46
---
Exact-HEAD revalidation on b9276f1 reproduced one residual: an OPEN report with satisfied_count or violated_count changed from +0 to -0 verifies {ok:true}. Object.is proves the supplied value differs from the evaluator output. Scope remains TASK-062 count-envelope verification only.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Repaired the TASK-062 signed-zero verifier residual only: Object.is now refuses -0 where the evaluator emitted a canonical +0 count, and NCI-15 records the RED-to-GREEN case. Verification: 38/38 focused tests; 178/178 independent hostile outcomes with zero unexpected; exact candidate 9001/9001 full tests; aggregate check and coverage exit 0; LLM guidance 7/7; diff checks clean. The npm lifecycle used a temporary Node 22 PATH sanitizer because the parent tree tracks a pre-existing self-referential node_modules symlink; no repository byte was changed to bypass it. No additional closure-decision verifier bypass survived the exercised matrix. Node0 remains OPEN at 1 satisfied / 9 unknown. Evaluator getter snapshot behavior and instrument provenance remain outside this verifier-only slice.
<!-- SECTION:FINAL_SUMMARY:END -->
