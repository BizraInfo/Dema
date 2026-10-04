---
id: TASK-064
title: >-
  ACCEPTANCE-MODEL-BLIND-ADAPTER-1A: the first closure invariant with a real
  evidence adapter
status: Done
assignee:
  - '@claude'
created_date: '2026-08-09 13:23'
updated_date: '2026-08-09 14:41'
labels: []
dependencies: []
modified_files:
  - packages/core/src/node0-acceptance-model-blind-adapter.js
  - tests/node0-acceptance-model-blind-adapter.test.js
  - scripts/review/node0-closure-invariants-check.mjs
  - tests/node0-closure-invariants-gate.test.js
  - packages/core/src/dema-capability-truth-registry.js
  - tests/dema-capability-truth-registry.test.js
  - docs/CURRENT_LIMITS.md
  - docs/TESTING.md
  - docs/receipts/NODE0_CLOSURE_INVARIANTS_1A.md
priority: high
ordinal: 39000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Measured at bf6d995: the closure ledger is visible and sound but reads 0 satisfied of 10 with zero adapters. Six of the ten describe a running loop and cannot be settled from this repository. acceptance_is_model_blind can be: NODE0-MODEL-SWAP-INVARIANCE-1A already proves, on a given attestation, that the verdict is a function of (output, contract) only, and its verifier reports which guarantee it actually established.

Outcome: an adapter that converts a model-swap attestation into a scoped closure observation for acceptance_is_model_blind, and returns null unless the attestation genuinely establishes the strongest tier.

The adapter must be strict in the TASK-060 sense: it may only emit an observation when the verifier independently re-derived the verdicts from carried contract and carried outputs (established === verdict_reproduced), the invariance flags all hold, a real model swap is present, and the contract is non-vacuous. Anything weaker returns null and the row stays UNKNOWN.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 An attestation whose verification establishes verdict_reproduced with all invariance flags holding yields an observation scoped node0_acceptance_function_model_blindness that satisfies the invariant.
- [x] #2 A weaker tier (rows_consistent or contract_reproduced) returns null, so a builder cannot settle the invariant by omitting evidence from the envelope.
- [x] #3 A tampered attestation, a failed verification, a one-model candidate set, or absent invariance flags each return null.
- [x] #4 The adapter cannot emit any other invariant id, and cannot emit a scope other than the one acceptance_is_model_blind declares.
- [x] #5 With the adapter registered, the review gate prints 1 of 10 satisfied and the verdict stays OPEN.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. RED: tests/node0-acceptance-model-blind-adapter.test.js — strongest-tier attestation yields a scoped satisfying observation; every weaker or broken input returns null.
2. Kernel packages/core/src/node0-acceptance-model-blind-adapter.js: pure, consumes a model-swap payload, calls verifyNode0ModelSwapInvariance, and emits only on ok && established===verdict_reproduced && invariants.all_hold.
3. Register in the review gate's CLOSURE_EVIDENCE_ADAPTERS with a fixture attestation built from the model-swap kernel's own surfaces.
4. Wire the four points the scaffold law names: TESTING.md row + gate command already listed, CURRENT_LIMITS row, capability registry entry + count bump, receipt.
5. Gates in a fresh extraction; expect the A7 pins to move again if a gate is added.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Tier separation measured, not assumed, so AMB-02 and AMB-04 are not vacuous greens: full envelope reaches established=verdict_reproduced with ok=true; carry_outputs=false lands at contract_reproduced with ok=true; a vacuous contract lands at rows_consistent with ok=false. The adapter emits only at the first.

Registered in the review gate against a declared probe task named review-gate-acceptance-model-blindness-probe, so the fixture provenance is inside the attestation content hash the published source string carries. Anyone reading the ledger can see the observation came from this gate exercising the shipped acceptance function, not from production traffic; CURRENT_LIMITS, TESTING and the receipt all say so explicitly rather than letting the count imply otherwise.

Gates on final bytes, fresh extraction of bf6d995 with the slice overlaid, writable HOME: npm test 8662 total = 8659 pass + 3 skipped + 0 fail, exit 0; npm run check exit 0 with the ledger printed inside it as '1 satisfied, 0 violated, 9 unknown of 10'; coverage exit 0 at 95.34 lines / 84.17 branches / 97.65 functions; guidance 7 PASS; kernel purity OK 465 scanned 0 violations; registry gate PASS at 74 capabilities.

REBASE 2026-08-09 (operator ruling NODE0-CANONICAL-REBASE-AND-REQUALIFY-1A): the closure line was rebased onto pinned canonical main b89d8718. Pre-rebase tip 53bbe7b / tree f5cdb72f, merge-base 53e636c8, 19 ahead / 13 behind. Backup ref refs/backup/pre-rebase-53bbe7b-2026-08-09 preserves the pre-rebase tip locally. Post-rebase tip 8ef2fd7 / tree 069fa30e, 19 ahead / 0 behind, and the branch-to-main diff went from 95 files -14935 deletions to 56 files -27. No file present on canonical main is absent from HEAD.

Conflicts were resolved as semantic union, never ours/theirs: docs/TESTING.md rows from both sides, and the A7 positional pins in tests/check-exit-integrity-adversarial.test.js re-derived by importing the merged check.mjs commands array rather than carried from either branch, exactly as that test's own comment requires. One integration commit was needed: the capability truth registry count pin is a merge artifact because both sides added capabilities, so it was re-measured from the merged registry (75) instead of taking either side's number.

The rebased ledger was re-measured, not assumed: still 1 SATISFIED / 9 UNKNOWN, verdict OPEN, same attestation hash. CORRECTION accepted from the operator: an instrument existing on canonical main does not settle an invariant. Save/resume, rollback, corridor recovery, ownership fencing and season action authority BEAR ON several remaining invariants; each becomes closure evidence only after a scoped adapter locates the authoritative artifact, verifies it, re-derives the property, binds its bytes and emits exactly one required observation scope. No adapter was added in this act.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Built the first real closure evidence adapter in this estate. acceptance_is_model_blind moves from UNKNOWN to SATISFIED, sourced by a NODE0-MODEL-SWAP-INVARIANCE-1A attestation whose verifier independently re-derived every verdict and diagnosis from the carried contract and outputs; both weaker verification tiers return null, so no builder can settle the row by carrying less evidence. The ledger is now 1 SATISFIED / 9 UNKNOWN and the verdict is still OPEN. Verified by AMB-01 through AMB-06 including a one-model vacuity control and a vacuous-contract control, plus the full gate ladder in a fresh extraction.
<!-- SECTION:FINAL_SUMMARY:END -->
