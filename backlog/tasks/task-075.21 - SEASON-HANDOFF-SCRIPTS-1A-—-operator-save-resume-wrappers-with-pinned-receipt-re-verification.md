---
id: TASK-075.21
title: >-
  SEASON-HANDOFF-SCRIPTS-1A — operator save/resume wrappers with pinned receipt
  re-verification
status: Done
assignee:
  - '@codex'
created_date: '2026-08-24 23:12'
updated_date: '2026-08-24 23:31'
labels: []
dependencies: []
references:
  - docs/LLM_SYSTEM_FLOW.md
  - docs/audits/PRE0_REALITY_RECONCILIATION_1A.json
  - docs/audits/PROD01_2B_REBIND_1A.json
  - packages/receipts/src/season-state-store.js
parent_task_id: TASK-075
ordinal: 68000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Operator tooling over proven kernels (no new authority): scripts/season/save.sh closes the current season into a durable handoff checkpoint via `dema season save`, deriving repository_commit/repository_tree from git HEAD and resolving the season id when DEMA_HOME holds exactly one. scripts/season/resume.sh --from <handoff-receipt-hash> runs a fail-closed environment preflight on any fresh shell/machine: re-derive body_digest/receipt_hash of the committed PRE0 (pin f5078a9e...) and PROD01_2B (pin 27c07d9d...) audit receipts including the 2B-to-PRE0 hash chain, verify every configured worktree is clean, and bind-probe loopback port 7421. READY_FOR_HUMAN_GO means environment readiness only and grants nothing; authority still enters exclusively through the exact H1 consent block.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 save.sh derives repo-commit/repo-tree from git HEAD unless explicitly given
- [x] #2 save.sh auto-resolves exactly one existing season; refuses with clear reason on zero seasons or ambiguity (>1 without --season)
- [x] #3 --reason maps to next_safe_action only when --next absent; passing both refuses
- [x] #4 resume.sh re-computes both receipt envelopes from bytes and compares to pins plus chain links; any mismatch yields NOT_READY_FOR_HUMAN_GO and exit 1
- [x] #5 worktree-clean check covers repo root by default plus DEMA_SEASON_WORKTREES overrides; port check binds 127.0.0.1:7421 for real
- [x] #6 tests/season-handoff-scripts.test.js covers digest reproduction, tamper+chain-break refusals, dirty worktree, occupied port, malformed --from, save.sh derivation and refusals
- [x] #7 docs/TESTING.md and docs/CURRENT_LIMITS.md updated; full local gate green
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verification evidence (2026-08-25): tests/season-handoff-scripts.test.js 14/14 green — S1 proves git-HEAD derivation into persisted state, S2 sequence chaining, S3 reason-token law + conflict refusal, S4/S4b season resolution refusals and auto-resolution, H1-H3 digest rederivation/tamper/chain isolation, W1 worktree classification, P1 real bind probe, R1-R4 preflight + CLI verdicts. Full ladder green: npm test 9577 pass / 0 fail (G8 classifier exit 0), npm run check exit 0, npm run llm:guidance PASS, git diff --check clean. Two gate catches repaired during work: actuator-check flagged regex .exec() in resume-check.mjs (replaced with String.match) and env-hygiene drift trap forced declaration of DEMA_SEASON_AUDITS_DIR/PORT/REPO_ROOT/WORKTREES in KNOWN_DEMA_ENV_VARS.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented SEASON-HANDOFF-SCRIPTS-1A: scripts/season/save.sh (derives repo commit/tree from git HEAD, auto-resolves single season, --reason as exact-token sugar for --next, copyable handoff line) and scripts/season/resume.sh + resume-check.mjs (fail-closed preflight re-deriving the committed PRE0 f5078a9e and PROD01 2B 27c07d9d receipt envelopes from bytes incl. the 2B-to-PRE0 chain, real git worktree-clean check, real loopback bind probe on 7421; READY_FOR_HUMAN_GO grants nothing). Verified with tests/season-handoff-scripts.test.js (14/14) and the full local gate: npm test 9577/0, npm run check exit 0, llm:guidance PASS, git diff --check clean.
<!-- SECTION:FINAL_SUMMARY:END -->
