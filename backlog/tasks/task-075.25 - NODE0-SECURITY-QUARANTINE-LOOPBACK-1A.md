---
id: TASK-075.25
title: NODE0-SECURITY-QUARANTINE-LOOPBACK-1A
status: Done
assignee:
  - '@codex'
created_date: '2026-11-05 13:55'
updated_date: '2026-11-05 14:34'
labels: []
dependencies: []
parent_task_id: TASK-075
priority: high
type: bug
ordinal: 95000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Source-only security repair from 8f7e84f9: permanently refuse the retired JS gateway HTTP write route and bind direct Dema UI launchers to loopback. Preserve SCO/TASK-098 work. No deployment, installed runtime, signing, external writes, or authority changes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 All retired gateway mission POSTs return 410 without writing, including directory aliases, chain-file aliases, unresolved targets and target swaps; read-only fixtures remain usable.
- [x] #2 Both direct UI launcher scripts explicitly bind 127.0.0.1; bounded disposable launches verify binding and forged-Host non-loopback refusal.
- [x] #3 RED-first regressions, focused tests, npm test, npm run check, npm run llm:guidance and git diff --check are reported honestly; protected SCO bytes are unchanged.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Capture RED controls against unchanged source. 2. Delete the legacy HTTP write path and migrate its fixture tests to refusal/read-only checks. 3. Pin the existing Next launchers to loopback. 4. Run focused and full local gates in disposable homes, independently inspect socket bindings, and leave a reviewable local diff.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Qualified locally from base 8f7e84f9e7df0d58bc1ee3fc95bbb3b4c1e119dd. RED-first: 13 cases, 2 passing controls and 11 failures on unchanged production source; directory/file aliases and target swaps appended to synthetic protected chains. Final focused suite: 83 pass, 0 fail. Final npm test: 10603 pass, 0 fail, 4 skip. Final npm run check: exit 0; native coverage 95.48% lines, 54084/64382 branches (84.004846%), 97.55% functions. The earlier 83.99% coverage gate failure is retained. Guidance, claim corpus and whitespace checks pass. Next.js 16.4.3 disposable dev and standalone fixtures served only on 127.0.0.1 and refused non-loopback requests with Host: localhost, despite inherited HOSTNAME=0.0.0.0. Both fixture processes were stopped. Seven protected SCO/TASK-098 paths match their original hashes. SELF_REVIEW_CLEAN for this scope. Evidence and complete patch: .artifacts/security-quarantine-loopback-1a/. Source candidate remains uncommitted; no push, merge, installation, host service change, signing or authority expansion. Full installed UI, a second-machine client, host D-Bus, namespace observation and Node0 closure are not qualified.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Removed the retired gateway writer and direct startup path; every mission POST now returns 410, including fixtures and aliases. Pinned direct UI dev/start to 127.0.0.1. Migrated legacy simulated-execution fixtures to refusal and read-only checks. Local focused tests, full tests, aggregate gate, guidance, corpus and diff checks pass; disposable Next.js socket probes confirm the launcher bindings. Protected SCO work is unchanged.
<!-- SECTION:FINAL_SUMMARY:END -->
