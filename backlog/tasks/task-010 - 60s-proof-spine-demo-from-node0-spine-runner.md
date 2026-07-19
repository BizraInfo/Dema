---
id: TASK-010
title: 60s proof-spine demo from node0-spine-runner
status: Done
assignee: []
created_date: '2026-07-18 03:37'
updated_date: '2026-07-19 02:31'
labels:
  - later
  - market-proof
dependencies: []
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Zero-build: node0-spine-runner.js (305 lines, NODE0_MEASURED_PROOF_SPINE_SANDBOX_RUN) already composes execute->receipt->proof-chain->signed head. Script + capture = GTM uncut-demo seed. GoT G4, screen-verified EXACT.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Demo receipt CAPTURED: /data/bizra/logs/spine-runner-demo-2026-07-18.json — ok:true, NODE0_MEASURED_PROOF_SPINE_SANDBOX_RUN, sandbox-only boundary, exact-consent hash-bound. Remaining: package as 60s narrated capture for GTM (uncut-demo seed).

Packaged 2026-07-19: /data/bizra/research/spine-demo/{run-demo.sh,DEMO_60S_SCRIPT.md} — 3-beat narrated script (refusal → consented run → signed proof). Rehearsed end-to-end: exit 0, 4s script runtime, spine core 101ms, ok:true + receipt_attestation_signed + chain_head_attestation_signed. Fresh receipt /data/bizra/logs/spine-runner-demo-2026-07-19.json. Command verified as 'dema node0 spine run --consent "GO: run measured proof spine in sandbox"' (fail-closed without it).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
60s demo packaged and rehearsal-verified: runnable 3-beat script + timed narration doc + fresh signed receipt. Core loop (execute→receipt→proof-chain→signed head) measured at ~100ms live. Remaining operator step (screen recording with narration) is documented in the script — the seed asset itself is complete.
<!-- SECTION:FINAL_SUMMARY:END -->
