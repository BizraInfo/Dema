---
id: TASK-057
title: 'PEAK-VERIFY-ADMISSION-1A: judge-free verifier gate + Peak proactive_self wire'
status: Done
assignee:
  - '@cursor'
created_date: '2026-07-31 13:38'
updated_date: '2026-07-31 13:41'
labels: []
dependencies: []
references:
  - docs/06-adr/ADR-049-peak-proactive-ultra-micro-self-harness.md
  - packages/core/src/peak-self-loop-preview.js
priority: high
type: feature
ordinal: 33000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Land ADR-049 Action #2 as a pure Dema kernel: decide self_verifiable true|false with a named judge-free verifier, fail-closed on LLM-as-judge and opinion metrics. Wire the gate into peak-self-loop proactive_self (critique · harness · compliance · consent) so only admission-passing sealed evidence is eligible as next INPUT. Preview-only: no runtime act, no daemon, no auto re-insert.

Why: closes the evaluate→verify→re-insert harness law without claiming live autonomy. Operator GO 2026-07-31 Peak ultra-micro.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Pure kernel exports evaluateVerificationAdmission({proposed_act, verifier}) returning self_verifiable boolean, named_verifier, refusal_reason, truth_label, all-false boundary
- [x] #2 Admissible: hash_equality, restore_test, suite_exit_0, schema_validate, content_address_rederive
- [x] #3 Inadmissible permanently: llm_as_judge, model_self_assessment, vibes, any metric computed by the acting party about itself without independent recompute
- [x] #4 peak-self-loop preview includes proactive_self.verification_admission with fail-closed defaults; consent/harness/critique/compliance unchanged in posture (preview_only, auto_applied false)
- [x] #5 Tests cover happy path, each inadmissible class, determinism, freeze, kernel purity (no node:fs/net)
- [x] #6 CURRENT_LIMITS.md + docs/TESTING.md rows for the slice; no CURRENT_LIMITS promotion of live loop
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add packages/core/src/verification-admission.js (pure, frozen).
2. Unit tests tests/verification-admission.test.js.
3. Wire into buildProactiveSelf / buildPeakSelfLoopPreview as proactive_self.verification_admission.
4. Extend peak-self-loop-preview tests for the new field.
5. Document in CURRENT_LIMITS.md + TESTING.md.
6. Run node --test on the new/related files; npm run check if tree allows.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented verification-admission.js; wired into peak-self-loop proactive_self (critique/harness/consent/compliance + verification_admission). Verified: node --test tests/verification-admission.test.js tests/peak-self-loop-preview.test.js tests/peak-self-loop-cli.test.js → 33/33 pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
PEAK-VERIFY-ADMISSION-1A: judge-free admission kernel + Peak proactive_self wire. Admits five hash/suite/schema verifiers; refuses LLM/vibes/self-metric. Default Peak fail-closed (reinsert_eligible false). Docs: CURRENT_LIMITS + TESTING. Verified 33/33 focused tests. Does not close L1 act→verify→re-insert runtime.
<!-- SECTION:FINAL_SUMMARY:END -->
