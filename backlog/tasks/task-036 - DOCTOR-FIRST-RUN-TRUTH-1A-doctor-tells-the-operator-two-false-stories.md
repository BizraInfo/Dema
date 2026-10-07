---
id: TASK-036
title: 'DOCTOR-FIRST-RUN-TRUTH-1A: doctor tells the operator two false stories'
status: In Progress
assignee:
  - '@claude'
created_date: '2026-07-28 05:24'
updated_date: '2026-07-28 06:18'
labels:
  - cli
  - ux
  - claim-discipline
dependencies: []
references:
  - packages/core/src/doctor-dashboard.js
  - packages/core/src/status.js
  - packages/node-adapter/src/node0-adapter.js
  - packages/core/src/onboarding-seal.js
  - docs/QUICKSTART.md
priority: high
type: bug
ordinal: 36000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A clean-home operator walkthrough (fresh DEMA_HOME, dema setup -> dema doctor) surfaced two false claims in the doctor presentation layer. Both were reproduced under isolated throwaway homes.

DEFECT 1 — dead-end fix hint. `dema doctor` on a BLOCKED gate prints: "activation gate is BLOCKED; run `dema setup` to initialize and check doctrine consent" (packages/core/src/doctor-dashboard.js:50). Measured: the gate is byte-identical BLOCKED before AND after `dema setup`. defaultStatus() hardcodes activationGate:"BLOCKED" (packages/core/src/status.js:8) and setup never touches it. The only lever that moves the gate is the operator bridge (DEMA_NODE0_ADAPTER / DEMA_GATEWAY_URL / DEMA_NODE0_STATUS_COMMAND, packages/node-adapter/src/node0-adapter.js:137-157) — which the doctor never names. Proven: with a stub status source emitting activation_gate=EXPLICIT_GO_REQUIRED, doctor goes 5/5 green exit 0. So a nontechnical operator following the printed advice loops forever with no discoverable next step. docs/QUICKSTART.md:85 repeats the same false claim ("Activation is BLOCKED — by design, until you complete setup").

DEFECT 2 — "Gateway probe" asserts a measurement it never takes. The predicate is synthesized by substring-sniffing the free-text findings array for "not connected" (doctor-dashboard.js:32-36). It opens no socket. Measured three ways, all printing "OK Gateway probe reachable": (a) findings:[] — nothing probed; (b) findings:["gateway refused connection ... ECONNREFUSED"] — an explicit failure worded differently than the sniffed substring; (c) a REAL dead gateway (DEMA_NODE0_ADAPTER=gateway-http DEMA_GATEWAY_URL=http://127.0.0.1:9, nothing listening). In case (c) the adapter payload is honest — truth_label:"DEGRADED", gateway.reachable:false, and four "Gateway /health unreachable: fetch failed" findings — so doctor contradicts its own data source in the same run while ignoring the authoritative structured field gateway.reachable.

Why it matters: doctor is the surface `dema welcome` advertises as the OpenClaw-derived promise to "make blocked states obvious and route repair through explicit commands". Defect 1 makes the blocked state unrepairable; defect 2 asserts an unmeasured green. Defect 2 is a ZANN violation (speculation presented as certainty) and violates the status-generated-from-state rule.

Note (code-read, not CLI-proven): packages/core/src/onboarding-seal.js:187 gates on the same activationGate === "EXPLICIT_GO_REQUIRED" comparison, so the same misleading value flows into a proof artifact. Worth checking during the fix; the seal kernel is not routed to a CLI command in this tree.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 dema doctor on a BLOCKED gate names the operator bridge (DEMA_NODE0_ADAPTER / DEMA_GATEWAY_URL / DEMA_NODE0_STATUS_COMMAND) as the lever, and no longer tells the operator to run `dema setup` to move the gate
- [x] #2 The Gateway probe predicate reads the structured gateway.reachable field (and/or performs a real probe) instead of substring-sniffing findings text
- [x] #3 A real dead gateway (DEMA_GATEWAY_URL=http://127.0.0.1:9) makes the Gateway probe predicate report unreachable, not reachable
- [x] #4 docs/QUICKSTART.md no longer claims the activation gate is BLOCKED until setup completes
- [x] #5 Red-first tests in tests/doctor-dashboard-cli.test.js (or a mirror) cover all three adversarial inputs: empty findings, differently-worded failure findings, and gateway.reachable=false
- [x] #6 A status payload whose reachability was never measured (findings:[] and no gateway field) never prints the bare "reachable" claim; it reports n/a instead — operator-approved 2026-07-28, superseding the original AC4 wording ("does not yield a green Gateway probe"), which would have made a healthy legacy DEMA_NODE0_STATUS_COMMAND bridge permanently read "blocked" because the verdict treats any warn as blocking
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Branch fix/doctor-first-run-truth-1a off 9289574 (targets verified clean; operator WIP untouched).
2. RED in tests/doctor-dashboard.test.js — gatewayProbe derives from the structured status.gateway.reachable field, never from findings prose:
   - gateway.reachable===true -> ok "reachable"
   - gateway.reachable===false -> warn "unreachable"
   - gateway absent -> warn "not probed" (NEVER ok — fail-closed on the claim)
   - differently-worded failure findings + no gateway field -> not ok
   Keep warn (not fail) so preview-only operators still see no red; that contract is unchanged.
3. RED for the gate hint: activationGate BLOCKED -> fix names the operator bridge (DEMA_NODE0_ADAPTER/DEMA_GATEWAY_URL/DEMA_NODE0_STATUS_COMMAND) and does NOT say `dema setup`. This inverts the existing assertion at tests/doctor-dashboard.test.js:63 which encodes the defect.
4. RED integration in tests/doctor-dashboard-cli.test.js — a real dead gateway (DEMA_NODE0_ADAPTER=gateway-http, DEMA_GATEWAY_URL=http://127.0.0.1:9) must not print a reachable Gateway probe.
5. Update the defaultOkStatus() fixture to carry gateway:{reachable:true} — it currently relies on the buggy findings:[] inference to go green.
6. GREEN: minimal edit to evaluatePredicates in packages/core/src/doctor-dashboard.js.
7. Correct docs/QUICKSTART.md:85.
8. Gates: node --test on both doctor files, then npm test + npm run check + npm run llm:guidance + git diff --check.

SCOPE NOTE: the `ready` predicate fix-text (doctor-dashboard.js:81) carries the SAME false "run `dema setup`" pointer. Fixing only the gate would still leave doctor telling the operator to run setup one line below, defeating AC1 intent. Extending to that one line and flagging it for the operator rather than shipping a half-fix.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
VERIFIED 2026-07-28.

Change: packages/core/src/doctor-dashboard.js (3 edits), docs/QUICKSTART.md (1 claim), tests/doctor-dashboard.test.js + tests/doctor-dashboard-cli.test.js (+9 tests). Nothing else touched.

Gateway predicate now has THREE states instead of two — the two-state design was the root of defect 2, because "not reachable-false" had to collapse into "reachable":

    gateway.reachable === true  -> ok   "reachable"
    gateway.reachable === false -> warn "unreachable (by design when no runtime running)"
    absent                      -> ok   "n/a (no gateway configured)"

The findings substring sniff is deleted outright, so prose can no longer move the verdict in either direction.

Operator decision, asked mid-implementation and approved: the absent case is ok/"n/a", mirroring the Daemon predicate existing "n/a-via-gateway" ok. It was first implemented as warn/"not probed", which satisfied the original AC4 literally but regressed a real path — formatDoctorDashboard treats ANY warn as "blocked" at doctor-dashboard.js:162, so a HEALTHY legacy DEMA_NODE0_STATUS_COMMAND bridge went from "ready and consent-gated" exit 0 to "blocked". Caught by the end-to-end re-run, not by the unit tests. AC4 was reworded to the truth-preserving invariant — never claim reachability that was not measured — and renumbered #6.

Scope extension, declared: the `ready` predicate fix-text carried the identical false "run `dema setup`" pointer. Setup does not set `ready` either; it mirrors the adapter payload. Fixed in the same edit and covered by its own test, because shipping AC1 while doctor still said "run `dema setup`" one line below would have defeated it. One line, trivially revertible.

RED proven before any production edit: 7 failures, each for its intended reason — dead gateway "reported as reachable", gate and ready fixes matching /dema setup/, and reachable=false plus empty-findings plus differently-worded-findings all rendering ok. Second RED cycle for the n/a change: 2 failures.

## Gate results, this sandbox

- node --test on both doctor files: 27 pass / 0 fail
- npm test: 8084 tests, 8077 pass, 7 fail, exit 1
- npm run check: exit 1 at gate 35 repo-claude-config-check
- npm run llm:guidance: exit 0
- git diff --check: exit 0
- scripts/review/kernel-purity-check.mjs: OK, 443 scanned, 0 violations
- scripts/review/no-overclaim.mjs: exit 0

## npm test and npm run check are RED AT BASE TOO

Proven, not assumed, by running both at 9289574 in a detached git worktree mounted on a Dema-basename path. Worktree, never stash; operator WIP untouched; worktree removed afterwards.

- base npm test: 8075 tests, 8070 pass, 5 fail, exit 1 — same 5 names (isolated preflight CLI, authorship-key-rotate, human summary gem counts, proof artifacts raw private data, self-check reports raw private data)
- base npm run check: exit 1, byte-identical failure — no_secret_patterns_tracked in .claude/agents/project-manager-backlog.md
- The 2 extra failures in this tree (claude Stop hook, x2) are a SANDBOX artifact, isolated to root cause: .claude/hooks/stop-closeout-check.mjs appends to .claude/hooks/logs/stop-closeout-check.jsonl, which is sandbox-read-only in the main checkout (EROFS) but writable inside a $TMPDIR worktree. The resulting non-empty stderr trips the test assertion `assert.equal(stderr, "")`. The same file passes 5/5 in the worktree. Not a code regression; would pass outside the sandbox.
- Arithmetic reconciles exactly: 8075 + 9 = 8084 tests; 8070 + 9 - 2 = 8077 pass; 5 + 2 = 7 fail. All 9 new tests pass. Zero regressions attributable to this change.

## End-to-end operator evidence, fresh throwaway DEMA_HOME

- A · no bridge → gate BLOCKED with bridge-naming fix · Gateway probe "n/a (no gateway configured)" · blocked
- B · dead gateway on :9 → Gateway probe "unreachable", previously the false "reachable" · blocked
- C · healthy legacy bridge → gate EXPLICIT_GO_REQUIRED · Gateway probe n/a · "ready and consent-gated" exit 0

NOT DONE: uncommitted and unpushed. Commit and push were not authorized this session.

COMMITTED c61c54f on fix/doctor-first-run-truth-1a (base 9289574). Exactly 4 files, +171/-18: packages/core/src/doctor-dashboard.js, docs/QUICKSTART.md, tests/doctor-dashboard.test.js, tests/doctor-dashboard-cli.test.js.

Commit self-sufficiency PROVEN, not assumed: detached worktree at c61c54f, both doctor test files run 27 pass / 0 fail from the commit alone — so nothing in the slice depends on the uncommitted operator WIP sharing this tree. Worktree removed after.

Operator WIP untouched and verified: the tracked-modified set is byte-identical to the session-start snapshot (same 12 M entries). The only files this session added to the tree are the two backlog task files, 036 and 037.

Still unpushed. No PR opened.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Closed both false claims in the dema doctor presentation layer. (1) The BLOCKED-gate and not-ready fix hints pointed at `dema setup`, which cannot move either value — defaultStatus() hardcodes activationGate BLOCKED and setup never touches it; both now name the operator bridge that actually reports them, and docs/QUICKSTART.md:85 was corrected to match. (2) The Gateway probe predicate synthesized reachability by substring-sniffing the free-text findings array, so it printed a green "reachable" for empty findings, for differently-worded failures, and for a genuinely dead gateway whose own payload said gateway.reachable=false. It now reads that structured field, with a third n/a state for no-gateway configs so a healthy legacy bridge still reaches a green verdict without anyone asserting an unmeasured reachability. Verified red-first (7 failures, then 2 for the n/a revision), 27/27 green on both doctor test files, and end-to-end across all three operator cases on throwaway DEMA_HOMEs. npm test and npm run check remain red in this sandbox, proven pre-existing by re-running both at base 9289574 in a detached Dema-basename worktree: identical failure names, plus 2 sandbox-only EROFS failures traced to .claude/hooks/logs being read-only here. Uncommitted and unpushed.
<!-- SECTION:FINAL_SUMMARY:END -->
