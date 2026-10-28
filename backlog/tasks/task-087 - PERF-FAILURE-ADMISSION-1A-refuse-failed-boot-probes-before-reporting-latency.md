---
id: TASK-087
title: 'PERF-FAILURE-ADMISSION-1A: refuse failed boot probes before reporting latency'
status: Done
assignee:
  - '@codex'
created_date: '2026-10-15 23:50'
updated_date: '2026-10-16 00:08'
labels: []
dependencies: []
references:
  - scripts/perf-bench.mjs
  - scripts/review/performance-budget-gate.mjs
  - tests/perf-probe-failure-admission.test.js
priority: high
type: bug
ordinal: 88000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Current benchmark and performance-budget collectors suppress child errors and count failed boot attempts as latency measurements. Repair this one shared invariant at both existing owners. Keep five measured calls in perf-bench and one warm-up plus three measured calls in performance-budget-gate; retain command, environment policy, timeouts, medians and ceilings. Scope only the two initially clean scripts and a new behavioral test. Preserve all inherited dirty work, old campaign evidence and yesterday UMDC repair. No CI workflow, adapter, runtime, model, Google eval, cloud, posting, signing, payments or campaign changes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Any nonzero, timeout, spawn or signal failure propagates as the original error at every invocation position, including warm-up, and no later probe executes.
- [x] #2 Successful probes retain five-call p50 and warm-up-plus-three-call p50 behavior, commands, environment mode, timeouts and configured ceilings.
- [x] #3 Actual script entrypoints exit nonzero and emit no passing measurement after a controlled failed child; a subsequent successful fixture proves recovery without modifying real runtime.
- [x] #4 Capture unchanged-source RED, focused and project-gate outcomes, independent review, preservation and reversal proof with exact source hashes and an unsigned engineering receipt.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Capture current source preimages, dirty-state hashes and existing test baseline. 2. Add actual-function behavioral regressions and establish RED with unchanged source. 3. Add minimal import-safe test seams and propagate failed probes at both collectors. 4. Verify success and failure entrypoints plus recovery; run focused and canonical project gates with designed state isolation. 5. Review exact source independently, confirm reverse restoration in disposable copies, preserve prior artifacts and produce the 13-section report and receipt.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Established unchanged-source RED with four real entrypoint probes: fake child exit23 was swallowed and scripts returned success. Removed swallowing catches in both collectors; added import-safe sampler exports with execute/clock seams. Final focused6 and adjacent36 tests pass, including36 original-error cases across9 invocation positions, successful median controls, recovery, human/JSON failing entrypoints and no later child. Initial green assertion mismatch retained separately; it concerned stderr formatting only and was corrected to verify command context. All49 preexisting dirty file hashes still match. Independent review running.

Final qualification: npm test exit0, 10294 pass/4 skip; npm run check exit0, canonical10409 pass/4 skip, coverage95.41 lines/84.01 branches/97.57 functions. Guidance, claim corpus and git diff --check exit0. Same-host independent review approved exact three source hashes; 35 tests plus12 real disposable timeout/missing/signal entrypoint checks passed. All49 protected inherited file hashes, HEAD, prior UMDC receipt and campaign hash preserved. Reverse patch actually restores preimages in disposable copy. Unsigned report/receipt/patch/logs are in .artifacts/perf-failure-admission-20261016. No source edits after qualification. Installed payload and remote CI remain separate unresolved boundaries; Flow accessed but no video observed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Repaired failed-boot admission in both existing performance collectors. Original child failures now propagate before any measurement/report; five-sample and warm-up-plus-three-sample medians, commands and ceilings remain unchanged. Verified unchanged-source RED4, focused6 with36 injected cases, adjacent36, independent35 plus12 actual negative entrypoints, all required local project gates and disposable reverse restoration. Bound source, evidence, preservation and limitations in .artifacts/perf-failure-admission-20261016/receipt.json. Local source verification only; no install, activation, cloud eval, push or merge.
<!-- SECTION:FINAL_SUMMARY:END -->
