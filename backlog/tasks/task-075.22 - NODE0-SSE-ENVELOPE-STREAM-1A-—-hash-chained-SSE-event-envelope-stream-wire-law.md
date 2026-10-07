---
id: TASK-075.22
title: NODE0-SSE-ENVELOPE-STREAM-1A — hash-chained SSE event-envelope stream wire law
status: Done
assignee: []
created_date: '2026-08-24 23:51'
updated_date: '2026-08-24 23:52'
labels: []
dependencies: []
references:
  - docs/02-architecture/NODE0_SSE_ENVELOPE_STREAM_v0_1.md
  - packages/core/src/node0-sse-envelope-stream.js
parent_task_id: TASK-075
ordinal: 69000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Pure kernel characterizing the envelope+persistent-connection+SSE composition as named, testable laws: builder derives seq 1..n and chains hashes under the canonical byte contract; verifier refuses gaps/duplicates/chain breaks/tampered bytes/unknown kinds/state-carrying heartbeats/post-terminal events by name; exactly-one-terminal law kept distinct from missing-terminal; SSE wire round-trip through a refusing parser lets reconnecting consumers re-derive order+integrity without trusting the connection. Wire law seed for TASK-075.03 PROD-02 execution transport. No socket, server, port, runtime, or network — transport stays forbidden to this kernel.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 focused test green with every refusal law individually named
- [x] #2 review gate wired into npm run check and passing with three negative controls
- [x] #3 registry row + count bump wired; what_this_proves precise and non-overclaiming
- [x] #4 receipt + architecture doc finished; CURRENT_LIMITS promoted to MEASURED only after full ladder green
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Evidence: tests/node0-sse-envelope-stream.test.js 19/19; registry test green after scaffold count bump 81->82; npm run check exit 0 with node0-sse-envelope-stream-check.mjs PASS; full ladder npm test 9600/9596/0 fail G8 clean, llm:guidance PASS, git diff --check clean. Launder limit (forged body + recomputed hash) stated in test source and receipt — no overclaim.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented NODE0-SSE-ENVELOPE-STREAM-1A via red-first scaffold: kernel (build/buildStream/verify/serialize/parse + orchestrator with three negative controls), 19-test mirrored contract, review gate wired into check.mjs, registry row+count, receipt+architecture docs, CURRENT_LIMITS MEASURED. Verified: focused 19/19, npm test 0 fail, npm run check exit 0, llm:guidance PASS, git diff --check clean.
<!-- SECTION:FINAL_SUMMARY:END -->
