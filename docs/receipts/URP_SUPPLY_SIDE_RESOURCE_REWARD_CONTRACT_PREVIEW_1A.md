# Receipt: URP-SUPPLY-SIDE-RESOURCE-REWARD-CONTRACT-PREVIEW-1A

Truth label: `URP_SUPPLY_REWARD_CONTRACT_PREVIEW_ONLY` — `PREVIEW_ONLY` / `DESIGNED_NOT_LIVE`.

## Slice

The public-market law for the URP supply side, encoded as a **preview** contract. It computes which
reward types a resource offer is **eligible** for — it mints nothing, settles nothing, pays no one,
activates no live URP.

## Market law

```text
Resource provider  → responsible for honest supply
URP                → responsible for useful allocation
SAT                → responsible for verification (allocation, usage, reward, claimed impact)
Reward             → for VERIFIED supply and VERIFIED service
Impact dividend    → EXTRA, requires a verified outcome — not the provider's base burden
```

The provider earns base value from verified supply/availability/service. The provider is **not**
responsible for proving humanitarian impact.

## Reward types (eligibility preview, not amounts)

1. `verified_supply_reward` — verified offered capacity
2. `verified_availability_reward` — measured uptime
3. `verified_usage_reward` — served units
4. `optional_impact_dividend` — extra, only with `verified_impact_evidence_refs`

## Hand-off status

`reward_preview_allowed` · `blocked_pending_consent` · `blocked_pending_measurement` ·
`blocked_pending_sat_audit` · `rejected_overclaim` · `rejected_policy_violation`

## Invariants (all enforced)

`cost_measured_is_not_impact` · `supply_reward_is_not_impact_claim` ·
`impact_dividend_requires_verified_outcome` · `no_self_mint` · `no_live_urp` · `no_wallet` ·
`no_federation` · `no_authority_increase` · boundary all-false · `authority_delta:0` ·
`grants_action:false` · **`mint_allowed:false`**.

## Proof Contract

17 focused tests + review gate. Content-addressed and stable. `verify` rejects a `mint_allowed`, a
`grants_action`, and a vacuous-boundary tamper. Genesis and public-node offer fixtures both pass as
preview-only.

`npm run check` runs `urp-supply-side-resource-reward-contract-preview-check.mjs`.

## What this proves

That the supply-side reward contract can be evaluated deterministically: verified supply/availability/
usage are eligible for base reward preview, an impact dividend requires a verified outcome, cost is not
impact, and overclaim/policy-violation/self-mint/live-URP/wallet/federation all reject — before any
market opens.

## What this does NOT prove

It does **not** activate live URP, mint, access a wallet, settle or pay, federate, invoke a model, or
touch the network. It previews *eligibility* under the contract; real settlement and real impact
require live URP + SAT audit, which remain `DESIGNED_NOT_LIVE`. Unverified reward would be riba — so
nothing mints here.

## Commands

```bash
node --test tests/urp-supply-side-resource-reward-contract-preview.test.js
node scripts/review/urp-supply-side-resource-reward-contract-preview-check.mjs --json
npm run check
```
