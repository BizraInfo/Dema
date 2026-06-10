# ADR-019: Impact Launchpad MVP Contract Boundary

**Status:** Proposed
**Date:** 2026-06-07 GST
**Decision makers:** Mumu (Mohamed Beshr)
**Supersedes:** none
**Related:** [ADR-006 Continuous Assurance and No-Mint Verification](ADR-006-continuous-assurance-and-no-mint-verification.md), [ADR-009 Proof-of-Impact Design](ADR-009-poi-proof-of-impact-design.md), [Delivery Spine v0.1](../DELIVERY_SPINE_v0_1.md), [Delivery Blueprint](../DELIVERY_BLUEPRINT.md), [Claim Register v0.1](../CLAIM_REGISTER_v0_1.md), [Impact Launchpad Claims Ledger v0.1](../claims/CLAIMS_LEDGER_IMPACT_LAUNCHPAD_v0.1.md), [Genesis Block v0.1](../genesis/BIZRA_GENESIS_BLOCK_v0.1.md), [Node0 Dema URP Flagship DOD](../NODE0_DEMA_URP_FLAGSHIP_DOD.md) [DECLARED]
**Implements:** a docs-only contract boundary for the future Impact Launchpad MVP. No runtime, smart contract, token logic, reward eligibility logic, marketplace behavior, CI workflow edit, or public economic claim lands under this ADR. [DECLARED]
**Evidence:** commit `1f9e1c52b67568a3b2bd12e00afa6bf686709fd9` established `G4B_CLAIMS_LEDGER_IMPACT_LAUNCHPAD_REMOTE_GREEN` with remote success on `check` (`27077921209`), `BIZRA Review Gate` (`27077921202`), `gitleaks` (`27077921211`), and `CodeQL` (`27077921207`).

---

## Operating canon

```text
Claim boundary -> ADR boundary -> test boundary -> implementation boundary -> receipt boundary -> public wording boundary.
```

The Impact Launchpad must not move directly from vision into contract code,
marketplace code, reward language, or public economic claims. The MVP boundary [DECLARED]
is the professional interface that prevents that jump.

In this ADR, "contract" means a software and governance contract: schemas,
interfaces, gates, authority limits, test obligations, and review boundaries.
It does not mean a legal contract, Shariah certification, securities opinion,
or blockchain smart contract.

## Context

The repository is past recovery mode and has a remote-green governance baseline:

1. Genesis Block and Node0 DOD were committed and remotely verified.
2. The Impact Launchpad Claims Ledger was committed and remotely verified.
3. Dema's Delivery Spine and Delivery Blueprint already define the repo's
   DevOps, CI/CD, release, rollback, and performance-quality posture.
4. ADR-009 defines Proof-of-Impact as `DESIGNED_NOT_LIVE` and preview-only. [DECLARED]

The next architectural risk is implementation pressure. Impact Launchpad
language touches contribution review, impact evidence, possible future reward [DECLARED]
eligibility, legal review, Shariah review, marketplace language, and token [DECLARED]
language. Without a narrow boundary, a future implementation could accidentally
turn a proposal lane into an economic claim.

## Problem

The project needs a full-stack MVP blueprint, but the dangerous word is
"full-stack." For this surface, full-stack does not mean every layer is live.
It means every layer has an explicit boundary before the first implementation [DECLARED]
slice begins.

Without this ADR:

1. A contribution proposal flow could be mistaken for live Impact Launchpad.
2. A review receipt shape could be mistaken for reward eligibility. [DECLARED]
3. A future schema could imply token, payout, or marketplace semantics. [DECLARED]
4. CI success could be mistaken for Node0 authority.
5. Public wording could outrun legal, Shariah, and proof review.
6. Performance-quality claims could appear before a metric artifact exists.

The project needs the smallest professional boundary that lets future work
proceed while preserving the no-token, no-reward, no-public-financial-claim [DECLARED]
discipline already established by the Claims Ledger.

## Decision

Accept this proposed boundary for the Impact Launchpad MVP:

```text
The MVP is a local, consent-bound contribution proposal and review-envelope
contract. It is not a launchpad runtime, not a marketplace, not a scoring
engine, not reward eligibility, not token logic, not a public bridge, and not a
smart contract.
```

The future MVP may define:

- a local contribution proposal draft envelope,
- a local proposal validation surface,
- a review-envelope candidate shape,
- refusal paths for token, reward, value, marketplace, and public launch claims, [DECLARED]
- tests that prove those refusals,
- CI witness gates that prove the repo state,
- operator consent phrases for any local write.

The future MVP must not define:

- reward eligibility computation, [DECLARED]
- Proof-of-Impact scoring implementation,
- token minting, token value, airdrop, presale, rebate, yield, or return, [DECLARED]
- public marketplace behavior,
- Node1 connection,
- public URP bridge behavior,
- legal approval,
- Shariah certification,
- runtime receipt minting from Dema, [DECLARED]
- smart contract deployment.

## Minimal solvable special case

The smallest useful implementation target after this ADR is one local proposal:

```text
Operator drafts contribution proposal C for future Impact Launchpad review.
```

At MVP boundary level, that produces only a local draft or validation envelope. [DECLARED]
It does not submit the proposal to a network, assign a reviewer, compute impact,
mark reward eligibility, mint a receipt, or publish a claim. [DECLARED]

Required truth label:

```text
DESIGNED_NOT_LIVE
```

Allowed next sentence:

```text
Dema can draft a local proposal envelope for future Impact Launchpad review,
subject to exact consent and proof-safe claim labels.
```

Forbidden stronger sentence:

```text
Dema runs Impact Launchpad or makes contributions reward-eligible.
```

## Full-stack boundary map

| Layer             | MVP boundary                                                                            | Forbidden promotion                                                                            |
| ----------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Product face      | Dema may preview and draft local proposal envelopes after exact consent.                | Claiming live launchpad, public submission, or marketplace behavior.                           |
| Domain model      | Contribution proposal, review candidate, claim label, evidence pointer, consent phrase. | Impact scoring, reward eligibility, token metadata, or public economic state. [DECLARED]       |
| Data contract     | Schema-tagged local envelopes with explicit non-claims and source paths.                | Economic ledger, balance ledger, token ledger, or investment record. [DECLARED]                |
| Application logic | Validate fields, classify claims, refuse forbidden wording, preserve local boundary.    | Runtime execution, federation, external post, reviewer assignment, payout, or mint. [DECLARED] |
| Security          | No secrets, no network, no hidden daemon, no path escape, no unmanaged writes.          | Remote provider call, raw private data publish, hidden state, or credentials in docs.          |
| DevOps            | Local gates plus existing four remote CI witnesses.                                     | CI minting canonical receipts, deploying contracts, or publishing artifacts. [DECLARED]        |
| QA                | Refusal-path tests and claim-gate tests before any implementation acceptance.           | Treating green tests as legal, Shariah, financial, or runtime proof.                           |
| Observability     | Local CLI/report evidence only; receipts are read/list in Dema.                         | Hidden telemetry or Dema-issued governed-runtime receipts. [DECLARED]                          |
| CD                | None configured. Publication requires a separate typed GO.                              | Auto-deploy, auto-publish, installer release, or network bridge activation.                    |

## MBOK alignment

| Management domain | Impact Launchpad control                                                                                             |
| ----------------- | -------------------------------------------------------------------------------------------------------------------- |
| Integration       | This ADR binds claims, delivery, security, QA, and implementation order before code.                                 |
| Scope             | MVP is proposal-envelope and review-envelope boundary only. Mixed token or marketplace work is split out. [DECLARED] |
| Schedule          | No launch date is declared; readiness is gate-based.                                                                 |
| Cost              | No new dependency, service, network, or deployment surface is authorized.                                            |
| Quality           | Future implementation must add tests for valid proposal flow and forbidden promotion paths.                          |
| Resource          | No hidden daemon, background job, or public compute workload is introduced.                                          |
| Communications    | Every sentence about Impact Launchpad routes through the Claims Ledger labels.                                       |
| Risk              | Economic, legal, Shariah, public-claim, and runtime risks stay explicit.                                             |
| Procurement       | No third-party action, oracle, marketplace, chain, or contract provider is selected.                                 |
| Stakeholder       | Operator consent, technical review, legal review, Shariah review, and public claim approval remain distinct gates.   |

## DevOps and CI/CD gates

This ADR inherits the Delivery Spine rule:

```text
Node0 is authority. GitHub Actions is witness.
```

For this docs-only ADR slice, the local gate is: [DECLARED]

```bash
npm test
npm run check
npm run llm:guidance
git diff --check
```

For any future implementation slice, the minimum local gate becomes:

```bash
node --test tests/<impact-launchpad-surface>.test.js
npm test
npm run check
npm run llm:guidance
npm run delivery:check
git diff --check
```

For any future release or public-facing promotion, add:

```bash
npm run release:readiness
npm run gtm:readiness
npm run claim:check
```

The remote witness gate remains the existing four rails:

- `check`
- `BIZRA Review Gate`
- `gitleaks`
- `CodeQL`

This ADR does not edit `.github/workflows/*.yml`. Any future workflow edit
requires a separate typed GO and must follow the CI/CD Pipeline workflow-change
authorization gate.

## Performance-quality assurance

No new performance number is declared by this ADR.

Any future performance metric for Impact Launchpad must include:

- metric name,
- exact command,
- OS, Node version, and relevant local hardware context,
- commit SHA,
- p50 and p95 where applicable,
- target and regression threshold,
- artifact path or hash,
- reviewer-readable interpretation.

Until those fields exist, Impact Launchpad performance may be described only as [DECLARED]
`not yet measured`.

## Security and privacy constraints

Future implementation must enforce:

1. Local state only under `DEMA_HOME` or `~/.dema`. [DECLARED]
2. No network access in the proposal draft path.
3. No secrets in proposals, fixtures, logs, CI summaries, or docs.
4. No hidden persistence.
5. Exact-string consent before any local write.
6. Claim-register classification before external wording.
7. No raw private data in review envelopes unless a future consent and redaction
   model is separately authorized.

## Claim and consent constraints

Every future Impact Launchpad proposal must carry:

- claim label,
- source path or `UNKNOWN`,
- evidence gate,
- forbidden promotion,
- operator consent requirement,
- review boundary,
- next proof step.

No future implementation may reuse a broad consent phrase to authorize multiple
effects. Drafting, saving, submitting, publishing, reviewing, scoring, and any
future reward-eligibility action are separate effects and require separate [DECLARED]
consent boundaries.

## Activation gates

Implementation may begin only when all of these hold: [DECLARED]

| Gate | Requirement                                                                                                                                                                           |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G0   | Claims Ledger is remote-green.                                                                                                                                                        |
| G1   | This ADR is accepted by explicit operator typed GO or an equivalent reviewed commit.                                                                                                  |
| G2   | Contribution proposal flow spec exists and links to this ADR.                                                                                                                         |
| G3   | Test plan includes valid path, malformed path, forbidden reward claim, forbidden token claim, public launch overclaim, missing consent, path escape, and no-network cases. [DECLARED] |
| G4   | Future code touches only Dema product-face surfaces; no runtime, federation, economy, or CI workflow edit is bundled. [DECLARED]                                                      |
| G5   | Local gates pass and the four remote CI rails pass on the implementation commit.                                                                                                      |
| G6   | Public economic wording remains blocked until legal and Shariah review boundaries are documented and approved.                                                                        |

If any gate fails, the slice is deferred rather than weakened.

## Non-claims

This ADR does not claim:

- Impact Launchpad is live.
- Proof-of-Impact is implemented.
- Any contribution can receive rewards. [DECLARED]
- Any reward eligibility exists. [DECLARED]
- Any token exists. [DECLARED]
- Any token has value. [DECLARED]
- Any marketplace exists.
- Any public URP bridge exists.
- Node1 is connected.
- Any legal approval exists.
- Any Shariah certification exists.
- Any smart contract is selected, written, audited, deployed, or planned for a
  date-certain launch.

## Consequences

Positive:

- Future Impact Launchpad implementation has a safe, reviewable starting point.
- DevOps, CI/CD, QA, security, consent, and claim controls are bound before code.
- The Claims Ledger becomes enforceable design input, not just narrative.
- Token and reward language remain quarantined until proof and review exist. [DECLARED]

Costs:

- Implementation speed is deliberately reduced by explicit gates.
- MVP scope is smaller than the broader vision.
- Future contributors must route economic ideas through claim labels before code.

Risk:

- Reviewers may read "contract boundary" as "smart contract." This ADR resolves
  that by defining contract as software and governance interface only. [DECLARED]

## Next micro

After this proposed ADR is reviewed and accepted, the next safe implementation
artifact is:

```text
GO: AUTHOR IMPACT LAUNCHPAD CONTRIBUTION PROPOSAL FLOW SPEC
```

That spec should define the proposal envelope, validation rules, refusal tests,
and review-envelope candidate shape. It must not implement scoring, token logic, [DECLARED]
marketplace behavior, public submission, or reward eligibility. [DECLARED]

---

**End of ADR-019.**
