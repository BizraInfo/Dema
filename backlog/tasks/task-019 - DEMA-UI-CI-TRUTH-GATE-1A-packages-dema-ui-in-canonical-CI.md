---
id: TASK-019
title: 'DEMA-UI-CI-TRUTH-GATE-1A: packages/dema-ui in canonical CI'
status: In Progress
assignee: []
created_date: '2026-07-18 23:51'
updated_date: '2026-07-19 10:23'
labels:
  - next
  - ui
  - product-proof
dependencies: []
ordinal: 19000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Audit 2026-07-19 finding 3 (SNR rank 3): packages/dema-ui (31k+ added lines, own lockfile/deps) has no CI job — root workflow never runs npm ci / tsc --noEmit / UI tests / next build there, and next.config sets ignoreBuildErrors:true. Add a UI CI job (ci -> lint -> tsc --noEmit -> node --test -> build -> npm audit --omit=dev), remove ignoreBuildErrors, produce a UI SBOM, and split the canonical SBOM into kernel-TCB vs UI vs aggregate (current SBOM claims zero deps repo-wide — stale since #404).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 CI runs the UI job on the exact head SHA and it is a required rail
- [x] #2 ignoreBuildErrors removed; tsc --noEmit green
- [ ] #3 SBOM split into kernel-TCB / dema-ui / aggregate and matches disk
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
On an exact-main isolated worktree, establish package-local tests, TypeScript, lint, build, and audit baselines. Fix only reproduced package defects: portable build handling when public/ is absent; remove ignoreBuildErrors after proving type safety; resolve react-hooks lint failures without disabling the rule; remove unused vulnerable direct dependencies and pin the remaining vulnerable transitive PostCSS to a patched compatible version. Re-run package tests, tsc, lint, build, npm audit, then root required gates. Do not edit GitHub workflows, push, open/update PRs, or merge without a separate exact GO.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Partial advance 2026-07-19 (the locally-verifiable half): SBOM trust-boundary split SHIPPED as commit 380fc46 on docs/sbom-and-ci-doc-truth-1a — kernel TCB (root, zero-dep, unchanged) now distinct from packages/dema-ui boundary (MEASURED: 66 prod + 9 dev deps, 927 lockfile entries) with an honesty row naming this task's pending CI rail; also corrected CI-doc branch threshold 85→84 (package.json authoritative). Audit finding rank 5 (stale SBOM) closed. REMAINING (blocked outward): the CI workflow job + ignoreBuildErrors removal + tsc/build/audit verification need npm-registry and GitHub access — neither reachable from this session (registry.npmjs.org not on sandbox allowlist; no credential). Authoring an unrunnable workflow would claim untested CI — deferred to credential day per FDE outward-failure law.

Evidence 2026-07-19: GitHub Dependabot reports 4 moderate vulnerabilities on the default branch — first live confirmation that the packages/dema-ui dependency surface needs its own audit rail (npm audit step in the planned UI CI job).

LOCAL CANDIDATE 2026-07-19 on chore/repo-health-reconciliation-1a: removed ignoreBuildErrors, made build portable without public/, added package test/typecheck/lint/build/audit check, fixed six React lifecycle/lint defects without rule suppression, removed four unused vulnerable direct dependencies, and scoped Next PostCSS to patched 8.5.20. Measured locally: UI 35/35, tsc/lint/build PASS, npm audit 0. Root npm test/check/coverage/guidance/diff gates PASS. TASK remains In Progress: required UI CI rail and SBOM split are separate governed work and no workflow was edited.

SEALED LOCAL COMMIT 5cce798b0372a8e8ef91847802b0f307106b86d1. Independent review: zero Critical/Important/Minor findings in scoped candidate. UI evidence: 45/45 tests including hydration/storage/matchMedia/carousel/fetch/raid cancellation; tsc, eslint, Next production build, npm audit 0. Root checks remain green. AC #1 CI rail and AC #3 SBOM split remain open and require separate governed work.
<!-- SECTION:NOTES:END -->
