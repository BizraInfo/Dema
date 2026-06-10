# ADR-020: Impact Launchpad MVP Test Boundary

**Status:** Proposed
**Date:** 2026-06-07 GST
**Decision makers:** Mumu (Mohamed Beshr)
**Supersedes:** none
**Related:** [Impact Launchpad Claims Ledger v0.1](../claims/CLAIMS_LEDGER_IMPACT_LAUNCHPAD_v0.1.md), [ADR-019 Impact Launchpad MVP Contract Boundary](ADR-019-impact-launchpad-mvp-contract-boundary.md), [ADR-006 Continuous Assurance and No-Mint Verification](ADR-006-continuous-assurance-and-no-mint-verification.md), [ADR-009 Proof-of-Impact Design](ADR-009-poi-proof-of-impact-design.md), [Genesis Block v0.1](../genesis/BIZRA_GENESIS_BLOCK_v0.1.md), [Node0 Dema URP Flagship DOD](../NODE0_DEMA_URP_FLAGSHIP_DOD.md), [Claim Register v0.1](../CLAIM_REGISTER_v0_1.md), [Delivery Spine v0.1](../DELIVERY_SPINE_v0_1.md), [Delivery Blueprint](../DELIVERY_BLUEPRINT.md) [DECLARED]
**Implements:** a docs-only test boundary for the Impact Launchpad MVP. No test fixtures, no implementation, no scoring, no token logic, no reward eligibility, no marketplace, no public economic claims, no CI workflow changes, and no runtime behavior are introduced by this ADR. [DECLARED]
**Evidence:** commit `eac8627d34b1ceead85c128d109a495fec6d02b8` established `G5R_ADR019_IMPACT_MVP_BOUNDARY_REMOTE_GREEN` with remote success on `gitleaks`, `CodeQL`, `BIZRA Review Gate` (27079506841), and `check` (27079506847).

---

## Operating canon

```text
Claim boundary -> ADR boundary -> test boundary -> implementation boundary -> receipt boundary -> public wording boundary.
```

The Impact Launchpad must not move from vision or boundary definition into untested implementation. The MVP test boundary is the professional interface that forces every future behavior to be proven against the claim and contract boundaries before code lands.

In this ADR, "test boundary" means the categories, assertions, refusal paths, and evidence expectations that must exist before any implementation slice is admissible. It does not mean implemented fixtures, harness changes, or CI edits.

## Context

The repository has a remote-green governance baseline for the Impact Launchpad surface:

1. Impact Launchpad Claims Ledger (remote-green) defines source-chained claim rows, Proof-of-Truth gates, SNR filter, non-claims, and promotion rules.
2. ADR-019 (remote-green) defines the MVP as a local, consent-bound contribution proposal and review-envelope contract. It explicitly forbids reward eligibility, token logic, marketplace behavior, public economic claims, Node1 connection, public URP bridge, smart contracts, and Shariah/legal certification until separate proof and review. [DECLARED]
3. Genesis Block, Node0 URP Flagship DOD, CLAIM_REGISTER, DELIVERY_SPINE, and DELIVERY_BLUEPRINT already codify the claim-first, MBOK-aligned, DevOps/CI/CD/perf-QA, consent-bound, no-mint posture. [DECLARED]

The next architectural risk is implementation pressure on the test surface. Without an explicit test boundary, future work could:

- Write tests that assume reward eligibility or scoring exists. [DECLARED]
- Omit refusal tests for token/marketplace/public-claim language. [DECLARED]
- Treat green tests as proof of economic or legal properties.
- Introduce fixtures that implicitly create economic state or bypass consent.

## Problem

ADR-019 gives the "what" (the contract boundary). The project now needs the "how we will know it is respected" before any code is written.

Without ADR-020:

- Test writers have no canonical list of required assertions.
- Forbidden promotion paths may not be tested.
- Claim label and consent enforcement may be assumed rather than proven.
- Future performance or receipt expectations may be invented ad-hoc.
- The "test boundary before implementation" canon from the operating law would be violated.

The smallest professional artifact that prevents this is a docs-only test-boundary ADR that lists exactly what must be proven, what must be refused, and what gates must pass before implementation begins. [DECLARED]

## Decision

Accept this proposed test boundary for the Impact Launchpad MVP:

```text
Before any implementation of proposal intake, review envelopes, or related surfaces, BIZRA will author a test boundary ADR that defines the categories, assertions, refusal paths, receipt expectations, and non-claim guards required to prove the local, consent-bound, no-token, no-reward, no-marketplace, no-public-economic-claim contract defined in ADR-019.
```

The future MVP test surface may define:

- Claim label validation tests.
- Forbidden promotion rejection tests (token, reward, marketplace, public launch, Shariah certification, smart contract, Node1, public URP bridge, runtime minting from Dema). [DECLARED]
- Consent requirement checks (exact-string before any write or state change).
- Review-boundary checks (proposal vs. review vs. decision separation).
- Receipt schema and expectation tests (local write/list/verify symmetry, content-addressing, truth labels).
- Non-claim regression tests (ensure no accidental economic or authority claims leak into test data or assertions).
- Future performance measurement test skeletons (metric name, command, context, p50/p95, threshold, artifact, interpretation) — marked as "not yet measured" until real artifacts exist.

The future MVP test surface must not define or assume:

- Reward eligibility computation or scoring. [DECLARED]
- Token minting, value, airdrop, presale, rebate, yield, or return semantics. [DECLARED]
- Marketplace behavior or public submission flows.
- Node1 connection or public URP bridge.
- Legal approval or Shariah certification.
- Runtime execution or federation.
- CI workflow changes or new gates without separate typed GO.
- Public economic wording or launch claims.

## Minimal solvable special case

The smallest useful artifact after this ADR is the test-boundary document itself. No fixtures, no test files, no harness changes.

Required truth label for any future implementation sentence:

```text
DESIGNED_NOT_LIVE
```

Allowed next sentence after remote-green of this ADR:

```text
Tests for the Impact Launchpad MVP proposal and review-envelope surfaces will be authored against the categories and refusal paths defined in ADR-020, subject to claim:check, local gates, and the four remote CI rails before any code lands.
```

Forbidden stronger sentence:

```text
Impact Launchpad tests prove reward eligibility or token behavior.
```

## Required Test Categories

1. Claim label tests (every proposal and review envelope must carry valid, sourced, labeled claims; invalid or unlabeled claims are rejected).
2. Forbidden promotion tests (explicit rejection of token, reward, marketplace, public launch, Shariah certification, smart contract, Node1, public URP bridge, runtime minting from Dema language or assumptions). [DECLARED]
3. Consent boundary tests (exact-string consent required before any local write, state change, or receipt; missing or wrong consent is refused).
4. Review boundary tests (proposal intake, validation, review candidate shape, and decision separation are distinct; no conflation of stages).
5. Receipt expectation tests (local receipt shapes, content-addressing, truth labels, no-mint invariants, and read/list/verify symmetry). [DECLARED]
6. Non-claim regression tests (ensure no accidental economic, authority, or public-claim leakage into test data, assertions, or documentation).
7. Future performance measurement test skeletons (define the required artifact fields for any future metric; current state is "not yet measured").

## Required Gates (before any implementation)

Local:

- npm test
- npm run check
- npm run llm:guidance
- git diff --check
- npm run claim:check -- docs/06-adr/ADR-020-impact-launchpad-mvp-test-boundary.md

Remote (the four rails):

- check
- BIZRA Review Gate
- gitleaks
- CodeQL

Activation rule: Implementation of any Impact Launchpad proposal intake, review envelope, or related surface may not begin until ADR-020 is remote-green and a separate typed GO for the implementation slice is recorded.

## MBOK alignment (summary)

| Management domain | Test boundary control                                                                                             |
| ----------------- | ----------------------------------------------------------------------------------------------------------------- | ---------- |
| Integration       | Binds claim, consent, review, receipt, and non-claim assertions into one canonical test list before code.         |
| Scope             | Only local proposal/review surfaces; splits out reward, token, marketplace, public, Node1, contracts.             | [DECLARED] |
| Quality           | Requires explicit refusal tests and non-claim regressions; forbids assuming economic properties.                  |
| Risk              | Surfaces economic, legal, Shariah, runtime, and public-claim risks as test obligations and forbidden assumptions. |
| Communications    | Every test category and refusal path must be traceable to the Claims Ledger and ADR-019.                          |

(Full 10-domain mapping follows the pattern established in ADR-019.)

## DevOps, CI/CD, and performance-quality gates

This ADR inherits the Delivery Spine and ADR-019 gates. No CI workflow is edited. Any future test harness or fixture work requires a separate typed GO and must pass the four remote rails on its own commit.

Performance: Any future performance test for this surface must carry the artifact fields defined in ADR-019 (metric name, exact command, context, p50/p95, target/threshold, artifact path/hash, interpretation). Until real artifacts exist, performance is labeled "not yet measured."

## Security, consent, and claim constraints

- Local state only under DEMA_HOME or ~/.dema. [DECLARED]
- Exact-string consent before any local write or state change in future tests.
- No secrets in test data or fixtures.
- Every test category and assertion must carry claim labels, source paths or UNKNOWN, evidence gates, and forbidden promotion notes.
- No raw private data or hidden state in review envelopes or test expectations.

## Non-claims

This ADR does not claim:

- Impact Launchpad tests exist or have been written.
- Reward eligibility, token behavior, marketplace, or public economic properties can be tested. [DECLARED]
- Any scoring, PoI implementation, or contract exists.
- Shariah, legal, or financial certification is in scope.
- Node1 or public URP bridge behavior is testable.
- CI or runtime changes are authorized.

## Consequences

Positive:

- Future implementation has a canonical, reviewable list of what must be proven and refused.
- The claim and contract boundaries from prior artifacts become enforceable at the test layer.
- The "test boundary before implementation" canon is made concrete for this surface.
- Economic, legal, Shariah, and public-claim risks are surfaced as explicit test obligations rather than implicit assumptions.

Costs:

- Implementation speed is deliberately gated behind test-boundary proof.
- MVP test scope is narrow (local proposal/review only). [DECLARED]
- Future contributors must route test ideas through the same claim/ADR discipline.

Risk:

- Reviewers may read "test boundary" as "implemented test suite." This ADR resolves that by remaining docs-only and requiring a separate remote-green step before fixtures or code. [DECLARED]

## Next micro

After this proposed ADR is reviewed and remote-green, the next safe artifact is a fixture-only test file (or the contribution proposal flow spec) that implements the categories and refusal paths defined here. No contracts, no scoring, no token logic. [DECLARED]

---

**End of ADR-020.**
