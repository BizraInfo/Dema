# Dual Token Proof-of-Impact Economy v0.1

**Slice:** `DUAL-TOKEN-POI-ECONOMY-CANON-1A`
**Status:** `DESIGNED_NOT_LIVE`
**Implementation:** docs plus pure local preview kernel only

This document defines the Dema-side canon for the BIZRA dual-token economy. It does not activate a token economy, wallet, public sale, exchange, chain deployment, live Proof-of-Impact runtime, or validator network.

## Truth Labels

| Surface | Label |
| --- | --- |
| Dual-token PoI economy | `DESIGNED_NOT_LIVE` |
| PoI mint preview | `ECONOMY_SIMULATION_ONLY` |
| Live token mint | `BLOCKED_UNTIL_EXTERNAL_REVIEW` |
| BZR-C | `DESIGNED_UTILITY_TOKEN` |
| BZR-I | `DESIGNED_IMPACT_REPUTATION_TOKEN` |

## Token Roles

`BZR-C` means BIZRA Capacity Token. It is the designed compute, service, storage, and execution utility layer. It can be previewed for service work, proof jobs, local indexing, and AaaS/RaaS-style execution, but it is not live money.

`BZR-I` means BIZRA Impact Token. It is the designed impact, knowledge, trust, and reputation layer. It can only be previewed from verified benefit. Cost, spend, intent, or agent self-assessment cannot create BZR-I.

## Mint Rule

The rule is deliberately simple:

```text
if ProofOfImpact.status != VERIFIED:
    simulated_mint = 0
```

Even when a receipt passes the local preview rule, `live_mint` remains `false`. A live mint design would require legal review, technical audit, Shariah review, wallet custody design, external validator policy, and governed PoI rails outside this repo.

## Required Gates

The local preview kernel requires all of the following declared inputs before it can produce non-zero simulated values:

- PoI claim schema: `bizra.poi.claim.v0.1`
- PoI status: `VERIFIED`
- FATE status: `PASS`, `PERMIT`, `VALIDATED`, or `VERIFIED`
- SAT status: `VALIDATED`, `PASS`, `PERMIT`, or `VERIFIED`
- Anti-abuse flags: proof, consent, impact score, completed job, quality threshold, and non-duplicate
- No agent self-reward attempt
- No cost-only or proof-of-spend-only value claim

## Formulas

```text
BZR-C preview =
base_capacity_units
* service_completion_score
* proof_confidence
* quality_multiplier
* anti_abuse_multiplier
* fairness_dampener

BZR-I preview =
impact_score
* beneficiary_weight
* durability_score
* additionality_score
* proof_confidence
* human_review_weight
* fairness_dampener
```

If Gini or concentration exceeds the configured threshold, the preview applies a fairness dampener. If any no-mint blocker fires, both simulated values become zero.

## Local Surfaces

- Kernel: `packages/core/src/dual-token-poi-economy.js`
- Mint rule wrapper: `packages/core/src/poi-mint-rule.js`
- Service ledger preview: `packages/core/src/service-economy-ledger.js`
- Review gate: `scripts/review/dual-token-poi-economy-check.mjs`
- Tests: `tests/dual-token-poi-economy.test.js`

## CLI

```bash
dema economy poi-mint-preview --impact-receipt <path> --json
```

The command reads one local JSON file and emits a deterministic preview envelope with `live_mint:false`, `no_wallet:true`, `no_sale:true`, and a replayable `receipt_hash`.

## Invariants

- Live total supply starts at zero.
- No verified PoI receipt means mint preview is zero.
- Cost and proof-of-spend receipts do not become impact value.
- Failed anti-abuse checks force zero simulated mint.
- Agents cannot self-reward.
- Every preview has a receipt hash.
- Simulation output cannot be treated as live token supply.
