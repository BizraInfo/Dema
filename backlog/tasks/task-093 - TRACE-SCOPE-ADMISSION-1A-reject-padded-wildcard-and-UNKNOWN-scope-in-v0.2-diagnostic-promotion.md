---
id: TASK-093
title: >-
  TRACE-SCOPE-ADMISSION-1A: reject padded wildcard and UNKNOWN scope in v0.2
  diagnostic promotion
status: Done
assignee:
  - '@codex'
created_date: '2026-10-31 03:25'
updated_date: '2026-10-31 03:43'
labels: []
dependencies: []
priority: high
type: bug
ordinal: 94000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On HEAD 885dffb2, a synthetic v0.2 trace fixture with whitespace-padded reserved scope passes all rails after its replay subject hash is recomputed. New promotion must enforce the existing explicit-scope contract without changing historical v0.1 derivation or carried trace bytes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 v0.2 refuses reserved scopes with spaces, tabs, newlines and nonbreaking spaces at either trace position; corroboration remains valid so refusal is causal.
- [x] #2 A pre-fix affected v0.2 report and rehashed forged authorization fail semantic verification; correctly blocked reports verify.
- [x] #3 Historical v0.1 output and ordinary v0.2 report hashes remain byte-identical to the pre-edit baseline, and raw evidence is preserved.
- [x] #4 Focused integration tests, repository gates, independent review and protected-work readback are recorded with exact limits.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Bind unchanged source, protected user work and baseline report hashes. 2. Add failing gate-level negative controls. 3. Narrow v0.2 provenance comparison in its existing owner. 4. Run focused and repository gates, independent review, and retain an unapplied rollback patch with evidence.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verified on baseline 885dffb274aa5a4d804e8451dba163ca67181973 plus the uncommitted two-file diff. RED: 31 pass, 2 fail before production edit. Focused integration: 70/70, no skips. npm test: 10458 pass, 4 skipped, zero failures, exit 0. npm run check: exit 0 in 786.957 seconds, including coverage and per-gate exit evidence. llm guidance, trace review gate and diff check exit 0. Independent review approved 84 additional probes and actual pre-edit report compatibility. Scratch rollback/reapply restored exact bytes; five inherited dirty paths unchanged. Historical v1 promotion remains available; affected pre-fix v2 reports intentionally fail semantic rederivation. Evidence: /data/bizra/logs/trace-scope-admission-1a-ptflk42a. No commit, push, runtime activation, signing or publication.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Hardened only v0.2 scope comparison against padded wildcard/UNKNOWN sentinels, preserving raw evidence and historical v0.1 derivation. Source-only repair locally qualified with red-first tests, full repository gates, independent adversarial review and byte-exact scratch rollback; runtime and economic effects remain unproven.
<!-- SECTION:FINAL_SUMMARY:END -->
