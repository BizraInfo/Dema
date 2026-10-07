---
id: TASK-075.18
title: Genesis Root-Bound Estate Refinery 0A — specification and schemas
status: Done
assignee:
  - '@codex'
created_date: '2026-08-23 15:55'
updated_date: '2026-08-23 16:08'
labels:
  - genesis-root
  - estate-refinery
  - spec-only
  - authority-zero
dependencies:
  - TASK-075.17
references:
  - docs/root-canon/BIZRA_ROOT_CANON_v0_1.md
  - docs/root-canon/root-canon.manifest.json
  - docs/LLM_SYSTEM_FLOW.md
modified_files:
  - docs/02-architecture/NODE0_GENESIS_ESTATE_REFINERY_0A.md
  - tests/node0-genesis-estate-refinery-spec.test.js
  - docs/CURRENT_LIMITS.md
  - docs/TESTING.md
parent_task_id: TASK-075
priority: high
type: docs
ordinal: 65000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Specify, without implementing or running it, a safe read-only Node0 closure path that turns one approved BIZRA source root into an evidence-weighted clean digital-twin plan governed by the three immutable Genesis roots. Reuse the existing Root Canon manifest and drift verifier as the sole root authority; add no scanner, provider, runtime, receipt minting, source-root mutation, secret handling, cloud write, or publication.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 One concise specification names the existing three-root manifest and verification script as the only root authority, defines hash-match and drift-lock outcomes, and never rewrites the immutable root manifest or source files.
- [x] #2 The specification defines a DEMA DNA pack and a Node0 Estate Refinery mission contract with explicit read-only, no-runtime, and authority-zero boundaries.
- [x] #3 Asset card, claim card, receipt-shaped evidence record, and approved source-root schemas are canonical, bounded, path-safe, secret-free, and explicitly non-runtime.
- [x] #4 A clean twin folder plan is declarative only: it identifies proposed containment, naming, and provenance rules without creating, deleting, renaming, or copying any files.
- [x] #5 A DEMA daily brief template reports evidence, drift, unknowns, and hold states without claiming mission completion or generating a receipt.
- [x] #6 The Definition of Done checklist preserves COMPONENT/SPECIFICATION scope and explicitly excludes live scanning, provider/model calls, cloud/public writes, keys/secrets, runtime activation, recovery, VRO, and Node0 closure.
- [x] #7 Focused documentation/schema tests or deterministic static checks prove the new contract is complete and has no runtime instruction or root-mutating path.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reuse the immutable Root Canon manifest and verifier rather than copy or replace root authority; establish a red-first static specification test.
2. Add one compact specification containing the DNA pack, future mission contract, four bounded schemas, declarative twin plan, daily brief, and done checklist.
3. Keep the document specification-only, verify it rejects runtime/mutation ambiguity through static assertions, then run the focused and repository gates.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verification: focused static specification test passed; existing Root Canon verifier returned BIZRA_ROOT_CANON_SEALED for all three roots; npm test passed (9560 pass, 0 fail, 4 skipped); npm run check passed; npm run llm:guidance passed; git diff --check passed. Caution: the pre-existing root-canon negative-control test temporarily rewrites then exactly restores the manifest to prove drift refusal; post-test read-only verification confirms no persistent manifest or root-PDF drift.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Delivered the compact Genesis Root-Bound Estate Refinery 0A specification and static contract test. It reuses the existing immutable Root Canon manifest/verifier, declares VERIFIED/DRIFT_LOCKED/UNKNOWN outcomes, defines the DEMA DNA pack, future mission contract, approved-root/asset/claim/evidence-record schemas, declarative clean-twin layout, daily brief, and scope-limited DoD. It creates no source-root approval, scan, twin, mission, runtime, receipt, provider/model call, key/secret, cloud/public write, recovery proof, VRO, or Node0 closure claim. Final current Root Canon verification: BIZRA_ROOT_CANON_SEALED.
<!-- SECTION:FINAL_SUMMARY:END -->
