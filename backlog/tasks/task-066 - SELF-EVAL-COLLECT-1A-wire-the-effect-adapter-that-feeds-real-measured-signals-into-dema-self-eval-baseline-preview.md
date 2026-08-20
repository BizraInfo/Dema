---
id: TASK-066
title: >-
  SELF-EVAL-COLLECT-1A: wire the effect adapter that feeds real measured signals
  into dema-self-eval-baseline-preview
status: Done
assignee: []
created_date: '2026-08-14 16:24'
updated_date: '2026-08-14 17:16'
labels: []
dependencies: []
ordinal: 41000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The self-eval kernel's signals are injected and nothing collects them (only review gate + registry consume it). Build apps/cli/src/commands/self-eval-gatherer.js (effects: npm run coverage TAP parse, dema monitors run --json, npm run check exit, boot timing; fail-closed — a broken/unspawnable command refuses, never fabricates) + dema self-eval baseline|compare CLI (exact consent 'GO: dema self eval baseline preview' gates the write under DEMA_HOME/self-eval, tmp+rename 0600; compare is read-only verdict). Red-first, review gate, TESTING.md + CURRENT_LIMITS.md same slice. Operator GO 2026-08-14.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Gatherer refuses (ok:false, named blocked_by, input null) when any signal source is unspawnable or unparseable; failing tests / red gates are measurements not refusals
- [x] #2 Fixture-driven gather output is accepted by runDemaSelfEvalBaselinePreview (kernel-eligible), formats pinned to real observed TAP/monitors bytes
- [x] #3 CLI baseline writes verifiable payload under DEMA_HOME only with exact consent phrase; without it nothing runs and nothing is written
- [x] #4 CLI compare re-derives improved/regressed/unchanged from two on-disk baselines
- [x] #5 Review gate + check.mjs wiring + TESTING.md + CURRENT_LIMITS.md updated in same slice; focused tests (39/39) + no-overclaim + git diff --check green; llm:guidance red verified PRE-EXISTING (AGENTS.md_is_thin_router — AGENTS.md dirty from a parallel stream, untouched by this slice, gate input identical with/without the slice)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Built red-first: 7 gatherer tests (formats pinned to real observed TAP/monitors bytes incl. suite-completeness guard tests_total>=test-file-count after a live degenerate crash-TAP sealed tests_total=1) + 5 CLI tests (consent-before-effects, blocked-gather-seals-nothing, compare from disk, dispatcher-ctx routing pinned after a live silent-help-fallback with exit 0) + review gate scripts/review/dema-self-eval-collect-check.mjs wired into check.mjs + consent-matrix row (gate demanded it) + docs rows. FDE outward repair: npm dead in tree (ELOOP 216) so commands invoke node directly; node self-globs tests/*.test.js (bare dir arg dies — proven live). THREE real baselines sealed under ~/.dema/self-eval: run1 degenerate (refuse-path receipt, honest healthy:false), run2+run3 real (9407 tests, 9388 pass, 83s suite). NEGATIVE CONTROL FINDING: identical tree, coverage jitter -0.02/-0.01 pct => kernel zero-tolerance compare says regressed; recorded in CURRENT_LIMITS, kernel tolerance = its own future ruled slice.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
SELF-EVAL-COLLECT-1A shipped: the self-eval kernel's first real signal collector + dema self-eval baseline|compare CLI, fail-closed (never fabricates), consent-before-effects, sealed content-addressed baselines under DEMA_HOME/self-eval. Verified: 39/39 focused tests, collect+consent-matrix review gates PASS, no-overclaim PASS, git diff --check clean, two real full-suite baselines sealed + compare controls run (negative control exposed measured coverage-jitter limit, documented).
<!-- SECTION:FINAL_SUMMARY:END -->
