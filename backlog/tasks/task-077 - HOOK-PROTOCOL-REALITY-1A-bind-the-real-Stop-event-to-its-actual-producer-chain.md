---
id: TASK-077
title: >-
  HOOK-PROTOCOL-REALITY-1A: bind the real Stop event to its actual producer
  chain
status: In Progress
assignee:
  - '@codex'
created_date: '2026-08-23 07:38'
updated_date: '2026-08-23 10:12'
labels:
  - hooks
  - protocol
  - harness
  - no-false-green
dependencies: []
priority: high
type: bug
ordinal: 59000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Explain and close the user-observed error: hook returned invalid stop hook JSON output. The focused Stop-hook contract tests are green, but the actual harness Stop event is reported failing; a passing intended hook path is not evidence that the harness selected that path. Scope is the Stop event only. Do not repair SessionStart, change PROD-01, promote a candidate, start runtime, consume consent, push, merge, or modify unrelated hooks.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Enumerate every Stop hook selected by user, project, local, and dispatcher configuration, with exact selection precedence.
- [ ] #2 For every selected producer, record executable path, SHA-256, cwd, relevant environment, stdin payload, stdout bytes, stderr bytes, and exit status without normalizing the negative control.
- [ ] #3 Classify each producer as stdout-silent, one valid Stop decision object, non-JSON stdout, multiple JSON objects, wrong schema, failure-before-output, or UNKNOWN.
- [ ] #4 Prove report-only Stop output is exactly zero stdout bytes and block output is exactly one contract-valid decision object with only permitted fields.
- [ ] #5 Prove stderr noise is not interpreted as protocol stdout and two registered hooks cannot create an invalid combined protocol stream.
- [ ] #6 Prove the physical hook file invoked by the actual harness; an unused mirror does not satisfy this criterion.
- [ ] #7 Inject one extra stdout byte as a removal control and show the real contract test fails.
- [ ] #8 Trigger an actual harness Stop after repair and capture absence of the invalid-JSON error, or report STOP_HOOK_REALITY_INCOMPLETE with the precise missing observation.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Bind the current host selection: enumerate global, project, local, and enabled-plugin Stop registrations; snapshot exact executable paths and SHA-256 values.
2. Reproduce each selected producer with the same JSON stdin and capture raw stdout, stderr, exit status, cwd, and relevant environment; retain the Ralph terminal branch as the negative control.
3. Add a red-first protocol test at the causal Ralph Stop implementation boundary, including the extra-byte removal control and multi-hook aggregation rule.
4. Apply the smallest fix to the selected producer only; preserve blocking decision JSON and keep allowed/report-only paths stdout-silent.
5. Run focused, full, lint/guidance, diff, and deterministic self-loop preview checks; trigger or precisely bound the remaining actual-host Stop observation.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-08-23 rapid-sprint rebind: the task remains a Stop-event-only repair. Confirmed prior evidence identifies a conditional malformed Ralph Loop Stop producer; Dema project hook mirrors are a separate already-repaired surface. No runtime, consent, production, SessionStart, or unrelated-hook scope is authorized.

2026-08-23 rapid-sprint evidence: red-first fixture against enabled Ralph Loop v1.0.0 terminal paths produced human text on stdout (exit 0), violating the Stop protocol. Repaired only the exact active cache producer at /home/bizra-operating-system/.claude/plugins/cache/claude-plugins-official/ralph-loop/1.0.0/hooks/stop-hook.sh by redirecting its two terminal echoes to stderr; current SHA-256 55bb28b66026d42b7e5f8014e8152e66aac1a4fdad819bd945df65f9f71923b0. Host-bound focused matrix: 11/11 pass (terminal silence, continuing decision schema, one-byte removal control); normal repository focused matrix: 7 pass, 4 host-bound skips. npm test: 9520 pass, 0 fail, 4 skips. npm run check, npm run llm:guidance, and git diff --check: PASS. Dema peak-self-loop preview remained preview-only with no runtime/model/network/write/consent. STOP_HOOK_REALITY_INCOMPLETE: no actual post-repair Claude Stop event has been observed; real aggregation/selection proof remains limited to captured configuration and direct producer fixtures. SessionStart intentionally untouched; no runtime, consent, PROD-01, push, merge, or promotion.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @codex
created: 2026-08-23 07:48
---
Measured 2026-08-23: six direct configured global/project Claude Stop handlers were stdout-silent on an allowed standard Stop payload; the project closeout and lexicon block paths each emitted one decision object. Installed Claude 2.1.237 parser accepts async metrics envelopes; Security Guidance 2.0.7 disabled/no-review controls emitted one metrics object matching that envelope. Ralph Loop is enabled and inactive now (no .claude/ralph-loop.local.md), but its exact Stop source has two terminal branches that print human text to stdout before exit 0; this is a confirmed conditional malformed synchronous Stop path. No durable host event trace or historical Ralph state was available, so the 11:36 producer and actual harness-triggered post-repair proof remain UNKNOWN. No source/config/plugin edits made.
---

author: @codex
created: 2026-08-23 07:49
---
Red control added: executed the exact installed Ralph Loop 1.0.0 Stop executable from an isolated active-loop fixture at its max-iteration terminal branch. Result: exit 0; stdout 45 bytes of non-JSON UTF-8 human text; stderr 0; state file removed by the hook. This proves a synchronous malformed-output defect in a currently enabled Stop producer. The current project state file is absent, which is consistent both with no active Ralph loop and with this terminal branch having just removed it; therefore it does not establish the historical 11:36 producer. No patch applied: HP-05 actual-host file binding and HP-07 real post-repair Stop observation remain unmet.
---
<!-- COMMENTS:END -->
