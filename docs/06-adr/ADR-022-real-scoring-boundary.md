# ADR-022: Real Scoring Boundary (Test Boundary)

**Status:** Proposed

**Date:** 2026-06-08

**Decision Makers:** Mumu (via GO consent), Professor Synapse (analysis), Grok (implementation per blueprint)

**Supersedes:** ADR-021 (mock scoring integration now locally and remotely proven for a8c4897 / b0b102f)

**Related:** ADR-019 (MVP boundary), ADR-020 (proposal flow), ADR-021 (mock scoring boundary), Elite Full-Stack Blueprint, Claims Ledger, Delivery Spine, G12R for mock integration commit.

**Implements:** Next gate after G12R (mock scoring delivery-check integration proven).

## Context

G12R achieved for the ADR-021 mock scoring integration commit (b0b102f): all four rails (gitleaks, CodeQL, BIZRA Review Gate, check) success. Receipts captured with real RIDs 27110741993/42010/42012/42025.

Previous rings closed:
- G8R (R3 classifier + fixture).
- ADR-020 proposal flow (envelope + integration + 4-rail).
- ADR-021 scoring test boundary + scaffold + mock module + delivery-check integration + push + 4-rail proof.

Per unlock ladder (user explicit):
- Prove mock integration (G12R) → unlock real scoring boundary (this ADR-022).
- Prove real scoring boundary → unlock real scoring implementation (future).
- ... (contracts, token, reward, marketplace, public copy, Node1, URP, Shariah).

Current state: Mock scoring unblocked and integrated/proven in A+ system (local + remote). Other 9+ items remain blocked.

The "pinnacle masterpiece" advances via ultra-micro, proof-first steps embodying elite full-stack blueprint (MBOK 10 domains, DevOps value stream, CI/CD to Level 5, A+ perf-QA).

## Problem

Real scoring is the next logical unlock after mock (to enable actual verified impact measurement without jumping to rewards/contracts).

Without a defined test boundary:
- Risk of over-expansion (real scoring tied to rewards/tokens/contracts/marketplace too early).
- No clear definition of allowed inputs (e.g., verified claims, evidence thresholds) or forbidden outputs (e.g., any reward eligibility language).
- No anti-gaming rules, consent/review/receipt requirements for real scoring events.
- Violates "test boundary before implementation" law (ADR-020/021 precedent).
- Could leak into public claims, Node1, or economic mechanisms without proof.

Must stay within blocked list: no reward eligibility, no token, no contracts, no marketplace, etc.

## Decision

Create ADR-022 as the **test boundary** for Real Scoring (parallel to ADR-021 for mock).

**In Scope (Test Boundary Only):**

- Define what real scoring means (e.g., verified impact delta based on consented, reviewed, receipted claims with evidence thresholds; contribution quality + proof strength).
- Define what real scoring does **not** mean (no reward, no token, no eligibility, no marketplace value, no public economic signal, no contract linkage, no Node1/URP exposure).
- Define allowed inputs (e.g., sourced claim labels with evidence, anti-gaming proof, exact consent for scoring events).
- Define forbidden outputs (e.g., any language implying rewards, APR, fixed returns, claimable value, earn, redeem, payout, token allocation).
- Define anti-gaming requirements (e.g., no self-scoring, no collusion, proof-of-work style requirements, independent review).
- Define consent/review/receipt rules (exact GO for real scoring writes, review-boundary separation, receipt expectation with content-addressed schema).
- Define no reward eligibility yet (explicit non-claim: real scoring creates no eligibility for any future distribution).
- Define no token/contract/marketplace linkage (explicit non-claim: real scoring is measurement only; no on-chain, no marketplace value, no contract enforcement).
- Test-only scaffold (like impact-scoring-mvp.test.js): claim label validation for real scores, forbidden promotion rejection in real scoring context, consent marker for real scoring writes, review boundary, receipt expectation for real scoring events.
- Non-claim assertions (no reward eligibility language, no token logic, no marketplace).
- MBOK alignment (Quality: measurable real impact; Risk: anti-gaming + no leakage; Integration: ties to proposal + mock flow).
- DevOps/CI/CD: targeted tests in delivery-check (future), local gates, remote 4-rail after fixture.
- Perf-QA: metrics with exact commands, thresholds, artifacts ("not yet measured" until evidence).

**Out of Scope (Still Blocked):**

- Actual real scoring implementation/logic.
- Any mock-to-real transition code.
- Reward eligibility.
- Token/reward distribution.
- Marketplace integration.
- Public economic copy or claims.
- Node1/URP bridge.
- Shariah-compliant scoring.
- Any production contracts or on-chain elements.
- Stash pop (separate micro if desired; proof path remains clean).

## Full-Stack Boundary Map (MBOK + Blueprint)

| Domain | MVP/Current Boundary | Forbidden Promotion |
|--------|----------------------|---------------------|
| Product | Local mock + real scoring definition only | No public real scoring dashboards, no "real score = value/reward" |
| Domain Model | Real score = verified contribution + evidence strength + anti-gaming proof | No "real score = reward points/token" |
| Data Contract | Receipt expectation for real scoring events (local only) | No on-chain real score minting or linkage |
| App Logic | Test boundary only (inputs/outputs/consent/review/receipt) | No real scoring engine |
| Security | Exact consent "GO" for any real scoring write; review separation; anti-gaming | No public real score exposure or eligibility |
| DevOps | delivery-check integration (future); 4-rail after test fixture | No CI changes without separate GO |
| QA | A+ gates + targeted real scoring test boundary; "not yet measured" until artifact | No perf claims on real scoring |

## MBOK Alignment (10 Domains)

- **Integration**: Proposal + mock + real scoring definition as single verified contribution pipeline.
- **Scope**: Test boundary only (no impl).
- **Schedule**: Ultra-micro (doc first, like ADR-020/021).
- **Cost**: Zero (local only).
- **Quality**: Measurable (anti-gaming rules, evidence thresholds, allowed inputs/forbidden outputs); A+ perf-QA.
- **Resource**: N/A (no new resources).
- **Communications**: Receipt notes, ladder status, [PROTOTYPE] labels, G12R reference.
- **Risk**: Explicit anti-gaming, manual fallback, no reward/token/marketplace leakage.
- **Procurement**: N/A.
- **Stakeholder**: Mumu consent + remote witness (CI).

## DevOps / CI/CD / Perf-QA

- Inherits R3 CI classifier (known B-bucket transparent).
- Local: npm test/check/llm:guidance/git diff --check + delivery-check (now includes ADR-021).
- Future: + real scoring test boundary + delivery:check extension.
- Remote: 4 rails after test fixture (G12R precedent for this ring).
- Metrics: Name, exact command, OS/Node/hardware, commit SHA, p50/p95, target, artifact path/hash, interpretation ("not yet measured" until evidence exists).

## Security / Consent / Claim

- Local-only for now (test boundary).
- Exact-string consent for any real scoring write/state change.
- Claim discipline: [PROTOTYPE] for boundary; no [DECLARED] on rewards/claims.
- No public wording until later gates.
- Anti-gaming enforced at boundary level.

## Non-Claims (Ihsān Discipline)

- Not live/real scoring implementation.
- No reward eligibility.
- No token/reward.
- No marketplace value.
- No public economic signal.
- No Node1/URP.
- No Shariah-compliant scoring.
- No date-certain.
- DESIGNED_NOT_LIVE until full ladder.
- No linkage to contracts/token/marketplace.

## Activation Gates (Gates after G12R)

- G12R: Mock scoring integration proven (a8c4897/b0b102f 4-rail success) — this step.
- G13: ADR-022 accepted (test boundary doc).
- G14: Real scoring test scaffold (like impact-scoring-mvp.test.js: categories for real scoring).
- G15: Local + 4 remote gates on scaffold commit.
- G16: Real scoring implementation (after boundary proof).
- G17: ... (later gates for contracts/rewards).

## Consequences

- Positive: Safe progression; controls bound; blueprint consistency; measurement separated from value.
- Costs: Speed deliberately reduced; proof path maintained.
- Risk: "Real score" misread as reward/eligibility (mitigated by explicit "does not mean" + labels + anti-gaming).

## Next Ultra-Micro (per ladder + blueprint)

GO: AUTHOR TEST SCAFFOLD FOR REAL SCORING BOUNDARY (doc + minimal test categories mirroring ADR-021, no impl)

(After this: prove in A+, then unlock real scoring impl, etc.)

---
