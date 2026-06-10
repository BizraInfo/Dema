# ADR-024: Reward Eligibility Boundary

**Status:** Proposed / Boundary Spec / No Implementation

**Date:** 2026-06-08

**Decision Makers:** Mumu (via GO consent), Professor Synapse (analysis), Grok (authoring per blueprint)

**Supersedes:** None (builds directly on G17R closure: minimal local real scoring enum-complete refinement passed four remote rails)

**Related:** ADR-019 (MVP boundary), ADR-020 (proposal flow), ADR-021 (mock scoring boundary), ADR-022 (real scoring boundary), ADR-023 (real scoring minimal solvable spec), ELITE_FULL_STACK_BLUEPRINT, Claims Ledger, Delivery Spine, G17R for prior ring.

**Implements:** G18_REWARD_ELIGIBILITY_BOUNDARY_LOCAL_GREEN (this boundary spec only; no implementation).

## Context

G17R closed: the minimal local real scoring enum-complete refinement (scripts/real-scoring-minimal.mjs + updated SELF_EVAL receipt) passed local gates (llm:guidance, diff --check, delivery:check with all 4 decision_status values exercised) and four remote rails (check 27117016291, BIZRA Review Gate 27117016296, gitleaks 27117016280, CodeQL 27117016284).

This ADR defines what "reward eligibility" may mean in future rings, without implementing any reward, token, payout, mint, or economic mechanism.

## Purpose

Prevent real scoring (or any future local review state) from leaking into economic entitlement, token logic, reward promises, marketplace claims, or public economic signals.

## Definition

Reward eligibility is a future review-state candidate. It is not a reward, not a token, not a mint, not a payout, not an investment signal, not a marketplace value.

## What Reward Eligibility Means

- a local review candidate state
- evidence-dependent
- consent-bound
- human-review gated
- receipt-required
- proof-gap aware
- non-automatic

## What Reward Eligibility Does Not Mean

- no token amount
- no reward amount
- no guaranteed payment
- no APY/APR/yield
- no investment return
- no marketplace value
- no automatic mint
- no Shariah-compliant claim
- no contract interaction
- no Node1 propagation
- no public URP publication

## Allowed Inputs

- score_id
- contribution_id
- proposal_id
- claim_label
- evidence_status
- consent_status
- review_status
- anti_gaming_status
- proof_gaps
- reviewer_reference
- local_context
- timestamp

## Forbidden Inputs

- token price
- expected payout
- trading volume
- public ranking
- market demand
- APR/APY/yield
- investment language
- automatic mint trigger
- contract address
- Shariah-compliance assertion
- Node1 propagation marker
- public URP bridge marker

## Allowed Output

A local reward eligibility review object only:

- schema
- eligibility_review_id
- score_id
- contribution_id
- proposal_id
- claim_label
- evidence_status
- consent_status
- review_status
- anti_gaming_status
- eligibility_status
- proof_gaps
- receipt_expectation
- created_at
- prototype_posture

## Allowed eligibility_status values

- not_eligible_needs_more_evidence
- not_eligible_needs_human_review
- rejected_for_forbidden_claim
- candidate_for_local_review_only

## Forbidden Output

- token amount
- reward amount
- eligibility=true
- payout=true
- mint=true
- contract call
- market value
- public leaderboard
- APY/APR/yield
- Shariah-compliant label
- Node1 propagation
- public URP publication

## Consent Rule

Exact consent required for any future eligibility write. No inferred consent.

## Review Boundary

Eligibility review is not final approval. It is not reward authorization. It is a local review object only. Human review remains separate. Any public use, economic use, or eligibility use requires future gates that have not yet been defined or proven.

## Anti-Gaming Rule

Reject or defer (mark as needs review or rejected_for_forbidden_claim) if the evidence shows:

- reward-seeking language
- circular proof (self-referential impact claims)
- unverifiable impact
- self-dealing
- market manipulation signals
- coercive claims
- unverifiable public benefit
- speculative economic language

## Receipt Rule

Any future implementation must produce a local, content-addressed receipt.

- The receipt must be read/list only.
- It must not mint, transfer, publish, bridge, or trigger reward eligibility.
- receipt_expectation must reference a local schema (e.g., "bizra.impact.reward.eligibility.v0.1.local").

## Non-Claims (Ihsān Discipline)

This spec is:

- [PROTOTYPE]
- [DESIGNED_NOT_LIVE]
- LOCAL_ONLY

- No reward eligibility implementation.
- No token logic.
- No contract logic.
- No marketplace.
- No public economic copy.
- No Node1.
- No public URP bridge.
- No Shariah-compliant claim.

All claims remain local, consented, reviewed, receipted, and anti-gaming-checked. No external or economic activation is created or implied.

## MBOK / DevOps / CI-CD / A+ QA Mapping

| Domain                 | Mapping                                                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Integration Management | Ladder continuity from G17R (minimal local real scoring) → ADR-024 boundary spec → future scaffold → local proof → remote proof |
| Scope Management       | Boundary/spec only (no implementation, no economic activation)                                                                  |
| Quality Management     | Allowed/forbidden input-output rules; anti-gaming_status; proof_gaps required; eligibility_status limited to 4 values           |
| Risk Management        | Anti-gaming rule; proof_gaps array; no forbidden claim language; explicit non-claims                                            |
| Stakeholder Management | Exact consent before any write; review boundary (eligibility review ≠ final decision or reward); human review separate          |
| DevOps                 | claim → ADR → (future) local proof → remote 4-rail                                                                              |
| CI/CD                  | Local gates (llm:guidance, diff --check, claim:check) then four remote rails                                                    |
| A+ QA                  | No "eligibility" or "reward" claim until artifacts exist, external review, and future gates proven                              |

## Next Micro

GO: REWARD ELIGIBILITY TEST SCAFFOLD

Only after ADR-024 local proof + remote four-rail proof on this boundary commit.

---

**Updated still-blocked list (carried forward):**

No production scoring.
No economic scoring.
No reward eligibility implementation.
No contracts.
No token logic.
No marketplace.
No public economic copy.
No Node1.
No public URP bridge.
No Shariah-compliant claim.

G17 local scoring may exist (minimal, enum-complete, prototype), but only as [PROTOTYPE], LOCAL_ONLY, DESIGNED_NOT_LIVE. Reward eligibility remains fully blocked for implementation.
