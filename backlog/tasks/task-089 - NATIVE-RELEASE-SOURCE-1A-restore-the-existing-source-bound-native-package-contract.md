---
id: TASK-089
title: >-
  NATIVE-RELEASE-SOURCE-1A: restore the existing source-bound native package
  contract
status: Done
assignee:
  - '@codex'
created_date: '2026-10-16 16:02'
updated_date: '2026-10-16 17:12'
labels: []
dependencies: []
references:
  - TASK-088
priority: high
type: task
ordinal: 90000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The locally qualified cf896009 readiness candidate lacks the native release tooling used by installed release 225c5189. Restore the coherent source-bound owner and deterministic UI build-ID hook, then qualify a real candidate package in an isolated offline build. Existing installation and services must remain untouched. The later a51b521 producer-version/npm recovery change is excluded because its verifier still accepts 2.3.0.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The candidate reuses the source-bound native release owner and adds only the Next 16.4 required preview-props compatibility repair under an explicit versioned contract; no execution authority or legacy typecheck bypass is added.
- [x] #2 The UI build uses the native deterministic build-ID input and retains TypeScript checking; required test registration is present.
- [x] #3 Focused release controls and required repository gates pass on recorded exact source with unchanged coverage thresholds.
- [x] #4 A real offline isolated candidate package is produced and independently qualifies against its exact source, with negative controls rejecting drift.
- [x] #5 Original primary files, prior candidate and installed/runtime anchors remain unchanged; reverse patch and unsigned local evidence bind the result.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Preserve anchors and reproduce missing-owner RED. 2. Restore native source/test, UI build-ID hook and mandatory test registration. 3. Preserve and repair the real Next 16.4 preview-copy refusal across versioned producer, verifier and projection. 4. Restore the original build-ID environment inventory entry required by unchanged T-13; preserve its RED and strict classification. 5. Run focused controls and complete repository gates on exact source. 6. Build the final offline package, verify it and semantic negative controls, then check rollback and preservation. No installation or service action.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Created clean local unsigned candidate 4148ce75f662f947a11b52868c6f2ddc87983c9a at the TASK-088 source. Existing native release suite reproduced missing-module RED, then passed 24/24 after exact v2.3.0 owner restoration; integration plus release suite passed 31/31. Only seven paths changed. UI config adds generateBuildId and retains TypeScript checking. Build A is running in a network-unshared bubblewrap namespace with read-only source/cache and confined writable output; no installation or service action.

Build A compiled and type-checked, then the unchanged native producer correctly refused NEXT_INSTANCE_SECRET_LEAK at .next/server/preview-props.json. Next 16.4 adds this preview copy. The existing producer, verifier and runtime projection must all bind it; no new path, dependency, authority or typecheck bypass is required.

Build A is terminal exit 1: type checking and compilation passed, but native secret scanning refused the Next 16.4 preview-props copy. Preserved raw failure and source-only regression RED. The bounded v2.4 compatibility repair now clears and independently checks that required copy and materializes it only in the disposable instance projection. Focused release plus integration is 32/32, including a child-process fixture that checks state correspondence, payload immutability and cleanup without opening a listener. Clean unsigned source 9f012a678b7e96a8833eb5c057608697471b3e9e is ready for Build B; no threshold or type checking bypass.

The first full npm test correctly failed T-13: restored process.env.DEMA_V2_BUILD_ID is absent from the readiness environment inventory. The historical 225c5189 owner contains this inventory entry. Restore that single existing entry in scripts/review/env-hygiene-check.mjs; no strict exemption or behavior weakening. The initial full log is preserved. Seven skips include three optional Rust-source sync checks under the isolated HOME, plus four Ralph-hook checks.

Coverage preflight on c9f138ac passed 10218 tests with 7 skips/0 failures but failed the unchanged branch floor at 83.97% (95.25 lines,97.42 functions). Preserved failure and added only behavioral release trust-boundary controls: invalid manifest shapes/counts, internal/escaping symlinks, launcher integrity/modes, and malformed instance fields. Focused suite remains green; no production change or threshold exemption.

Pause/resume recovery: volatile /tmp source and packages disappeared; the old runner and child processes are absent, and its canonical check has no final outcome. Preserve it as OUTWARD_INTERRUPTED_WITHOUT_EXIT, not code failure or PASS. Exact HEAD 602dbd3af779bd21ef49c04d0e16aa56e0810d00 / tree 27454deeb77d386467275de0e4f7b11ead619295 reconstructed from retained Git objects under /home/bizra-operating-system/bizra-worktrees/native-release-source-20261016-recovery/source. All eight source hashes match; no source edits. Recovered UI dependencies offline into owned durable roots; installation and services untouched.

Final exact source 602dbd3af779bd21ef49c04d0e16aa56e0810d00/tree27454deeb77d386467275de0e4f7b11ead619295 is clean. Focused52/52; npm test10222pass7skip; canonical serial10306pass7skip; canonical coverage95.28/84.05/97.41 with unchanged84.00branch floor. All seven recovered gates exit0. Offline BuildC succeeds; native separate verifier from fresh detached source returns QUALIFIED for final package and durable copy, release dema-v2-bb9167076a375afc48b326b91ca61687f7d15839ee065cc329b8c6d48bc35ef1. Four semantic negative controls refuse; exact restoration re-qualifies. Reverse patch restores all8paths in disposable copy;58primary preimages and installed wrapper match. Three builds used; no further attempt under this slice. Seven active compiled routes are absent from this candidate, including Talk; product/source convergence must precede installation selection. No install, restart, provider/model call, signer, mint or remote write. REPORT.md and unsigned local receipt are under .artifacts/native-release-source-20261016. Overall Node0 objective remains open.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Restored the existing native release owner and versioned Next16.4 preview-props compatibility across producer, verifier, and private projection. Exact source602dbd3a passes focused/full/guidance/corpus/diff checks and84.05%branch coverage. Real offline final package QUALIFIED; four semantic corruptions refused and restored package re-qualified; source rollback/preservation proved. This completes local source/package qualification only. Candidate lacks seven active routes and is not approved as an installed product replacement; runtime and independent mission proof remain open.
<!-- SECTION:FINAL_SUMMARY:END -->
