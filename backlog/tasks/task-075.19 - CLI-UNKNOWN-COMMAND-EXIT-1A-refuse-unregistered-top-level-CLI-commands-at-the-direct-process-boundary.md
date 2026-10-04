---
id: TASK-075.19
title: >-
  CLI-UNKNOWN-COMMAND-EXIT-1A: refuse unregistered top-level CLI commands at the
  direct process boundary
status: Done
assignee:
  - '@codex'
created_date: '2026-08-23 18:06'
updated_date: '2026-08-23 18:15'
labels:
  - cli
  - truth-gate
  - diagnostic
dependencies: []
documentation:
  - docs/LLM_SYSTEM_FLOW.md
modified_files:
  - apps/cli/src/index.js
  - tests/cli-command-table.test.js
  - tests/command-suggester-cli.test.js
parent_task_id: TASK-075
priority: high
type: bug
ordinal: 66000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Repair the top-level CLI false-green: unregistered commands currently print a friendly suggestion yet exit 0, so automation cannot distinguish absence from success. Keep the change confined to the shared dispatcher result contract and its regression test. No new command, evaluator, runtime, provider/model invocation, network activity, DEMA_HOME write, consent consumption, or authority increase.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 An unregistered top-level command emits the existing suggestion text and exits non-zero at the direct CLI boundary.
- [x] #2 Prototype-property tokens still fall through safely to the unknown-command suggester and exit non-zero rather than invoking inherited properties.
- [x] #3 Known successful commands retain exit 0, and the repair does not set a global process exit code from dispatch so interactive shell turns remain isolated.
- [x] #4 Focused tests and the repository verification ladder are run on final bytes; any unrelated failures are reported without being reclassified as green.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a red subprocess assertion that an unregistered top-level command preserves its suggestion output but exits non-zero. 2. Return the existing refusal sentinel from the shared unknown-command dispatcher path so only the direct CLI boundary sets exit 1 and interactive shells remain usable. 3. Run focused CLI checks, then the full repository ladder; record any pre-existing failures without masking them.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Red reproduced: an absent top-level command (I don't have a `self` command.

Did you mean:
  - dema seed                             — seed-loop gate preview (ADVANCE/HOLD/REFUSED)
  - dema help                             — show full command list

Type `dema help` to see everything I can do.) printed the existing suggestion but exited 0. The shared unknown-command dispatcher now returns a refusal sentinel; the direct CLI main maps it to exit 1 while direct dispatch leaves process.exitCode unchanged. Final evidence: focused CLI suite 28/28; npm test 9,566 pass, 0 fail, 4 skip; npm run check PASS; npm run llm:guidance PASS; git diff --check PASS. No DEMA_HOME write, provider/model invocation, runtime activation, consent consumption, network call, or authority increase.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Repaired the shared unknown-command path so direct CLI use exits 1 while preserving suggestions and interactive dispatch isolation. Verified by focused CLI tests and the complete repository ladder.
<!-- SECTION:FINAL_SUMMARY:END -->
