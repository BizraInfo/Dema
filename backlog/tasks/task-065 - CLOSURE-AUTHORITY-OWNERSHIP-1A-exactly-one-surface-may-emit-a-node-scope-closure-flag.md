---
id: TASK-065
title: >-
  CLOSURE-AUTHORITY-OWNERSHIP-1A: exactly one surface may emit a node-scope
  closure flag
status: Done
assignee:
  - '@claude'
created_date: '2026-08-09 15:07'
updated_date: '2026-08-09 15:07'
labels: []
dependencies: []
modified_files:
  - scripts/review/node0-closure-invariants-check.mjs
  - tests/node0-closure-invariants-gate.test.js
priority: high
ordinal: 40000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Operator correction on 8ef2fd7: 'SINGLE OWNER CONFIRMED' was only LEXICALLY confirmed. A grep for NODE0_CLOSED proves no second producer of that exact token was found; it cannot establish that no second surface can proclaim closure. Measured: four closure-SHAPED verdict producers exist on this tree — mission-corridor-closure, node0-local-closure-readiness, omega0-mechanical-closure and node0-closure-invariants — each with a distinct schema and scope, and only the invariant ledger emits a node-scope flag.

Every remaining closure adapter is blocked behind this unknown, because the operator's rule is: if multiple independent paths can proclaim final closure, stop before adapters.

Outcome: the review gate enumerates every source file that PRODUCES a node-scope closure flag, distinguishes producing from reading, fails closed on an unreadable file, and refuses any producer other than the registered owner. Scope is the Dema repository only; system-wide reconciliation with the producer-side closure constitution remains open.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The gate enumerates node-scope closure-flag producers across packages/ and apps/ and passes only when the sole producer is the registered owner.
- [x] #2 Producing a flag is distinguished from reading one: an object key node0_closed: is a finding, report.node0_closed is not.
- [x] #3 An unreadable file is a finding, never a silent skip, and a scan that finds no owner at all fails as a broken scan.
- [x] #4 A negative control proves the scanner can actually detect a foreign producer, so SINGLE is not an artifact of a broken pattern.
- [x] #5 The three subordinate closure schemas are pinned distinct from the ledger schema.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Enumerate closure-SHAPED verdict producers by exported verify/evaluate/run signature, not by token grep.
2. Resolve each surface's schema identity at runtime to prove scope separation.
3. Extend the already-wired closure review gate with findClosureAuthorityProducers; do not create a second gate.
4. NCG-06 pins SINGLE; NCG-07 is the negative control proving the scanner detects a foreign producer AND does not flag a reader; NCG-08 pins schema distinctness.
5. Qualify in a fresh extraction.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Measured before implementing: six exported closure-shaped verdict functions across four modules, resolving to four distinct schemas — bizra.dema.mission_corridor_closure.v0.1, bizra.dema.node0_local_closure_readiness.v0.1, bizra.dema.omega0_mechanical_closure.v0.1, bizra.dema.node0_closure_invariants.v0.3. A direct scan for node-scope flag emission outside the ledger returned NONE. So the separation mechanism is schema-scoped verdicts with exactly one node-scope flag, which is what the gate now pins.

Gate output on 8ef2fd7: 'semantic closure owner: SINGLE (1 producer(s))'. Fresh extraction: 9001 tests, 8998 pass, 3 skipped, 0 fail, exit 0; kernel purity OK 470 scanned 0 violations.

SCOPE, stated in the task rather than implied: this is the Dema repository only. SYSTEM_WIDE_CLOSURE_OWNER remains NOT_RECONCILED against the producer-side closure constitution, and PR452's health/CLEAN, witness-verify and runtime-observation surfaces have not entered this base.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Converted 'single owner' from a lexical grep result into an enforced, controlled property. The already-wired closure gate now enumerates every source file that PRODUCES a node-scope closure flag across packages/ and apps/, distinguishes producing from reading, fails closed on an unreadable file, and refuses any producer but the registered owner — so a second surface cannot silently become a parallel closure authority. Verified by NCG-06 (SINGLE on this tree), NCG-07 (negative control: the scanner detects a planted foreign producer and does not flag a reader) and NCG-08 (three subordinate schemas pinned distinct). Ledger unchanged at 1 SATISFIED / 9 UNKNOWN, verdict OPEN.
<!-- SECTION:FINAL_SUMMARY:END -->
