# ADR-009: Proof-of-Impact (POI) Design — pre-implementation specification

**Status:** Proposed
**Date:** 2026-05-18 (proposed)
**Decision makers:** Mumu (Mohamed Beshr)
**Supersedes:** none
**Related:** [ADR-001 Dema Is One Face](ADR-001-dema-is-one-face.md), [ADR-002 No Shadow State](ADR-002-no-shadow-state.md), [ADR-006 Continuous Assurance and No-mint Verification](ADR-006-continuous-assurance-and-no-mint-verification.md), [ADR-008 Runtime Activation](ADR-008-runtime-activation.md)
**Implements:** the design contract for the 7th BIZRA pillar (POI) referenced in ADR-008 §C4 and the Third Fact manifest. Implementation is deferred to a separate scoped GO.
**Evidence:** `docs/public/third-fact-v0.1.md` §213-229 (canonical economic flow, Bitcoin-anchored at block 948027 + 948029); `packages/core/src/profiles.js` (commit `9a8389e`, 2026-05-18) `buildUserProfile` `node_uid` primitive that POI scoring will reference; `docs/canon/BIZRA_TOPOLOGY_CANON.md` §"Node ordinal law" and §"Seed-pattern invariant" (companion canon for what every node carries).

---

## Context

POI is the 7th pillar in the canonical 7-pillar BIZRA architecture (PAT · SAT · DEMA · FATE · URP · RECEIPTS · POI). The Third Fact public manifest (`docs/public/third-fact-v0.1.md`) lines 213-229 specify the canonical economic flow:

```text
Contribution → Verification → Receipt → Impact Score → Reward Eligibility
        ↑              ↑           ↑          ↑                 ↑
        already        already     chain      POI               proof
        possible       implemented exists     (this ADR)        gates
        (PAT × 7)      (SAT-1..5)  (17 IRONCLAD                  before
                                    receipts as                  reward
                                    of HEAD                      can fire
                                    1831aa9)
```

Three of the five stations are operational at HEAD `1831aa9`. The POI station is the unbuilt bridge between a verified receipt and an impact score that could *eventually* gate reward eligibility. The fifth station (proof gates → reward) is downstream of POI and out of scope for this ADR.

## Problem

Without an explicit design for POI:

1. The Third Fact's economic line ("verified useful impact may earn reward eligibility after proof gates") has no implementable target. Reviewers asking "how is impact computed?" have no canonical answer.
2. ADR-008's runtime activation completed 12 components, all of which produce receipts. None of those receipts know how to express **impact**. The receipt-mint integration (C12) prepares mint requests; it does not score them.
3. The risk surface for ad-hoc POI activation grows with every shipped slice. The longer POI lacks a design, the more likely an implementation slips in via a side-channel (e.g., a "useful contribution" counter that becomes a reward function in disguise).
4. The dual-token question (raised separately) cannot be evaluated without a single-track POI design as baseline. Dual-token vs single-token only becomes a real choice once the single-token shape is explicit.

## Design

This section specifies the POI design as a contract. No code lands under this ADR.

### Definition

**Proof-of-Impact (POI)** is the canonical mapping from a verified receipt chain to a per-`node_uid` impact score. POI is:

- **Proof-gated:** every input to a POI score is itself receipt-bound (the chain at HEAD `1831aa9` carries 18 receipts; each is sha256-chained to its predecessor).
- **Local-first:** every node computes its own POI score from its own receipts. There is no shared ledger before federation.
- **Verification-only at v0.1:** no reward, no payout, no token issued. POI v0.1 is a preview score, schema-tagged, deep-frozen, no I/O.
- **Riba-Zero coherent:** no time-decay extraction. Score depends on receipt content + receipt cryptographic position, not on receipt age or time-held.

### Canonical input shape

```text
POI input         = ordered list of (receipt_id, content_hash, prev_hash, evidence_hash) tuples
                    from a node's local receipt chain (~/.dema/agents/dema.node0_mission_agent/
                    or .proof-forge/receipts/, depending on chain context)

POI per-receipt   = a single-receipt impact contribution score, computed from:
                      • receipt-shape canonicality (passes SAT-1 boundary check)
                      • receipt-content discipline (passes SAT-3 doctrine check)
                      • receipt-chain integrity (passes SAT-4 chain verifier)
                      • declared contribution intent (PAT-1 mission-scribe origin)

POI per-node      = aggregated function over per-receipt scores AND per-receipt distinctness
                    (one receipt contributes ≤ 1 score · no duplicate mint, no replay)

POI envelope      = {
                      schema:      "bizra.dema.poi_preview.v0.1",
                      truth_label: "NODE0_LOCAL_SEED",
                      mode:        "preview_only",
                      node_uid:    "<from buildUserProfile>",
                      receipt_count: N,
                      poi_score_preview: float,
                      score_method: "v0.1-canonical",
                      boundary:    <canonical 16-key, all false>
                    }
```

### Canonical refusals (binding at v0.1)

POI v0.1 MUST refuse:

1. **Reward issuance.** No token, no payment, no IMP unit, no entitlement claim.
2. **Cross-node score comparison.** Two POI scores from different nodes cannot be compared at v0.1 — federation has not yet shipped (`federation_invoked` is canonically `false`).
3. **External attestation.** POI scores are not published, broadcast, or signed for external consumption at v0.1.
4. **Time-weighted scoring.** No bonus for "earliest contribution" or "longest holder" — Riba-Zero invariant.
5. **Speculation surface.** No `expected_future_poi`, no `poi_velocity`, no `poi_appreciation`. POI is what *has been verified*, not what *might be*.

### Five rules of POI v0.1

1. **POI is a function of receipts, not of intent.** Stated intent does not score. A receipt-shaped, doctrine-coherent emission scores.
2. **POI is computed locally.** Federation extends the score-sharing surface, not the score-computation primitive.
3. **POI is deterministic.** Same receipt chain → same POI score, always. No randomness, no clock dependency.
4. **POI is non-mutable.** A receipt's contribution to POI is fixed at mint time. Re-scoring an already-minted receipt is forbidden.
5. **POI is bounded.** Every POI computation emits the canonical 16-key boundary. POI is preview-only at v0.1.

### Design upstream of POI (already shipped)

- `node_uid` primitive — every receipt-emitting source has a stable identifier. Shipped in v0.1a (commit `9a8389e`).
- Node ordinal law — companion device receipts attribute to the same ordinal but distinct uid. Canonized in v0.1b (commit `1831aa9`).
- Seed-pattern invariant — every node carries the full POI shape, not a subset. Canonized in v0.1b extension (this turn).
- Receipt chain — 18 receipts at HEAD `1831aa9`, IRONCLAD #17 + #18 anchored.

### Design downstream of POI (not yet considered)

- **Reward function** (impact-score → entitlement) — out of scope for this ADR. Requires its own ADR-010+ after POI v0.1 ships.
- **Federated POI aggregation** — out of scope. Requires Ring-2+ design partner cohort and ADR amendment.
- **Dual-token derivation** — a dual-token design would consume POI scores as one of its inputs. POI v0.1 must ship before dual-token can be evaluated against a real baseline.

## Constraints (binding)

| ID | Constraint | Rationale |
|---|---|---|
| POI-C1 | No reward issuance at v0.1 | RIBA_ZERO invariant; Founder Asset Inventory v0.3 50% pool oath does not activate before proof |
| POI-C2 | No public economic claim | Third Fact §229 binding ("makes no token, payout, income, IMP, or live economic claim") |
| POI-C3 | No cross-node comparison | federation_invoked = false canonically at v0.1 |
| POI-C4 | No time-weighted scoring | Riba-Zero invariant — no value extraction from time-decay |
| POI-C5 | Receipt-bound inputs only | Every POI input must already exist as a verified receipt |
| POI-C6 | Preview-only emission | mode: "preview_only" · canonical 16-key boundary all-false |
| POI-C7 | Deterministic | same chain → same score · no randomness · no clock dependency |
| POI-C8 | Master Craftsmanship binding | when POI lands, all 10 invariants must hold (see ADR-008) |

## Implementation activation gates (when POI v0.1 can land)

POI v0.1 implementation may begin only when ALL the following hold:

```text
Gate 1   Ring-1 N=1 reviewer has engaged with Lighthouse Pack v1.0
         and provided written feedback on the proof discipline.

Gate 2   v0.1c onboarding has landed (POI must speak the user's language
         when surfacing scores; depends on profile.language wiring).

Gate 3   Operator types: GO impl POI v0.1
         (separate from this ADR's typed-GO authorization).

Gate 4   A v0.1 POI test plan exists with ≥ 15 adversarial tests:
         duplicate-receipt-replay refused · cross-node-comparison refused ·
         time-decay attempt refused · reward-issuance attempt refused ·
         unbounded-score refused · etc.

Gate 5   A Proof-Forge receipt is minted upon POI v0.1 implementation
         completion · linking the implementation diff to its verification
         commands.
```

If any gate fails to hold, POI implementation is deferred.

## Out of scope (binding)

- Dual-token design (see separate ADR if/when authorized)
- Token issuance of any kind
- Federated POI aggregation
- Reward eligibility computation
- POI-to-fiat or POI-to-crypto bridging
- Time-decay extraction mechanisms
- Public POI broadcast
- Cross-node POI comparison

## Decision

**Accept this design contract for POI v0.1.** No implementation lands under this ADR. Implementation is deferred to the activation gates above. This ADR establishes the canonical refusal-as-product taxonomy for POI: what POI is, what POI is not, and what POI v0.1 must never become.

The proposed status holds until either:
- Operator types `GO accept ADR-009` (promotes to Accepted), or
- An identified flaw in the design fires a typed `GO revise ADR-009 <reason>`.

## Consequences

**Positive:**

- POI now has a single canonical reference. Future reviewers asking "how does POI work?" can be pointed at one document.
- The single-track economic flow is now explicit, making the dual-token question evaluable against a real baseline.
- The v0.1a `node_uid` primitive's purpose becomes load-bearing: it is the score-attribution key for POI.
- The seed-pattern invariant becomes load-bearing: POI v0.1 ships at every node identically, no node has a "richer" POI surface than another at v0.1.

**Risks:**

- A reviewer or external observer may interpret the design as a *commitment* to ship POI. Document language must be clear: this is a design contract, not a roadmap commitment.
- The canonical refusals must hold under future scope pressure. If a future ADR proposes "small reward issuance for testnet," it must explicitly amend POI-C1, not silently violate it.
- A dual-token proposal that arrives before POI v0.1 implementation must be evaluated against this design as baseline, not as a parallel design.

**Open questions deferred:**

- What is the canonical `poi_score_preview` formula? (deferred to implementation slice · ≥ 3 alternatives must be evaluated; Riba-Zero + seed-pattern compatibility is the filter)
- How does POI handle receipts minted by previous Claude Code sessions (ADR-007 cross-session attribution)? (deferred · likely "all receipts on the local chain attribute to the local node_uid")
- How does POI integrate with the URP local resource pool (ADR-008 C7)? (deferred · likely "URP resources contributed are themselves receipt-emitting → POI sees them via receipts, not via direct URP read")

---

**End of ADR-009.**
