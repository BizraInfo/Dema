---
id: TASK-091
title: 'PEAK-GATE-EVIDENCE-PROVENANCE-1A: refuse unproven gate-pass signals'
status: Done
assignee:
  - '@codex'
created_date: '2026-10-26 06:55'
updated_date: '2026-10-26 07:09'
labels: []
dependencies: []
references:
  - packages/core/src/peak-evidence-gatherer.js
  - apps/cli/src/commands/peak-self-loop-evidence-gatherer.js
  - packages/core/src/peak-self-loop-preview.js
documentation:
  - docs/CURRENT_LIMITS.md
  - docs/TESTING.md
  - docs/06-adr/ADR-049-peak-proactive-ultra-micro-self-harness.md
modified_files:
  - packages/core/src/peak-evidence-gatherer.js
  - packages/core/src/peak-self-loop-preview.js
  - apps/cli/src/commands/peak-self-loop-evidence-gatherer.js
  - tests/peak-evidence-gatherer.test.js
  - tests/peak-self-loop-evidence-gatherer.test.js
  - tests/peak-self-loop-preview.test.js
  - docs/CURRENT_LIMITS.md
  - docs/TESTING.md
priority: high
type: bug
ordinal: 93000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The peak evidence gatherer currently admits caller-authored JSON containing a matching gate id and exit: 0 as MEASURED. A content hash binds those bytes but does not establish that the declared command ran. This can raise the self-loop SNR and change the preview verdict. Keep the existing evidence gatherer and adapter as the owners; fail closed until an existing independent execution-provenance verifier can substantiate the positive claim. Preserve preview-only and authority_delta=0 boundaries.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A matching caller-authored gate JSON declaration is not emitted as MEASURED or counted as a verified signal.
- [x] #2 Missing sources, mismatched gate ids, nonzero exits, duplicate ids, hash drift, and unsupported evidence types keep their existing refusal behavior.
- [x] #3 Focused gatherer and adapter tests prove the fabricated-positive negative control leaves the self-loop held.
- [x] #4 Current limits and test documentation state the exact evidence ceiling; no parallel receipt store or runtime execution is added.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Rebind the primary checkout and preserve all existing user changes; confirm no other agent is writing the target files. 2. Run focused gatherer/adapter tests and reproduce matching self-authored {gate, exit:0} bytes becoming MEASURED and moving the preview toward CONTINUE. 3. Fail closed in the existing gatherer when execution provenance is unverified. 4. Prevent direct exported-preview callers from bypassing the existing gatherer by accepting only in-process evidence objects issued by that owner; add direct-call negative coverage. 5. Preserve the adapter's duplicate-id/source-target refusals, update only current limits/testing rows, run focused and compatible suites, inspect the exact diff and mutation footprint, and request independent review. 6. Report preview-only evidence, known limits, and authority_delta=0; no runtime or Node0 closure claim.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Baseline on current HEAD daa20685cb3a7b80718bb3664ce2399b9af672da, tree 8b799eee3867d5053695fb1357c07065bea26ce8: `node --test tests/peak-evidence-gatherer.test.js tests/peak-self-loop-evidence-gatherer.test.js` exited 0 (23/23). Direct unchanged-source reproduction with three self-authored matching JSON objects emitted 3 MEASURED events at weight 1, `verified_signal_count=3`, verdict `CONTINUE_MICRO_SLICE`.

Focused tests write only temporary directories under OS tmpdir and clean them; no DEMA_HOME or runtime calls. Primary working tree was already dirty. Parallel read-only agents are complete; target source writer conflict not observed.

After source/test/docs changes: `node --test tests/peak-evidence-gatherer.test.js tests/peak-self-loop-evidence-gatherer.test.js` exited 0 (23/23). The CLI + preview + verification-admission compatibility group exited 0 (48/48); CLI temp DEMA_HOME roots were isolated under a task-specific TMPDIR and removed empty after the run. `git diff --check` returned no diagnostics (final exit code will be re-bound at closeout).

Final focused suite after the JSON-round-trip regression assertion: `node --test tests/peak-evidence-gatherer.test.js tests/peak-self-loop-evidence-gatherer.test.js tests/peak-self-loop-preview.test.js tests/peak-trace-diagnostic-moat.test.js tests/peak-self-loop-cli.test.js tests/verification-admission.test.js` exited 0 (83/83).

Read-only `node scripts/bind-peak-evidence.mjs` exited 0 and reported zero verified signals, HOLD, and PASS for keeping readable source code as evidence debt.

Final `git diff --check` exited 0. Independent read-only review: PROCEED; follow-up review confirmed the JSON-round-trip/output parity assertions and found no blockers.

Current local file/diff hashes are recorded in the closeout response. The scoped diff hash covers complete dirty target-file diffs relative to HEAD, including inherited dirty hunks; it is not an isolated patch hash.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Refused unproven gate-pass evidence at both the existing gatherer and exported preview boundary. Matching caller-authored `{gate, exit: 0}` JSON no longer becomes MEASURED; only same-process objects issued by the existing gatherer can be scored, and there is currently no independent execution-provenance verifier to issue a positive gate signal. Added regression coverage for raw and JSON-round-tripped caller objects, downstream score/RSI/event-table/trace parity, adapter refusal, and HOLD behavior. Updated current limits and testing documentation. Verification: focused 83/83; read-only binder preview exit 0 with zero verified signals and HOLD; `git diff --check` exit 0; independent review PROCEED. Preview-only and authority_delta=0. No runtime, DEMA_HOME, deployment, network, Node1, federation, or economic effect was accessed. Existing working-tree dirt remains preserved.
<!-- SECTION:FINAL_SUMMARY:END -->
