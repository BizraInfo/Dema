# ADR-021: Impact Scoring Boundary (Test Boundary)

**Status:** Proposed

**Date:** 2026-06-08

**Decision Makers:** Mumu (via GO consent), Professor Synapse (analysis), Grok (implementation per blueprint)

**Supersedes:** ADR-020 (proposal flow now proven/integrated)

**Related:** ADR-019 (MVP boundary), Elite Full-Stack Blueprint, Claims Ledger, Delivery Spine, R3 CI gate repairs (G8R green on 2150ff5 / 08a1e71)

**Implements:** Unlock ladder Gate 2 (after proposal-flow proof/integration)

## Context

G8R achieved (exact 4-rail success on R3 head after coverage/check classifier routing).

Proposal-flow implemented as minimal local envelope (5 strict markers only: claim label, forbidden promotion rejection, consent "GO" marker, review boundary, receipt placeholder) in `scripts/proposal-envelope.mjs`, and integrated/proven in `scripts/delivery-check.mjs` A+ orchestrator.

Per unlock ladder (user explicit):

1. G8R → unlock proposal-flow (done)

2. Prove proposal-flow → unlock scoring boundary

3. Prove scoring boundary → unlock mock scoring

4. ... (contracts, token, reward, marketplace, public copy, Node1, URP, Shariah)

Current state: Proposal-flow unblocked and integrated in A+ system. Other 9 items remain blocked.

The "pinnacle masterpiece" advances via ultra-micro, proof-first steps embodying elite full-stack blueprint (MBOK 10 domains, DevOps value stream, CI/CD to Level 5, A+ perf-QA).

## Problem

Scoring is the next logical unlock after proposal (to enable impact measurement without jumping to rewards/contracts).

Without a defined test boundary:

- Risk of over-expansion (scoring tied to rewards too early)

- No anti-gaming rules, oracle assumptions, or manual fallback

- Violates "test boundary before implementation" law (ADR-020 precedent)

- Could leak into public claims or Node1 without proof

Must stay within blocked list: no reward eligibility, no token, no marketplace, etc.

## Decision

Create ADR-021 as the **test boundary** for Impact Scoring (parallel to ADR-020 for proposal).

**In Scope (Test Boundary Only):**

- Define what a score means (e.g., verified impact delta, contribution quality, proof strength)

- Define what a score does **not** mean (no reward, no token, no eligibility, no marketplace value, no public economic signal)

- Anti-gaming rules (e.g., no self-scoring, no collusion, proof-of-work style requirements)

- Oracle/reviewer assumptions (manual review fallback, no automated oracle yet)

- Scoring categories (e.g., 0-100 scale or tiers, with evidence thresholds)

- Test-only scaffold (like impact-launchpad-mvp.test.js): claim label validation for scores, forbidden promotion rejection in scoring context, consent marker for scoring writes, review boundary (proposal score vs final decision), receipt expectation for scoring events

- Non-claim assertions (no reward eligibility language, no token logic)

- MBOK alignment (Quality: measurable impact; Risk: anti-gaming; Integration: ties to proposal flow)

- DevOps/CI/CD: targeted tests in delivery-check, local gates, remote 4-rail after fixture

- Perf-QA: metrics with exact commands, thresholds, artifacts (e.g., "not yet measured" until evidence)

**Out of Scope (Still Blocked):**

- Actual scoring implementation/logic

- Mock scoring (until boundary proven)

- Reward eligibility

- Token/reward distribution

- Marketplace integration

- Public economic copy or claims

- Node1/URP bridge

- Shariah-compliant scoring

- Any production contracts or on-chain elements

## Full-Stack Boundary Map (MBOK + Blueprint)

| Domain | MVP/Current Boundary | Forbidden Promotion |
|--------|----------------------|---------------------|
| Product | Local proposal envelope + scoring definition only | No public scoring dashboards, no "impact score = value" |
| Domain Model | Score = verified contribution + evidence strength | No "score = reward points" |
| Data Contract | Receipt expectation for scoring events (local only) | No on-chain score minting |
| App Logic | Test scaffold only (claim/reject/ consent/review/receipt) | No auto-scoring engine |
| Security | Exact consent "GO" for any scoring write; review separation | No public score exposure |
| DevOps | delivery-check integration; 4-rail after test fixture | No CI changes without separate GO |
| QA | A+ gates + targeted scoring tests; "not yet measured" until artifact | No perf claims on scoring |

## MBOK Alignment (10 Domains)

- **Integration**: Proposal flow + scoring definition as single verified contribution pipeline
- **Scope**: Test boundary only (no impl)
- **Schedule**: Ultra-micro (doc first, like ADR-020)
- **Cost**: Zero (local only)
- **Quality**: Measurable (anti-gaming rules, evidence thresholds); A+ perf-QA
- **Resource**: N/A (no new resources)
- **Communications**: Receipt notes, ladder status, [PROTOTYPE] labels
- **Risk**: Explicit anti-gaming, manual fallback, no reward leakage
- **Procurement**: N/A
- **Stakeholder**: Mumu consent + remote witness (CI)

## DevOps / CI/CD / Perf-QA

- Inherits R3 CI classifier (known B-bucket transparent)
- Local: npm test/check/llm:guidance/git diff --check + delivery-check (now includes proposal envelope)
- Future: + scoring test scaffold + delivery:check extension
- Remote: 4 rails after test fixture (G8R precedent)
- Metrics: Name, exact command, OS/Node/hardware, commit SHA, p50/p95, target, artifact path/hash, interpretation ("not yet measured" until evidence exists)

## Security / Consent / Claim

- Local-only for now
- Exact-string consent for any scoring write/state change
- Claim discipline: [PROTOTYPE] for boundary; no [DECLARED] on rewards/claims
- No public wording until later gates

## Non-Claims (Ihsān Discipline)

- Not live scoring
- No reward eligibility
- No token/reward
- No marketplace value
- No public economic signal
- No Node1/URP
- No Shariah-compliant scoring
- No date-certain
- DESIGNED_NOT_LIVE until full ladder

## Activation Gates (Gates after G8R + Proposal)

- G0: Proposal integrated in A+ (this step)
- G1: ADR-021 accepted (test boundary doc)
- G2: Scoring test scaffold (like impact-launchpad-mvp.test.js: 7 categories for scoring)
- G3: Local + 4 remote gates on scaffold commit
- G4: Mock scoring (after boundary proof)
- G5: ... (later gates for contracts/rewards)

## Consequences

- Positive: Safe progression; controls bound; blueprint consistency
- Costs: Speed deliberately reduced
- Risk: "Score" misread as reward (mitigated by explicit "does not mean" + labels)

## Next Ultra-Micro (per ladder + blueprint)

GO: AUTHOR ADR-021 SCORING BOUNDARY TEST SCAFFOLD (doc + minimal test categories, no impl)

(After this: prove in A+, then unlock mock scoring, etc.)

---
