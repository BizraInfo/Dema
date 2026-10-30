# Phase 03 · Seed Scaling Law (nodes ≠ chains)

**Status:** DESIGNED_NOT_LIVE  
**Code hook:** `previewSeedScale(N)` in habitat-actor-party-ontology

## Equation (design)

```
Node_i ⇒ (1 Dema + 7 PAT)_private  +  (5 SAT + Δcompute + Δskills)_URP_design
At N = 1_000_000 ⇒ 5_000_000 SAT slots in design inventory — NOT LIVE
```

## Why this is SNR-high

Fixes Web2 central bottleneck narrative and Web3 duplicate-state tax **as architecture intent**. Convergence level today: **1 documented / 2 prototype math** — not 4 reproducible cluster.

## Failure / halt

- Never mint SAT identities without typed GO + signer path
- Never claim pooled VRAM or 70B RPC until MEASURED on disk
- Genesis creator enters URP as a normal Player (equal law)

## Validation

```
assert previewSeedScale(1).urp_sat_slots === 5
assert previewSeedScale(10).private_pat_slots === 70
assert mode === PREVIEW_ONLY
```
