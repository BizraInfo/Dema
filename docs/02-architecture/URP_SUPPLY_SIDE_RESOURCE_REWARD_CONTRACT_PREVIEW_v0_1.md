# URP-SUPPLY-SIDE-RESOURCE-REWARD-CONTRACT-PREVIEW-1A

Truth label: `URP_SUPPLY_REWARD_CONTRACT_PREVIEW_ONLY` — `PREVIEW_ONLY` / `DESIGNED_NOT_LIVE`.

## Purpose

Price **verified supply, not promised impact.** The supply-side reward contract, encoded as a preview
so the market law can be proven before a market opens. A resource provider earns base value from
verified supply/availability/service; proving humanitarian impact is not the provider's burden — the
impact dividend is extra and requires a verified outcome that SAT audits.

```text
Provider supplies (honestly)  →  URP allocates  →  SAT verifies  →  reward for VERIFIED supply/service
                                                                      + optional impact dividend (verified outcome only)
```

## Input contract — a resource offer

```js
{
  resource_class,        // compute | memory | storage | model | tool | data | artifact | human_attention
  offered_capacity,      // measured capacity (≥ 1000 ⇒ high-value, needs a SAT audit ref)
  consent_scope,
  availability_window,
  measured_uptime,       // required measurement
  served_units,          // required measurement
  quality_score,
  failure_count,
  policy_violation_count, // > 0 ⇒ rejected
  claimed_impact,
  verified_impact_evidence_refs: [], // required for the impact dividend
  sat_audit_ref,         // required for high-value offers
}
```

## Output contract

```text
resource_class
reward_types { verified_supply_reward · verified_availability_reward · verified_usage_reward · optional_impact_dividend }
status  ∈ { reward_preview_allowed, blocked_pending_consent, blocked_pending_measurement,
            blocked_pending_sat_audit, rejected_overclaim, rejected_policy_violation }
blocked_by[] · rejected_by[]
invariants { cost_measured_is_not_impact · supply_reward_is_not_impact_claim · impact_dividend_requires_verified_outcome · … }
grants_action: false · authority_delta: 0 · mint_allowed: false · boundary: all-false · content_hash
```

## Invariants (the market discipline)

- **Cost measured is not impact.** A cost-labeled-as-impact offer is rejected.
- **Supply reward is not an impact claim.** A supply reward mislabeled as impact is rejected.
- **Impact dividend requires a verified outcome.** Claimed impact without evidence → blocked pending SAT audit.
- **No self-mint, no live URP, no wallet, no federation, no authority increase** — each rejected.
- `mint_allowed:false` always. Unverified reward would be riba; nothing mints here.

## Boundaries

- Pure kernel; no fs/network/clock/random. No model invocation, no settlement, no payment.
- `PREVIEW_ONLY` / `DESIGNED_NOT_LIVE`: previews eligibility; does not open a live market.
- Boundary all-false, `authority_delta:0`, `grants_action:false`, `mint_allowed:false`.

## Files

```text
packages/core/src/urp-supply-side-resource-reward-contract-preview.js
tests/urp-supply-side-resource-reward-contract-preview.test.js
scripts/review/urp-supply-side-resource-reward-contract-preview-check.mjs
scripts/check.mjs
packages/core/src/dema-capability-truth-registry.js
docs/receipts/URP_SUPPLY_SIDE_RESOURCE_REWARD_CONTRACT_PREVIEW_1A.md
docs/02-architecture/URP_SUPPLY_SIDE_RESOURCE_REWARD_CONTRACT_PREVIEW_v0_1.md
```
