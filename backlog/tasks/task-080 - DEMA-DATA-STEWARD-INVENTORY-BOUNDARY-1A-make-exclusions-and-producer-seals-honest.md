---
id: TASK-080
title: >-
  DEMA-DATA-STEWARD-INVENTORY-BOUNDARY-1A: make exclusions and producer seals
  honest
status: Done
assignee:
  - '@codex'
created_date: '2026-08-27 21:13'
updated_date: '2026-08-27 22:07'
labels:
  - data-steward
  - truth-boundary
  - metadata-only
dependencies: []
references:
  - steward-2026-08-27T2101 audit finding
documentation:
  - .agents/skills/dema-data-steward/SKILL.md
  - .agents/skills/dema-data-steward/references/output-contract.md
priority: medium
type: bug
ordinal: 81000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The 2026-08-27 Steward report claimed that node_modules was excluded, but the shipped metadata inventory has no exclusion rule and recorded 988 node_modules paths. Repair the existing Steward producer contract so a future metadata-only run either records exact explicit exclusions or makes no exclusion claim, and so its seal binds the producer-script bytes. This protects the operator from a report whose stated evidence boundary differs from the observed inventory. Scope is limited to the untracked Data Steward skill, a focused regression test, and its operator contract; source content remains unread and /data/bizra/node0-closure remains immutable.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 An explicit repeatable directory-name exclusion is opt-in, is applied before descendants are inventoried, and summary output names the effective rule plus each skipped directory path; default behavior does not silently exclude content.
- [x] #2 A focused fixture proves a node_modules subtree is omitted only when requested, ordinary files remain, symlinks are not followed, and metadata-only mode reports content_read_performed false.
- [x] #3 A Steward run receipt binds each declared producer script by resolved path, byte size, and SHA-256; invalid or duplicate script inputs fail closed.
- [x] #4 A fresh metadata-only run over /data/bizra/node0-closure writes only to a new /tmp output root, records the explicit node_modules exclusion, verifies sealed output hashes, and truthfully distinguishes source-root mutation false from temporary output writes.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add an opt-in exact directory-name exclusion to the shared inventory traversal and persist its effective names plus skipped paths in summary output; default remains no exclusions. 2. Add producer-script identity and declared-source-root/output separation to the sealing receipt, rejecting ambiguous output placement and invalid or duplicate producer inputs. 3. Add one Node-native temporary-fixture regression test, update only the Steward operator contract and test matrix row, then run a fresh metadata-only /tmp census with no content hashing. 4. Re-derive receipt/body hashes, run focused and repository gates, and close with the observed residual proof gaps.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-08-27: Rebound from disk, retained the existing focused scripts/test, and made the output contract plus TESTING matrix explicit. Fresh metadata-only census: /data/bizra/node0-closure -> /tmp/dema-data-steward-task080-TJoimI/output; content_read_performed=false, one explicit node_modules exclusion, 0 inventory errors, authority_delta=0. Seal receipt 6953f7682f57ff3bfc1d385ea03d87e0167018be3cd8ceaf8d1269d57fa69998 independently re-derived with canonical Python JSON; its two output hashes match, declared source-root mutation=false, and temporary output write=true. Focused Node test and Python compilation pass. Full repository gates pending.

2026-08-27 final verification: node --test tests/dema-data-steward-scripts.test.js passed 2/2; python3 -m py_compile passed; receipt body and its two sealed output hashes re-derived again. npm test exited 0 (9777 tests: 9773 pass, 0 fail, 4 skipped); npm run check exited 0 with every declared gate zero; npm run llm:guidance and git diff --check exited 0. No source content was read and no /data/bizra/node0-closure mutation was performed by this Steward run.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Made Data Steward exclusions and producer seals evidence-honest; verified with focused fixtures, a fresh metadata-only /tmp census and independently recomputed receipt/output hashes, plus passing repository gates.
<!-- SECTION:FINAL_SUMMARY:END -->
