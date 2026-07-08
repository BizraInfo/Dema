# PLAN-BRANCH-PREVIEW-1A

Truth label: `PLAN_BRANCH_PREVIEW_MEASURED_REPO`

## Purpose

A pure preview-only Materialization Pulse planning kernel that preserves candidate, chosen, and
**rejected** plan branches as content-addressed evidence before FATE or execution.

## Core law

**Rejected branches are evidence.** A safe system must remember what it refused, not only what it chose.
(Materialization Pulse Step 2 · pi.dev branch-tree shape · the falsification ledger.)

## Position in the Pulse

```text
niyyah → PLAN-BRANCH-PREVIEW → FATE → execution envelope → claim binding
```

## Input

```text
mission_id · niyyah_hash · branches[] · chosen_branch_id · rejected_branches[]
```
Each candidate branch may carry `id · title · summary · risk_score · ihsan_score · estimated_cost ·
consent_required · authority_delta · evidence_refs[]`. Each rejected branch MUST carry
`branch_id · rejection_reason · rejection_basis · evidence_refs[]`.

## Rejection reasons (fixed set)

```text
higher_risk · weaker_evidence · higher_cost · lower_ihsan · consent_gap · scope_violation · overclaim_risk · unsafe_boundary
```

## Rules

- exactly one chosen branch; it must be one of the candidates; it may not also be rejected
- every non-chosen candidate must be rejected with a valid reason + a non-empty basis
- duplicate branch ids, empty ids, duplicate rejected ids, and rejected-not-in-candidates all fail
- `authority_delta` must be 0 on every branch; risk/ihsan scores must be in [0,1]
- `action_allowed` false; boundary all-false

## What this proves

Binds a planning decision — including the rejected branches and their reasons — into a content-addressed
preview receipt. `verify` rejects tamper and (even with a recomputed hash) authority/action/mint/wallet/
federation/model laundering and boundary flips; `run()` self-probes forgeries.

## What this does NOT prove

It does not execute the chosen plan, invoke a model, authorize action, verify external truth, mint, use
a wallet, federate, or prove live URP.

## Commands

```bash
node --test tests/plan-branch-preview.test.js
node scripts/review/plan-branch-preview-check.mjs --json
npm test
npm run check
npm run coverage
```
