---
id: TASK-063
title: >-
  CLOSURE-LEDGER-WIRING-1A: the closure ledger is printed by npm run check and
  registered as a capability
status: Done
assignee:
  - '@claude'
created_date: '2026-08-09 13:22'
updated_date: '2026-08-09 13:23'
labels: []
dependencies: []
modified_files:
  - scripts/review/node0-closure-invariants-check.mjs
  - scripts/check.mjs
  - packages/core/src/dema-capability-truth-registry.js
  - tests/dema-capability-truth-registry.test.js
  - tests/node0-closure-invariants-gate.test.js
  - tests/check-exit-integrity-adversarial.test.js
  - docs/receipts/NODE0_CLOSURE_INVARIANTS_1A.md
  - docs/CURRENT_LIMITS.md
  - docs/TESTING.md
priority: high
ordinal: 38000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Measured at 719b88d: the closure-invariant kernel had zero consumers. Only its own test and the remote-write test imported it, so npm run check never evaluated it, the capability truth registry did not list it, and reading the ledger required a hand-written node -e. Four commits of hardening had gone into a surface nothing called.

Outcome: a review gate runs inside npm run check and prints the ledger every run; the surface is registered in the capability truth registry with honest forbidden claims; a receipt names the six invariants that cannot be settled from this repository at all.

The gate PASSES while closure is OPEN. A gate that failed on OPEN would demand a lie, and the cheapest way to satisfy it would be to fabricate an observation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 npm run check runs the closure ledger gate and prints satisfied/violated/unknown counts and the per-invariant status.
- [x] #2 The gate passes while the verdict is OPEN, and asserts only the truth surface: ten invariants in order, every one scope-declared, verdict re-derives, forged CLOSED refused.
- [x] #3 An adapter returning null contributes no evidence key, proven together with a positive control that a real observation does reach the ledger.
- [x] #4 NODE0_CLOSURE_INVARIANTS_1A is in the capability truth registry with source, test, gate, receipt and docs paths that exist on disk, and the pinned capability count is updated.
- [x] #5 Full suite, npm run check, coverage and guidance pass on the final bytes in a fresh extraction.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. New review gate scripts/review/node0-closure-invariants-check.mjs: positive control (fully evidenced set reads CLOSED and verifies), negative control (forged CLOSED over empty evidence refused), then publish the live ledger. PASS on OPEN.
2. Wire into scripts/check.mjs after node0-local-closure-readiness-check.
3. Register NODE0_CLOSURE_INVARIANTS_1A in dema-capability-truth-registry.js + REQUIRED_CAPABILITY_IDS; bump the pinned capability count 72 -> 73.
4. Write docs/receipts/NODE0_CLOSURE_INVARIANTS_1A.md naming the six invariants no static analysis can settle.
5. tests/node0-closure-invariants-gate.test.js with the NCG-03/NCG-04 control pair.
6. Expect three collateral REDs from the wiring itself: integration-check requires the gate command verbatim in docs/TESTING.md, and the A7 adversarial test pins check.mjs command count and the isolated-TAP index.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The three collateral failures arrived exactly as the scaffold law predicts: adding a gate to check.mjs is six wiring points, and integration_check + A7 fail only under the FULL suite. Fixed by documenting the gate command verbatim in docs/TESTING.md line 616 and bumping the A7 pins 204 -> 205 commands, isolated index 128 -> 129, coverage neighbour 129 -> 130.

Working tree suite is untrustworthy this session: this sandbox's git exits 128 on .git/config.worktree (a /dev/null char device in the sandbox view only), which alone produced 24 failures. All gate evidence below comes from a fresh extraction of 719b88d with the slice overlaid and a writable HOME.

Gates on final bytes, fresh extraction of 719b88d with the slice overlaid, writable HOME: npm test 8656 total = 8653 pass + 3 skipped + 0 fail, exit 0; npm run check exit 0 with aggregate gate evidence, and the ledger printed inside that run as 'adapters registered: 0 of 10 / ledger: OPEN - 0 satisfied, 0 violated, 10 unknown of 10'; npm run coverage exit 0 at 95.38 lines / 84.28 branches / 97.65 functions; llm:guidance 7 PASS; kernel purity OK 464 scanned 0 violations. Registry gate PASS at 73 capabilities, 73 measured_repo.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Wired the closure ledger into the repository's own verification graph. A new review gate runs inside npm run check and prints the ledger on every run, so the operator sees 0 of 10 settled without writing a node -e; NODE0_CLOSURE_INVARIANTS_1A is registered in the capability truth registry with forbidden claims that refuse 'node0 closed' and 'invariant satisfied'; and a receipt names the six invariants that describe a running loop and therefore cannot be settled from this repository at all. The gate passes on OPEN by design. No adapter was added and no invariant moved: the ledger is still 0 SATISFIED / 10 UNKNOWN.
<!-- SECTION:FINAL_SUMMARY:END -->
