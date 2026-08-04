---
id: TASK-030
title: 'PUBLIC-CLAIM-RECEIPT-BINDING-1A: bind or remove every live bizra.ai claim'
status: In Progress
assignee:
  - '@BizraInfo'
created_date: '2026-07-22 07:56'
updated_date: '2026-08-04 15:45'
labels:
  - gtm
  - no-overclaim
dependencies: []
priority: high
ordinal: 30000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Both 2026-07-21 dev logs flag live bizra.ai/bizra.info claims with no per-claim receipts: '8,072 Verified Tests / 100% pass', 'Formally Verified', 'every action Ed25519-signed', 'no cloud / no telemetry', '96% cheaper', '73 of 100 nodes'. Status: RED_PENDING_RECEIPT_BINDING. Claim-by-claim audit against the receipt chain; each claim gets bound to evidence (commit + receipt hash) or is edited/removed. Blocks invitations and Program G1 ignition. GitHub also reports 4 moderate Dependabot vulnerabilities on the default branch (likely dema-ui subtree) — triage in the same honesty pass.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every live public claim mapped to receipt+commit or removed
- [x] #2 Dependabot 4 moderate findings triaged with verdicts
- [x] #3 Result recorded in docs/CLAIM_REGISTER and CURRENT_LIMITS same slice
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Verify the current live bizra.ai claim surface and distinguish commit evidence from governed claim receipts. 2. Add a deterministic local receipt-binding evaluator that fails closed on malformed or falsely bound claim records while permitting an honest BLOCKED state. 3. Add red-first tests for bound, removed, and receipt-unbound live claims. 4. Record the five live receipt-unbound claim IDs and exact outward blockers in CLAIM_REGISTER, CURRENT_LIMITS, and a proof receipt. 5. Run focused checks and canonical gates; leave AC #1 open until live publication is removed or each claim is linked to a governed receipt.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-08-04 evidence-bound pass: confirmed live public claim set from docs/audits/evidence/bizra-ai-public-claim-postdeploy-2026-07-24.json (reviewed root claim IDs BIZRA-PUBLIC-001/002/003; non-root contained by 307). Added Dependabot triage snapshot using GitHub API evidence (gh api repos/BizraInfo/Dema/dependabot/alerts?state=open&per_page=100): 13 open alerts total (7 high, 6 medium). Triaged all medium alerts with INWARD verdicts and first patched versions in CLAIM_REGISTER and CURRENT_LIMITS. Required gates run clean: npm test, npm run check, npm run llm:guidance, git diff --check.

Correction from proof closeout: live read-only probes on 2026-08-04 observed BIZRA-PUBLIC-001/002/003 on the root and BIZRA-PUBLIC-004/005 on public APIs. They are linked to commit 26bb5735 but expose no public receipt link/hash. Commit evidence is not a governed Claim Receipt, so AC #1 was checked prematurely and TASK-030 is reopened under no-false-GREEN discipline.

2026-08-04 proof-closeout correction implemented: added a pure receipt-binding validator, review gate, red-first tests, committed live evidence manifest, package scripts, canonical check wiring, and proof receipt. npm run claims:receipt-binding exits 0 for a coherent honest manifest; npm run claims:receipt-binding:require-closed exits 2 and names BIZRA-PUBLIC-001..005 because all five are live with commit evidence and zero governed receipt hashes/links. Final proof: focused wiring set 32/32, npm test 8546/8546, npm run check exit 0, npm run llm:guidance PASS, git diff --check exit 0. AC #1 remains open. Exact outward closure requirement: authorized signer rotation plus governed receipt issuance/publication, or authorized website removal plus deploy. Supplied Claude C4D output was also checked against disk: isolated workspace HEAD 37d29a9 has two dirty Task 5 files and no captured successful check status; it remains a separate in-progress lane.
<!-- SECTION:NOTES:END -->
