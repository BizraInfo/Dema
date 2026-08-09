---
id: TASK-062
title: >-
  CLOSURE-VERDICT-REDERIVATION-1A: verifyClosureVerdict must re-derive the rows,
  not just the summary
status: Done
assignee:
  - '@claude'
created_date: '2026-08-09 11:35'
updated_date: '2026-08-09 11:41'
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
Measured on 097447d: verifyClosureVerdict returns {ok:true} for a report whose ten rows all claim status SATISFIED while carrying source null, scope null, an observed value that does not equal required, and reason no_evidence — over a summary that simultaneously says satisfied_count 0, unknown_count 10, a non-empty blocked_by, and an invented schema string. The function only compares 'do all rows say SATISFIED' against node0_closed, so a forger who edits the rows and the flag together is never caught. Only the summary was bound; the evidence was not.

NCI-09 is named 'a hand-edited CLOSED verdict is caught' but forges only the summary over honest rows, so it never reached this path.

Outcome: the verdict is re-derived from each row's own evidence against the kernel's canonical invariant definitions — a row may not redefine its required value or required_scope, a status must follow from (observed, source, scope), and the summary counts, blocked_by list, total, schema and verdict must all be exactly what the rows produce.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A report whose ten rows claim SATISFIED without a source or a matching scope is rejected, with a reason naming the row evidence rather than the summary.
- [x] #2 A row that redefines its own required value or required_scope is rejected.
- [x] #3 satisfied_count, violated_count, unknown_count, total and blocked_by are each re-derived from the rows and an edited value is rejected.
- [x] #4 A report whose schema is not the kernel's schema is rejected.
- [x] #5 The honest path is unchanged: a real evaluator output still returns exactly {ok:true}, and NCI-09's three existing forgeries keep their current reasons.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. RED: NCI-14 forges ten SATISFIED rows over unsourced/unscoped evidence with a contradicting summary and an invented schema; it must be rejected. NCI-15 edits one summary count and one blocked_by entry over honest rows. Both must fail against 097447d bytes.
2. GREEN: rederiveRowStatus(row) resolves the row's id against CLOSURE_INVARIANTS, refuses a row that redefines required or required_scope, and returns the status that (observed, source, scope) actually support. verifyClosureVerdict then compares every row status, all four counts, blocked_by, the schema and the verdict string against the re-derivation.
3. Keep the honest path returning exactly {ok:true} and keep NCI-09's three reasons stable — order the checks so row shape is settled before the summary.
4. Trim two overstatements the review flagged: the CURRENT_LIMITS 'live ledger' phrase, and any wording implying a scope string proves provenance.
5. Gates on final bytes in a fresh extraction with a writable HOME, since this sandbox's git is poisoned; report skipped counts alongside pass counts.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Defect reproduced on 097447d before any edit: verifyClosureVerdict returned {ok:true} for ten rows claiming SATISFIED with source null, scope null, observed 'not-required' and reason no_evidence, under a summary saying satisfied_count 0 with a non-empty blocked_by. RED: NCI-14 and NCI-15 failed against those bytes, 2 of 15.

GREEN: rederiveRowStatus resolves each row against CLOSURE_INVARIANTS and returns null if the row restates its own required value or required_scope; otherwise the status follows from (observed, source, scope). verifyClosureVerdict now checks schema, row count, id order, every row status, the presence/absence of a row reason, all four counts, blocked_by as an exact ordered list, and the verdict string. The same probe now returns invariant_definition_mismatch; an honest OPEN report still returns exactly {ok:true}, and NCI-09's three reasons are unchanged.

Two overstatements corrected in the same slice, both raised by independent review: docs/CURRENT_LIMITS.md called an empty-evidence evaluation a 'live ledger' when nothing evaluates it on a schedule, and the kernel header implied a scope string proves what an instrument looked at. Scope is now described as a caller-supplied declaration that prevents routing a narrow instrument to a broad question and does not prove itself.

Gates on final bytes in a fresh extraction with a writable HOME (this sandbox's git is poisoned, so the working tree cannot be trusted for suite runs): focused 27/27; npm test 8640 total = 8637 pass + 3 skipped + 0 fail, exit 0; npm run check exit 0 with aggregate gate evidence; npm run coverage exit 0 at 95.38 percent lines / 84.23 branches / 97.66 functions; llm:guidance 7 PASS. Skipped counts are reported alongside pass counts, which the TASK-061 record omitted.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Closed a vacuous-proof hole in the closure verifier found by independent review of 097447d: verifyClosureVerdict bound only the summary to the rows and nothing to the evidence, so ten forged SATISFIED rows carrying no source and no scope verified as ok. It now re-derives each row's status from that row's own evidence against the canonical invariant definition, refuses a row that restates its own contract, and re-derives schema, counts, blocked_by and the verdict from the rows. Verified by NCI-14 and NCI-15, red before and green after, plus a direct re-probe of the original forgery. Also corrected two doc overstatements the review flagged. No invariant moved: closure stays OPEN at 0/10.
<!-- SECTION:FINAL_SUMMARY:END -->
