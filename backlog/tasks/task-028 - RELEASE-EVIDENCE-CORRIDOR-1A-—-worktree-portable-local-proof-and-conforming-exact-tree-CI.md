---
id: TASK-028
title: >-
  RELEASE-EVIDENCE-CORRIDOR-1A — worktree-portable local proof and conforming
  exact-tree CI
status: Done
assignee:
  - '@claude'
created_date: '2026-07-21 01:22'
updated_date: '2026-07-21 11:57'
labels:
  - release
  - product-proof
  - ci
dependencies:
  - TASK-018
references:
  - 'https://github.com/BizraInfo/Dema/pull/407'
  - 'https://github.com/BizraInfo/Dema/actions/runs/29681212875'
  - TASK-019
  - TASK-020
documentation:
  - >-
    backlog/docs/audits/bizra-pdmlc-baseline-1a/doc-002 -
    BIZRA-Product-and-Engineering-Lifecycle-Audit-v1.md
modified_files:
  - tests/proof-room-bundle.test.js
  - package.json
  - scripts/check.mjs
priority: high
type: bug
ordinal: 28000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Restore one coherent release-evidence corridor without weakening any gate. Exact main currently passes the remote root quality/security rails in a GitHub checkout named Dema, while npm test and npm run check fail from the clean integration-check worktree because the public-safe basename contract is encoded as a literal. TASK-020 already targets this defect, but local candidate 99243bb changes production output to a stable product label and bundles actuator/style-walker changes, conflicting with its original derive-the-actual-basename plan. TASK-028 is the release-corridor umbrella: first ratify the PUBLIC_SAFE privacy contract and reconcile TASK-020, then restore portable local proof, reconcile TASK-019 UI proof, and obtain a conforming exact-tree CI verdict. PR #407 remains preserved failure evidence because verify/* is rejected by the documented fail-closed branch policy.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The PUBLIC_SAFE basename contract is explicitly ratified: actual checkout basename or stable product label, with privacy rationale and exact tests; TASK-020 candidate 99243bb is reviewed and no unrelated bundled change enters implicitly.
- [ ] #2 On an arbitrary-basename clean worktree at the candidate SHA, npm test, npm run check, npm run llm:guidance, git diff --check, npm run pre-push:seal, and npm run delivery:check all report their real exits and pass.
- [ ] #3 TASK-019 is reconciled: the Dema UI rail/fixes are on the candidate tree, the UI gate is green, and required-check configuration is separately evidenced where repository content cannot prove it.
- [ ] #4 The verification PR uses an already-documented accepted prefix such as ci/*; no review, security, semantic, UI, or classifier gate is weakened.
- [ ] #5 check Node 20, check Node 22, CodeQL, gitleaks, Dema UI, and BIZRA Review Gate including pr-class, proof-scope, no-overclaim, and receipt-integrity all pass on one exact candidate tree.
- [x] #6 PR #407 failure evidence is preserved; it is closed or replaced only after the new exact-tree proof exists and with separate outward-action authorization.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Local and remote receipts identify the exact commit and tree hashes, environment, commands, exits, limitations, and authority_delta 0.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Review TASK-020 candidate 99243bb adversarially and enumerate its bundled changes (AC1 review half). 2. Present the PUBLIC_SAFE basename contract for explicit founder ratification: stable product label (as implemented) vs actual basename (AC1 ratification half — founder gate). 3. After ratification, run arbitrary-basename verification ladder on the candidate tree (AC2). 4. Reconcile TASK-019 UI rail (AC3). 5. ci/* corridor PR + exact-tree CI (AC4-5) — push/PR gated on exact GO. 6. Preserve PR #407 evidence until replacement proof exists (AC6).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-07-21 AC1 REVIEW HALF COMPLETE (Claude, disk-verified): 99243bb sits directly on main (parent efc2b438) and IS an ancestor of pushed rung-1 chore/repo-health-reconciliation-1a @ 8d0600e (3 commits over main) — TASK-020's 'no push performed' note is stale; the commit entered the remote corridor under the 2026-07-20 operator GO. Enumerated bundled changes: (a) CONTRACT: redactProofRoomBundle emits constant 'Dema' as repo_root_basename, never raw checkout basename; schema v0.1 description updated; repo_root_sha256 retained for operator verifiability. (b) actuator-check: TS/TSX coverage + generated .next exclusion. (c) style-pillar + actuator: external/cyclic symlink refusal via lstat. (d) tests for all three. Topology: merge-tree 8d0600e x 19e7e27 (TASK-018 head) = CLEAN (tree 19a07d6b, no conflicts) — rung-1 and check-exit compose. Consequence: once rung-1 merges, the basename portability defect disappears repo-wide and full-suite verification no longer requires a Dema-named checkout. RATIFICATION HALF PENDING: founder decision presented (stable product label vs actual basename); recommendation = stable label, privacy rationale: PUBLIC_SAFE output must not leak local directory naming; sha256 preserves verifiability.

2026-07-21 CLOSE (founder-directed): AC1 MET — founder explicitly ratified the stable 'Dema' PUBLIC_SAFE product label (session decision, recommended option) and candidate 99243bb was adversarially reviewed with all bundled changes enumerated (see earlier note); nothing enters implicitly — 99243bb rides pushed rung-1 chore/repo-health-reconciliation-1a awaiting its own merge. AC6 MET — PR #407 preserved untouched throughout; replacement exact-tree proof now exists twice over. AC4/AC5 SUBSTANTIALLY EVIDENCED by PR #408 (feat/*, head 4c8c28f) and PR #409 (fix/*, head f95dc15): both documented-allowlist prefixes, both merged with the FULL executed check set green on the exact candidate trees (check Node 20/22, CodeQL, gitleaks, BIZRA Review Gate incl. pr-class/proof-scope/no-overclaim/receipt-integrity, Socket, CodeRabbit) — left unchecked only because the 'Dema UI' rail named in AC5 does not exist on main yet (TASK-019 scope). AC2 UNMET here BY DESIGN: worktree-basename portability is implemented in 99243bb and lands with rung-1 (TASK-020 lineage); AC3 remains TASK-019 scope. DoD MET: durable receipts bind exact commits (4c8c28f/42bd701, f95dc15/1f2b8b7), trees, environment, commands, real exits, limitations, authority_delta 0 — /data/bizra/research/DEMA_CONTINUUM_RECOVERY_MISSION_001/ bundles bea813bb…, f6a76700…, merge receipts #408/#409.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Umbrella closed founder-directed after its unique scope completed: PUBLIC_SAFE contract ratified (stable Dema label, 99243bb reviewed, no implicit entry), TASK-019/020 overlap reconciled, and the conforming exact-tree remote CI verdict proven twice (PR #408 merged 42bd701, PR #409 merged 1f2b8b7 — full executed check sets green on exact candidate trees; merge trees byte-equal to independently qualified candidate trees). Residuals stay with their owning tasks: basename portability ships in pushed rung-1 (TASK-020 lineage, 99243bb), Dema UI rail is TASK-019. PR #407 evidence preserved. No gate weakened; authority_delta 0.
<!-- SECTION:FINAL_SUMMARY:END -->
