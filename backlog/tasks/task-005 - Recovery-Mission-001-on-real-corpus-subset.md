---
id: TASK-005
title: Recovery Mission 001 on real corpus subset
status: In Progress
assignee:
  - '@codex'
created_date: '2026-07-18 03:20'
updated_date: '2026-07-30 13:30'
labels:
  - next
  - product-proof
dependencies: []
references:
  - docs/02-architecture/NODE0_FIRST_LIGHT_0A_CORRIDOR_v0_1.md
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Deliver NODE0-FIRST-LIGHT-0A as one real, local, read-only-corpus founder-value loop: selected folder -> exact context-bound consent -> deterministic retrieval -> localhost model answer -> persisted local receipt -> receipt-derived Proof Card -> restart verification. Website, domain, PR #440-#444, PSMP, federation, token, and external publication work are out of scope.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The local `bizra start` entrypoint opens or resumes one First Light mission without starting a daemon.
- [x] #2 One absolute folder and one DEMA_HOME destination are disclosed; content remains unread until exact context-bound C3_LOCAL_WRITE consent verifies.
- [x] #3 A real PAT/SAT question is answered from retrieved local files with path and SHA-256 citations.
- [x] #4 The persisted receipt binds mission, scope, consent context, question, retrieval, prompt, raw model response, final answer, and cited source hashes.
- [x] #5 The Proof Card is derived only from the persisted receipt, while separate persisted-state verification fails closed on receipt or source tampering.
- [x] #6 A fresh process reloads the same mission, receipt, index, and Proof Card and re-verifies their relationships and cited source bytes.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reuse the existing consent envelope and local-model adapter behind a First Light CLI IO layer. 2. Build a deterministic bounded text index and lexical retriever over the consented root. 3. Persist one hash-bound First Light truth envelope plus a derived Proof Card under DEMA_HOME. 4. Add the `bizra start` entrypoint with create/resume/verify behavior. 5. Run a real PAT/SAT question against repository files, restart, verify hashes, then run focused and full gates.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
KNOWN_OPEN: npm run check remains red — repository-wide native coverage thresholds already unmet on clean main 72ef164 (lines 91.49%, branches 78.33%). First Light candidate improves aggregate lines to 93.00% (branches 77.80%) but does not close inherited 95%/84% thresholds. Coverage rescue is a separate mission (REPOSITORY-COVERAGE-TRUTH-AND-RESCUE-1A). Do not label full check PASS, coverage CLOSED, or release ready.
<!-- SECTION:NOTES:END -->
