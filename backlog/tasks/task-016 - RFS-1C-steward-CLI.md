---
id: TASK-016
title: RFS-1C-steward-CLI
status: To Do
assignee: []
created_date: '2026-07-18 21:16'
updated_date: '2026-07-19 10:00'
labels: []
dependencies: []
ordinal: 16000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Operable CLI surface for the reversible-file-steward stack: dema steward plan|verify|run|undo over the proven 1A planner + 1B execution kernels. Thin CLI, no new policy: consent phrases, sandbox containment, backups, receipts, undo proofs all live in the shipped kernels. Satisfies the four CLI gates (command-table parity, help-coverage, consent-matrix strong-consent row, ADR-012 naming: single-word + space subcommands). Stacked on feat/reversible-file-steward-1b (7e4198a).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 dema steward plan previews a job fail-closed without the exact preview phrase and eligible with it
- [x] #2 dema steward verify proves execute-all→undo-all round-trip in a real sandbox (genesis hash equality) via CLI
- [x] #3 dema steward run refuses wrong consent with zero mutation; run+undo restores original names
- [x] #4 cli-command-table, help-coverage, cli-consent-matrix, cli-naming-convention tests all green
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Red-first CLI spawn tests (tests/steward-cli.test.js). 2. apps/cli/src/commands/steward.js handler. 3. Wire index.js (import, COMMAND_TABLE, REGISTERED_COMMANDS_LIST, HELP). 4. COMMAND_SURFACE + consent-matrix row. 5. Docs rows (TESTING.md, CURRENT_LIMITS 1B). 6. Gates + commit on feat/reversible-file-steward-1c.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verification run 2026-07-19: tests/steward-cli.test.js 7/7 pass (spawned CLI, real tmpdir sandboxes). Four CLI gates green: cli-command-table + help-coverage + cli-consent-matrix + cli-naming-convention = 24/24. cli-consent-matrix-check.mjs PASS (steward row: local_write, exact_phrase). no-overclaim 0 warnings. integration-check exit 0 (ARCHITECTURE.md command-map row added). doc-freshness-gate OK. Full npm run check failure set byte-identical to pre-1C baseline (T-08 main breakage + 4 sandbox-only) — zero new failures. Commit 1a263dc on feat/reversible-file-steward-1c (stacked on 1b 7e4198a).

REOPENED BY RECONCILIATION 2026-07-19: local CLI tests are not sufficient for shipment. The underlying 1B sequence is not atomic on later-atom failure, and 1C run/undo crosses Dema no-runtime ownership; undo also lacks its own exact consent. Preserve commit ebf7367 as historical candidate. Redesign the Dema surface as preview/contract only and move execution to a governed runtime before requalification.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added dema steward plan|verify|run|undo CLI (apps/cli/src/commands/steward.js) as a thin surface over the proven 1A planner + 1B execution kernels — no new policy in the CLI. Verified with 7 spawned-CLI tests (plan fail-closed/eligible, real-sandbox round-trip restore, wrong-consent zero-mutation, run+undo restore, empty-job refusal), 24/24 CLI binding-gate tests, consent-matrix gate PASS, integration-check + doc-freshness green, npm-check baseline unchanged. Commit 1a263dc.
<!-- SECTION:FINAL_SUMMARY:END -->
