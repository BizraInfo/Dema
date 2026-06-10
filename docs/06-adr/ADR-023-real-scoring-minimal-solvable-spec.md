# ADR-023: Real Scoring Minimal Solvable Spec

**Status:** Proposed / Boundary Spec / No Implementation

**Date:** 2026-06-08

**Decision Makers:** Mumu (via GO consent), Professor Synapse (analysis), Grok (authoring per blueprint)

**Supersedes:** None (builds directly on ADR-022 real scoring boundary and G14 scaffold remote proof)

**Related:** ADR-019 (MVP boundary), ADR-020 (proposal flow), ADR-021 (mock scoring boundary), ADR-022 (real scoring boundary), Elite Full-Stack Blueprint, Claims Ledger, Delivery Spine, G13R/G14R for prior rings.

**Implements:** G15_REAL_SCORING_MINIMAL_SOLVABLE_SPEC_LOCAL_GREEN (this spec only; no implementation).

## Context

ADR-022 defined the real scoring boundary (test boundary, allowed/forbidden inputs/outputs, anti-gaming, consent/review/receipt rules). The real-scoring scaffold (G14) has remote proof (four-rail success on the scaffold commit).

This ADR defines the **minimal solvable case** before any implementation of real scoring. It is the bridge between the boundary (ADR-022) and a future test-only/minimal implementation. No executable scoring logic is present or implied.

The proof ladder remains strict: boundary → minimal spec → test scaffold/fixture → local proof → remote 4-rail → only then potential implementation (still blocked per list).

## Purpose

Define the smallest possible safe real-scoring object and flow that can later be implemented locally without creating reward, token, marketplace, contract, public economic, Node1/URP, or Shariah-compliance claims.

This is measurement-only, consent-bound, review-bound, receipt-bound, anti-gaming-enforced, local-face-only.

## Minimal Solvable Case

The minimal case must include exactly:

- One local contribution/proposal object
- One evidence packet
- One claim label
- One consent marker
- One review boundary marker
- One expected local receipt

No more, no less. This is the smallest safe case that can be specified without expanding scope.

## Allowed Inputs

Only these fields:

- contribution_id
- proposal_id
- contributor_reference
- claim_label
- evidence_packet
- consent_marker
- review_boundary_marker
- timestamp
- local_context
- source_references

These are the minimal fields needed for a verifiable, consented, reviewed local scoring event.

## Forbidden Inputs

Forbid any of the following (direct or implied):

- token price
- expected reward
- reward eligibility
- investment language
- marketplace demand
- trading volume
- public ranking
- public economic promise
- Shariah-compliant claim (unless reviewed externally by qualified party in future gate)
- contract address (unless future contract boundary is separately proven)
- Node1 or public URP bridge dependency
- Any language that could be read as creating eligibility, value, or economic right

## Allowed Output

One local scoring decision object with these fields only:

- schema
- score_id
- contribution_id
- proposal_id
- claim_label
- evidence_status
- consent_status
- review_status
- anti_gaming_status
- decision_status
- proof_gaps
- receipt_expectation
- created_at
- prototype_posture

This object is a local review artifact only.

## Forbidden Output

Forbid any of the following (direct or implied):

- numeric economic score
- token amount
- reward amount
- eligibility boolean
- market value
- APY/APR/yield
- trading recommendation
- public leaderboard
- automatic mint
- contract call
- Shariah-compliant label
- Node1 propagation
- public URP publication
- Any output that could be read as creating reward eligibility, token value, marketplace signal, or public economic claim

## Decision Status Values

Allowed decision_status values only:

- needs_more_evidence
- needs_human_review
- rejected_for_forbidden_claim
- accepted_for_local_review_only

Do not include: approved_for_reward, approved_for_token, approved_for_market, approved_for_contract, approved_for_public, or any variant that implies economic or public activation.

## Proof Gaps

proof_gaps is a required array.

- It must be non-empty unless a future qualified human review explicitly closes specific gaps.
- It must not imply final truth or external validation.
- It must list specific gaps (e.g., "evidence packet lacks independent third-party verification", "anti-gaming check not yet executed in code", "consent marker not yet enforced in future implementation").

The existence of proof_gaps is part of the prototype posture.

## Consent Rule

Real scoring must require exact consent before any write operation.

- Use exact-string consent (e.g., "GO: REAL SCORING MINIMAL CASE").
- No inferred consent, no default consent, no "assumed from prior proposal".
- Consent must be recorded in the receipt.

## Review Boundary

The score is not a final decision.

- It is a local review object.
- Human review remains separate (future gate).
- Any public use, economic use, or eligibility use requires future gates that have not yet been defined or proven.

## Anti-Gaming Rule

Reject or mark as needs review if the evidence packet contains:

- reward-seeking language
- circular proof (self-referential impact claims)
- unverifiable impact
- self-dealing
- market manipulation signals
- coercive claims
- unverifiable public benefit
- speculative economic language

Anti-gaming_status must be explicitly recorded (passed / failed / needs_review).

## Receipt Rule

Any future implementation must produce a local, content-addressed receipt.

- The receipt must be read/list only.
- It must not mint, transfer, publish, bridge, or trigger reward eligibility.
- receipt_expectation must reference a local schema (e.g., "bizra.impact.real-scoring.v0.1.local").

## Non-Claims (Ihsān Discipline)

This spec is:

- Not real scoring implementation.
- Not reward eligibility.
- Not token logic.
- Not a contract interface.
- Not a marketplace system.
- Not public economic copy.
- Not Node1.
- Not a public URP bridge.
- Not a Shariah-compliance claim.
- [PROTOTYPE]
- [DESIGNED_NOT_LIVE]

All claims remain local, consented, reviewed, receipted, and anti-gaming-checked. No external or economic activation is created or implied.

## Future Activation Gates

Before any implementation, the following must be proven:

- ADR-023 local proof (this document + claim-check)
- claim-check proof on this ADR
- real-scoring spec scaffold or fixture (test boundary only)
- local tests passing the allowed/forbidden rules
- delivery-check boundary extension (if used)
- four-rail CI proof on the implementation commit
- no forbidden claim scan on all new wording
- human review of all wording for Ihsān compliance

Only after all of the above may a future GO for minimal implementation be considered.

## MBOK / DevOps / CI-CD / A+ QA Mapping

| Domain                 | Mapping                                                                                                                      |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Integration Management | Ladder continuity from ADR-022 boundary + G14 scaffold → ADR-023 minimal spec → future scaffold → local proof → remote proof |
| Scope Management       | Minimal solvable case only (one object, one evidence packet, one consent, one review, one receipt)                           |
| Quality Management     | Allowed/forbidden input-output rules; anti-gaming_status; proof_gaps required                                                |
| Risk Management        | Anti-gaming rule; proof_gaps array; no forbidden claim language; explicit non-claims                                         |
| Stakeholder Management | Exact consent before write; review boundary (score ≠ final decision); human review separate                                  |
| DevOps                 | claim → ADR → minimal spec → (future) local proof → remote 4-rail                                                            |
| CI/CD                  | Local gates (llm:guidance, diff --check, claim:check) then four remote rails                                                 |
| A+ QA                  | No "measured" or "proven" claim until artifacts (receipts, test runs, CI logs) exist and are captured                        |

## Next Micro

The next micro after this ADR (only after local proof of this ADR and remote 4-rail proof of its commit) is:

GO: REAL SCORING MINIMAL SPEC TEST SCAFFOLD

Not implementation. Not reward logic. Not contracts. Not tokens.

---
