---
id: TASK-075.16
title: POT-CLAIM-SCOPE-0A — pure four-scope Proof-of-Truth validation
status: Done
assignee:
  - '@codex'
created_date: '2026-08-23 14:41'
updated_date: '2026-08-23 15:14'
labels:
  - composition
  - proof-of-truth
  - claim-scope
  - authority-zero
dependencies: []
references:
  - docs/LLM_SYSTEM_FLOW.md
  - packages/core/src/proof-convergence-preview.js
  - packages/flywheel/src/flywheel-task-convergence.js
  - >-
    backlog/tasks/task-075.14 -
    MASTER-REGISTRY-EFFECTIVE-CONFIG-1A-—-pure-desired-plus-observed-route-resolution.md
parent_task_id: TASK-075
priority: high
type: feature
ordinal: 63000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the minimum pure evaluator for Proof-of-Truth claim scopes COMPONENT, ROUTE, MISSION, and RESPONSIBILITY. It consumes only caller-supplied claim envelopes and explicit evaluation context, returning deterministic PASS, FAIL, HOLD, or scope-specific verified states. It preserves the existing illustrative proof-convergence preview and flywheel-specific convergence verifier. It performs no filesystem, network, process, clock, random, provider, model, runtime, consent, receipt, or authority action.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The evaluator accepts only the four declared scopes and rejects unknown scope values fail-closed.
- [x] #2 Required rails, permitted NOT_APPLICABLE rails, causal identity bindings, freshness, and recovery requirements are enforced per scope.
- [x] #3 Missing evidence yields HOLD; an explicit identity mismatch or contradiction yields FAIL; UNKNOWN never promotes.
- [x] #4 COMPONENT and ROUTE cannot promote to MISSION or RESPONSIBILITY; MISSION cannot promote to RESPONSIBILITY.
- [x] #5 A RESPONSIBILITY cannot converge without FORMAL_CONTRACT, INTEGRITY_BINDING, EMPIRICAL_OBSERVATION, ECONOMIC_VALUE, and required recovery evidence.
- [x] #6 The evaluator requires caller-supplied time context for freshness and uses no clock.
- [x] #7 All output boundaries are all false and authority_delta is zero; no provider, model, runtime, consent, receipt, or effect is invoked or changed.
- [x] #8 Red-first focused tests include the ten anti-false-GREEN controls in the POT-CLAIM-SCOPE-0A contract.
- [x] #9 The full Dema verification ladder passes and documentation states the exact bounded proof only.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reconfirm the existing proof-convergence preview and flywheel verifier boundaries; preserve both unchanged. 2. Dry-run the Dema proof-slice scaffold for POT-CLAIM-SCOPE-0A and confirm every registry, check, and documentation anchor. 3. Capture the deliberate red focused test. 4. Implement the smallest pure claim-scope evaluator with caller-supplied freshness context, fixed scope requirements, causal-binding checks, fail/HOLD rules, all-false boundary, and authority_delta=0. 5. Add the contract documentation and precise registry truth statement. 6. Run focused, static-review, repository, guidance, and diff checks; then close out against each acceptance criterion.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Red-first captured (3 passing scaffolding assertions; 5 TODO failures). Implemented the pure evaluator, static fixture, scope docs, receipt note, registry statement, and tests. Focused POT tests: 12/12 PASS; static review gate PASS; registry/canonical consumers PASS. Full npm test currently RED outside this slice: RCA-03 subprocess emitted empty JSON during parallel suite; same recovery file passes 5/5 alone. No runtime/provider/model/receipt action in this slice.

Final closeout: focused POT suite 12/12 PASS; static review fixture PASS with all boundary flags false and authority_delta=0; capability registry 18/18 PASS; canonical JSON gate PASS; npm test PASS (9,595 tests, 9,591 pass, 0 fail, 4 skip); npm run check PASS including coverage and registered review gates; npm run llm:guidance PASS; git diff --check PASS. First full-suite attempt earlier in the slice hit a transient RCA-03 empty child-output failure; isolated recovery control passed and this final full run passed without altering recovery code. POT remains structural only: no provider/model/runtime/mission/receipt/consent/effect was invoked or changed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented the pure POT four-scope evaluator and static review gate. It fail-closes unknown scopes, evidence/identity/freshness/recovery gaps, causal mismatches, contradictions, and scope escalation; it preserves zero authority and all-false boundaries. Verified by focused, repository, guidance, and diff gates; no runtime capability was activated.
<!-- SECTION:FINAL_SUMMARY:END -->
