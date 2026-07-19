---
id: TASK-021
title: >-
  NODE0-MODEL-SWAP-INVARIANCE-1A — system verdict is model-agnostic (thesis
  proof)
status: Done
assignee: []
created_date: '2026-07-19 15:04'
updated_date: '2026-07-19 17:04'
labels: []
dependencies: []
ordinal: 21000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The measured form of the founding thesis (human/mission-centric, LLM-as-replaceable-component): a pure kernel proving a mission-task's ACCEPT/REJECT verdict is a function of (output, acceptance_contract) ONLY — model identity is never a parameter of the decision. Built solo 2026-07-19 while Codex was out. Committed 3f72e6f on feat/node0-model-swap-invariance-1a (off efc2b43, merges CLEAN onto main).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 verdict_is_model_blind: identical outputs from different models get identical verdicts
- [ ] #2 no_identity_laundering: a 'trusted' model cannot flip a contract-violating output to ACCEPT
- [ ] #3 relabel_invariant: permuting model-id labels leaves the accepted-state set unchanged
- [ ] #4 content-addressed + body-bound verify fails closed on forged invariant flag or extra boundary key
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
16 proof-contract tests green; full slice wiring (registry count 70, canonical consumer, T8 allowlist, check.mjs); no-overclaim/kernel-purity/canonical-json/registry gates all green; diff clean; merges CLEAN onto main. Boundary all-false incl model_invocation_performed:false — judges INJECTED outputs, no live model call, no model ranking, no quality claim about any model. Registry-count interaction with steward branch (both 69->70) resolves by re-bump on serial merge.

2026-07-19: 3f72e6f qualified vs main efc2b43 — merge CLEAN, 39/39 focused green, slice gate PASS (NODE0_MODEL_SWAP_INVARIANCE_MEASURED_REPO). Conflicts with handoff branch (registry test): land model-swap before handoff.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Shipped the measured proof that BIZRA's decision logic is model-agnostic: the system contract decides ACCEPT/REJECT, model identity has zero authority. Deterministic, CI-provable without any live model — because the system's model-independence must be provable WITHOUT a model. Commit 3f72e6f, all gates green.
<!-- SECTION:FINAL_SUMMARY:END -->
